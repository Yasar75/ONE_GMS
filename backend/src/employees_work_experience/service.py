import uuid
import logging
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy import func
from sqlmodel import select, desc
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Employee, EmployeeWorkExperience
from .schema import EmployeeWorkExperienceCreate, EmployeeWorkExperienceUpdate

logger = logging.getLogger(__name__)


def _normalized(value: str) -> str:
    return value.strip().casefold()


def calculate_year_of_exp(start_date: date, end_date: Optional[date] = None) -> Decimal:
    final_date = end_date or date.today()

    if start_date > final_date:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,detail="start_date cannot be greater than end_date/current date.")

    total_days = (final_date - start_date).days
    years = Decimal(total_days / 365).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return years


async def _ensure_employee_exists(session: AsyncSession, employee_uid: uuid.UUID) -> None:
    stmt = select(Employee.uid).where(Employee.uid == employee_uid)
    result = await session.exec(stmt)
    employee = result.first()

    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee not found.")


async def _ensure_not_duplicate(session: AsyncSession,employee_uid: uuid.UUID,company_name: str,job_title: str,start_date,
exclude_uid: Optional[uuid.UUID] = None) -> None:
    stmt = select(EmployeeWorkExperience).where(
        EmployeeWorkExperience.employee_uid == employee_uid,
        func.lower(EmployeeWorkExperience.company_name) == _normalized(company_name),
        func.lower(EmployeeWorkExperience.job_title) == _normalized(job_title),
        EmployeeWorkExperience.start_date == start_date)

    if exclude_uid is not None:
        stmt = stmt.where(EmployeeWorkExperience.uid != exclude_uid)

    result = await session.exec(stmt)
    existing = result.first()

    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail="This work experience already exists for the employee.")


## CURD Operation

class EmployeeWorkExperienceService:
    async def get_all(self, session: AsyncSession) -> List[EmployeeWorkExperience]:
        stmt = select(EmployeeWorkExperience).order_by(desc(EmployeeWorkExperience.created_at))
        result = await session.exec(stmt)
        return result.all()

    async def get_by_uid(self,session: AsyncSession,experience_uid: uuid.UUID,) -> EmployeeWorkExperience:
        stmt = select(EmployeeWorkExperience).where(EmployeeWorkExperience.uid == experience_uid)
        result = await session.exec(stmt)
        obj = result.first()

        if obj is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee work experience not found.")
        return obj

    async def get_by_employee_uid(self,session: AsyncSession,employee_uid: uuid.UUID) -> List[EmployeeWorkExperience]:
        await _ensure_employee_exists(session, employee_uid)

        stmt = (select(EmployeeWorkExperience).where(EmployeeWorkExperience.employee_uid == employee_uid)
            .order_by(desc(EmployeeWorkExperience.start_date), desc(EmployeeWorkExperience.created_at)))
        result = await session.exec(stmt)
        return result.all()

    async def create(self,session: AsyncSession,payload: EmployeeWorkExperienceCreate,user_uid: str) -> EmployeeWorkExperience:
        try:
            try:
                user_uid_uuid = uuid.UUID(user_uid)
            except ValueError as e:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,detail="Invalid user UID format.") from e

            await _ensure_employee_exists(session, payload.employee_uid)
            await _ensure_not_duplicate(
                session=session,
                employee_uid=payload.employee_uid,
                company_name=payload.company_name,
                job_title=payload.job_title,
                start_date=payload.start_date,
            )

            payload_data = payload.model_dump()
            payload_data["company_name"] = payload_data["company_name"].strip()
            payload_data["job_title"] = payload_data["job_title"].strip()

            # auto-calculate total experience
            payload_data["year_of_exp"] = calculate_year_of_exp(
                start_date=payload_data["start_date"],
                end_date=payload_data.get("end_date"),
            )

            obj = EmployeeWorkExperience(**payload_data)
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
            logger.error("Integrity error while creating work experience", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Could not create work experience due to duplicate or constraint issue.",
            ) from e
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error while creating work experience", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while creating work experience.",
            ) from e

    async def update(self,session: AsyncSession,experience_uid: uuid.UUID,payload: EmployeeWorkExperienceUpdate) -> EmployeeWorkExperience:
        obj = await self.get_by_uid(session, experience_uid)

        update_data = payload.model_dump(exclude_unset=True)

        new_company_name = (update_data.get("company_name", obj.company_name).strip()
            if update_data.get("company_name", obj.company_name) is not None
            else obj.company_name
        )
        new_job_title = (update_data.get("job_title", obj.job_title).strip()
            if update_data.get("job_title", obj.job_title) is not None
            else obj.job_title
        )
        new_start_date = update_data.get("start_date", obj.start_date)
        new_end_date = update_data.get("end_date", obj.end_date)
        new_is_current = update_data.get("is_current", obj.is_current)

        if new_end_date and new_start_date > new_end_date:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,detail="start_date cannot be greater than end_date.")

        if new_is_current and new_end_date is not None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,detail="Current experience should not have end_date.")

        await _ensure_not_duplicate(
            session=session,
            employee_uid=obj.employee_uid,
            company_name=new_company_name,
            job_title=new_job_title,
            start_date=new_start_date,
            exclude_uid=obj.uid,
        )

        if "company_name" in update_data and update_data["company_name"] is not None:
            update_data["company_name"] = update_data["company_name"].strip()

        if "job_title" in update_data and update_data["job_title"] is not None:
            update_data["job_title"] = update_data["job_title"].strip()

        # auto-calculate total experience
        update_data["year_of_exp"] = calculate_year_of_exp(start_date=new_start_date,end_date=new_end_date)

        for key, value in update_data.items():
            setattr(obj, key, value)

        session.add(obj)

        try:
            await session.commit()
            await session.refresh(obj)
            return obj
        except IntegrityError as e:
            await session.rollback()
            logger.error("Integrity error while updating work experience", exc_info=True)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail="Could not update work experience due to duplicate or constraint issue.") from e
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error while updating work experience", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while updating work experience.",
            ) from e

    async def delete(self, session: AsyncSession, experience_uid: uuid.UUID) -> None:
        obj = await self.get_by_uid(session, experience_uid)

        try:
            await session.delete(obj)
            await session.commit()
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error while deleting work experience", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while deleting work experience.",
            ) from e


employee_work_experience_service = EmployeeWorkExperienceService()