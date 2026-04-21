from typing import List

from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session
from src.errors import RoleNotFound
from src.auth.dependencies import AccessTokenBearer, AdminOnly, PermissionChecker, AdminOnly
from .schemas import RoleCreateModel, RoleResponse, RoleUpdateModel
from .service import RoleService
from .constants import AVAILABLE_MODULES

role_service = RoleService()
# role_checker = Depends(PermissionChecker("roles", "c"))
role_router = APIRouter()
access_token_bearer = AccessTokenBearer()
adminonly = Depends(AdminOnly)

####Create A Role Route #####
@role_router.post(
    "/create-role",
    status_code=status.HTTP_201_CREATED,
    response_model=RoleResponse,
    dependencies=[ adminonly ]
)
async def create_a_role(
    role_data: RoleCreateModel,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_id = token_details.get("user")["user_uid"]
    new_role = await role_service.create_role(role_data, user_id, session)
    if new_role:
        return role_service._transform_role_for_response(new_role)
    raise RoleNotFound()


####Get All Roles Route #####
@role_router.get(
    "/roles", response_model=List[RoleResponse],
    
)  # , dependencies=[ adminonly ]
async def get_all_roles(
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    return  await role_service.get_all_roles(session)


#####Get particular Role Route #####
@role_router.get(
    "/role/{role_uid}", response_model=RoleResponse,
    
)  # dependencies=[ adminonly ]
async def get_role_id(
    role_uid: str,
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    return await role_service.get_role_by_id(role_uid, session)


####Update A Role Route #####
@role_router.put(
    "/role/{role_uid}", response_model=RoleResponse,
    dependencies=[ adminonly ]
)
async def update_role(
    role_uid: str,
    role_data: RoleUpdateModel,
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    updated_role = await role_service.update_role(role_uid, role_data, session)
    if updated_role:
        return role_service._transform_role_for_response(updated_role)
    else:
        raise RoleNotFound()


####Delete A Role Route #####
@role_router.delete(
    "/role/{role_uid}",
    status_code=status.HTTP_200_OK,
    dependencies=[ adminonly ]
)
async def delete_role(
    role_uid: str,
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    role_to_delete = await role_service.delete_role(role_uid, session)

    if not role_to_delete:
        raise RoleNotFound()

    return {
        "status_code=": status.HTTP_204_NO_CONTENT,
        "detail=": "Delete successfully",
    }

@role_router.get(
    "/modules",
    response_model=List[str])
async def get_modules(
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    return AVAILABLE_MODULES
