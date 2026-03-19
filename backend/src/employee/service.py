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

from src.db.models import Employee, Role, User, EmployeeSkill, EmployeeDocument
from .schema import (
    EmployeeCreate,
    EmployeeDocumentSummary,
    EmployeeProfileRead,
    EmployeeProfileRequestRead,
    EmployeeSelfProfileUpdate,
    EmployeeSkillSummary,
    EmployeeUpdate,
)
from src.auth.utils import generate_password_hash, verify_password
from src.sendgrid_mail import SendGridMail
from src.config import Config

logger = logging.getLogger(__name__)
#bg_task=BackgroundTasks
DEFAULT_TEMP_PASSWORD = "Welcome@123"

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


def _normalize_skills(values: Optional[List[str]]) -> List[str]:
    if not values:
        return []

    normalized: List[str] = []
    seen = set()
    for value in values:
        skill = str(value or "").strip()
        if not skill:
            continue
        canonical = skill.casefold()
        if canonical in seen:
            continue
        seen.add(canonical)
        normalized.append(skill[:80])
    return normalized


def _skill_signature(values: Optional[List[str]]) -> tuple[str, ...]:
    return tuple(sorted(skill.casefold() for skill in _normalize_skills(values)))


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

            temp_password = DEFAULT_TEMP_PASSWORD
            username = _build_username(normalized_email, employees_data.employee_code)

            new_user = User(
                first_name=employees_data.first_name,
                last_name=employees_data.last_name,
                username=username,
                email=normalized_email,
                password_hash=generate_password_hash(temp_password),
                role_id=employees_data.role_type,
                is_verified=True,
                must_change_password=True,
                can_edit_profile_details=True,
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

    async def get_employee_by_user_uid(self, session: AsyncSession, user_uid: uuid.UUID) -> Employee:
        statement = select(Employee).where(Employee.user_uid == user_uid)
        result = await session.exec(statement)
        employee = result.first()
        if employee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found for current user.")
        return employee

    async def _build_profile_response(self, session: AsyncSession, employee: Optional[Employee], user: User) -> EmployeeProfileRead:
        skill_items: List[EmployeeSkillSummary] = []
        document_items: List[EmployeeDocumentSummary] = []

        if employee is not None:
            skills_result = await session.exec(
                select(EmployeeSkill)
                .where(EmployeeSkill.employee_uid == employee.uid)
                .order_by(EmployeeSkill.created_at.desc())
            )
            skill_items = [
                EmployeeSkillSummary(uid=skill.uid, skill=skill.skill)
                for skill in skills_result.all()
            ]

            documents_result = await session.exec(
                select(EmployeeDocument)
                .where(EmployeeDocument.employee_uid == employee.uid)
                .order_by(EmployeeDocument.created_at.desc())
            )
            document_items = [
                EmployeeDocumentSummary(
                    uid=document.uid,
                    document_type=str(getattr(document.document_type, "value", document.document_type)),
                    name=document.name,
                    file_url=document.file_url,
                    upload_date=document.upload_date,
                    file_format=document.file_format,
                    file_size=document.file_size,
                )
                for document in documents_result.all()
            ]

        must_change_password = bool(
            user.must_change_password
            or verify_password(DEFAULT_TEMP_PASSWORD, user.password_hash)
        )

        return EmployeeProfileRead(
            employee=employee,
            nickname=user.nickname,
            profile_image_url=user.profile_image_url,
            can_edit_profile_details=bool(user.can_edit_profile_details),
            profile_completed_at=user.profile_completed_at,
            must_change_password=must_change_password,
            skills=skill_items,
            documents=document_items,
        )

    async def get_employee_profile_by_employee_uid(self, session: AsyncSession, employee_uid: uuid.UUID) -> EmployeeProfileRead:
        employee = await self.get_employee_by_uid(session, employee_uid)
        user = await session.get(User, employee.user_uid)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked user not found.")
        return await self._build_profile_response(session, employee, user)

    async def get_employee_profile_by_user_uid(self, session: AsyncSession, user_uid: uuid.UUID) -> EmployeeProfileRead:
        employee_stmt = select(Employee).where(Employee.user_uid == user_uid)
        employee_result = await session.exec(employee_stmt)
        employee = employee_result.first()
        user = await session.get(User, user_uid)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked user not found.")
        return await self._build_profile_response(session, employee, user)

    async def update_self_profile(
        self,
        session: AsyncSession,
        current_user: User,
        payload: EmployeeSelfProfileUpdate,
    ) -> EmployeeProfileRead:
        employee_stmt = select(Employee).where(Employee.user_uid == current_user.uid)
        employee_result = await session.exec(employee_stmt)
        employee = employee_result.first()

        update_data = payload.model_dump(exclude_unset=True)
        nickname_requested = "nickname" in update_data
        nickname_value = update_data.pop("nickname", None)
        skills_requested = "skills" in update_data
        requested_skills = _normalize_skills(update_data.pop("skills", None))

        existing_skill_rows: List[EmployeeSkill] = []
        skills_changed = False
        if employee is not None and skills_requested:
            existing_skills_result = await session.exec(
                select(EmployeeSkill).where(EmployeeSkill.employee_uid == employee.uid)
            )
            existing_skill_rows = list(existing_skills_result.all())
            skills_changed = _skill_signature([row.skill for row in existing_skill_rows]) != _skill_signature(requested_skills)

        detail_field_names = {
            "first_name",
            "last_name",
            "position",
            "department",
            "email",
            "phone",
            "join_date",
            "birth_date",
            "address",
            "gender",
            "caste",
            "emergency_contact",
            "blood_group",
            "employee_type",
            "work_location",
        }
        has_detail_changes = any(field_name in update_data for field_name in detail_field_names) or skills_changed

        if employee is None:
            if has_detail_changes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No employee profile is linked with this user account.",
                )

            if nickname_requested:
                current_user.nickname = nickname_value.strip() if isinstance(nickname_value, str) and nickname_value.strip() else None
                current_user.updated_at = _utcnow()
                session.add(current_user)
                await session.commit()
                await session.refresh(current_user)

            return await self._build_profile_response(session, None, current_user)

        if has_detail_changes and not current_user.can_edit_profile_details:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Profile details are locked. Contact admin to unlock profile editing.",
            )

        normalized_current_email = _normalize_email_value(employee.email)
        normalized_updated_email = _normalize_email_value(update_data.get("email")) if "email" in update_data else None

        if normalized_updated_email is not None and normalized_updated_email != normalized_current_email:
            await _ensure_employee_email_unique(session, normalized_updated_email, exclude_id=employee.uid)
            await _ensure_user_email_unique(session, normalized_updated_email, exclude_user_uid=current_user.uid)
            update_data["email"] = normalized_updated_email

        for key, value in update_data.items():
            setattr(employee, key, value)
        employee.updated_at = _utcnow()
        session.add(employee)

        if skills_requested and skills_changed:
            for existing_skill in existing_skill_rows:
                await session.delete(existing_skill)

            for skill_name in requested_skills:
                session.add(
                    EmployeeSkill(
                        user_uid=current_user.uid,
                        employee_uid=employee.uid,
                        skill=skill_name,
                    )
                )

        if "first_name" in update_data:
            current_user.first_name = update_data["first_name"]
        if "last_name" in update_data:
            current_user.last_name = update_data["last_name"]
        if normalized_updated_email is not None:
            current_user.email = normalized_updated_email
            current_user.username = _build_username(normalized_updated_email, employee.employee_code)

        if nickname_requested:
            current_user.nickname = nickname_value.strip() if isinstance(nickname_value, str) and nickname_value.strip() else None

        if has_detail_changes:
            if current_user.profile_completed_at is None:
                current_user.profile_completed_at = _utcnow()
            current_user.can_edit_profile_details = False

        current_user.updated_at = _utcnow()
        session.add(current_user)

        await session.commit()
        await session.refresh(employee)
        await session.refresh(current_user)
        return await self._build_profile_response(session, employee, current_user)

    async def update_self_profile_photo(
        self,
        session: AsyncSession,
        current_user: User,
        image_url: str,
        public_id: Optional[str] = None,
    ) -> EmployeeProfileRead:
        current_user.profile_image_url = image_url
        current_user.profile_image_public_id = public_id
        current_user.updated_at = _utcnow()
        session.add(current_user)
        await session.commit()
        await session.refresh(current_user)
        employee_stmt = select(Employee).where(Employee.user_uid == current_user.uid)
        employee_result = await session.exec(employee_stmt)
        employee = employee_result.first()
        return await self._build_profile_response(session, employee, current_user)

    async def list_profile_requests(self, session: AsyncSession) -> List[EmployeeProfileRequestRead]:
        statement = select(Employee).order_by(desc(Employee.created_at))
        result = await session.exec(statement)
        employees = result.all()
        response_rows: List[EmployeeProfileRequestRead] = []

        for employee in employees:
            user = await session.get(User, employee.user_uid)
            if not user:
                continue
            full_name = " ".join(filter(None, [employee.first_name, employee.last_name])).strip() or employee.employee_code
            response_rows.append(
                EmployeeProfileRequestRead(
                    employee_uid=employee.uid,
                    user_uid=employee.user_uid,
                    employee_code=employee.employee_code,
                    full_name=full_name,
                    email=employee.email,
                    status=employee.status,
                    can_edit_profile_details=bool(user.can_edit_profile_details),
                    profile_completed_at=user.profile_completed_at,
                    must_change_password=bool(
                        user.must_change_password
                        or verify_password(DEFAULT_TEMP_PASSWORD, user.password_hash)
                    ),
                    is_locked=bool(user.is_locked),
                    locked_reason=user.locked_reason,
                )
            )
        return response_rows

    async def update_profile_edit_lock(
        self,
        session: AsyncSession,
        employee_uid: uuid.UUID,
        can_edit_profile_details: bool,
    ) -> EmployeeProfileRequestRead:
        employee = await self.get_employee_by_uid(session, employee_uid)
        user = await session.get(User, employee.user_uid)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked user not found.")

        user.can_edit_profile_details = bool(can_edit_profile_details)
        user.updated_at = _utcnow()
        session.add(user)
        await session.commit()
        await session.refresh(user)

        full_name = " ".join(filter(None, [employee.first_name, employee.last_name])).strip() or employee.employee_code
        return EmployeeProfileRequestRead(
            employee_uid=employee.uid,
            user_uid=employee.user_uid,
            employee_code=employee.employee_code,
            full_name=full_name,
            email=employee.email,
            status=employee.status,
            can_edit_profile_details=bool(user.can_edit_profile_details),
            profile_completed_at=user.profile_completed_at,
            must_change_password=bool(
                user.must_change_password
                or verify_password(DEFAULT_TEMP_PASSWORD, user.password_hash)
            ),
            is_locked=bool(user.is_locked),
            locked_reason=user.locked_reason,
        )

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
