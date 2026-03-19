from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, status
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from src.config import Config
from src.db.main import get_session
from src.errors import InvalidCredentials, InvalidToken, UserAlreadyExists, UserNotFound
from src.mail import create_message, mail
from src.db.models import Role, Employee
from sqlmodel import select

from .dependencies import RefreshTokenBearer, get_current_user, AdminOnly, RoleChecker
from .schemas import (
    EmailModel,
    PasswordResetConfirmModel,
    PasswordResetRequestModel,
    UserCreateModel,
    UserLoginModel,ChangePasswordModel,UserUnlockResponse,UserUnlockRequest
)
from .service import UserService
from .service import DEFAULT_TEMP_PASSWORD
from .utils import (
    create_access_token,
    create_url_safe_token,
    decode_url_safe_token,
    generate_password_hash,
    verify_password,
)

## send mail by SendGridMail
from src.sendgrid_mail import SendGridMail
from src.config import Config
API = Config.APIKEY
from_email = Config.FROM


auth_router = APIRouter()
user_service = UserService()
role_checker = Depends(RoleChecker(["Admin", "HR"]))
adminonly = Depends(AdminOnly)
REFRESH_TOKEN_EXPIRY = 2


@auth_router.post("/send_mail")
async def send_mail(emails: EmailModel):
    emails = emails.addresses

    html = ("<h1>We are pleased to welcome you to GIANTMIND SOLUTIONS PRIVATE LIMITED.</h1>")
    subject = "Welcome To you"
    message = create_message(recipients=emails, subject="Welcome!!", body=html)
    await mail.send_message(message)
    return {"message": "Email sent successfully"}


########### User Signup Route ###########
@auth_router.post("/signup",status_code=status.HTTP_201_CREATED,dependencies=[adminonly]) 
async def create_user_account(user_data: UserCreateModel,bg_tasks: BackgroundTasks,session: AsyncSession = Depends(get_session)):
    return await user_service.sign_up(user_data=user_data,session=session,bg_tasks=bg_tasks)


@auth_router.get("/verify/{token}")
async def verify_user_account(token: str, session: AsyncSession = Depends(get_session)):
    token_data = decode_url_safe_token(token)
    user_email = token_data.get("email")

    if user_email:
        user = await user_service.get_user_by_email(user_email, session)

        if not user:
            raise UserNotFound()
        await user_service.update_user(user, {"is_verified": True}, session)

        return JSONResponse(content={"message": "Account verified successfully",},status_code=status.HTTP_200_OK)

    return JSONResponse(content={"message": "Error occured during verification"},status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


########### User Login Route ###########
@auth_router.post("/login")
async def login_user(login_data: UserLoginModel, session: AsyncSession = Depends(get_session)):
    email = str(login_data.email).strip().lower()
    password = login_data.password

    user = await user_service.get_user_by_email(email, session)

    if user is None:
        raise InvalidCredentials()

    # auto lock if profile completion was not submitted within 48 hours
    user = await user_service.auto_lock_if_profile_completion_expired(user, session)

    if user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=user.locked_reason or "Your account is locked. Please contact admin.",
        )

    password_valid = verify_password(password, user.password_hash)
    if not password_valid:
        raise InvalidCredentials()

    role = await session.get(Role, user.role_id)
    employee_result = await session.exec(select(Employee).where(Employee.user_uid == user.uid))
    has_employee_profile = employee_result.first() is not None

    access_token = create_access_token(user_data={"email": user.email,"user_uid": str(user.uid),"role_id": str(user.role_id),
            "role_name": role.role_name if role else None,})

    refresh_token = create_access_token(user_data={"email": user.email, "user_uid": str(user.uid)},refresh=True,
        expiry=timedelta(days=REFRESH_TOKEN_EXPIRY),)

    is_default_password = verify_password(DEFAULT_TEMP_PASSWORD, user.password_hash)
    must_change_password = bool(user.must_change_password or is_default_password)
    must_complete_profile = has_employee_profile and user.profile_completed_at is None

    return JSONResponse(
        content={
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "email": user.email,
                "uid": str(user.uid),
                "must_change_password": must_change_password,
                "must_complete_profile": must_complete_profile,
                "can_edit_profile_details": bool(user.can_edit_profile_details),
            },
        }
    )
# @auth_router.post("/login")
# async def login_user(login_data: UserLoginModel, session: AsyncSession = Depends(get_session)):
#     email = str(login_data.email).strip().lower()
#     password = login_data.password
#     user = await user_service.get_user_by_email(email, session)

#     if user is not None:
#         password_valid = verify_password(password, user.password_hash)
#         if password_valid:
#             role = await session.get(Role, user.role_id)
#             access_token = create_access_token(
#                 user_data={
#                     "email": user.email,
#                     "user_uid": str(user.uid),
#                     "role_id": str(user.role_id),
#                     "role_name": role.role_name if role else None,
#                 }
#             )

#             refresh_token = create_access_token(
#                 user_data={"email": user.email, "user_uid": str(user.uid)},
#                 refresh=True,
#                 expiry=timedelta(days=REFRESH_TOKEN_EXPIRY),
#             )

