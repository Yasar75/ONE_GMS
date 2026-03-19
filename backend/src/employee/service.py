import uuid
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import BackgroundTasks
from fastapi import HTTPException, status
from sqlmodel import select, desc
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from src.db.models import Employee, Role, User
from .schema import EmployeeCreate, EmployeeUpdate
from src.auth.utils import generate_password_hash
from src.sendgrid_mail import SendGridMail
from src.config import Config

logger = logging.getLogger(__name__)
#bg_task=BackgroundTasks

def _utcnow() -> datetime:
    return datetime.utcnow()


def _normalize_email_value(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    normalized_email = str(email).strip().lower()
    return normalized_email or None


def _build_username(email: Optional[str], employee_code: str) -> str:
    if email:
        return str(email).split("@")[0][:20]
    return str(employee_code)[:20]


async def _send_employee_welcome_email(email: str, password: str) -> None:
    if not Config.APIKEY or not Config.FROM:
        logger.warning("SendGrid configuration is missing. Skipping welcome email for %s", email)
        return

    html_message = f"""
    <h1>Welcome to GIANTMIND SOLUTIONS PRIVATE LIMITED</h1>
    <p>Your user account has been created successfully.</p>
    <p><strong>Email:</strong> {email}</p>
    <p><strong>Password:</strong> {password}</p>
    """

    try:
        await SendGridMail.sendMailUsingSendGrid(
            Config.APIKEY,
            Config.FROM,
            email,
            subject="Your account credentials",
            html_content=html_message,
        )
    except Exception as error:
        logger.warning("Failed to send welcome email to %s: %s", email, error)


async def _ensure_employee_code_unique(session: AsyncSession, employee_code: str, exclude_id: Optional[uuid.UUID] = None) -> None:
    stmt = select(Employee).where(Employee.employee_code == employee_code)
    if exclude_id:
        stmt = stmt.where(Employee.uid != exclude_id)

    res = await session.exec(stmt)
    if res.first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee code already exists.")


async def _ensure_employee_email_unique(session: AsyncSession, email: Optional[str], exclude_id: Optional[uuid.UUID] = None) -> None:
    normalized_email = _normalize_email_value(email)
    if not normalized_email:
        return

    stmt = select(Employee).where(func.lower(Employee.email) == normalized_email)
    if exclude_id:
        stmt = stmt.where(Employee.uid != exclude_id)

    res = await session.exec(stmt)
    if res.first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee email already exists.")


async def _ensure_user_email_unique(session: AsyncSession, email: Optional[str], exclude_user_uid: Optional[uuid.UUID] = None) -> None:
    normalized_email = _normalize_email_value(email)
    if not normalized_email:
        return

    stmt = select(User).where(func.lower(User.email) == normalized_email)
    if exclude_user_uid:
        stmt = stmt.where(User.uid != exclude_user_uid)
    res = await session.exec(stmt)
    if res.first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User email already exists.")


async def _ensure_employee_exists(session: AsyncSession, employee_uid: Optional[uuid.UUID], field_name: str, current_employee_uid: Optional[uuid.UUID] = None) -> None:
    if not employee_uid:
        return
    if current_employee_uid and employee_uid == current_employee_uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} cannot reference the same employee.")

    res = await session.exec(select(Employee).where(Employee.uid == employee_uid))
    if res.first() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} is invalid (employee not found).")


async def _ensure_role_exists(session: AsyncSession, role_uid: Optional[uuid.UUID]) -> None:
    if not role_uid:
        return
    res = await session.exec(select(Role).where(Role.uid == role_uid))
    if res.first() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role_type. Role not found.")


