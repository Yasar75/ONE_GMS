from typing import Any, List
from fastapi import Depends, Request, status
from fastapi.exceptions import HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from src.db.models import Role, User
from src.errors import AccessTokenRequired,AccountNotVerified,InsufficientPermission,InvalidToken,RefreshTokenRequired
from .service import UserService
from .utils import decode_token

user_service = UserService()


class TokenBearer(HTTPBearer):
    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> dict:
        creds: HTTPAuthorizationCredentials | None = await super().__call__(request)

        if creds is None or not creds.credentials:
            raise InvalidToken()

        token = creds.credentials
        token_data = decode_token(token)
        self.verify_token_data(token_data)
        return token_data

    def verify_token_data(self, token_data: dict) -> None:
        raise NotImplementedError("Please override this method in child classes.")


class AccessTokenBearer(TokenBearer):
    def verify_token_data(self, token_data: dict) -> None:
        if token_data.get("refresh") is True:
            raise AccessTokenRequired()


class RefreshTokenBearer(TokenBearer):
    def verify_token_data(self, token_data: dict) -> None:
        if token_data.get("refresh") is False:
            raise RefreshTokenRequired()


async def get_current_user(token_details: dict = Depends(AccessTokenBearer()),session: AsyncSession = Depends(get_session)):
    user = token_details.get("user")
    if not isinstance(user, dict):
        raise InvalidToken()

    user_email = user.get("email")
    if not user_email:
        raise InvalidToken()

    db_user = await user_service.get_user_by_email(user_email, session)
    if not db_user:
        raise InvalidToken()

    if db_user.is_locked:
        raise HTTPException(status_code=status.HTTP_423_LOCKED,detail=db_user.locked_reason or "Your account is locked. Please contact admin.")

    # also block already logged-in users if employee status changed later
    await user_service.ensure_employee_is_allowed_to_login(db_user, session)

    return db_user


class RoleChecker:
    def __init__(self, allowed_roles: List[str]) -> None:
        self.allowed_roles = [role.lower() for role in allowed_roles]

    async def __call__(self,current_user: User = Depends(get_current_user),session: AsyncSession = Depends(get_session)) -> Any:
        if not current_user.is_verified:
            raise AccountNotVerified()

        role = await session.get(Role, current_user.role_id)
        if not role:
            raise InsufficientPermission()

        if role.role_name.lower() in self.allowed_roles:
            return True

        raise InsufficientPermission()


async def AdminOnly(token_details: dict = Depends(AccessTokenBearer())):
    role = token_details.get("user")["role_name"].lower()

    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="Admin access required")

    return token_details


class PermissionChecker:
    def __init__(self, module: str, action: str) -> None:
        self.module = module
        self.action = action

    async def __call__(self,current_user: User = Depends(get_current_user),session: AsyncSession = Depends(get_session)) -> Any:
        if not current_user.is_verified:
            raise AccountNotVerified()

        role = await session.get(Role, current_user.role_id)

        if not role:
            raise InsufficientPermission()

        if role.role_name.lower() == "admin":
            return True

        permissions = role.permissions or {}
        allowed_actions = permissions.get(self.module, [])

        if self.action not in allowed_actions:
            raise InsufficientPermission()

        return True