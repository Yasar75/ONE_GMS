import uuid
import logging
from typing import Optional, List

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import select, func, desc
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import EmployeeSkill, Employee
from src.employee_skill.schema import EmployeeSkillCreate, EmployeeSkillUpdate

logger = logging.getLogger(__name__)


def _normalize_skill_for_compare(skill: str) -> str:
    # store/compare in a case-insensitive + trim manner
    return skill.strip().casefold()


async def _ensure_employee_exists(session: AsyncSession, employee_uid: uuid.UUID) -> None:
    res = await session.execute(select(Employee.uid).where(Employee.uid == employee_uid))
    if res.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )


async def _ensure_skill_not_duplicate(
    session: AsyncSession,
    employee_uid: uuid.UUID,
    skill: str,
    exclude_uid: Optional[uuid.UUID] = None,
) -> None:
    norm = _normalize_skill_for_compare(skill)

    stmt = select(EmployeeSkill.uid).where(
        EmployeeSkill.employee_uid == employee_uid,
        func.lower(EmployeeSkill.skill) == norm,
    )
    if exclude_uid is not None:
        stmt = stmt.where(EmployeeSkill.uid != exclude_uid)

    res = await session.execute(stmt)
    if res.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This skill already exists for the employee.",
        )


class EmployeeSkillService:
    async def get_all_employee_skill(self, session: AsyncSession) -> List[EmployeeSkill]:
        stmt = select(EmployeeSkill).order_by(desc(EmployeeSkill.created_at))
        result = await session.exec(stmt)
        return result.all()

    async def get_employee_skill_by_uid(
        self, session: AsyncSession, employee_uid: uuid.UUID
    ) -> EmployeeSkill:
        stmt = select(EmployeeSkill).where(EmployeeSkill.employee_uid == employee_uid)
        result = await session.exec(stmt)
        obj = result.first()
        if obj is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee skill not found.",
            )
        return obj

    async def create_Employee_skill(
        self, skill_data: EmployeeSkillCreate, user_uid: str, session: AsyncSession
    ) -> EmployeeSkill:
        try:
            try:
                user_uid_uuid = uuid.UUID(user_uid)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid user_uid UUID format.",
                ) from e

            await _ensure_employee_exists(session, skill_data.employee_uid)
            await _ensure_skill_not_duplicate(
                session,
                skill_data.employee_uid,
                skill_data.skill,
            )

            new_skill = EmployeeSkill(**skill_data.model_dump())
            new_skill.user_uid = user_uid_uuid

            session.add(new_skill)
            await session.flush()
            await session.commit()
            await session.refresh(new_skill)
            return new_skill

        except HTTPException:
            await session.rollback()
            raise
        except IntegrityError as e:
            await session.rollback()
            logger.error("Integrity error creating Employee skill", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Could not create skill (possible duplicate/constraint).",
            ) from e
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error creating Employee skill", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while creating skill.",
            ) from e

    async def update(
        self,
        session: AsyncSession,
        skill_uid: uuid.UUID,
        payload: EmployeeSkillUpdate,
    ) -> EmployeeSkill:
        obj = await self.get_employee_skill_by_uid(session, skill_uid)

        if payload.skill is not None:
            await _ensure_skill_not_duplicate(
                session,
                obj.employee_uid,
                payload.skill,
                exclude_uid=obj.uid,
            )
            obj.skill = payload.skill.strip()

        session.add(obj)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Could not update skill (possible duplicate).",
            ) from e

        await session.refresh(obj)
        return obj

    async def delete(self, session: AsyncSession, skill_uid: uuid.UUID) -> None:
        obj = await self.get_employee_skill_by_uid(session, skill_uid)
        await session.delete(obj)
        await session.commit()