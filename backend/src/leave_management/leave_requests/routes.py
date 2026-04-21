import uuid
from datetime import date
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker
from src.db.main import get_session
from .schema import LeaveRequestCreate, LeaveRequestDecision, LeaveRequestRead, LeaveDayPreviewRead,LeaveRequestManagerDecision,LeaveCancellationCreate, LeaveCancellationDecision,LeaveRequestUpdate
from .service import leave_request_service
 

leave_request_router = APIRouter()
access_token_bearer = AccessTokenBearer()
role_checker = Depends(RoleChecker(["admin", "hr"]))
employee_admin_module="Leave Request"
admin_module= "Manage Leave"

@leave_request_router.get("/preview-days",response_model=LeaveDayPreviewRead,status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(employee_admin_module, "r"))])
async def preview_leave_days(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_session),
):
    return await leave_request_service.preview_leave_days(session, start_date, end_date)


@leave_request_router.post("/apply",response_model=LeaveRequestRead,status_code=status.HTTP_201_CREATED, dependencies=[Depends(PermissionChecker(employee_admin_module, "c"))])
async def apply_leave(
    data: LeaveRequestCreate,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_uid = token_details["user"]["user_uid"]
    email = token_details["user"]["email"]
    return await leave_request_service.apply_leave(session, data, user_uid, email)


@leave_request_router.get("/my-requests",response_model=List[LeaveRequestRead],status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(employee_admin_module, "r"))])
async def list_my_requests(
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    return await leave_request_service.list_my_requests(session, email)


@leave_request_router.get("/leave-request-pending",response_model=List[LeaveRequestRead],status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(admin_module, "r"))])
async def list_pending_leave_request(session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    role_name = str(token_details["user"].get("role_name") or "")
    return await leave_request_service.list_pending_leave_request(session, email, role_name)


@leave_request_router.post("/{leave_request_uid}/approve",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(admin_module, "c"))])
async def approve_leave(
    leave_request_uid: uuid.UUID,
    data: LeaveRequestDecision,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    role_name = str(token_details["user"].get("role_name") or "")
    return await leave_request_service.approve_leave(session, leave_request_uid, email, data, role_name)


@leave_request_router.post("/{leave_request_uid}/reject",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(admin_module, "c"))])
async def reject_leave(
    leave_request_uid: uuid.UUID,
    data: LeaveRequestDecision,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    role_name = str(token_details["user"].get("role_name") or "")
    return await leave_request_service.reject_leave(session, leave_request_uid, email, data, role_name)

@leave_request_router.post("/{leave_request_uid}/request-approved-leave-cancellation",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(employee_admin_module, "c"))])
async def request_leave_cancellation(leave_request_uid: uuid.UUID,data: LeaveCancellationCreate,session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer)):
    user_uid = token_details["user"]["user_uid"]
    email = token_details["user"]["email"]
    return await leave_request_service.request_leave_cancellation(
        session=session,
        leave_request_uid=leave_request_uid,
        user_uid=user_uid,
        email=email,
        data=data,
    )

@leave_request_router.get("/approved-leave-cancellation-pending",response_model=List[LeaveRequestRead],status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(admin_module, "c"))])
async def list_pending_leave_cancellations(session: AsyncSession = Depends(get_session)):
    return await leave_request_service.list_pending_leave_cancellations(session)

@leave_request_router.post("/{leave_request_uid}/approve-leave-cancellation",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(admin_module, "c"))])
async def approve_leave_cancellation(
    leave_request_uid: uuid.UUID,
    data: LeaveCancellationDecision,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    role_name = str(token_details["user"].get("role_name") or "")
    return await leave_request_service.approve_leave_cancellation(
        session=session,
        leave_request_uid=leave_request_uid,
        email=email,
        data=data,
        role_name=role_name,
    )

@leave_request_router.post("/{leave_request_uid}/reject-leave-cancellation",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(admin_module, "c"))])
async def reject_leave_cancellation(
    leave_request_uid: uuid.UUID,
    data: LeaveCancellationDecision,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    role_name = str(token_details["user"].get("role_name") or "")
    return await leave_request_service.reject_leave_cancellation(
        session=session,
        leave_request_uid=leave_request_uid,
        email=email,
        data=data,
        role_name=role_name,
    )

@leave_request_router.put("/{leave_request_uid}/edit-leave-pending-state",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(employee_admin_module, "u"))])
async def edit_leave_request(
    leave_request_uid: uuid.UUID,
    data: LeaveRequestUpdate,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_uid = token_details["user"]["user_uid"]
    email = token_details["user"]["email"]
    return await leave_request_service.edit_leave_request(
        session=session,
        leave_request_uid=leave_request_uid,
        user_uid=user_uid,
        email=email,
        data=data,
    )


@leave_request_router.delete("/{leave_request_uid}/delete-leave-pending-state",status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(employee_admin_module, "d"))])
async def delete_leave_request(leave_request_uid: uuid.UUID,session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer)):
    email = token_details["user"]["email"]
    return await leave_request_service.delete_leave_request(
        session=session,
        leave_request_uid=leave_request_uid,
        email=email,
    )

##### Manager Level Leave Approve and Reject routes ############3
# @leave_request_router.get("/Manager-Level-Pending",response_model=List[LeaveRequestRead],status_code=status.HTTP_200_OK)
# async def list_manager_pending_leave_requests(session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer),):
#     email = token_details["user"]["email"]
#     return await leave_request_service.list_manager_pending_leave_requests(session, email)


# @leave_request_router.post("/{leave_request_uid}/Manager-Level-Decision",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK)
# async def manager_decide_leave_request(leave_request_uid: uuid.UUID,data: LeaveRequestManagerDecision,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
#     email = token_details["user"]["email"]
#     return await leave_request_service.manager_decide_leave_request(session=session,leave_request_uid=leave_request_uid,manager_email=email,action=data.action,reviewer_note=data.reviewer_note)
