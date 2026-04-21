import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Sequence, Tuple
from zoneinfo import ZoneInfo
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Attendance, AttendancePunchLog, Employee, EmployeeShift, ShiftRoster
from src.db.models import AttendanceStatus, PunchType
from src.config import Config


class AttendancePunchLogService:
    GRACE_MINUTES = 30
    IST = ZoneInfo(Config.TIME_ZONE)

    @classmethod
    def _now(cls) -> datetime:
        return datetime.now(cls.IST)

    @classmethod
    def _today(cls) -> date:
        return cls._now().date()

    @staticmethod
    def _q2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _combine(day: date, value: time) -> datetime:
        return datetime.combine(day, value)

    @classmethod
    def _to_ist(cls, dt: Optional[datetime]) -> Optional[datetime]:
        if dt is None:
            return None

        if dt.tzinfo is None or dt.utcoffset() is None:
            return dt.replace(tzinfo=cls.IST)

        return dt.astimezone(cls.IST)

    @classmethod
    def _duration_hours(cls, start_dt: datetime, end_dt: datetime) -> Decimal:
        start_dt = cls._to_ist(start_dt)
        end_dt = cls._to_ist(end_dt)

        total_seconds = Decimal(str((end_dt - start_dt).total_seconds()))
        hours = total_seconds / Decimal("3600")
        return hours.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _shift_duration_hours(start_time: time, end_time: time) -> Decimal:
        base_day = date(2000, 1, 1)
        start_dt = datetime.combine(base_day, start_time)
        end_dt = datetime.combine(base_day, end_time)

        if end_dt <= start_dt:
            end_dt += timedelta(days=1)

        seconds = Decimal(str((end_dt - start_dt).total_seconds()))
        return (seconds / Decimal("3600")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    async def _get_employee_by_email(self, session: AsyncSession, email: str) -> Employee:
        stmt = select(Employee).where(Employee.email == email)
        employee = (await session.exec(stmt)).first()
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found."
            )
        return employee

    async def _get_attendance_by_employee_date(
        self,
        session: AsyncSession,
        employee_uid: uuid.UUID,
        attendance_date: date
    ) -> Optional[Attendance]:
        stmt = select(Attendance).where(
            Attendance.employee_uid == employee_uid,
            Attendance.attendance_date == attendance_date
        )
        return (await session.exec(stmt)).first()

    async def _get_active_employee_shifts(
        self,
        session: AsyncSession,
        employee_uid: uuid.UUID
    ) -> Sequence[Tuple[EmployeeShift, ShiftRoster]]:
        stmt = (
            select(EmployeeShift, ShiftRoster)
            .join(ShiftRoster, EmployeeShift.shift_uid == ShiftRoster.uid)
            .where(
                EmployeeShift.employee_uid == employee_uid,
                EmployeeShift.is_active == True,
                ShiftRoster.is_active == True,
            )
        )
        result = await session.exec(stmt)
        rows = result.all()

        if not rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active shift assigned to this employee."
            )
        return rows

    def _calculate_total_assigned_shift_hours(
        self,
        rows: Sequence[Tuple[EmployeeShift, ShiftRoster]]
    ) -> Decimal:
        total = Decimal("0.00")
        for _, shift in rows:
            total += self._shift_duration_hours(shift.start_time, shift.end_time)
        return self._q2(total)

    async def _get_or_create_attendance(
        self,
        session: AsyncSession,
        employee_uid: uuid.UUID,
        user_uid: uuid.UUID,
        attendance_date: date,
        total_assigned_shift_hours: Decimal
    ) -> Attendance:
        attendance = await self._get_attendance_by_employee_date(
            session, employee_uid, attendance_date
        )
        if attendance:
            return attendance

        attendance = Attendance(
            user_uid=user_uid,
            employee_uid=employee_uid,
            attendance_date=attendance_date,
            total_assigned_shift_hours=total_assigned_shift_hours,
            total_worked_hours=Decimal("0.00"),
            status=AttendanceStatus.Absent,
            is_regularized=False,
        )
        session.add(attendance)
        await session.flush()
        return attendance

    def _validate_current_date_only(self, now_dt: datetime) -> None:
        if now_dt.date() != self._today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Punch in/punch out is allowed for current date only."
            )

    def _validate_punch_in_window(
        self,
        now_dt: datetime,
        rows: Sequence[Tuple[EmployeeShift, ShiftRoster]]
    ) -> None:
        now_dt = self._to_ist(now_dt)

        for _, shift in rows:
            shift_start_dt = datetime.combine(now_dt.date(), shift.start_time, tzinfo=self.IST)
            shift_end_dt = datetime.combine(now_dt.date(), shift.end_time, tzinfo=self.IST)

            early_punch_in = shift_start_dt - timedelta(minutes=self.GRACE_MINUTES)
            latest_punch_in = shift_end_dt

            if early_punch_in <= now_dt <= latest_punch_in:
                return

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Punch in is allowed only from {self.GRACE_MINUTES} minutes before shift start until shift end."
        )

    def _validate_punch_out_window(
        self,
        now_dt: datetime,
        rows: Sequence[Tuple[EmployeeShift, ShiftRoster]]
    ) -> None:
        now_dt = self._to_ist(now_dt)

        for _, shift in rows:
            shift_start_dt = datetime.combine(now_dt.date(), shift.start_time, tzinfo=self.IST)
            shift_end_dt = datetime.combine(now_dt.date(), shift.end_time, tzinfo=self.IST)

            earliest_punch_out = shift_start_dt
            late_punch_out = shift_end_dt + timedelta(minutes=self.GRACE_MINUTES)

            if earliest_punch_out <= now_dt <= late_punch_out:
                return

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Punch out is allowed only during shift time and up to {self.GRACE_MINUTES} minutes after shift end."
        )

    def _finalize_attendance_status(self, attendance: Attendance) -> None:
        first_punch_in = self._to_ist(attendance.first_punch_in)
        last_punch_out = self._to_ist(attendance.last_punch_out)

        if not first_punch_in:
            attendance.status = AttendanceStatus.Absent
            attendance.total_worked_hours = Decimal("0.00")
            return

        if not last_punch_out:
            attendance.status = AttendanceStatus.Absent
            attendance.total_worked_hours = Decimal("0.00")
            return

        if last_punch_out <= first_punch_in:
            attendance.status = AttendanceStatus.Absent
            attendance.total_worked_hours = Decimal("0.00")
            return

        attendance.first_punch_in = first_punch_in
        attendance.last_punch_out = last_punch_out

        worked_hours = self._duration_hours(first_punch_in, last_punch_out)
        attendance.total_worked_hours = self._q2(worked_hours)

        # once employee punches, this is not WO / Leave anymore
        attendance.leave_request_uid = None if attendance.status != AttendanceStatus.Leave else attendance.leave_request_uid
        attendance.leave_type_uid = None if attendance.status != AttendanceStatus.Leave else attendance.leave_type_uid

        if attendance.total_worked_hours >= Decimal("8.00"):
            attendance.status = AttendanceStatus.Present
        elif attendance.total_worked_hours >= Decimal("4.00"):
            attendance.status = AttendanceStatus.HalfDay
        else:
            attendance.status = AttendanceStatus.Absent

    async def _create_punch_log(
        self,
        session: AsyncSession,
        user_uid: uuid.UUID,
        employee_uid: uuid.UUID,
        attendance_uid: uuid.UUID,
        attendance_date: date,
        punch_type: PunchType,
        punch_time: datetime,
        is_valid: bool = True,
        invalid_reason: Optional[str] = None,
    ) -> AttendancePunchLog:
        log = AttendancePunchLog(
            user_uid=user_uid,
            employee_uid=employee_uid,
            attendance_uid=attendance_uid,
            attendance_date=attendance_date,
            punch_type=punch_type,
            punch_time=self._to_ist(punch_time),
            is_valid=is_valid,
            invalid_reason=invalid_reason,
            source="SELF",
        )
        session.add(log)
        await session.flush()
        return log

    async def punch_in_current_user(
        self,
        session: AsyncSession,
        user_uid: uuid.UUID,
        employee_email: str,
    ) -> dict:
        if not user_uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token user."
            )

        if not employee_email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Employee email not found in token."
            )

        now_dt = self._now()
        self._validate_current_date_only(now_dt)

        employee = await self._get_employee_by_email(session, employee_email)
        rows = await self._get_active_employee_shifts(session, employee.uid)
        self._validate_punch_in_window(now_dt, rows)

        total_assigned_shift_hours = self._calculate_total_assigned_shift_hours(rows)

        attendance = await self._get_or_create_attendance(
            session=session,
            employee_uid=employee.uid,
            user_uid=user_uid,
            attendance_date=now_dt.date(),
            total_assigned_shift_hours=total_assigned_shift_hours,
        )

        if attendance.first_punch_in is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Punch in already recorded for today."
            )

        attendance.first_punch_in = now_dt
        attendance.status = AttendanceStatus.Absent
        attendance.updated_at = self._now()

        await self._create_punch_log(
            session=session,
            user_uid=user_uid,
            employee_uid=employee.uid,
            attendance_uid=attendance.uid,
            attendance_date=now_dt.date(),
            punch_type=PunchType.IN,
            punch_time=now_dt,
        )

        await session.commit()
        await session.refresh(attendance)

        return {
            "attendance_uid": attendance.uid,
            "employee_uid": attendance.employee_uid,
            "attendance_date": attendance.attendance_date,
            "first_punch_in": attendance.first_punch_in,
            "last_punch_out": attendance.last_punch_out,
            "total_assigned_shift_hours": attendance.total_assigned_shift_hours,
            "total_worked_hours": attendance.total_worked_hours,
            "status": attendance.status,
            "message": "Punch in recorded successfully.",
        }

    async def punch_out_current_user(
        self,
        session: AsyncSession,
        user_uid: uuid.UUID,
        employee_email: str,
    ) -> dict:
        if not user_uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token user."
            )

        if not employee_email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Employee email not found in token."
            )

        now_dt = self._now()
        self._validate_current_date_only(now_dt)

        employee = await self._get_employee_by_email(session, employee_email)
        rows = await self._get_active_employee_shifts(session, employee.uid)
        self._validate_punch_out_window(now_dt, rows)

        attendance = await self._get_attendance_by_employee_date(
            session, employee.uid, now_dt.date()
        )
        if not attendance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Punch in not found for today. Please punch in first."
            )

        if attendance.first_punch_in is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Punch in not found for today. Please punch in first."
            )

        await self._create_punch_log(
            session=session,
            user_uid=user_uid,
            employee_uid=employee.uid,
            attendance_uid=attendance.uid,
            attendance_date=now_dt.date(),
            punch_type=PunchType.OUT,
            punch_time=now_dt,
        )

        existing_last_punch_out = self._to_ist(attendance.last_punch_out)
        if existing_last_punch_out is None or now_dt > existing_last_punch_out:
            attendance.last_punch_out = now_dt

        self._finalize_attendance_status(attendance)
        attendance.updated_at = self._now()

        await session.commit()
        await session.refresh(attendance)

        return {
            "attendance_uid": attendance.uid,
            "employee_uid": attendance.employee_uid,
            "attendance_date": attendance.attendance_date,
            "first_punch_in": attendance.first_punch_in,
            "last_punch_out": attendance.last_punch_out,
            "total_assigned_shift_hours": attendance.total_assigned_shift_hours,
            "total_worked_hours": attendance.total_worked_hours,
            "status": attendance.status,
            "message": "Punch out recorded successfully.",
        }

    async def list_my_punch_logs(
        self,
        session: AsyncSession,
        employee_email: str,
        attendance_date: date
    ):
        employee = await self._get_employee_by_email(session, employee_email)
        stmt = (
            select(AttendancePunchLog)
            .where(
                AttendancePunchLog.employee_uid == employee.uid,
                AttendancePunchLog.attendance_date == attendance_date
            )
            .order_by(AttendancePunchLog.punch_time.asc())
        )
        result = await session.exec(stmt)
        return result.all()


attendance_punch_log_service = AttendancePunchLogService()