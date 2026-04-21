import uuid
from typing import Optional, List
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models.employee import Employee
from src.db.models.leave_management import LeaveRequest
from src.db.models.attendance_management import AttendanceRegularization
from .schema import TransactionHistoryRead, TransactionHistoryListRead


class TransactionHistoryService:
    async def _get_employee_by_email(self, session: AsyncSession, email: str) -> Employee:
        stmt = select(Employee).where(Employee.email == email)
        employee = (await session.exec(stmt)).first()
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee not found.")
        return employee

    async def _get_employee_name_map(self, session: AsyncSession) -> dict:
        stmt = select(Employee)
        employees = (await session.exec(stmt)).all()

        result = {}
        for emp in employees:
            full_name = f"{emp.first_name or ''} {emp.last_name or ''}".strip()
            if emp.employee_code:
                full_name = f"{full_name} ({emp.employee_code})".strip()
            result[emp.uid] = full_name
        return result

    def _build_leave_details(self,employee_name: str,leave_type_name: str,leave,approver_name: Optional[str]) -> str:
        status_value = leave.status.value if hasattr(leave.status, "value") else str(leave.status)
        status_value = str(status_value).strip().lower()

        base = (
            f"Request for {leave_type_name} Leave of {leave.applied_days} day's "
            f"from {leave.start_date.strftime('%d %b %Y')} to {leave.end_date.strftime('%d %b %Y')} "
            f"raised by {employee_name} on {leave.created_at.strftime('%d %b, %Y at %I:%M%p')}."
        )

        if status_value == "approved" and approver_name and leave.reviewed_at:
            return (
                f"{base} It has been approved by {approver_name} "
                f"on {leave.reviewed_at.strftime('%d %b, %Y at %I:%M%p')}."
            )

        if status_value == "rejected" and approver_name and leave.reviewed_at:
            return (
                f"{base} It has been rejected by {approver_name} "
                f"on {leave.reviewed_at.strftime('%d %b, %Y at %I:%M%p')}."
            )

        if status_value == "cancelled":
            return f"{base} It has been cancelled."

        return base

    def _build_regularization_details(self,employee_name: str,regularization,approver_name: Optional[str]) -> str:
        status_value = (
            regularization.status.value
            if hasattr(regularization.status, "value")
            else str(regularization.status)
        )
        status_value = str(status_value).strip().lower()

        base = (
            f"Regularization request has been applied by {employee_name} on "
            f"{regularization.created_at.strftime('%d %b, %Y at %I:%M%p')} "
            f"for {regularization.regularization_date.strftime('%d %b, %Y')}."
        )

        if status_value == "approved" and approver_name and regularization.reviewed_at:
            return (
                f"{base} It is now approved by {approver_name} "
                f"on {regularization.reviewed_at.strftime('%d %b, %Y at %I:%M%p')}."
            )

        if status_value == "rejected" and approver_name and regularization.reviewed_at:
            return (
                f"{base} It is now rejected by {approver_name} "
                f"on {regularization.reviewed_at.strftime('%d %b, %Y at %I:%M%p')}."
            )

        if status_value == "cancelled":
            return f"{base} It has been cancelled."

        return base

    async def list_my_transaction_history(self,session: AsyncSession,email: str,status_filter: Optional[str] = None,
        request_type: Optional[str] = None,search: Optional[str] = None) -> TransactionHistoryListRead:
        employee = await self._get_employee_by_email(session, email)
        employee_name_map = await self._get_employee_name_map(session)
        current_employee_name = employee_name_map.get(employee.uid, employee.employee_code)

        items: List[TransactionHistoryRead] = []

        # ------------------ LEAVE REQUESTS ------------------
        if request_type in (None, "", "LEAVE"):
            leave_stmt = (select(LeaveRequest).where(LeaveRequest.employee_uid == employee.uid).order_by(LeaveRequest.created_at.desc()))
            leave_requests = (await session.exec(leave_stmt)).all()

            leave_type_map = {}
            from src.db.models.leave_management import LeaveType
            leave_types = (await session.exec(select(LeaveType))).all()
            for lt in leave_types:
                leave_type_map[lt.uid] = lt.name

            for leave in leave_requests:
                approver_name = employee_name_map.get(leave.approver_employee_uid) if leave.approver_employee_uid else None
                pending_with = approver_name if str(leave.status) == "Pending" else "-"
                leave_type_name = leave_type_map.get(leave.leave_type_uid, "Leave")

                details = self._build_leave_details(employee_name=current_employee_name,leave_type_name=leave_type_name,leave=leave,
                    approver_name=approver_name)

                items.append(
                    TransactionHistoryRead(
                        uid=leave.uid,
                        transaction_type="LEAVE",
                        request_date=leave.created_at.date(),
                        created_at=leave.created_at,
                        status=str(leave.status.value if hasattr(leave.status, "value") else leave.status),
                        details=details,
                        pending_with=pending_with,
                        approver_employee_uid=leave.approver_employee_uid,
                        reviewer_note=leave.reviewer_note,
                    )
                )

        # ------------------ REGULARIZATION REQUESTS ------------------
        if request_type in (None, "", "REGULARIZATION"):
            reg_stmt = (select(AttendanceRegularization).where(AttendanceRegularization.employee_uid == employee.uid)
                .order_by(AttendanceRegularization.created_at.desc()))
            regularizations = (await session.exec(reg_stmt)).all()

            for reg in regularizations:
                approver_name = employee_name_map.get(reg.approver_employee_uid) if reg.approver_employee_uid else None
                pending_with = approver_name if str(reg.status) == "Pending" else "-"

                details = self._build_regularization_details(employee_name=current_employee_name,regularization=reg,approver_name=approver_name)

                items.append(
                    TransactionHistoryRead(
                        uid=reg.uid,
                        transaction_type="REGULARIZATION",
                        request_date=reg.created_at.date(),
                        created_at=reg.created_at,
                        status=str(reg.status.value if hasattr(reg.status, "value") else reg.status),
                        details=details,
                        pending_with=pending_with,
                        approver_employee_uid=reg.approver_employee_uid,
                        reviewer_note=reg.reviewer_note,
                    )
                )

        # ------------------ FILTERS ------------------
        if status_filter and status_filter.upper() != "ALL":
            items = [item for item in items if item.status.upper() == status_filter.upper()]

        if search:
            q = search.strip().lower()
            items = [
                item for item in items
                if q in item.details.lower()
                or q in item.status.lower()
                or q in item.transaction_type.lower()
                or (item.pending_with and q in item.pending_with.lower())
            ]

        # final sort
        items.sort(key=lambda x: x.created_at, reverse=True)

        return TransactionHistoryListRead(items=items,total=len(items))


transaction_history_service = TransactionHistoryService()