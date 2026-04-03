import uuid
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import BackgroundTasks
from fastapi import HTTPException, status
from sqlmodel import select, desc
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from src.db.models import Employee,Role,User,HolidayCalendar,LeaveType,ShiftRoster,EmployeeMetadata
from .schema import EmployeeCreate, EmployeeUpdate
from src.auth.schemas import UserCreateModel
from src.auth.service import UserService

##upload Profile image and nick name ###
import cloudinary
from fastapi import UploadFile, File
from src.utils.cloudinary_service import upload_employee_profile_image,delete_employee_profile_image

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.utcnow()


async def _ensure_employee_code_unique(session: AsyncSession, employee_code: str, exclude_id: Optional[uuid.UUID] = None) -> None:
    stmt = select(Employee).where(Employee.employee_code == employee_code)
    if exclude_id:
        stmt = stmt.where(Employee.uid != exclude_id)

    res = await session.exec(stmt)
    if res.first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee code already exists.")


async def _ensure_employee_email_unique(session: AsyncSession, email: Optional[str], exclude_id: Optional[uuid.UUID] = None) -> None:
    if not email:
        return

    stmt = select(Employee).where(Employee.email == email)
    if exclude_id:
        stmt = stmt.where(Employee.uid != exclude_id)

    res = await session.exec(stmt)
    if res.first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee email already exists.")


