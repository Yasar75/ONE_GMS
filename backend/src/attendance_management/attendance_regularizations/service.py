import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence, Tuple
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import (
    Attendance,
    AttendanceRegularization,
    AttendanceRegularizationLog,
    Employee,
    EmployeeShift,
    ShiftRoster,
)
from src.db.models import AttendanceStatus, RegularizationStatus


class AttendanceRegularizationService:
    @staticmethod
    def _today() -> date:
        return date.today()

    @staticmethod
    def _q2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _shift_duration_hours(start_time, end_time) -> Decimal:
        base_day = date(2000, 1, 1)
        start_dt = datetime.combine(base_day, start_time)
        end_dt = datetime.combine(base_day, end_time)
        if end_dt <= start_dt:
            end_dt += timedelta(days=1)
        seconds = Decimal(str((end_dt - start_dt).total_seconds()))
        return (seconds / Decimal("3600")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _worked_hours(start_dt: datetime, end_dt: datetime) -> Decimal:
        if end_dt <= start_dt:
            return Decimal("0.00")
        seconds = Decimal(str((end_dt - start_dt).total_seconds()))
        return (seconds / Decimal("3600")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    async def _get_employee_by_email(self, session: AsyncSession, email: str) -> Employee:
        stmt = select(Employee).where(Employee.email == email)
        employee = (await session.exec(stmt)).first()
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
        return employee

    async def _get_active_employee_shifts(self,session: AsyncSession,employee_uid: uuid.UUID) -> Sequence[Tuple[EmployeeShift, ShiftRoster]]:
        stmt = (select(EmployeeShift, ShiftRoster).join(ShiftRoster, EmployeeShift.shift_uid == ShiftRoster.uid).where(
                EmployeeShift.employee_uid == employee_uid,EmployeeShift.is_active == True,ShiftRoster.is_active == True))
        result = await session.exec(stmt)
        rows = result.all()
        if not rows:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active shift assigned to employee.")
        return rows

    def _calculate_total_shift_hours(self, rows: Sequence[Tuple[EmployeeShift, ShiftRoster]]) -> Decimal:
        total = Decimal("0.00")
        for _, shift in rows:
            total += self._shift_duration_hours(shift.start_time, shift.end_time)
        return self._q2(total)

    async def _get_attendance_by_employee_date(self,session: AsyncSession,employee_uid: uuid.UUID,attendance_date: date):
        stmt = select(Attendance).where(Attendance.employee_uid == employee_uid,Attendance.attendance_date == attendance_date)
        return (await session.exec(stmt)).first()

    async def _get_regularization(self, session: AsyncSession, regularization_uid: uuid.UUID):
        stmt = select(AttendanceRegularization).where(AttendanceRegularization.uid == regularization_uid)
        regularization = (await session.exec(stmt)).first()
        if not regularization:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regularization request not found.")
        return regularization

    async def _create_log(self,session: AsyncSession,regularization_uid: uuid.UUID,actor_employee_uid: uuid.UUID | None,action: str,note: str | None):
        log = AttendanceRegularizationLog(regularization_uid=regularization_uid,actor_employee_uid=actor_employee_uid,action=action,note=note)
        session.add(log)
        await session.flush()

    async def create_regularization(self,session: AsyncSession,user_uid: uuid.UUID,employee_email: str,data):
        employee = await self._get_employee_by_email(session, employee_email)

        if data.regularization_date >= self._today():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Regularization is allowed for past date only.")

        if employee.join_date and data.regularization_date < employee.join_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Regularization date cannot be before employee joining date.")

        existing_pending_stmt = select(AttendanceRegularization).where(
            AttendanceRegularization.employee_uid == employee.uid,
            AttendanceRegularization.regularization_date == data.regularization_date,
            AttendanceRegularization.status == RegularizationStatus.Pending,
        )
        existing_pending = (await session.exec(existing_pending_stmt)).first()
        if existing_pending:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail="Pending regularization request already exists for this date.")

        if not data.requested_punch_in or not data.requested_punch_out:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="requested_punch_in and requested_punch_out are required.")

        if data.requested_punch_in.date() != data.regularization_date or data.requested_punch_out.date() != data.regularization_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Requested punch times must belong to regularization_date.")

        if data.requested_punch_out <= data.requested_punch_in:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="requested_punch_out must be greater than requested_punch_in.")

        requested_worked_hours = self._worked_hours(data.requested_punch_in, data.requested_punch_out)
        attendance = await self._get_attendance_by_employee_date(session, employee.uid, data.regularization_date)

        regularization = AttendanceRegularization(
            user_uid=user_uid,
            employee_uid=employee.uid,
            attendance_uid=attendance.uid if attendance else None,
            regularization_date=data.regularization_date,
            requested_punch_in=data.requested_punch_in,
            requested_punch_out=data.requested_punch_out,
            requested_worked_hours=requested_worked_hours,
            reason=data.reason,
            status=RegularizationStatus.Pending,
            approver_employee_uid=employee.manager_employee_uid,
        )
        session.add(regularization)
        await session.flush()

        await self._create_log(
            session=session,
            regularization_uid=regularization.uid,
            actor_employee_uid=employee.uid,
            action="CREATED",
            note=data.reason,
        )

        if attendance:
            attendance.status = AttendanceStatus.PendingRegularization
            attendance.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(regularization)
        return regularization

    async def list_my_regularizations(self, session: AsyncSession, employee_email: str):
        employee = await self._get_employee_by_email(session, employee_email)
        stmt = (select(AttendanceRegularization).where(AttendanceRegularization.employee_uid == employee.uid).order_by(AttendanceRegularization.created_at.desc()))
        result = await session.exec(stmt)
        return result.all()

    async def list_all_pending_regularizations(self, session: AsyncSession):
        stmt = (select(AttendanceRegularization).where(AttendanceRegularization.status == RegularizationStatus.Pending).order_by(AttendanceRegularization.created_at.asc()))
        result = await session.exec(stmt)
        return result.all()

    async def approve_regularization(self, session: AsyncSession, regularization_uid: uuid.UUID, manager_email: str, data):
        manager = await self._get_employee_by_email(session, manager_email)
        regularization = await self._get_regularization(session, regularization_uid)

        if regularization.status != RegularizationStatus.Pending:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending request can be approved.")

        if regularization.approver_employee_uid and regularization.approver_employee_uid != manager.uid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to approve this request.")

        rows = await self._get_active_employee_shifts(session, regularization.employee_uid)
        total_shift_hours = self._calculate_total_shift_hours(rows)

        attendance = None
        if regularization.attendance_uid:
            stmt = select(Attendance).where(Attendance.uid == regularization.attendance_uid)
            attendance = (await session.exec(stmt)).first()

        if not attendance:
            attendance = Attendance(
                user_uid=regularization.user_uid,
                employee_uid=regularization.employee_uid,
                attendance_date=regularization.regularization_date,
                total_assigned_shift_hours=total_shift_hours,
                total_worked_hours=Decimal("0.00"),
                status=AttendanceStatus.Absent,
                is_regularized=True,
            )
            session.add(attendance)
            await session.flush()
            regularization.attendance_uid = attendance.uid

        attendance.first_punch_in = regularization.requested_punch_in
        attendance.last_punch_out = regularization.requested_punch_out
        attendance.total_assigned_shift_hours = total_shift_hours
        attendance.total_worked_hours = regularization.requested_worked_hours or Decimal("0.00")
        attendance.is_regularized = True

        if attendance.first_punch_in and attendance.last_punch_out and attendance.total_worked_hours >= attendance.total_assigned_shift_hours:
            attendance.status = AttendanceStatus.Present
        else:
            attendance.status = AttendanceStatus.Absent

        regularization.status = RegularizationStatus.Approved
        regularization.reviewer_note = data.reviewer_note
        regularization.reviewed_at = datetime.utcnow()
        regularization.approver_employee_uid = manager.uid
        regularization.updated_at = datetime.utcnow()

        await self._create_log(
            session=session,
            regularization_uid=regularization.uid,
            actor_employee_uid=manager.uid,
            action="APPROVED",
            note=data.reviewer_note,
        )

        await session.commit()
        await session.refresh(regularization)
        return regularization

    async def reject_regularization(self, session: AsyncSession, regularization_uid: uuid.UUID, manager_email: str, data):
        manager = await self._get_employee_by_email(session, manager_email)
        regularization = await self._get_regularization(session, regularization_uid)

        if regularization.status != RegularizationStatus.Pending:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending request can be rejected.")

        if regularization.approver_employee_uid and regularization.approver_employee_uid != manager.uid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to reject this request.")

        attendance = None
        if regularization.attendance_uid:
            stmt = select(Attendance).where(Attendance.uid == regularization.attendance_uid)
            attendance = (await session.exec(stmt)).first()

        if attendance:
            attendance.status = AttendanceStatus.Absent
            attendance.updated_at = datetime.utcnow()

        regularization.status = RegularizationStatus.Rejected
        regularization.reviewer_note = data.reviewer_note
        regularization.reviewed_at = datetime.utcnow()
        regularization.approver_employee_uid = manager.uid
        regularization.updated_at = datetime.utcnow()

        await self._create_log(
            session=session,
            regularization_uid=regularization.uid,
            actor_employee_uid=manager.uid,
            action="REJECTED",
            note=data.reviewer_note,
        )

        await session.commit()
        await session.refresh(regularization)
        return regularization


