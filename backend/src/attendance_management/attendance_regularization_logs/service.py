import uuid
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import AttendanceRegularization, AttendanceRegularizationLog


class AttendanceRegularizationLogService:
    async def list_logs(self, session: AsyncSession, regularization_uid: uuid.UUID):
        regularization_stmt = select(AttendanceRegularization).where(AttendanceRegularization.uid == regularization_uid)
        regularization = (await session.exec(regularization_stmt)).first()
        if not regularization:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regularization request not found.")

        stmt = (select(AttendanceRegularizationLog).where(AttendanceRegularizationLog.regularization_uid == regularization_uid)
            .order_by(AttendanceRegularizationLog.created_at.asc()))
        result = await session.exec(stmt)
        return result.all()


attendance_regularization_log_service = AttendanceRegularizationLogService()