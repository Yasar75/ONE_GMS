import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker
from src.db.main import get_session
from .schema import (
    AttendanceRegularizationCreate,
    AttendanceRegularizationDecision,
    AttendanceRegularizationRead,AttendanceRegularizationManagerDecision
)
from .service import attendance_regularization_service

attendance_regularization_router = APIRouter()
access_token_bearer = AccessTokenBearer()
role_checker = Depends(RoleChecker(["admin", "hr"]))

admin_module= "Manage Regularization"

@attendance_regularization_router.post("/",response_model=AttendanceRegularizationRead,status_code=status.HTTP_201_CREATED)
async def create_regularization(data: AttendanceRegularizationCreate,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    user_data = token_details.get("user", {})
    return await attendance_regularization_service.create_regularization(session=session,user_uid=user_data.get("user_uid"),
        employee_email=user_data.get("email"),data=data)


@attendance_regularization_router.get("/my-requests",response_model=List[AttendanceRegularizationRead],status_code=status.HTTP_200_OK)
async def list_my_regularizations(session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    email = token_details.get("user", {}).get("email")
    return await attendance_regularization_service.list_my_regularizations(session, email)


@attendance_regularization_router.get("/employees-pending",response_model=List[AttendanceRegularizationRead],status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(admin_module, "r"))])
async def list_employee_pending_regularizations(session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    return await attendance_regularization_service.list_all_pending_regularizations(session)


@attendance_regularization_router.post("/{regularization_uid}/approve",response_model=AttendanceRegularizationRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(admin_module, "c"))])
async def approve_regularization(regularization_uid: uuid.UUID,data: AttendanceRegularizationDecision,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    email = token_details.get("user", {}).get("email")
    return await attendance_regularization_service.approve_regularization(session, regularization_uid, email, data)


@attendance_regularization_router.post("/{regularization_uid}/reject",response_model=AttendanceRegularizationRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(admin_module, "c"))])
async def reject_regularization(regularization_uid: uuid.UUID,data: AttendanceRegularizationDecision,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    email = token_details.get("user", {}).get("email")
    return await attendance_regularization_service.reject_regularization(session, regularization_uid, email, data)

############# Manager Level Regularization list and approval and reject routers ######################333333

# @attendance_regularization_router.get("/Manager-Level-Pending",response_model=List[AttendanceRegularizationRead],status_code=status.HTTP_200_OK)
# async def list_manager_pending_regularizations(session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
#     email = token_details.get("user", {}).get("email")
#     return await attendance_regularization_service.list_manager_pending_regularizations(session, email)


# @attendance_regularization_router.post("/{regularization_uid}/Manager-Level-Approve-Reject",response_model=AttendanceRegularizationRead,
# status_code=status.HTTP_200_OK)
# async def manager_decide_regularization(regularization_uid: uuid.UUID,data: AttendanceRegularizationManagerDecision,
#     session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
#     email = token_details.get("user", {}).get("email")
#     return await attendance_regularization_service.manager_decide_regularization(session=session, regularization_uid=regularization_uid,manager_email=email, action=data.action, reviewer_note=data.reviewer_note)