######################## Manager Level Approval management function created ###################################
    # async def list_manager_pending_regularizations(self, session: AsyncSession, manager_email: str):
    #     manager = await self._get_employee_by_email(session, manager_email)

    #     stmt = (select(AttendanceRegularization).where(AttendanceRegularization.status == RegularizationStatus.Pending,
    #             AttendanceRegularization.approver_employee_uid == manager.uid).order_by(AttendanceRegularization.created_at.asc()))
    #     result = await session.exec(stmt)
    #     return result.all()

    # async def manager_decide_regularization(self,session: AsyncSession,regularization_uid: uuid.UUID,manager_email: str,action: str,
    #     reviewer_note: str | None = None):
    #     manager = await self._get_employee_by_email(session, manager_email)
    #     regularization = await self._get_regularization(session, regularization_uid)

    #     if regularization.status != RegularizationStatus.Pending:
    #         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Only pending request can be processed.")

    #     if regularization.approver_employee_uid is None:
    #         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="No manager assigned for this regularization request.")

    #     if regularization.approver_employee_uid != manager.uid:
    #         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="Only the employee's manager can approve/reject this attendance regularization.")

    #     attendance = None
    #     if regularization.attendance_uid:
    #         stmt = select(Attendance).where(Attendance.uid == regularization.attendance_uid)
    #         attendance = (await session.exec(stmt)).first()

    #     if action == "approve":
    #         rows = await self._get_active_employee_shifts(session, regularization.employee_uid)
    #         total_shift_hours = self._calculate_total_shift_hours(rows)

    #         if not attendance:
    #             attendance = Attendance(
    #                 user_uid=regularization.user_uid,
    #                 employee_uid=regularization.employee_uid,
    #                 attendance_date=regularization.regularization_date,
    #                 total_assigned_shift_hours=total_shift_hours,
    #                 total_worked_hours=Decimal("0.00"),
    #                 status=AttendanceStatus.Absent,
    #                 is_regularized=True,
    #             )
    #             session.add(attendance)
    #             await session.flush()
    #             regularization.attendance_uid = attendance.uid

    #         attendance.first_punch_in = regularization.requested_punch_in
    #         attendance.last_punch_out = regularization.requested_punch_out
    #         attendance.total_assigned_shift_hours = total_shift_hours
    #         attendance.total_worked_hours = regularization.requested_worked_hours or Decimal("0.00")
    #         attendance.is_regularized = True

    #         if (attendance.first_punch_in and attendance.last_punch_out and attendance.total_worked_hours >= attendance.total_assigned_shift_hours):
    #             attendance.status = AttendanceStatus.Present
    #         else:
    #             attendance.status = AttendanceStatus.Absent

    #         regularization.status = RegularizationStatus.Approved

    #         await self._create_log(session=session,regularization_uid=regularization.uid,actor_employee_uid=manager.uid,
    #             action="APPROVED",note=reviewer_note)

    #     elif action == "reject":
    #         if attendance:
    #             attendance.status = AttendanceStatus.Absent
    #             attendance.updated_at = datetime.utcnow()

    #         regularization.status = RegularizationStatus.Rejected

    #         await self._create_log(session=session,regularization_uid=regularization.uid,actor_employee_uid=manager.uid,
    #             action="REJECTED",note=reviewer_note)

    #     else:
    #         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Invalid action. Use approve or reject.")

    #     regularization.reviewer_note = reviewer_note
    #     regularization.reviewed_at = datetime.utcnow()
    #     regularization.approver_employee_uid = manager.uid
    #     regularization.updated_at = datetime.utcnow()

    #     await session.commit()
    #     await session.refresh(regularization)
    #     return regularization

attendance_regularization_service = AttendanceRegularizationService()