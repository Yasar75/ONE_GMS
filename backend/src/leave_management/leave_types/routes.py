import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker
from src.db.main import get_session
from .schema import LeaveTypeCreate, LeaveTypeUpdate, LeaveTypeRead
from .service import leave_type_service

leave_type_router = APIRouter()
access_token_bearer = AccessTokenBearer()
#role_checker = Depends(RoleChecker(["admin", "hr"]))
module= "Leave Type"

@leave_type_router.post("/",response_model=LeaveTypeRead,status_code=status.HTTP_201_CREATED,dependencies=[Depends(PermissionChecker(module, "c"))])
async def create_leave_type(
    data: LeaveTypeCreate,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_uid = token_details["user"]["user_uid"]
    return await leave_type_service.create_leave_type(session, data, user_uid)


@leave_type_router.get("/",response_model=List[LeaveTypeRead],status_code=status.HTTP_200_OK)
async def list_leave_types(session: AsyncSession = Depends(get_session)):
    return await leave_type_service.list_leave_types(session)


@leave_type_router.get("/{leave_type_uid}",response_model=LeaveTypeRead,status_code=status.HTTP_200_OK)
async def get_leave_type(
    leave_type_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    return await leave_type_service.get_leave_type(session, leave_type_uid)


@leave_type_router.put("/{leave_type_uid}",response_model=LeaveTypeRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_leave_type(
    leave_type_uid: uuid.UUID,
    data: LeaveTypeUpdate,
    session: AsyncSession = Depends(get_session),
):
    return await leave_type_service.update_leave_type(session, leave_type_uid, data)

@leave_type_router.delete(
    "/{leave_type_uid}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(module, "d"))],
)
async def delete_leave_type(
    leave_type_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    return await leave_type_service.delete_leave_type(session, leave_type_uid)