#             return JSONResponse(
#                 content={
#                     "message": "Login successful",
#                     "access_token": access_token,
#                     "refresh_token": refresh_token,
#                     "user": {"email": user.email, "uid": str(user.uid)},
#                 }
#             )

#     raise InvalidCredentials()


#############Get New Access Token Route #############
@auth_router.get("/refresh_token")
async def get_new_access_token(token_details: dict = Depends(RefreshTokenBearer())):
    expiry_timestamp = token_details["exp"]

    if datetime.fromtimestamp(expiry_timestamp) > datetime.now():
        new_access_token = create_access_token(user_data=token_details["user"])
        return JSONResponse(content={"access_token": new_access_token})
    raise InvalidToken()


#############Current User Route #############
@auth_router.get("/me")
async def me(user=Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    role = await session.get(Role, user.role_id)
    is_default_password = verify_password(DEFAULT_TEMP_PASSWORD, user.password_hash)
    employee_result = await session.exec(select(Employee).where(Employee.user_uid == user.uid))
    has_employee_profile = employee_result.first() is not None
    must_change_password = bool(user.must_change_password or is_default_password)
    return {
           "user": user,
           "role_name": role.role_name,
           "permissions": role.permissions,
           "must_change_password": must_change_password,
           "must_complete_profile": has_employee_profile and user.profile_completed_at is None,
           "can_edit_profile_details": bool(user.can_edit_profile_details)
           }


####Password Reset Request ####################
@auth_router.post("/password-reset-request")
async def password_reset_request(email_data: PasswordResetRequestModel):
    email = email_data.email

    token = create_url_safe_token({"email": email})

    link = f"http://{Config.DOMAIN}/api/v1/auth/password-reset-confirm/{token}"

    html_message = f"""
    <h1>Reset Your Password</h1>
    <p>We received a request to reset the password associated with your account.</p>
    <p>Please click this <a href="{link}">link</a> to Reset Your Password</p>
    <If you did not request this reset, please ignore this message. Your account will remain secure. </p>
    """
    #subject = "Reset Your Password"
    #message = create_message(recipients=[email], subject="Reset your password", body=html_message)

    await SendGridMail.sendMailUsingSendGrid(API,from_email,email,subject="Reset your password.",html_content=html_message)

    #await mail.send_message(message)

    # mail.send_message(html_message)
    # send_email.delay([email], subject, html_message)
    return JSONResponse(content={"message": "Please check your email for instructions to reset your password",},
        status_code=status.HTTP_200_OK,)


##############
@auth_router.post("/password-reset-confirm/{token}")
async def reset_account_password(
    token: str,
    passwords: PasswordResetConfirmModel,
    session: AsyncSession = Depends(get_session),
):
    new_password = passwords.new_password
    confirm_password = passwords.confirm_new_password

    if new_password != confirm_password:
        raise HTTPException(
            detail="Passwords do not match", status_code=status.HTTP_400_BAD_REQUEST
        )

    token_data = decode_url_safe_token(token)
    user_email = token_data.get("email")

    if user_email:
        user = await user_service.get_user_by_email(user_email, session)

        if not user:
            raise UserNotFound()

        passwd_hash = generate_password_hash(new_password)
        await user_service.update_user(user, {"password_hash": passwd_hash, "must_change_password": False}, session)

        return JSONResponse(
            content={"message": "Password reset Successfully"},
            status_code=status.HTTP_200_OK,
        )

    return JSONResponse(
        content={"message": "Error occured during password reset."},
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


@auth_router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(password_data: ChangePasswordModel,current_user=Depends(get_current_user),session: AsyncSession = Depends(get_session)):
    if password_data.new_password != password_data.confirm_new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password and confirm password do not match")

    is_first_time_password_change = bool(
        current_user.must_change_password
        or verify_password(DEFAULT_TEMP_PASSWORD, current_user.password_hash)
    )

    if is_first_time_password_change:
        if password_data.new_password == DEFAULT_TEMP_PASSWORD:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from the default password.",
            )
    else:
        if not password_data.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required.",
            )
        if not verify_password(password_data.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        if password_data.current_password == password_data.new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current password",
            )

    await user_service.change_password(user=current_user,new_password=password_data.new_password,session=session)

    return JSONResponse(
        content={
            "message": "Password changed successfully",
            "must_change_password": False,
        },
        status_code=status.HTTP_200_OK,
    )


## For lock unlock user's credential.
@auth_router.post("/unlock-user",response_model=UserUnlockResponse,status_code=status.HTTP_200_OK,dependencies=[Depends(AdminOnly)],)
async def unlock_user_account(payload: UserUnlockRequest,session: AsyncSession = Depends(get_session),):
    user = await user_service.get_user_by_email(str(payload.email).strip().lower(), session)
    if not user:
        raise UserNotFound()

    user = await user_service.unlock_user_by_admin(user, session)

    return UserUnlockResponse(message="User account unlocked successfully.",email=user.email,
        is_locked=user.is_locked,unlocked_at=user.unlocked_at,)