class EmployeeService:
    async def create_Employees(self, employees_data: EmployeeCreate, user_uid: str, session: AsyncSession,bg_tasks: BackgroundTasks,) -> Employee:
        try:
            logger.info("Creating employee with automatic user signup")

            normalized_email = _normalize_email_value(employees_data.email)
            if not normalized_email:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee email is required for linked user creation.")

            await _ensure_employee_code_unique(session, employees_data.employee_code)
            await _ensure_employee_email_unique(session, normalized_email)
            await _ensure_user_email_unique(session, normalized_email)
            await _ensure_employee_exists(session, employees_data.manager_employee_uid, "manager_employee_uid")
            await _ensure_employee_exists(session, employees_data.hr_employee_uid, "hr_employee_uid")
            await _ensure_employee_exists(session, employees_data.team_lead_employee_uid, "team_lead_employee_uid")
            await _ensure_employee_exists(session, employees_data.coordinator_employee_uid, "coordinator_employee_uid")
            await _ensure_role_exists(session, employees_data.role_type)

            temp_password = "Welcome@123"
            username = _build_username(normalized_email, employees_data.employee_code)

            new_user = User(
                first_name=employees_data.first_name,
                last_name=employees_data.last_name,
                username=username,
                email=normalized_email,
                password_hash=generate_password_hash(temp_password),
                role_id=employees_data.role_type,
                is_verified=True,
            )
            session.add(new_user)
            await session.flush()

            employee_dict = employees_data.model_dump()
            employee_dict["email"] = normalized_email
            new_employee = Employee(
                **employee_dict,
                user_uid=new_user.uid,
            )

            session.add(new_employee)
            await session.flush()
            await session.commit()
            await session.refresh(new_employee)
            await _send_employee_welcome_email(normalized_email, temp_password)

            logger.info("Employee created successfully: %s linked user: %s by admin %s", new_employee.uid, new_user.uid, user_uid)
            return new_employee

        except HTTPException:
            await session.rollback()
            raise
        except IntegrityError as e:
            await session.rollback()
            error_message = str(e.orig) if hasattr(e, "orig") else str(e)
            logger.error("Integrity error creating employee: %s", error_message, exc_info=True)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Integrity error while creating employee/user.")
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error creating employee: %s", str(e), exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error while creating employee.")

    async def get_employee_by_uid(self, session: AsyncSession, employee_uid: uuid.UUID) -> Employee:
        statement = select(Employee).where(Employee.uid == employee_uid)
        result = await session.exec(statement)
        employee = result.first()

        if employee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        return employee

    async def get_all_employee(self, session: AsyncSession) -> List[Employee]:
        statement = select(Employee).order_by(desc(Employee.created_at))
        result = await session.exec(statement)
        return result.all()

    async def update_employee(self, session: AsyncSession, employee_uid: uuid.UUID, employee_data: EmployeeUpdate) -> Employee:
        employee = await self.get_employee_by_uid(session, employee_uid)
        normalized_current_email = _normalize_email_value(employee.email)
        normalized_updated_email = _normalize_email_value(employee_data.email) if employee_data.email is not None else None

        if employee_data.employee_code is not None and employee_data.employee_code != employee.employee_code:
            await _ensure_employee_code_unique(session, employee_data.employee_code, exclude_id=employee_uid)

        if normalized_updated_email is not None and normalized_updated_email != normalized_current_email:
            await _ensure_employee_email_unique(session, normalized_updated_email, exclude_id=employee_uid)
            await _ensure_user_email_unique(session, normalized_updated_email, exclude_user_uid=employee.user_uid)

        if employee_data.manager_employee_uid is not None and employee_data.manager_employee_uid != employee.manager_employee_uid:
            await _ensure_employee_exists(session, employee_data.manager_employee_uid, "manager_employee_uid", current_employee_uid=employee_uid)

        if employee_data.hr_employee_uid is not None and employee_data.hr_employee_uid != employee.hr_employee_uid:
            await _ensure_employee_exists(session, employee_data.hr_employee_uid, "hr_employee_uid", current_employee_uid=employee_uid)

        if employee_data.team_lead_employee_uid is not None and employee_data.team_lead_employee_uid != employee.team_lead_employee_uid:
            await _ensure_employee_exists(session, employee_data.team_lead_employee_uid, "team_lead_employee_uid", current_employee_uid=employee_uid)

        if employee_data.coordinator_employee_uid is not None and employee_data.coordinator_employee_uid != employee.coordinator_employee_uid:
            await _ensure_employee_exists(session, employee_data.coordinator_employee_uid, "coordinator_employee_uid", current_employee_uid=employee_uid)

        if employee_data.role_type is not None:
            await _ensure_role_exists(session, employee_data.role_type)

        data = employee_data.model_dump(exclude_unset=True)
        if "email" in data and data["email"] is not None:
            data["email"] = normalized_updated_email

        for key, value in data.items():
            setattr(employee, key, value)

        employee.updated_at = _utcnow()
        session.add(employee)

        user = await session.get(User, employee.user_uid)
        if not user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Linked user record not found for this employee.")

        if employee_data.first_name is not None:
            user.first_name = employee_data.first_name
        if employee_data.last_name is not None:
            user.last_name = employee_data.last_name
        if normalized_updated_email is not None:
            user.email = normalized_updated_email
            user.username = _build_username(normalized_updated_email, employee.employee_code)
        if employee_data.role_type is not None:
            user.role_id = employee_data.role_type
        user.updated_at = _utcnow()
        session.add(user)

        await session.commit()
        await session.refresh(employee)
        return employee

    async def delete_employee(self, employee_uid: str, session: AsyncSession) -> bool:
        try:
            uid = uuid.UUID(employee_uid)
        except ValueError:
            logger.warning("Invalid UUID format for employee_uid: %s", employee_uid)
            return False

        try:
            logger.info("Deleting employee with uid: %s", uid)
            employee_to_delete = await self.get_employee_by_uid(session, uid)
            linked_user = await session.get(User, employee_to_delete.user_uid)

            await session.delete(employee_to_delete)
            if linked_user is not None:
                await session.delete(linked_user)
            await session.commit()

            logger.info("Employee deleted successfully: %s", uid)
            return True

        except IntegrityError as e:
            await session.rollback()
            error_message = str(e.orig) if hasattr(e, "orig") else str(e)
            logger.error("Integrity error deleting Employee %s: %s", uid, error_message, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee/User delete conflict: remove dependent records first, then retry."
            )
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error deleting Employee %s: %s", uid, str(e), exc_info=True)
            raise
        except Exception as e:
            await session.rollback()
            logger.error("Unexpected error deleting Employee %s: %s", uid, str(e), exc_info=True)
            raise
