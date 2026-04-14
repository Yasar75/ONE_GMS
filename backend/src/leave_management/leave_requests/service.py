import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Attendance, Employee
from src.db.models import AttendanceStatus
from src.db.models.leave_management import (
    EmployeeLeaveBalance,
    HolidayCalendar,
    LeaveRequest,
    LeaveRequestStatus,
    LeaveType,
    LeaveCancellationStatus,
    
)
from .schema import LeaveRequestCreate, LeaveRequestDecision,LeaveCancellationCreate,LeaveCancellationDecision,LeaveRequestUpdate
from src.notification.employee_notifications import employee_notification_service
from src.config import Config

class LeaveRequestService:
    @property
    def WEEKEND_DAYS(self):
        return Config.WEEKEND_DAYS
    
    def _is_weekend(self, current_date: date) -> bool:
        return current_date.weekday() in self.WEEKEND_DAYS
    
    @staticmethod
    def _q2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    async def _get_employee_by_email(self, session: AsyncSession, email: str):
        stmt = select(Employee).where(Employee.email == email)
        employee = (await session.exec(stmt)).first()
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
        return employee

    async def _get_employee_by_uid(self, session: AsyncSession, employee_uid: uuid.UUID):
        stmt = select(Employee).where(Employee.uid == employee_uid)
        employee = (await session.exec(stmt)).first()
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee not found.")
        return employee
    
    async def _get_leave_type(self, session: AsyncSession, leave_type_uid: uuid.UUID):
        stmt = select(LeaveType).where(LeaveType.uid == leave_type_uid, LeaveType.is_active == True)  # noqa
        leave_type = (await session.exec(stmt)).first()
        if not leave_type:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found.")
        return leave_type

    async def _get_balance(self, session: AsyncSession, employee_uid: uuid.UUID, leave_type_uid: uuid.UUID, year: int):
        stmt = select(EmployeeLeaveBalance).where(
            EmployeeLeaveBalance.employee_uid == employee_uid,
            EmployeeLeaveBalance.leave_type_uid == leave_type_uid,
            EmployeeLeaveBalance.year == year,
        )
        return (await session.exec(stmt)).first()

    async def _get_request(self, session: AsyncSession, leave_request_uid: uuid.UUID):
        stmt = select(LeaveRequest).where(LeaveRequest.uid == leave_request_uid)
        leave_request = (await session.exec(stmt)).first()
        if not leave_request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
        return leave_request

    async def _get_holidays_between(self, session: AsyncSession, start_date: date, end_date: date):
        stmt = select(HolidayCalendar).where(
            HolidayCalendar.holiday_date >= start_date,
            HolidayCalendar.holiday_date <= end_date,
            HolidayCalendar.is_active == True,  # noqa
        )
        return (await session.exec(stmt)).all()

    def _is_weekend(self, current_date: date) -> bool:
        return current_date.weekday() in self.WEEKEND_DAYS

    async def preview_leave_days(self, session: AsyncSession, start_date: date, end_date: date):
        if end_date < start_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date cannot be before start_date.")

        holidays = await self._get_holidays_between(session, start_date, end_date)
        holiday_dates = {holiday.holiday_date for holiday in holidays}

        current = start_date
        total_calendar_days = 0
        excluded_weekends = []
        excluded_holidays = []
        applied_days = Decimal("0.00")

        while current <= end_date:
            total_calendar_days += 1
            if current.weekday() in self.WEEKEND_DAYS:
                excluded_weekends.append(current)
            elif current in holiday_dates:
                excluded_holidays.append(current)
            else:
                applied_days += Decimal("1.00")
            current += timedelta(days=1)

        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_calendar_days": total_calendar_days,
            "excluded_weekends": excluded_weekends,
            "excluded_holidays": excluded_holidays,
            "applied_days": self._q2(applied_days),
        }
    ## Helper function for reverse attendance after approved leave cancellation
    async def _reverse_cancelled_leave_in_attendance(self, session: AsyncSession, leave_request: LeaveRequest) -> None:
        holidays = await self._get_holidays_between(session, leave_request.start_date, leave_request.end_date)
        holiday_dates = {holiday.holiday_date for holiday in holidays}

        current_date = leave_request.start_date

        while current_date <= leave_request.end_date:
            if self._is_weekend(current_date) or current_date in holiday_dates:
                current_date += timedelta(days=1)
                continue

            stmt = select(Attendance).where(
                Attendance.employee_uid == leave_request.employee_uid,
                Attendance.attendance_date == current_date,
                Attendance.leave_request_uid == leave_request.uid,
                Attendance.status == AttendanceStatus.Leave,
            )
            attendance = (await session.exec(stmt)).first()

            if attendance:
                attendance.status = AttendanceStatus.Absent
                attendance.leave_request_uid = None
                attendance.leave_type_uid = None
                attendance.remarks = "Leave cancelled"
                attendance.updated_at = datetime.utcnow()

            current_date += timedelta(days=1)

    async def _mark_approved_leave_in_attendance(
        self,
        session: AsyncSession,
        leave_request: LeaveRequest,
    ) -> None:
        holidays = await self._get_holidays_between(session, leave_request.start_date, leave_request.end_date)
        holiday_dates = {holiday.holiday_date for holiday in holidays}

        current_date = leave_request.start_date

        while current_date <= leave_request.end_date:
            if self._is_weekend(current_date) or current_date in holiday_dates:
                current_date += timedelta(days=1)
                continue

            stmt = select(Attendance).where(
                Attendance.employee_uid == leave_request.employee_uid,
                Attendance.attendance_date == current_date,
            )
            attendance = (await session.exec(stmt)).first()

            if attendance and attendance.status == AttendanceStatus.Present:
                current_date += timedelta(days=1)
                continue

            if not attendance:
                attendance = Attendance(
                    user_uid=leave_request.user_uid,
                    employee_uid=leave_request.employee_uid,
                    attendance_date=current_date,
                    first_punch_in=None,
                    last_punch_out=None,
                    total_assigned_shift_hours=Decimal("0.00"),
                    total_worked_hours=Decimal("0.00"),
                    status=AttendanceStatus.Leave,
                    is_regularized=False,
                    leave_request_uid=leave_request.uid,
                    leave_type_uid=leave_request.leave_type_uid,
                    remarks="Approved leave",
                )
                session.add(attendance)
            else:
                attendance.first_punch_in = None
                attendance.last_punch_out = None
                attendance.total_worked_hours = Decimal("0.00")
                attendance.status = AttendanceStatus.Leave
                attendance.is_regularized = False
                attendance.leave_request_uid = leave_request.uid
                attendance.leave_type_uid = leave_request.leave_type_uid
                attendance.remarks = "Approved leave"
                attendance.updated_at = datetime.utcnow()

            current_date += timedelta(days=1)

    async def apply_leave(self, session: AsyncSession, data: LeaveRequestCreate, user_uid: uuid.UUID, email: str):
        employee = await self._get_employee_by_email(session, email)
        await self._get_leave_type(session, data.leave_type_uid)

        if data.start_date > data.end_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date cannot be greater than end_date.")

        if employee.join_date and data.start_date < employee.join_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leave cannot be applied before joining date.")

        if data.start_date.year != data.end_date.year:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cross year leave request is not allowed.")

        preview = await self.preview_leave_days(session, data.start_date, data.end_date)
        applied_days = preview["applied_days"]

        if applied_days <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only weekends/holidays found in range.")

        balance = await self._get_balance(session, employee.uid, data.leave_type_uid, data.start_date.year)
        if not balance:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leave balance not found. Generate leave balances first.")

        available_balance = self._q2(
            balance.opening_balance
            + balance.annual_allocation
            + balance.carry_forward_in
            + balance.manual_granted
            - balance.used_days
            - balance.pending_days
            - balance.lapsed_days
        )

        if available_balance < applied_days:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient leave balance.")

        overlap_stmt = select(LeaveRequest).where(
            LeaveRequest.employee_uid == employee.uid,
            LeaveRequest.status.in_([LeaveRequestStatus.Pending, LeaveRequestStatus.Approved]),
            LeaveRequest.start_date <= data.end_date,
            LeaveRequest.end_date >= data.start_date,
        )
        overlap = (await session.exec(overlap_stmt)).first()
        if overlap:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Overlapping leave request already exists.")

        leave_request = LeaveRequest(
            user_uid=user_uid,
            employee_uid=employee.uid,
            leave_type_uid=data.leave_type_uid,
            start_date=data.start_date,
            end_date=data.end_date,
            applied_days=applied_days,
            reason=data.reason,
            status=LeaveRequestStatus.Pending,
            approver_employee_uid=employee.manager_employee_uid,
        )

        balance.pending_days = self._q2(balance.pending_days + applied_days)

        session.add(leave_request)
        await session.commit()
        await session.refresh(leave_request)
        return leave_request

    async def list_my_requests(self, session: AsyncSession, email: str):
        employee = await self._get_employee_by_email(session, email)
        stmt = select(LeaveRequest).where(LeaveRequest.employee_uid == employee.uid).order_by(LeaveRequest.created_at.desc())
        return (await session.exec(stmt)).all()

    async def list_pending_leave_request(self, session: AsyncSession, email: str, role_name: str = ""):
        manager = await self._get_employee_by_email(session, email)
        role_name_normalized = str(role_name or "").strip().lower()

        stmt = select(LeaveRequest).where(LeaveRequest.status == LeaveRequestStatus.Pending)
        if role_name_normalized not in {"admin", "hr"}:
            stmt = stmt.where(LeaveRequest.approver_employee_uid == manager.uid)

        stmt = stmt.order_by(LeaveRequest.created_at.asc())
        return (await session.exec(stmt)).all()

    async def approve_leave(self, session: AsyncSession, leave_request_uid: uuid.UUID, email: str, data: LeaveRequestDecision, role_name: str = ""):
        manager = await self._get_employee_by_email(session, email)
        leave_request = await self._get_request(session, leave_request_uid)
        role_name_normalized = str(role_name or "").strip().lower()
        is_admin_reviewer = role_name_normalized in {"admin", "hr"}

        if leave_request.status != LeaveRequestStatus.Pending:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending request can be approved.")

        if not is_admin_reviewer and leave_request.approver_employee_uid and leave_request.approver_employee_uid != manager.uid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to approve this request.")

        balance = await self._get_balance(session, leave_request.employee_uid, leave_request.leave_type_uid, leave_request.start_date.year)
        if not balance:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leave balance not found.")

        balance.pending_days = self._q2(balance.pending_days - leave_request.applied_days)
        balance.used_days = self._q2(balance.used_days + leave_request.applied_days)

        leave_request.status = LeaveRequestStatus.Approved
        leave_request.reviewer_note = data.reviewer_note
        leave_request.reviewed_at = datetime.utcnow()
        leave_request.approver_employee_uid = manager.uid

        await self._mark_approved_leave_in_attendance(session, leave_request)

        await session.commit()
        await session.refresh(leave_request)

        ## Notification Mail to employee
        employee = await self._get_employee_by_uid(session, leave_request.employee_uid)

        try:
            await employee_notification_service.send_leave_status_email(
                employee_email=employee.email,
                employee_name=f"{employee.first_name or ''} {employee.last_name or ''}".strip() or employee.employee_code,
                status_value=leave_request.status.value,start_date=leave_request.start_date,
                end_date=leave_request.end_date,applied_days=leave_request.applied_days,reviewer_note=leave_request.reviewer_note)
        except Exception as e:
            print(f"Failed to send leave approval email: {e}")

        return leave_request

    async def reject_leave(self, session: AsyncSession, leave_request_uid: uuid.UUID, email: str, data: LeaveRequestDecision, role_name: str = ""):
        manager = await self._get_employee_by_email(session, email)
        leave_request = await self._get_request(session, leave_request_uid)
        role_name_normalized = str(role_name or "").strip().lower()
        is_admin_reviewer = role_name_normalized in {"admin", "hr"}

        if leave_request.status != LeaveRequestStatus.Pending:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending request can be rejected.")

        if not is_admin_reviewer and leave_request.approver_employee_uid and leave_request.approver_employee_uid != manager.uid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to reject this request.")

        balance = await self._get_balance(session, leave_request.employee_uid, leave_request.leave_type_uid, leave_request.start_date.year)
        if not balance:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leave balance not found.")

        balance.pending_days = self._q2(balance.pending_days - leave_request.applied_days)

        leave_request.status = LeaveRequestStatus.Rejected
        leave_request.reviewer_note = data.reviewer_note
        leave_request.reviewed_at = datetime.utcnow()
        leave_request.approver_employee_uid = manager.uid

        await session.commit()
        await session.refresh(leave_request)

        ## Notification Mail to employee
        employee = await self._get_employee_by_uid(session, leave_request.employee_uid)

        try:
            await employee_notification_service.send_leave_status_email(
                employee_email=employee.email,
                employee_name=f"{employee.first_name or ''} {employee.last_name or ''}".strip() or employee.employee_code,
                status_value=leave_request.status.value,start_date=leave_request.start_date,
                end_date=leave_request.end_date,applied_days=leave_request.applied_days,reviewer_note=leave_request.reviewer_note)
        except Exception as e:
            print(f"Failed to send leave rejection email: {e}")

        return leave_request

    async def request_leave_cancellation(self,session: AsyncSession,leave_request_uid: uuid.UUID,user_uid: uuid.UUID,email: str,
    data: LeaveCancellationCreate):
        employee = await self._get_employee_by_email(session, email)
        leave_request = await self._get_request(session, leave_request_uid)

        if leave_request.employee_uid != employee.uid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can cancel only your own leave request.")

        if leave_request.status not in {LeaveRequestStatus.Pending, LeaveRequestStatus.Approved}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending or approved leave request can be sent for cancellation.",
            )

        if leave_request.cancellation_status == LeaveCancellationStatus.Pending:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancellation request is already pending.")

        if leave_request.cancellation_status == LeaveCancellationStatus.Approved:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancellation request is already approved.")

        leave_request.user_uid = user_uid
        leave_request.cancellation_status = LeaveCancellationStatus.Pending
        leave_request.cancellation_reason = data.cancellation_reason
        leave_request.cancellation_requested_at = datetime.utcnow()
        leave_request.cancellation_reviewer_note = None
        leave_request.cancellation_reviewed_at = None
        leave_request.cancellation_approver_employee_uid = None

        await session.commit()
        await session.refresh(leave_request)
        return leave_request
    
    async def list_pending_leave_cancellations(self, session: AsyncSession):
        stmt = (
            select(LeaveRequest)
            .where(LeaveRequest.cancellation_status == LeaveCancellationStatus.Pending)
            .order_by(LeaveRequest.cancellation_requested_at.asc())
        )
        return (await session.exec(stmt)).all()

    async def approve_leave_cancellation(self,session: AsyncSession,leave_request_uid: uuid.UUID,email: str,
    data: LeaveCancellationDecision,role_name: str = "",):
        reviewer = await self._get_employee_by_email(session, email)
        role_name_normalized = str(role_name or "").strip().lower()

        if role_name_normalized not in {"admin", "hr"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR/Admin can approve cancellation.")

        leave_request = await self._get_request(session, leave_request_uid)

        if leave_request.cancellation_status != LeaveCancellationStatus.Pending:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending cancellation can be approved.")

        balance = await self._get_balance(
            session,
            leave_request.employee_uid,
            leave_request.leave_type_uid,
            leave_request.start_date.year,
        )
        if not balance:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leave balance not found.")

        if leave_request.status == LeaveRequestStatus.Pending:
            balance.pending_days = self._q2(balance.pending_days - leave_request.applied_days)

        elif leave_request.status == LeaveRequestStatus.Approved:
            balance.used_days = self._q2(balance.used_days - leave_request.applied_days)
            await self._reverse_cancelled_leave_in_attendance(session, leave_request)

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancellation approval is allowed only for pending or approved leave request.",
            )

        leave_request.status = LeaveRequestStatus.Cancelled
        leave_request.cancellation_status = LeaveCancellationStatus.Approved
        leave_request.cancellation_reviewer_note = data.reviewer_note
        leave_request.cancellation_reviewed_at = datetime.utcnow()
        leave_request.cancellation_approver_employee_uid = reviewer.uid

        await session.commit()
        await session.refresh(leave_request)
        return leave_request
    
    async def reject_leave_cancellation(self,session: AsyncSession,leave_request_uid: uuid.UUID,email: str,data: LeaveCancellationDecision,
    role_name: str = ""):
        reviewer = await self._get_employee_by_email(session, email)
        role_name_normalized = str(role_name or "").strip().lower()

        if role_name_normalized not in {"admin", "hr"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HR/Admin can reject cancellation.")

        leave_request = await self._get_request(session, leave_request_uid)

        if leave_request.cancellation_status != LeaveCancellationStatus.Pending:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending cancellation can be rejected.")

        leave_request.cancellation_status = LeaveCancellationStatus.Rejected
        leave_request.cancellation_reviewer_note = data.reviewer_note
        leave_request.cancellation_reviewed_at = datetime.utcnow()
        leave_request.cancellation_approver_employee_uid = reviewer.uid

        await session.commit()
        await session.refresh(leave_request)
        return leave_request
    
    async def edit_leave_request(self,session: AsyncSession,leave_request_uid: uuid.UUID,user_uid: uuid.UUID,
    email: str,data: LeaveRequestUpdate):
        employee = await self._get_employee_by_email(session, email)
        leave_request = await self._get_request(session, leave_request_uid)
        await self._get_leave_type(session, data.leave_type_uid)

        if leave_request.employee_uid != employee.uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can edit only your own leave request.",
            )

        if leave_request.status != LeaveRequestStatus.Pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending leave request can be edited.",
            )

        if leave_request.cancellation_status == LeaveCancellationStatus.Pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Leave request cannot be edited while cancellation is pending.",
            )

        if data.start_date > data.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date cannot be greater than end_date.",
            )

        if employee.join_date and data.start_date < employee.join_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Leave cannot be applied before joining date.",
            )

        if data.start_date.year != data.end_date.year:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cross year leave request is not allowed.",
            )

        old_balance = await self._get_balance(
            session,
            leave_request.employee_uid,
            leave_request.leave_type_uid,
            leave_request.start_date.year,
        )
        if not old_balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Existing leave balance not found.",
            )

        # first release old pending days
        old_balance.pending_days = self._q2(old_balance.pending_days - leave_request.applied_days)

        preview = await self.preview_leave_days(session, data.start_date, data.end_date)
        new_applied_days = preview["applied_days"]

        if new_applied_days <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only weekends/holidays found in range.",
            )

        new_balance = await self._get_balance(
            session,
            leave_request.employee_uid,
            data.leave_type_uid,
            data.start_date.year,
        )
        if not new_balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Leave balance not found. Generate leave balances first.",
            )

        available_balance = self._q2(
            new_balance.opening_balance
            + new_balance.annual_allocation
            + new_balance.carry_forward_in
            + new_balance.manual_granted
            - new_balance.used_days
            - new_balance.pending_days
            - new_balance.lapsed_days
        )

        if available_balance < new_applied_days:
            # rollback old pending days in memory before error
            old_balance.pending_days = self._q2(old_balance.pending_days + leave_request.applied_days)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient leave balance.",
            )

        overlap_stmt = select(LeaveRequest).where(
            LeaveRequest.employee_uid == employee.uid,
            LeaveRequest.uid != leave_request.uid,
            LeaveRequest.status.in_([LeaveRequestStatus.Pending, LeaveRequestStatus.Approved]),
            LeaveRequest.start_date <= data.end_date,
            LeaveRequest.end_date >= data.start_date,
        )
        overlap = (await session.exec(overlap_stmt)).first()
        if overlap:
            old_balance.pending_days = self._q2(old_balance.pending_days + leave_request.applied_days)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Overlapping leave request already exists.",
            )

        new_balance.pending_days = self._q2(new_balance.pending_days + new_applied_days)

        leave_request.user_uid = user_uid
        leave_request.leave_type_uid = data.leave_type_uid
        leave_request.start_date = data.start_date
        leave_request.end_date = data.end_date
        leave_request.applied_days = new_applied_days
        leave_request.reason = data.reason
        leave_request.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(leave_request)
        return leave_request
    
    async def delete_leave_request(self,session: AsyncSession,leave_request_uid: uuid.UUID,email: str):
        employee = await self._get_employee_by_email(session, email)
        leave_request = await self._get_request(session, leave_request_uid)

        if leave_request.employee_uid != employee.uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can delete only your own leave request.",
            )

        if leave_request.status != LeaveRequestStatus.Pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending leave request can be deleted.",
            )

        if leave_request.cancellation_status == LeaveCancellationStatus.Pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Leave request cannot be deleted while cancellation is pending.",
            )

        balance = await self._get_balance(
            session,
            leave_request.employee_uid,
            leave_request.leave_type_uid,
            leave_request.start_date.year,
        )
        if not balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Leave balance not found.",
            )

        balance.pending_days = self._q2(balance.pending_days - leave_request.applied_days)

        await session.delete(leave_request)
        await session.commit()

        return {"message": "Leave request deleted successfully."}
