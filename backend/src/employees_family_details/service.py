import uuid
import logging
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy import func
from sqlmodel import select, desc
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Employee, EmployeeFamilyDetail
from .schema import EmployeeFamilyDetailCreate,EmployeeFamilyDetailUpdate

logger = logging.getLogger(__name__)


def _normalized(value: str) -> str:
    return value.strip().casefold()


async def _ensure_employee_exists(session: AsyncSession, employee_uid: uuid.UUID) -> None:
    stmt = select(Employee.uid).where(Employee.uid == employee_uid)
    result = await session.exec(stmt)
    employee = result.first()

    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee not found.")


async def _ensure_not_duplicate(session: AsyncSession,employee_uid: uuid.UUID,relation: str,full_name: str,exclude_uid: Optional[uuid.UUID] = None,
) -> None:
    stmt = select(EmployeeFamilyDetail).where(EmployeeFamilyDetail.employee_uid == employee_uid,func.lower(EmployeeFamilyDetail.relation) == _normalized(relation),
        func.lower(EmployeeFamilyDetail.full_name) == _normalized(full_name))

    if exclude_uid is not None:
        stmt = stmt.where(EmployeeFamilyDetail.uid != exclude_uid)

    result = await session.exec(stmt)
    existing = result.first()

    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail="This family detail already exists for the employee.")


class EmployeeFamilyDetailService:
    async def get_all(self, session: AsyncSession) -> List[EmployeeFamilyDetail]:
        stmt = select(EmployeeFamilyDetail).order_by(desc(EmployeeFamilyDetail.created_at))
        result = await session.exec(stmt)
        return result.all()

    async def get_by_uid(self, session: AsyncSession, family_uid: uuid.UUID) -> EmployeeFamilyDetail:
        stmt = select(EmployeeFamilyDetail).where(EmployeeFamilyDetail.uid == family_uid)
        result = await session.exec(stmt)
        obj = result.first()

        if obj is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee family detail not found.")
        return obj

    async def get_by_employee_uid(self, session: AsyncSession, employee_uid: uuid.UUID) -> List[EmployeeFamilyDetail]:
        await _ensure_employee_exists(session, employee_uid)

        stmt = (select(EmployeeFamilyDetail).where(EmployeeFamilyDetail.employee_uid == employee_uid).order_by(desc(EmployeeFamilyDetail.created_at)))
        result = await session.exec(stmt)
        return result.all()

    async def create(self,session: AsyncSession,payload: EmployeeFamilyDetailCreate,user_uid: str) -> EmployeeFamilyDetail:
        try:
            try:
                user_uid_uuid = uuid.UUID(user_uid)
            except ValueError as e:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,detail="Invalid user UID format.") from e

            await _ensure_employee_exists(session, payload.employee_uid)
            await _ensure_not_duplicate(session=session,employee_uid=payload.employee_uid,relation=payload.relation,
                full_name=payload.full_name)

            payload_data = payload.model_dump()
            payload_data["relation"] = payload_data["relation"].strip()
            payload_data["full_name"] = payload_data["full_name"].strip()

            obj = EmployeeFamilyDetail(**payload_data)
            obj.user_uid = user_uid_uuid

            session.add(obj)
            await session.commit()
            await session.refresh(obj)
            return obj

        except HTTPException:
            await session.rollback()
            raise
        except IntegrityError as e:
            await session.rollback()
            logger.error("Integrity error while creating family detail", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Could not create family detail due to duplicate or constraint issue.",
            ) from e
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error while creating family detail", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while creating family detail.",
            ) from e

    async def update(self,session: AsyncSession,family_uid: uuid.UUID,payload: EmployeeFamilyDetailUpdate) -> EmployeeFamilyDetail:
        obj = await self.get_by_uid(session, family_uid)

        new_relation = payload.relation.strip() if payload.relation is not None else obj.relation
        new_full_name = payload.full_name.strip() if payload.full_name is not None else obj.full_name

        await _ensure_not_duplicate(session=session,employee_uid=obj.employee_uid,relation=new_relation,full_name=new_full_name,
            exclude_uid=obj.uid)

        update_data = payload.model_dump(exclude_unset=True)

        if "relation" in update_data and update_data["relation"] is not None:
            update_data["relation"] = update_data["relation"].strip()

        if "full_name" in update_data and update_data["full_name"] is not None:
            update_data["full_name"] = update_data["full_name"].strip()

        for key, value in update_data.items():
            setattr(obj, key, value)

        session.add(obj)

        try:
            await session.commit()
            await session.refresh(obj)
            return obj
        except IntegrityError as e:
            await session.rollback()
            logger.error("Integrity error while updating family detail", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Could not update family detail due to duplicate or constraint issue.",
            ) from e
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error while updating family detail", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while updating family detail.",
            ) from e

    async def delete(self, session: AsyncSession, family_uid: uuid.UUID) -> None:
        obj = await self.get_by_uid(session, family_uid)

        try:
            await session.delete(obj)
            await session.commit()
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error while deleting family detail", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while deleting family detail.",
            ) from e


employee_family_detail_service = EmployeeFamilyDetailService()