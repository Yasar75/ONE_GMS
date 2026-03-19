import uuid
from datetime import date, datetime, time, timedelta
from typing import Optional, Sequence
from src.config import Config
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from .schema import EmployeeShiftCreate, EmployeeShiftUpdate
from src.db.models import EmployeeShift, ShiftRoster, Employee


# ----------------------------
# Exceptions
# ----------------------------

class ShiftNotFound(HTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee shift assignment not found.",
        )


class BadRequest(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


class ConflictError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )


# ----------------------------
# Service
# ----------------------------

class EmployeeShiftService:
    """
    Service for Employee Shift assignment CRUD.

    Expected route signatures:
      - get_all_employee_shift(session)
      - get_employee_shift_by_uid(session, employee_shift_uid)
      - create_employee_shift(employee_shift_data, user_id, session)
      - update_employee_shift(session, employee_shift_uid, employee_shift_data)
      - delete_employee_shift(employee_shift_uid, session)

    Business rule:
      - An employee may have more than one active shift.
      - Total active shift working hours per day must not exceed 8 hours.
    """

    MAX_WORKING_HOURS_PER_DAY = Config.MAX_WORKING_HOURS_PER_DAY
    MAX_WORKING_MINUTES_PER_DAY = MAX_WORKING_HOURS_PER_DAY * 60

    # ---------- helpers ----------

    @staticmethod
    def _duration_minutes(start: time, end: time) -> int:
        """
        Returns positive duration in minutes.
        Supports crossing midnight (e.g. 20:00 -> 00:00).
        """
        base = date(2000, 1, 1)
        start_dt = datetime.combine(base, start)
        end_dt = datetime.combine(base, end)

        if end_dt <= start_dt:
            end_dt += timedelta(days=1)

        delta = end_dt - start_dt
        return int(delta.total_seconds() // 60)

    async def _get_employee_shift_by_uid(self, session: AsyncSession, employee_shift_uid: uuid.UUID) -> Optional[EmployeeShift]:
        stmt = select(EmployeeShift).where(EmployeeShift.uid == employee_shift_uid)
        result = await session.exec(stmt)
        return result.first()
    
    async def _get_employee_shift_by_employee_uid(self, session: AsyncSession, employee_shift_uid: uuid.UUID) -> Optional[EmployeeShift]:
        stmt = select(EmployeeShift).where(EmployeeShift.employee_uid == employee_shift_uid)
        result = await session.exec(stmt)
        return result.first()
    
    
    async def _get_employee_by_uid(self, session: AsyncSession, employee_uid: uuid.UUID) -> Optional[Employee]:
        stmt = select(Employee).where(Employee.uid == employee_uid)
        result = await session.exec(stmt)
        return result.first()

    async def _get_shift_by_uid(self, session: AsyncSession, shift_uid: uuid.UUID) -> Optional[ShiftRoster]:
        stmt = select(ShiftRoster).where(ShiftRoster.uid == shift_uid)
        result = await session.exec(stmt)
        return result.first()

    async def _assignment_exists(self,session: AsyncSession,employee_uid: uuid.UUID,shift_uid: uuid.UUID,*,exclude_uid: Optional[uuid.UUID] = None,
    ) -> bool:
        where_conditions = [EmployeeShift.employee_uid == employee_uid,EmployeeShift.shift_uid == shift_uid]

        if exclude_uid is not None:
            where_conditions.append(EmployeeShift.uid != exclude_uid)
        stmt = select(func.count()).select_from(EmployeeShift).where(*where_conditions)
        result = await session.exec(stmt)
        count = result.one()
        return int(count or 0) > 0

    async def _get_total_active_minutes_for_employee(self,session: AsyncSession,employee_uid: uuid.UUID,*,exclude_assignment_uid: Optional[uuid.UUID] = None,
    ) -> int:
        """
        Sum duration of all active assigned shifts for the employee.
        """
        stmt = (select(EmployeeShift, ShiftRoster).join(ShiftRoster, EmployeeShift.shift_uid == ShiftRoster.uid)
            .where(EmployeeShift.employee_uid == employee_uid,EmployeeShift.is_active == True))

        if exclude_assignment_uid is not None:
            stmt = stmt.where(EmployeeShift.uid != exclude_assignment_uid)
        result = await session.exec(stmt)
        rows = result.all()
        total_minutes = 0
        for _, shift in rows:
            total_minutes += self._duration_minutes(shift.start_time, shift.end_time)
        return total_minutes

    async def _validate_employee_and_shift_exist(self,session: AsyncSession,employee_uid: uuid.UUID,shift_uid: uuid.UUID) -> ShiftRoster:
        employee = await self._get_employee_by_uid(session, employee_uid)
        if not employee:
            raise BadRequest("Employee not found.")
        shift = await self._get_shift_by_uid(session, shift_uid)
        if not shift:
            raise BadRequest("Shift roster not found.")
        return shift

    async def _validate_total_working_hours(self,session: AsyncSession,employee_uid: uuid.UUID,shift_uid: uuid.UUID,*,exclude_assignment_uid: Optional[uuid.UUID] = None,new_is_active: bool = True) -> None:
        """
        Ensure total active shift duration for the employee does not exceed 8/9 hours/day.
        """
        if not new_is_active:
            return
        shift = await self._get_shift_by_uid(session, shift_uid)
        if not shift:
            raise BadRequest("Shift roster not found.")
        current_total_minutes = await self._get_total_active_minutes_for_employee(
            session,
            employee_uid,
            exclude_assignment_uid=exclude_assignment_uid,
        )
        new_shift_minutes = self._duration_minutes(shift.start_time, shift.end_time)
        proposed_total = current_total_minutes + new_shift_minutes

        if proposed_total > self.MAX_WORKING_MINUTES_PER_DAY:
            raise BadRequest(
                f"Total active working hours for this employee cannot exceed "
                f"{self.MAX_WORKING_HOURS_PER_DAY} hours per day."
            )

    # ----------CURD Operation ----------
    
    ## Get all employee's shift detail.
    async def get_all_employee_shift(self,session: AsyncSession) -> Sequence[EmployeeShift]:
        stmt = select(EmployeeShift).order_by(EmployeeShift.created_at.desc())
        result = await session.exec(stmt)
        return result.all()

    ## Get employee's shift details by shift uid.
    async def get_employee_shift_by_uid(self,session: AsyncSession,employee_shift_uid: uuid.UUID) -> EmployeeShift:
        employee_shift = await self._get_employee_shift_by_uid(session, employee_shift_uid)
        if not employee_shift:
            raise ShiftNotFound()
        return employee_shift

    ## Get employee's shift details by employee uid.
    async def get_employee_shift_by_employee_uid(self, session: AsyncSession, employee_uid: uuid.UUID) -> EmployeeShift:
        employee_shift = await self._get_employee_shift_by_employee_uid(session, employee_uid)
        if not employee_shift:
            raise ShiftNotFound()
        return employee_shift
    
    ## create employee's shift.
    async def create_employee_shift(self,employee_shift_data: EmployeeShiftCreate,user_id: Optional[uuid.UUID],session: AsyncSession,
    ) -> EmployeeShift:
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Invalid token: user_uid not found.")

        shift = await self._validate_employee_and_shift_exist(session,employee_shift_data.employee_uid,employee_shift_data.shift_uid)

        if not shift.is_active:
            raise BadRequest("Inactive shift cannot be assigned to employee.")

        already_exists = await self._assignment_exists(session,employee_shift_data.employee_uid,employee_shift_data.shift_uid)
        if already_exists:
            raise ConflictError("This shift is already assigned to the employee.")

        await self._validate_total_working_hours(session,employee_shift_data.employee_uid,employee_shift_data.shift_uid,new_is_active=employee_shift_data.is_active)

        new_employee_shift = EmployeeShift(
            uid=uuid.uuid4(),
            employee_uid=employee_shift_data.employee_uid,
            shift_uid=employee_shift_data.shift_uid,
            is_active=employee_shift_data.is_active,
            user_uid=user_id,
        )

        session.add(new_employee_shift)

        try:
            await session.commit()
            await session.refresh(new_employee_shift)
        except Exception as e:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create employee shift assignment. Please try again.",
            ) from e

        return new_employee_shift

    ## Update employee's shift.
    async def update_employee_shift(self,session: AsyncSession,employee_shift_uid: uuid.UUID,employee_shift_data: EmployeeShiftUpdate,) -> EmployeeShift:
        employee_shift = await self._get_employee_shift_by_uid(session, employee_shift_uid)
        if not employee_shift:
            raise ShiftNotFound()

        if (employee_shift_data.shift_uid is None and employee_shift_data.is_active is None):
            raise BadRequest("At least one field is required to update.")

        new_shift_uid = (employee_shift.shift_uid if employee_shift_data.shift_uid is None else employee_shift_data.shift_uid)
        
        new_is_active = (employee_shift.is_active if employee_shift_data.is_active is None else employee_shift_data.is_active)

        shift = await self._get_shift_by_uid(session, new_shift_uid)
        if not shift:
            raise BadRequest("Shift roster not found.")

        if new_is_active and not shift.is_active:
            raise BadRequest("Inactive shift cannot be assigned as active.")

        duplicate_exists = await self._assignment_exists(session,employee_shift.employee_uid,new_shift_uid,exclude_uid=employee_shift.uid)
        if duplicate_exists:
            raise ConflictError("This shift is already assigned to the employee.")

        await self._validate_total_working_hours(session,employee_shift.employee_uid,new_shift_uid,exclude_assignment_uid=employee_shift.uid,new_is_active=new_is_active,)

        employee_shift.shift_uid = new_shift_uid
        employee_shift.is_active = new_is_active
        employee_shift.updated_at = datetime.utcnow()

        try:
            session.add(employee_shift)
            await session.commit()
            await session.refresh(employee_shift)
        except Exception as e:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Failed to update employee shift assignment. Please try again.",
            ) from e

        return employee_shift

    ## Delete employee shift.
    async def delete_employee_shift(self,employee_shift_uid: str,session: AsyncSession,) -> bool:
        try:
            uid = uuid.UUID(employee_shift_uid)
        except Exception:
            raise BadRequest("Invalid employee_shift_uid. Must be a valid UUID string.")

        employee_shift = await self._get_employee_shift_by_uid(session, uid)
        if not employee_shift:
            return False

        try:
            await session.delete(employee_shift)
            await session.commit()
        except Exception as e:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete employee shift assignment. Please try again.",
            ) from e

        return True