###### Manager Level Leave Approve and Reject function ################3
    # async def list_manager_pending_leave_requests(self, session: AsyncSession, manager_email: str):
    #     manager = await self._get_employee_by_email(session, manager_email)

    #     stmt = (select(LeaveRequest).where(LeaveRequest.status == LeaveRequestStatus.Pending,LeaveRequest.approver_employee_uid == manager.uid).order_by(LeaveRequest.created_at.asc()))
    #     return (await session.exec(stmt)).all()

    # async def manager_decide_leave_request(self,session: AsyncSession,leave_request_uid: uuid.UUID,manager_email: str,action: str,
    #     reviewer_note: str | None = None):
    #     manager = await self._get_employee_by_email(session, manager_email)
    #     leave_request = await self._get_request(session, leave_request_uid)

    #     if leave_request.status != LeaveRequestStatus.Pending:
    #         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Only pending request can be processed.")

    #     if leave_request.approver_employee_uid is None:
    #         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="No manager assigned for this leave request.")

    #     if leave_request.approver_employee_uid != manager.uid:
    #         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="Only the employee's manager can approve/reject this leave request.")

    #     balance = await self._get_balance(session,leave_request.employee_uid,leave_request.leave_type_uid,leave_request.start_date.year)
    #     if not balance:
    #         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Leave balance not found.")

    #     if action == "approve":
    #         balance.pending_days = self._q2(balance.pending_days - leave_request.applied_days)
    #         balance.used_days = self._q2(balance.used_days + leave_request.applied_days)

    #         leave_request.status = LeaveRequestStatus.Approved
    #         await self._mark_approved_leave_in_attendance(session, leave_request)

    #     elif action == "reject":
    #         balance.pending_days = self._q2(balance.pending_days - leave_request.applied_days)
    #         leave_request.status = LeaveRequestStatus.Rejected

    #     else:
    #         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Invalid action. Use approve or reject.")

    #     leave_request.reviewer_note = reviewer_note
    #     leave_request.reviewed_at = datetime.utcnow()
    #     leave_request.approver_employee_uid = manager.uid

    #     await session.commit()
    #     await session.refresh(leave_request)
    #     return leave_request

leave_request_service = LeaveRequestService()