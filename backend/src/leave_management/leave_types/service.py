from decimal import Decimal, ROUND_HALF_UP
import uuid

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models.leave_management import LeaveType
from .schema import LeaveTypeCreate, LeaveTypeUpdate


class LeaveTypeService:
    @staticmethod
    def _q2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    async def create_leave_type(self, session: AsyncSession, data: LeaveTypeCreate, user_uid: uuid.UUID):
        stmt = select(LeaveType).where((LeaveType.code == data.code) | (LeaveType.name == data.name))
        existing = (await session.exec(stmt)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Leave type already exists.")

        leave_type = LeaveType(
            code=data.code,
            name=data.name,
            annual_days=self._q2(data.annual_days),
            auto_allocate=data.auto_allocate,
            requires_manual_grant=data.requires_manual_grant,
            carry_forward_allowed=data.carry_forward_allowed,
            carry_forward_cap=self._q2(data.carry_forward_cap) if data.carry_forward_cap is not None else None,
            user_uid=user_uid,
        )
        session.add(leave_type)
        await session.commit()
        await session.refresh(leave_type)
        return leave_type

    async def list_leave_types(self, session: AsyncSession):
        stmt = select(LeaveType).order_by(LeaveType.name.asc())
        result = await session.exec(stmt)
        return result.all()

    async def get_leave_type(self, session: AsyncSession, leave_type_uid: uuid.UUID):
        stmt = select(LeaveType).where(LeaveType.uid == leave_type_uid)
        leave_type = (await session.exec(stmt)).first()
        if not leave_type:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found.")
        return leave_type

    async def update_leave_type(self, session: AsyncSession, leave_type_uid: uuid.UUID, data: LeaveTypeUpdate):
        leave_type = await self.get_leave_type(session, leave_type_uid)

        if data.name is not None:
            leave_type.name = data.name
        if data.annual_days is not None:
            leave_type.annual_days = self._q2(data.annual_days)
        if data.auto_allocate is not None:
            leave_type.auto_allocate = data.auto_allocate
        if data.requires_manual_grant is not None:
            leave_type.requires_manual_grant = data.requires_manual_grant
        if data.carry_forward_allowed is not None:
            leave_type.carry_forward_allowed = data.carry_forward_allowed
        if data.carry_forward_cap is not None:
            leave_type.carry_forward_cap = self._q2(data.carry_forward_cap)
        if data.is_active is not None:
            leave_type.is_active = data.is_active

        await session.commit()
        await session.refresh(leave_type)
        return leave_type

    async def delete_leave_type(self, session: AsyncSession, leave_type_uid: uuid.UUID):
        leave_type = await self.get_leave_type(session, leave_type_uid)

        await session.delete(leave_type)
        await session.commit()

        return {"message": "Leave type deleted successfully."}


leave_type_service = LeaveTypeService()