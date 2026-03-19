from src.db.models import User, Role, Employee
from src.db.models.employee import EmployeeStatus
from .schemas import UserCreateModel
from .utils import generate_password_hash
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from src.mail import create_message, mail
from src.errors import UserAlreadyExists
from src.config import Config
from .utils import create_url_safe_token
from fastapi import BackgroundTasks
from sqlalchemy import func
from datetime import datetime, timedelta

## send mail by SendGridMail
from src.sendgrid_mail import SendGridMail
from src.config import Config

API = Config.APIKEY
from_email = Config.FROM
DEFAULT_TEMP_PASSWORD = "Welcome@123"


class UserService:
    # async def get_user_by_email(self, email: str, session: AsyncSession):
    #     statement =  select(User).where(User.email == email)
    #     result = await session.exec(statement)
    #     user = result.first()
    #     return user
    
    async def get_user_by_email(self, email: str, session: AsyncSession):
        normalized_email = email.strip().lower()
        statement = select(User).where(func.lower(User.email) == normalized_email)
        result = await session.exec(statement)
        user = result.first()
        return user
    
    async def user_exists(self, email, session: AsyncSession):
        user = await self.get_user_by_email(email, session)

        return True if user is not None else False
    
    async def create_user(self, user_data: UserCreateModel, session: AsyncSession):
        user_data_dict = user_data.model_dump()
        new_user = User(**user_data_dict)
        new_user.password_hash = generate_password_hash(user_data_dict['password'])
        result = await session.exec(select(Role).where(Role.uid == new_user.role_id))
        role = result.first()
        new_user.role_id = role.uid
        session.add(new_user)
        await session.commit()
        return new_user
    
    async def sign_up(self,*,user_data: UserCreateModel,session: AsyncSession,bg_tasks: BackgroundTasks):
        email = str(user_data.email).strip().lower() #user_data.email

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

        # message = create_message(
        #     recipients=[email],
        #     subject="Verify Your Email.",
        #     body=html_message,
        # )

        # IMPORTANT: Don't send twice. Just schedule it in background.
        #bg_tasks.add_task(mail.send_message, message)
        await SendGridMail.sendMailUsingSendGrid(API,from_email,email,subject="Verify Your Email.",html_content=html_message)

        return {
            "message": "Account Created! Check email to verify your account",
            "user": new_user,
        }
    



    async def update_user(self, user: User, user_data: dict, session: AsyncSession):
        for k,v in user_data.items():
            setattr(user, k,v)
        await session.commit()
        return user
    

    async def change_password(self,user: User,new_password: str,session: AsyncSession):
        user.password_hash = generate_password_hash(new_password)
        user.must_change_password = False
        await session.commit()
        await session.refresh(user)
        return user
    

    
### Below is the function creation for lock unlock management of users account.
    async def auto_lock_if_profile_completion_expired(self, user: User, session: AsyncSession) -> User:
        employee_stmt = select(Employee).where(Employee.user_uid == user.uid)
        employee_result = await session.exec(employee_stmt)
        linked_employee = employee_result.first()

        # apply the 48-hour completion rule only for employee-linked user accounts
        if linked_employee is None:
            return user

        # profile was completed already
        if user.profile_completed_at is not None:
            return user

        # admin override (legacy field reused as a relock bypass marker)
        if user.first_login_at is not None:
            return user

        if user.is_locked:
            return user

        expiry_time = user.created_at + timedelta(hours=48)
        if datetime.utcnow() <= expiry_time:
            return user

        user.is_locked = True
        user.locked_at = datetime.utcnow()
        user.locked_reason = "Account locked because profile completion was not submitted within 48 hours of account creation."

        linked_employee.status = EmployeeStatus.Inactive
        linked_employee.updated_at = datetime.utcnow()
        session.add(linked_employee)

        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    async def mark_profile_completed(self, user: User, session: AsyncSession) -> User:
        user.profile_completed_at = datetime.utcnow()
        user.can_edit_profile_details = False
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    async def unlock_user_by_admin(self, user: User, session) -> User:
        user.is_locked = False
        user.locked_at = None
        user.locked_reason = None
        user.unlocked_at = datetime.utcnow()

        # once admin unlocks, do not relock again due to the 48-hour profile completion condition
        if user.first_login_at is None:
            user.first_login_at = datetime.utcnow()

        employee_stmt = select(Employee).where(Employee.user_uid == user.uid)
        employee_result = await session.exec(employee_stmt)
        linked_employee = employee_result.first()
        if linked_employee and linked_employee.status == EmployeeStatus.Inactive:
            linked_employee.status = EmployeeStatus.Active
            linked_employee.updated_at = datetime.utcnow()
            session.add(linked_employee)

        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user
