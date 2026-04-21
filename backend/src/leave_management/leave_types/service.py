from decimal import Decimal, ROUND_HALF_UP
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models.leave_management import LeaveType
from .schema import LeaveTypeCreate, LeaveTypeUpdate


class LeaveTypeService:
    @staticmethod
    def _q2(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _normalize_text(value: str) -> str:
        return " ".join(value.strip().split())

    async def _ensure_leave_type_unique(self,session: AsyncSession,*,code: str,name: str,exclude_uid: uuid.UUID | None = None) -> None:
        normalized_code = self._normalize_text(code).lower()
        normalized_name = self._normalize_text(name).lower()

        stmt = select(LeaveType).where((func.lower(LeaveType.code) == normalized_code) |(func.lower(LeaveType.name) == normalized_name))

        if exclude_uid is not None:
            stmt = stmt.where(LeaveType.uid != exclude_uid)

        existing = (await session.exec(stmt)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail="Leave type code or name already exists.")

    async def create_leave_type(self, session: AsyncSession, data: LeaveTypeCreate, user_uid: uuid.UUID):
        normalized_code = self._normalize_text(data.code)
        normalized_name = self._normalize_text(data.name)

        await self._ensure_leave_type_unique(session,code=normalized_code,name=normalized_name)

        leave_type = LeaveType(code=normalized_code,name=normalized_name,annual_days=self._q2(data.annual_days),auto_allocate=data.auto_allocate,requires_manual_grant=data.requires_manual_grant,carry_forward_allowed=data.carry_forward_allowed,
            carry_forward_cap=self._q2(data.carry_forward_cap) if data.carry_forward_cap is not None else None,
            user_uid=user_uid)
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

        new_code = self._normalize_text(data.code) if data.code is not None else leave_type.code
        new_name = self._normalize_text(data.name) if data.name is not None else leave_type.name

        if (new_code.lower() != self._normalize_text(leave_type.code).lower() or new_name.lower() != self._normalize_text(leave_type.name).lower()):
            await self._ensure_leave_type_unique(session,code=new_code,name=new_name,exclude_uid=leave_type_uid)

        if data.code is not None:
            leave_type.code = new_code
        if data.name is not None:
            leave_type.name = new_name
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