async def _ensure_user_email_unique(session: AsyncSession, email: Optional[str], exclude_user_uid: Optional[uuid.UUID] = None) -> None:
    if not email:
        return

    stmt = select(User).where(User.email == email)
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

    async def _get_linked_user_delete_blockers(self,session: AsyncSession,*,linked_user_uid: uuid.UUID,employee_uid: uuid.UUID,) -> list[str]:
        blockers: list[str] = []

        other_employee_stmt = select(Employee).where(Employee.user_uid == linked_user_uid,Employee.uid != employee_uid,)
        if (await session.exec(other_employee_stmt)).first():
            blockers.append("another employee record is still linked to this user")

        holiday_stmt = select(HolidayCalendar.uid).where(HolidayCalendar.user_uid == linked_user_uid).limit(1)
        if (await session.exec(holiday_stmt)).first():
            blockers.append("holiday calendar records created by this user")

        leave_type_stmt = select(LeaveType.uid).where(LeaveType.user_uid == linked_user_uid).limit(1)
        if (await session.exec(leave_type_stmt)).first():
            blockers.append("leave type records created by this user")

        shift_stmt = select(ShiftRoster.uid).where(ShiftRoster.user_uid == linked_user_uid).limit(1)
        if (await session.exec(shift_stmt)).first():
            blockers.append("shift roster records created by this user")

        metadata_stmt = select(EmployeeMetadata.uid).where(EmployeeMetadata.created_by == linked_user_uid).limit(1)
        if (await session.exec(metadata_stmt)).first():
            blockers.append("employee metadata records created by this user")

        return blockers

    async def create_Employees(self,employees_data: EmployeeCreate,user_uid: str,session: AsyncSession,bg_tasks: BackgroundTasks,) -> Employee:
        try:
            logger.info("Creating employee with automatic user signup")

            await _ensure_employee_code_unique(session, employees_data.employee_code)
            await _ensure_employee_email_unique(session, employees_data.email)
            await _ensure_user_email_unique(session, employees_data.email)
            await _ensure_employee_exists(session, employees_data.manager_employee_uid, "manager_employee_uid")
            await _ensure_employee_exists(session, employees_data.hr_employee_uid, "hr_employee_uid")
            await _ensure_employee_exists(session, employees_data.team_lead_employee_uid, "team_lead_employee_uid")
            await _ensure_employee_exists(session, employees_data.coordinator_employee_uid, "coordinator_employee_uid")
            await _ensure_role_exists(session, employees_data.role_type)

            temp_password = "Welcome@123"
            username = employees_data.email.split("@")[0] if employees_data.email else employees_data.employee_code

            user_service = UserService()
            user_data = UserCreateModel(
                first_name=employees_data.first_name,
                last_name=employees_data.last_name,
                username=username[:20],
                email=employees_data.email,
                password=temp_password,
                role_id=employees_data.role_type,
                is_verified=True,
            )

            signup_result = await user_service.sign_up(user_data=user_data,session=session,bg_tasks=bg_tasks)
            new_user = signup_result["user"]

            employee_dict = employees_data.model_dump()
            new_employee = Employee(**employee_dict,user_uid=new_user.uid)

            session.add(new_employee)
            await session.flush()
            await session.commit()
            await session.refresh(new_employee)

            logger.info("Employee created successfully: %s linked user: %s by admin %s",
                new_employee.uid,new_user.uid,user_uid)
            return new_employee

        except HTTPException:
            await session.rollback()
            raise
        except IntegrityError as e:
            await session.rollback()
            error_message = str(e.orig) if hasattr(e, "orig") else str(e)
            logger.error("Integrity error creating employee: %s", error_message, exc_info=True)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail="Integrity error while creating employee/user.")
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error creating employee: %s", str(e), exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Database error while creating employee.")

    async def get_employee_by_uid(self, session: AsyncSession, employee_uid: uuid.UUID) -> Employee:
        statement = select(Employee).where(Employee.uid == employee_uid)
        result = await session.exec(statement)
        employee = result.first()

        if employee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        return employee

    async def get_employee_by_user_uid(self, session: AsyncSession, user_uid: uuid.UUID) -> Employee:
        statement = select(Employee).where(Employee.user_uid == user_uid)
        result = await session.exec(statement)
        employee = result.first()

        if employee is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found for current user")
        return employee

    async def get_all_employee(self, session: AsyncSession) -> List[Employee]:
        statement = select(Employee).order_by(desc(Employee.created_at))
        result = await session.exec(statement)
        return result.all()

    async def update_employee(self, session: AsyncSession, employee_uid: uuid.UUID, employee_data: EmployeeUpdate) -> Employee:
        try:
            employee = await self.get_employee_by_uid(session, employee_uid)

            if employee_data.employee_code is not None and employee_data.employee_code != employee.employee_code:
                await _ensure_employee_code_unique(session, employee_data.employee_code, exclude_id=employee_uid)

            if employee_data.email is not None and employee_data.email != employee.email:
                await _ensure_employee_email_unique(session, employee_data.email, exclude_id=employee_uid)
                await _ensure_user_email_unique(session, employee_data.email, exclude_user_uid=employee.user_uid)

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

            for key, value in data.items():
                setattr(employee, key, value)

            employee.updated_at = _utcnow()
            session.add(employee)

            user = await session.get(User, employee.user_uid)
            if user:
                if employee_data.first_name is not None:
                    user.first_name = employee_data.first_name

                if employee_data.last_name is not None:
                    user.last_name = employee_data.last_name

                if employee_data.email is not None:
                    user.email = employee_data.email
                    user.username = employee_data.email.split("@")[0][:20]

                if employee_data.role_type is not None:
                    user.role_id = employee_data.role_type

                # sync employee employment status with linked user lock state
                if employee_data.status is not None:
                    if str(employee_data.status) in {"Inactive", "Resigned", "Terminated"}:
                        user.is_locked = True
                        user.locked_reason = f"Login blocked because employee status is {employee_data.status}."
                    elif str(employee_data.status) == "Active":
                        user.is_locked = False
                        user.locked_reason = None

                user.updated_at = _utcnow()
                session.add(user)

            await session.commit()
            await session.refresh(employee)
            return employee

        except HTTPException:
            await session.rollback()
            raise
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail="Integrity error while updating employee/user.")
        except SQLAlchemyError:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Database error while updating employee/user.")

    async def delete_employee(self, employee_uid: uuid.UUID, session: AsyncSession) -> bool:
        try:
            logger.info("Deleting employee with uid: %s", employee_uid)

            employee_to_delete = await self.get_employee_by_uid(session, employee_uid)

            linked_user = None
            if employee_to_delete.user_uid:
                linked_user = await session.get(User, employee_to_delete.user_uid)

            await session.delete(employee_to_delete)
            await session.flush()

            if linked_user:
                blockers = await self._get_linked_user_delete_blockers(session,linked_user_uid=linked_user.uid,employee_uid=employee_uid)

                if blockers:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                        detail=("Linked user cannot be deleted because "+ "; ".join(blockers)+ ". Remove or reassign those references first."))

                await session.delete(linked_user)

            await session.commit()

            logger.info("Employee deleted successfully: %s, linked user deleted: %s",employee_uid,linked_user.uid if linked_user else None)
            return True

        except HTTPException:
            await session.rollback()
            raise
        except IntegrityError as e:
            await session.rollback()
            error_message = str(e.orig) if hasattr(e, "orig") else str(e)
            logger.error("Integrity error deleting employee %s: %s",employee_uid,error_message,exc_info=True)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                detail="Cannot delete employee because related records exist or the linked user is still referenced elsewhere.")
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error("Database error deleting employee %s: %s",employee_uid,str(e),exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Database error while deleting employee.")
        


    ### Helper function and function for Upload profile image and set nick name ####

    def _extract_public_id_from_url(self, image_url: str) -> Optional[str]:
        """
        Extract Cloudinary public_id from secure URL.
        Example:
        https://res.cloudinary.com/demo/image/upload/v123456/employees/profile_images/abc_profile.jpg
        -> employees/profile_images/abc_profile
        """
        if not image_url:
            return None

        try:
            parts = image_url.split("/upload/")
            if len(parts) < 2:
                return None

            path_part = parts[1]
            segments = path_part.split("/")

            # remove version if present
            if segments and segments[0].startswith("v"):
                segments = segments[1:]

            public_path = "/".join(segments)

            if "." in public_path:
                public_path = public_path.rsplit(".", 1)[0]

            return public_path
        except Exception:
            return None
    
    async def upload_profile_image(self,session: AsyncSession,employee_uid: uuid.UUID,file: UploadFile) -> Employee:
        try:
            employee = await self.get_employee_by_uid(session, employee_uid)

            if not file.content_type or not file.content_type.startswith("image/"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Only image files are allowed.")

            # delete old image from Cloudinary if exists
            if employee.profile_image:
                old_public_id = self._extract_public_id_from_url(employee.profile_image)
                if old_public_id:
                    try:
                        delete_employee_profile_image(old_public_id)
                    except Exception:
                        logger.warning("Failed to delete old Cloudinary image for employee %s", employee_uid)

            upload_result = upload_employee_profile_image(file.file, str(employee_uid))
            employee.profile_image = upload_result.get("secure_url")
            employee.updated_at = _utcnow()

            session.add(employee)
            await session.commit()
            await session.refresh(employee)
            return employee

        except HTTPException:
            await session.rollback()
            raise
        except Exception as e:
            await session.rollback()
            logger.error("Error uploading profile image: %s", str(e), exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Failed to upload profile image.")

    async def update_nick_name(self,session: AsyncSession,employee_uid: uuid.UUID,nick_name: Optional[str]) -> Employee:
        try:
            employee = await self.get_employee_by_uid(session, employee_uid)
            employee.nick_name = nick_name
            employee.updated_at = _utcnow()

            session.add(employee)
            await session.commit()
            await session.refresh(employee)
            return employee

        except HTTPException:
            await session.rollback()
            raise
        except SQLAlchemyError:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Database error while updating nick name.")

    async def delete_profile_image(self,session: AsyncSession,employee_uid: uuid.UUID) -> Employee:
        try:
            employee = await self.get_employee_by_uid(session, employee_uid)

            if not employee.profile_image:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Profile image not found.")

            public_id = self._extract_public_id_from_url(employee.profile_image)
            if public_id:
                try:
                    delete_employee_profile_image(public_id)
                except Exception:
                    logger.warning("Failed to delete Cloudinary image for employee %s", employee_uid)

            employee.profile_image = None
            employee.updated_at = _utcnow()

            session.add(employee)
            await session.commit()
            await session.refresh(employee)
            return employee

        except HTTPException:
            await session.rollback()
            raise
        except SQLAlchemyError:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Database error while deleting profile image.")
        
    async def get_profile_image(self, session: AsyncSession, employee_uid: uuid.UUID) -> dict:
        employee = await self.get_employee_by_uid(session, employee_uid)

        return {"uid": employee.uid,"profile_image": employee.profile_image}
    
    async def get_profile_details(self, session: AsyncSession, employee_uid: uuid.UUID) -> dict:
        employee = await self.get_employee_by_uid(session, employee_uid)
        return {"uid": employee.uid,"nick_name": employee.nick_name,"profile_image": employee.profile_image}
