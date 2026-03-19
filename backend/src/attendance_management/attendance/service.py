import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Sequence
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Attendance


class AttendanceService:
    @staticmethod
    def _q2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    async def get_attendance_by_uid(self, session: AsyncSession, attendance_uid: uuid.UUID) -> Attendance:
        stmt = select(Attendance).where(Attendance.uid == attendance_uid)
        attendance = (await session.exec(stmt)).first()
        if not attendance:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found.")
        return attendance

    async def get_attendance_by_employee_and_date(self, session: AsyncSession, employee_uid: uuid.UUID, attendance_date: date) -> Optional[Attendance]:
        stmt = select(Attendance).where(Attendance.employee_uid == employee_uid, Attendance.attendance_date == attendance_date)
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
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update attendance record.") from exc

        return attendance


attendance_service = AttendanceService()
