import uuid
from datetime import date
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker
from src.db.main import get_session
from .schema import LeaveRequestCreate, LeaveRequestDecision, LeaveRequestRead, LeaveDayPreviewRead,LeaveRequestManagerDecision
from .service import leave_request_service

leave_request_router = APIRouter()
access_token_bearer = AccessTokenBearer()
role_checker = Depends(RoleChecker(["admin", "hr"]))
module="Leave Request"

@leave_request_router.get("/preview-days",response_model=LeaveDayPreviewRead,status_code=status.HTTP_200_OK,)
async def preview_leave_days(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_session),
):
    return await leave_request_service.preview_leave_days(session, start_date, end_date)


@leave_request_router.post("/apply",response_model=LeaveRequestRead,status_code=status.HTTP_201_CREATED)
async def apply_leave(
    data: LeaveRequestCreate,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_uid = token_details["user"]["user_uid"]
    email = token_details["user"]["email"]
    return await leave_request_service.apply_leave(session, data, user_uid, email)


@leave_request_router.get("/my-requests",response_model=List[LeaveRequestRead],status_code=status.HTTP_200_OK)
async def list_my_requests(
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    return await leave_request_service.list_my_requests(session, email)


@leave_request_router.get("/leave-request-pending",response_model=List[LeaveRequestRead],status_code=status.HTTP_200_OK,dependencies=[role_checker])
async def list_pending_leave_request(session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    role_name = str(token_details["user"].get("role_name") or "")
    return await leave_request_service.list_pending_leave_request(session, email, role_name)


@leave_request_router.post("/{leave_request_uid}/approve",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK,dependencies=[role_checker])
async def approve_leave(
    leave_request_uid: uuid.UUID,
    data: LeaveRequestDecision,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    role_name = str(token_details["user"].get("role_name") or "")
    return await leave_request_service.approve_leave(session, leave_request_uid, email, data, role_name)


@leave_request_router.post("/{leave_request_uid}/reject",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK,dependencies=[role_checker])
async def reject_leave(
    leave_request_uid: uuid.UUID,
    data: LeaveRequestDecision,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    email = token_details["user"]["email"]
    role_name = str(token_details["user"].get("role_name") or "")
    return await leave_request_service.reject_leave(session, leave_request_uid, email, data, role_name)

##### Manager Level Leave Approve and Reject routes ############3
# @leave_request_router.get("/Manager-Level-Pending",response_model=List[LeaveRequestRead],status_code=status.HTTP_200_OK)
# async def list_manager_pending_leave_requests(session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer),):
#     email = token_details["user"]["email"]
#     return await leave_request_service.list_manager_pending_leave_requests(session, email)


# @leave_request_router.post("/{leave_request_uid}/Manager-Level-Decision",response_model=LeaveRequestRead,status_code=status.HTTP_200_OK)
# async def manager_decide_leave_request(leave_request_uid: uuid.UUID,data: LeaveRequestManagerDecision,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
#     email = token_details["user"]["email"]
#     return await leave_request_service.manager_decide_leave_request(session=session,leave_request_uid=leave_request_uid,manager_email=email,action=data.action,reviewer_note=data.reviewer_note)
