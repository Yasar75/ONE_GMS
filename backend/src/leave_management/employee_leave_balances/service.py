import calendar
import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Employee
from src.db.models import EmployeeLeaveBalance, LeaveType
from .schema import GenerateEmployeeLeaveBalanceRequest, ManualGrantLeaveBalanceRequest


class EmployeeLeaveBalanceService:
    @staticmethod
    def _q2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _days_in_year(year: int) -> int:
        return 366 if calendar.isleap(year) else 365

    def _calculate_prorated_leave(self, annual_days: Decimal, joining_date: date, year: int) -> Decimal:
        year_start = date(year, 1, 1)
        year_end = date(year, 12, 31)

        if joining_date > year_end:
            return Decimal("0.00")

        effective_start = max(joining_date, year_start)
        eligible_days = Decimal((year_end - effective_start).days + 1)
        total_days = Decimal(self._days_in_year(year))
        prorated = (annual_days * eligible_days) / total_days
        return self._q2(prorated)

    async def _get_previous_balance(self,session: AsyncSession,employee_uid: uuid.UUID,leave_type_uid: uuid.UUID,year: int):
        stmt = select(EmployeeLeaveBalance).where(
            EmployeeLeaveBalance.employee_uid == employee_uid,
            EmployeeLeaveBalance.leave_type_uid == leave_type_uid,
            EmployeeLeaveBalance.year == year - 1,
        )
        return (await session.exec(stmt)).first()

    async def _calculate_carry_forward(self,session: AsyncSession,employee_uid: uuid.UUID,leave_type: LeaveType,year: int):
        previous = await self._get_previous_balance(session, employee_uid, leave_type.uid, year)
        if not previous:
            return Decimal("0.00")

        remaining = (
            previous.opening_balance
            + previous.annual_allocation
            + previous.carry_forward_in
            + previous.manual_granted
            - previous.used_days
            - previous.pending_days
            - previous.lapsed_days
        )

        if remaining <= 0 or not leave_type.carry_forward_allowed:
            return Decimal("0.00")

        if leave_type.carry_forward_cap is not None:
            return self._q2(min(remaining, leave_type.carry_forward_cap))

        return self._q2(remaining)

    async def generate_balances(self,session: AsyncSession,data: GenerateEmployeeLeaveBalanceRequest,user_uid: uuid.UUID):
        emp_stmt = select(Employee)
        if data.employee_uid:
            emp_stmt = emp_stmt.where(Employee.uid == data.employee_uid)

        employees = (await session.exec(emp_stmt)).all()
        leave_types = (await session.exec(select(LeaveType).where(LeaveType.is_active == True))).all()

        if not employees:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee not found.")

        response_rows = []

        for employee in employees:
            if not employee.join_date:
                continue

            for leave_type in leave_types:
                if not leave_type.auto_allocate:
                    continue

                existing_stmt = select(EmployeeLeaveBalance).where(
                    EmployeeLeaveBalance.employee_uid == employee.uid,
                    EmployeeLeaveBalance.leave_type_uid == leave_type.uid,
                    EmployeeLeaveBalance.year == data.year,
                )
                existing = (await session.exec(existing_stmt)).first()

                if existing:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="This Leave type already generated for this year")

                annual_allocation = self._calculate_prorated_leave(
                    annual_days=leave_type.annual_days,
                    joining_date=employee.join_date,
                    year=data.year,
                )

                carry_forward_in = await self._calculate_carry_forward(
                    session, employee.uid, leave_type, data.year
                )

                balance = EmployeeLeaveBalance(
                    user_uid=user_uid,
                    employee_uid=employee.uid,
                    leave_type_uid=leave_type.uid,
                    year=data.year,
                    opening_balance=Decimal("0.00"),
                    annual_allocation=annual_allocation,
                    carry_forward_in=carry_forward_in,
                    manual_granted=Decimal("0.00"),
                    used_days=Decimal("0.00"),
                    pending_days=Decimal("0.00"),
                    lapsed_days=Decimal("0.00"),
                )
                session.add(balance)
                response_rows.append(balance)

        await session.commit()

        for row in response_rows:
            await session.refresh(row)

        return [
            {
                "uid": row.uid,
                "employee_uid": row.employee_uid,
                "leave_type_uid": row.leave_type_uid,
                "year": row.year,
                "opening_balance": row.opening_balance,
                "annual_allocation": row.annual_allocation,
                "carry_forward_in": row.carry_forward_in,
                "manual_granted": row.manual_granted,
                "used_days": row.used_days,
                "pending_days": row.pending_days,
                "lapsed_days": row.lapsed_days,
                "available_balance": self._q2(
                    row.opening_balance
                    + row.annual_allocation
                    + row.carry_forward_in
                    + row.manual_granted
                    - row.used_days
                    - row.pending_days
                    - row.lapsed_days
                ),
            }
            for row in response_rows
        ]

    async def manual_grant_leave(self,session: AsyncSession,data: ManualGrantLeaveBalanceRequest,user_uid: uuid.UUID):
        leave_type = (await session.exec(select(LeaveType).where(LeaveType.uid == data.leave_type_uid))).first()
        if not leave_type:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Leave type not found.")

        if not leave_type.requires_manual_grant:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="This leave type does not allow manual grant.")

        stmt = select(EmployeeLeaveBalance).where(
            EmployeeLeaveBalance.employee_uid == data.employee_uid,
            EmployeeLeaveBalance.leave_type_uid == data.leave_type_uid,
            EmployeeLeaveBalance.year == data.year,
        )
        balance = (await session.exec(stmt)).first()

        if not balance:
            balance = EmployeeLeaveBalance(
                user_uid=user_uid,
                employee_uid=data.employee_uid,
                leave_type_uid=data.leave_type_uid,
                year=data.year,
                opening_balance=Decimal("0.00"),
                annual_allocation=Decimal("0.00"),
                carry_forward_in=Decimal("0.00"),
                manual_granted=self._q2(data.days),
                used_days=Decimal("0.00"),
                pending_days=Decimal("0.00"),
                lapsed_days=Decimal("0.00"),
            )
            session.add(balance)
        else:
            balance.manual_granted = self._q2(balance.manual_granted + data.days)

        await session.commit()
        await session.refresh(balance)

        return {
            "uid": balance.uid,
            "employee_uid": balance.employee_uid,
            "leave_type_uid": balance.leave_type_uid,
            "year": balance.year,
            "opening_balance": balance.opening_balance,
            "annual_allocation": balance.annual_allocation,
            "carry_forward_in": balance.carry_forward_in,
            "manual_granted": balance.manual_granted,
            "used_days": balance.used_days,
            "pending_days": balance.pending_days,
            "lapsed_days": balance.lapsed_days,
            "available_balance": self._q2(
                balance.opening_balance
                + balance.annual_allocation
                + balance.carry_forward_in
                + balance.manual_granted
                - balance.used_days
                - balance.pending_days
                - balance.lapsed_days
            ),
        }

    async def get_employee_balances(self,session: AsyncSession,employee_uid: uuid.UUID,year: int):
        stmt = select(EmployeeLeaveBalance).where(
            EmployeeLeaveBalance.employee_uid == employee_uid,
            EmployeeLeaveBalance.year == year,
        )
        rows = (await session.exec(stmt)).all()

        return [
            {
                "uid": row.uid,
                "employee_uid": row.employee_uid,
                "leave_type_uid": row.leave_type_uid,
                "year": row.year,
                "opening_balance": row.opening_balance,
                "annual_allocation": row.annual_allocation,
                "carry_forward_in": row.carry_forward_in,
                "manual_granted": row.manual_granted,
                "used_days": row.used_days,
                "pending_days": row.pending_days,
                "lapsed_days": row.lapsed_days,
                "available_balance": self._q2(
                    row.opening_balance
                    + row.annual_allocation
                    + row.carry_forward_in
                    + row.manual_granted
                    - row.used_days
                    - row.pending_days
                    - row.lapsed_days
                ),
            }
            for row in rows
        ]

    async def get_all_employees_leave_balances(self, session: AsyncSession, year: int | None = None):
        stmt = select(EmployeeLeaveBalance)

        if year is not None:
            stmt = stmt.where(EmployeeLeaveBalance.year == year)

        rows = (await session.exec(stmt)).all()

        return [
            {
                "uid": row.uid,
                "employee_uid": row.employee_uid,
                "leave_type_uid": row.leave_type_uid,
                "year": row.year,
                "opening_balance": row.opening_balance,
                "annual_allocation": row.annual_allocation,
                "carry_forward_in": row.carry_forward_in,
                "manual_granted": row.manual_granted,
                "used_days": row.used_days,
                "pending_days": row.pending_days,
                "lapsed_days": row.lapsed_days,
                "available_balance": self._q2(
                    row.opening_balance
                    + row.annual_allocation
                    + row.carry_forward_in
                    + row.manual_granted
                    - row.used_days
                    - row.pending_days
                    - row.lapsed_days
                ),
            }
            for row in rows
        ]

employee_leave_balance_service = EmployeeLeaveBalanceService()