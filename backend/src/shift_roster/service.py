import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Optional, Sequence
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from .schema import ShiftRosterCreate, ShiftRosterUpdate
from src.db.models import ShiftRoster  


# ----------------------------
# Exceptions
# ----------------------------

class ShiftNotFound(HTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found.",
        )


class ShiftCodeAlreadyExists(HTTPException):
    def __init__(self, code: str) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Shift with code '{code}' already exists.",
        )


class BadRequest(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


# ----------------------------
# Service
# ----------------------------

class RosterService:
    """
    Service for Shift Roster CRUD.

    Matches routes.py signatures:
      - get_all_shift(session)
      - get_shift_by_uid(session, shift_uid)
      - create_shift(shift_data, user_id, session)
      - update_shift(session, shift_uid, shift_data)
      - delete_employee(shift_uid, session)
    """

    # ---------- helpers ----------

    @staticmethod
    def _normalize_code(code: str) -> str:
        return code.strip()

    @staticmethod
    def _normalize_name(name: str) -> str:
        return name.strip()

    @staticmethod
    def _duration_minutes(start: time, end: time) -> int:
        """
        Returns positive duration in minutes.
        Supports crossing midnight (e.g., 20:00 -> 00:00).
        """
        base = date(2000, 1, 1)
        sdt = datetime.combine(base, start)
        edt = datetime.combine(base, end)
        if edt <= sdt:
            edt += timedelta(days=1)
        delta = edt - sdt
        return int(delta.total_seconds() // 60)

    @classmethod
    def _validate_times(cls, start_time: time, end_time: time) -> None:
        if start_time is None or end_time is None:
            raise BadRequest("start_time and end_time are required.")
        minutes = cls._duration_minutes(start_time, end_time)
        if minutes <= 0:
            raise BadRequest("Shift duration must be greater than 0 minutes.")
        # Optional safety cap (prevents weird configs like 23h59m)
        if minutes > 16 * 60:
            raise BadRequest("Shift duration seems too long (> 16 hours). Please verify start/end time.")

    # ---------- queries ----------

    async def _get_by_uid(self, session: AsyncSession, shift_uid: uuid.UUID) -> Optional[ShiftRoster]:
        stmt = select(ShiftRoster).where(ShiftRoster.uid == shift_uid)
        return (await session.exec(stmt)).first()

    async def _code_exists(self, session: AsyncSession, code: str, *, exclude_uid: Optional[uuid.UUID] = None) -> bool:
        where = [func.lower(ShiftRoster.code) == code.lower()]
        if exclude_uid is not None:
            where.append(ShiftRoster.uid != exclude_uid)
        stmt = select(func.count()).select_from(ShiftRoster).where(*where)
        count = (await session.exec(stmt)).one()
        return bool(count and count > 0)

    # ---------- public methods ----------

    async def get_all_shift(self, session: AsyncSession) -> Sequence[ShiftRoster]:
        stmt = select(ShiftRoster).order_by(ShiftRoster.created_at.desc())
        return (await session.exec(stmt)).all()

    async def get_shift_by_uid(self, session: AsyncSession, shift_uid: uuid.UUID) -> ShiftRoster:
        shift = await self._get_by_uid(session, shift_uid)
        if not shift:
            raise ShiftNotFound()
        return shift

    async def create_shift(self,shift_data: ShiftRosterCreate,user_id: Optional[uuid.UUID],session: AsyncSession) -> ShiftRoster:
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Invalid token: user_uid not found.")

        code = self._normalize_code(shift_data.code)
        name = self._normalize_name(shift_data.name)

        if not code:
            raise BadRequest("code cannot be empty.")
        if not name:
            raise BadRequest("name cannot be empty.")

        self._validate_times(shift_data.start_time, shift_data.end_time)

        if await self._code_exists(session, code):
            raise ShiftCodeAlreadyExists(code)

        new_shift = ShiftRoster(
            uid=uuid.uuid4(),
            code=code,
            name=name,
            start_time=shift_data.start_time,
            end_time=shift_data.end_time,
            is_active=bool(shift_data.is_active),
            user_uid=user_id,
        )

        session.add(new_shift)
        try:
            await session.commit()
        except Exception as e:
            await session.rollback()
            # Most likely: DB constraint / unique violation
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Failed to create shift. Please try again.")from e

        await session.refresh(new_shift)
        return new_shift

    async def update_shift(self,session: AsyncSession,shift_uid: uuid.UUID,shift_data: ShiftRosterUpdate) -> ShiftRoster:
        shift = await self._get_by_uid(session, shift_uid)
        if not shift:
            raise ShiftNotFound()

        # Ensure at least one field provided
        if (
            shift_data.name is None
            and shift_data.start_time is None
            and shift_data.end_time is None
            and shift_data.is_active is None
        ):
            raise BadRequest("At least one field is required to update.")

        if shift_data.name is not None:
            name = self._normalize_name(shift_data.name)
            if not name:
                raise BadRequest("name cannot be empty.")
            shift.name = name

        # Handle time updates safely (validate as pair)
        start_time = shift.start_time if shift_data.start_time is None else shift_data.start_time
        end_time = shift.end_time if shift_data.end_time is None else shift_data.end_time

        if shift_data.start_time is not None or shift_data.end_time is not None:
            self._validate_times(start_time, end_time)
            shift.start_time = start_time
            shift.end_time = end_time

        if shift_data.is_active is not None:
            shift.is_active = bool(shift_data.is_active)

        try:
            session.add(shift)
            await session.commit()
        except Exception as e:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Failed to update shift. Please try again.") from e

        await session.refresh(shift)
        return shift

    async def delete_employee(self, shift_uid: str, session: AsyncSession) -> bool:
        """
        NOTE: Route uses shift_uid: str (not UUID). :contentReference[oaicite:3]{index=3}
        We accept str and try to parse it to UUID.
        """
        try:
            uid = uuid.UUID(shift_uid)
        except Exception:
            raise BadRequest("Invalid shift_uid. Must be a valid UUID string.")

        shift = await self._get_by_uid(session, uid)
        if not shift:
            return False

        try:
            await session.delete(shift)
            await session.commit()
        except Exception:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Failed to delete shift. Please try again.")

        return True