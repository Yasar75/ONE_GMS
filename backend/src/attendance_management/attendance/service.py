import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Sequence
import sqlalchemy as sa
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import Config
from src.db.models import Attendance, AttendanceStatus, Employee, ShiftRoster, EmployeeShift
from src.db.models.employee import EmployeeStatus
from src.db.models.leave_management import LeaveRequest, LeaveRequestStatus


class AttendanceService:
    @staticmethod
    def _q2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _is_weekend(self, target_date: date) -> bool:
        return target_date.weekday() in Config.WEEKEND_DAYS

    async def get_attendance_by_uid(self, session: AsyncSession, attendance_uid: uuid.UUID) -> Attendance:
        stmt = select(Attendance).where(Attendance.uid == attendance_uid)
        attendance = (await session.exec(stmt)).first()
        if not attendance:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found.")
        return attendance

    async def get_attendance_by_employee_and_date(
        self,
        session: AsyncSession,
        employee_uid: uuid.UUID,
        attendance_date: date,
    ) -> Optional[Attendance]:
        stmt = select(Attendance).where(
            Attendance.employee_uid == employee_uid,
            Attendance.attendance_date == attendance_date,
        )
        return (await session.exec(stmt)).first()

    async def get_all_attendance(self, session: AsyncSession, employee_uid: Optional[uuid.UUID] = None) -> Sequence[Attendance]:
        stmt = select(Attendance)
        if employee_uid:
            stmt = stmt.where(Attendance.employee_uid == employee_uid)
        stmt = stmt.order_by(Attendance.attendance_date.desc(), Attendance.created_at.desc())
        result = await session.exec(stmt)
        return result.all()

    async def update_attendance(self, session: AsyncSession, attendance_uid: uuid.UUID, data) -> Attendance:
        attendance = await self.get_attendance_by_uid(session, attendance_uid)

        if data.first_punch_in is not None:
            attendance.first_punch_in = data.first_punch_in
        if data.last_punch_out is not None:
            attendance.last_punch_out = data.last_punch_out

        if attendance.first_punch_in and attendance.last_punch_out and attendance.last_punch_out < attendance.first_punch_in:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="last_punch_out must be greater than first_punch_in.")

        if data.total_worked_hours is not None:
            attendance.total_worked_hours = self._q2(Decimal(str(data.total_worked_hours)))
        if data.status is not None:
            attendance.status = data.status
        if data.is_regularized is not None:
            attendance.is_regularized = data.is_regularized
        if data.remarks is not None:
            attendance.remarks = data.remarks

        attendance.updated_at = datetime.utcnow()

        try:
            session.add(attendance)
            await session.commit()
            await session.refresh(attendance)
        except Exception as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update attendance record.",
            ) from exc

        return attendance

    async def _get_active_employees_for_date(self, session: AsyncSession, target_date: date) -> Sequence[Employee]:
        stmt = (
            select(Employee)
            .where(Employee.status == EmployeeStatus.Active)
            .where(sa.or_(Employee.join_date.is_(None), Employee.join_date <= target_date))
            .order_by(Employee.created_at.asc())
        )
        return (await session.exec(stmt)).all()

    async def _get_total_assigned_shift_hours(self, session: AsyncSession, employee_uid: uuid.UUID) -> Decimal:
        stmt = (
            select(EmployeeShift, ShiftRoster)
            .join(ShiftRoster, EmployeeShift.shift_uid == ShiftRoster.uid)
            .where(
                EmployeeShift.employee_uid == employee_uid,
                EmployeeShift.is_active == True,
                ShiftRoster.is_active == True,
            )
        )
        rows = (await session.exec(stmt)).all()

        if not rows:
            return Decimal("0.00")

        total = Decimal("0.00")
        for _, shift in rows:
            start_dt = datetime.combine(date(2000, 1, 1), shift.start_time)
            end_dt = datetime.combine(date(2000, 1, 1), shift.end_time)
            if end_dt <= start_dt:
                end_dt = end_dt + timedelta(days=1)
            hours = Decimal(str((end_dt - start_dt).total_seconds())) / Decimal("3600")
            total += hours

        return self._q2(total)

    async def _get_approved_leave_for_date(
        self,
        session: AsyncSession,
        employee_uid: uuid.UUID,
        target_date: date,
    ) -> Optional[LeaveRequest]:
        stmt = select(LeaveRequest).where(
            LeaveRequest.employee_uid == employee_uid,
            LeaveRequest.status == LeaveRequestStatus.Approved,
            LeaveRequest.start_date <= target_date,
            LeaveRequest.end_date >= target_date,
        )
        return (await session.exec(stmt)).first()

    def _has_actual_work(self, attendance: Attendance) -> bool:
        return bool(
            attendance.first_punch_in
            or attendance.last_punch_out
            or (attendance.total_worked_hours and attendance.total_worked_hours > Decimal("0.00"))
        )

    def _apply_final_status_by_worked_hours(self, attendance: Attendance) -> None:
        if not attendance.first_punch_in or not attendance.last_punch_out:
            attendance.total_worked_hours = Decimal("0.00")
            attendance.status = AttendanceStatus.Absent
            return

        if attendance.last_punch_out <= attendance.first_punch_in:
            attendance.total_worked_hours = Decimal("0.00")
            attendance.status = AttendanceStatus.Absent
            return

        seconds = Decimal(str((attendance.last_punch_out - attendance.first_punch_in).total_seconds()))
        worked_hours = seconds / Decimal("3600")
        attendance.total_worked_hours = self._q2(worked_hours)

        if attendance.total_worked_hours >= Decimal("8.00"):
            attendance.status = AttendanceStatus.Present
        elif attendance.total_worked_hours >= Decimal("4.00"):
            attendance.status = AttendanceStatus.HalfDay
        else:
            attendance.status = AttendanceStatus.Absent

    async def _sync_single_employee_for_date(
        self,
        session: AsyncSession,
        employee: Employee,
        target_date: date,
    ) -> tuple[bool, bool]:
        created = False
        updated = False

        total_assigned_shift_hours = await self._get_total_assigned_shift_hours(session, employee.uid)
        approved_leave = await self._get_approved_leave_for_date(session, employee.uid, target_date)

        attendance = await self.get_attendance_by_employee_and_date(session, employee.uid, target_date)
        if not attendance:
            attendance = Attendance(
                user_uid=employee.user_uid,
                employee_uid=employee.uid,
                attendance_date=target_date,
                total_assigned_shift_hours=total_assigned_shift_hours,
                total_worked_hours=Decimal("0.00"),
                status=AttendanceStatus.Absent,
                is_regularized=False,
                remarks="Auto-generated daily attendance",
            )
            session.add(attendance)
            await session.flush()
            created = True
        else:
            attendance.total_assigned_shift_hours = total_assigned_shift_hours

        # do not overwrite pending regularization
        if attendance.status == AttendanceStatus.PendingRegularization:
            attendance.updated_at = datetime.utcnow()
            return created, updated

        # approved leave has priority
        if approved_leave and not self._has_actual_work(attendance):
            attendance.first_punch_in = None
            attendance.last_punch_out = None
            attendance.total_worked_hours = Decimal("0.00")
            attendance.status = AttendanceStatus.Leave
            attendance.leave_request_uid = approved_leave.uid
            attendance.leave_type_uid = approved_leave.leave_type_uid
            attendance.remarks = "Approved leave"
            attendance.updated_at = datetime.utcnow()
            updated = True
            return created, updated

        # if already worked, calculate final status
        if self._has_actual_work(attendance):
            attendance.leave_request_uid = None
            attendance.leave_type_uid = None
            self._apply_final_status_by_worked_hours(attendance)
            attendance.updated_at = datetime.utcnow()
            updated = True
            return created, updated

        # weekend
        if self._is_weekend(target_date):
            attendance.first_punch_in = None
            attendance.last_punch_out = None
            attendance.total_worked_hours = Decimal("0.00")
            attendance.status = AttendanceStatus.WO
            attendance.leave_request_uid = None
            attendance.leave_type_uid = None
            attendance.remarks = "Weekly Off"
            attendance.updated_at = datetime.utcnow()
            updated = True
            return created, updated

        # normal working day default absent
        attendance.first_punch_in = None
        attendance.last_punch_out = None
        attendance.total_worked_hours = Decimal("0.00")
        attendance.status = AttendanceStatus.Absent
        attendance.leave_request_uid = None
        attendance.leave_type_uid = None
        attendance.remarks = "Auto-marked absent"
        attendance.updated_at = datetime.utcnow()
        updated = True
        return created, updated

    async def sync_daily_attendance(
        self,
        session: AsyncSession,
        target_date: date,
    ) -> dict:
        employees = await self._get_active_employees_for_date(session, target_date)

        created_count = 0
        updated_count = 0

        for employee in employees:
            created, updated = await self._sync_single_employee_for_date(session, employee, target_date)
            if created:
                created_count += 1
            if updated:
                updated_count += 1

        await session.commit()

        return {
            "date": target_date,
            "employees_processed": len(employees),
            "created_count": created_count,
            "updated_count": updated_count,
        }

    async def sync_attendance_range(
        self,
        session: AsyncSession,
        start_date: date,
        end_date: date,
    ) -> dict:
        if end_date < start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="end_date cannot be before start_date.",
            )

        current_date = start_date
        total_created = 0
        total_updated = 0
        total_employees_processed = 0
        total_days = 0

        while current_date <= end_date:
            result = await self.sync_daily_attendance(session, current_date)
            total_created += result["created_count"]
            total_updated += result["updated_count"]
            total_employees_processed += result["employees_processed"]
            total_days += 1
            current_date += timedelta(days=1)

        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_days": total_days,
            "employees_processed": total_employees_processed,
            "created_count": total_created,
            "updated_count": total_updated,
        }


attendance_service = AttendanceService()