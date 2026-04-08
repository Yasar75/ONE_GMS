from src.db.models import User, Role, Employee
from .schemas import UserCreateModel
from .utils import generate_password_hash
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from src.errors import UserAlreadyExists
from src.config import Config
from .utils import create_url_safe_token
from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Optional

## send mail by SendGridMail
from src.sendgrid_mail import SendGridMail

API = Config.APIKEY
from_email = Config.FROM


class UserService:
    async def get_user_by_email(self, email: str, session: AsyncSession):
        normalized_email = email.strip().lower()
        statement = select(User).where(func.lower(User.email) == normalized_email)
        result = await session.exec(statement)
        user = result.first()
        return user

    async def get_employee_by_user_uid(self, user_uid, session: AsyncSession):
        stmt = select(Employee).where(Employee.user_uid == user_uid)
        result = await session.exec(stmt)
        return result.first()

    async def ensure_employee_is_allowed_to_login(self, user: User, session: AsyncSession) -> None:
        employee = await self.get_employee_by_user_uid(user.uid, session)

        # allow login if this user is not linked with any employee record
        if employee is None:
            return

        blocked_statuses = {"Inactive", "Resigned", "Terminated"}

        if str(employee.status) in blocked_statuses:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Login not allowed. Employee status is {employee.status}."
            )

    async def user_exists(self, email, session: AsyncSession):
        user = await self.get_user_by_email(email, session)
        return True if user is not None else False

    async def create_user(self, user_data: UserCreateModel, session: AsyncSession):
        user_data_dict = user_data.model_dump()
        new_user = User(**user_data_dict)
        new_user.password_hash = generate_password_hash(user_data_dict["password"])

        result = await session.exec(select(Role).where(Role.uid == new_user.role_id))
        role = result.first()
        new_user.role_id = role.uid

        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        return new_user

    async def sign_up(self, *, user_data: UserCreateModel, session: AsyncSession, bg_tasks: BackgroundTasks):
        email = str(user_data.email).strip().lower()

        if await self.user_exists(email, session):
            raise UserAlreadyExists()

        plain_password = user_data.password
        new_user = await self.create_user(user_data, session)

        token = create_url_safe_token({"email": email})
        link = f"http://{Config.DOMAIN}/api/v1/auth/verify/{token}"

        html_message = f"""
        <h1>Verify your Email</h1>
        <p>Welcome to GIANTMIND SOLUTIONS PRIVATE LIMITED.</p>
        <p>Your user account has been successfully created in our system.</p>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Password:</strong> {plain_password}</p>
        <p>Please click this <a href="{link}">link</a> to verify your email.</p>
        <p>If you did not request this account or believe this message was sent in error,</p>
        <p>please contact the admin team immediately.</p>
        """

        # await SendGridMail.sendMailUsingSendGrid(
        #     API,
        #     from_email,
        #     email,
        #     subject="Verify Your Email.",
        #     html_content=html_message,
        # )

        return {
            "message": "Account Created! Check email to verify your account",
            "user": new_user,
        }

    async def update_user(self, user: User, user_data: dict, session: AsyncSession):
        for k, v in user_data.items():
            setattr(user, k, v)
        await session.commit()
        await session.refresh(user)
        return user

    async def change_password(self, user: User, new_password: str, session: AsyncSession):
        user.password_hash = generate_password_hash(new_password)
        await session.commit()
        await session.refresh(user)
        return user

    ### Below is the function creation for lock unlock management of users account.
    async def auto_lock_if_first_login_expired(self, user: User, session: AsyncSession) -> User:
        if user.first_login_at is not None:
            return user

        if user.is_locked:
            return user

        expiry_time = user.created_at + timedelta(hours=48)
        if datetime.utcnow() > expiry_time:
            user.is_locked = True
            user.locked_at = datetime.utcnow()
            user.locked_reason = "Account locked because first login was not completed within 48 hours of account creation."
            await session.commit()
            await session.refresh(user)

        return user

    async def mark_first_login_success(self, user: User, session: AsyncSession) -> None:
        if user.first_login_at is None:
            user.first_login_at = datetime.utcnow()
            await session.commit()
            await session.refresh(user)

    async def unlock_user_by_admin(self, user: User, session: AsyncSession) -> User:
        user.is_locked = False
        user.locked_at = None
        user.locked_reason = None
        user.unlocked_at = datetime.utcnow()

        # once admin unlocks, do not relock again due to first-login 48 hr condition
        if user.first_login_at is None:
            user.first_login_at = datetime.utcnow()

        await session.commit()
        await session.refresh(user)
        return user
    
    async def get_users_by_lock_status(self,session: AsyncSession,is_locked: Optional[bool] = None) -> List[User]:
        statement = select(User).order_by(User.created_at.desc())
        if is_locked is not None:
            statement = statement.where(User.is_locked == is_locked)
        result = await session.exec(statement)
        return result.all()
    
    async def get_locked_users(self, session: AsyncSession) -> List[User]:
        return await self.get_users_by_lock_status(session=session, is_locked=True)

    async def get_unlocked_users(self, session: AsyncSession) -> List[User]:
        return await self.get_users_by_lock_status(session=session, is_locked=False)