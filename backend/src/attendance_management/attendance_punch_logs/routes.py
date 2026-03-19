from datetime import date
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import AccessTokenBearer
from src.db.main import get_session
from .schema import AttendancePunchActionResponse, AttendancePunchLogRead
from .service import attendance_punch_log_service

attendance_punch_log_router = APIRouter()
access_token_bearer = AccessTokenBearer()


@attendance_punch_log_router.post("/punch-in",response_model=AttendancePunchActionResponse,status_code=status.HTTP_200_OK)
async def punch_in_current_user(session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    user_data = token_details.get("user", {})
    return await attendance_punch_log_service.punch_in_current_user(session=session,user_uid=user_data.get("user_uid"),employee_email=user_data.get("email"))


@attendance_punch_log_router.post("/punch-out",response_model=AttendancePunchActionResponse,status_code=status.HTTP_200_OK)
async def punch_out_current_user(session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    user_data = token_details.get("user", {})
    return await attendance_punch_log_service.punch_out_current_user(session=session,user_uid=user_data.get("user_uid"),employee_email=user_data.get("email"))


@attendance_punch_log_router.get("/my-logs",response_model=List[AttendancePunchLogRead],status_code=status.HTTP_200_OK)
async def list_my_punch_logs(attendance_date: date = Query(...),session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    user_data = token_details.get("user", {})
    return await attendance_punch_log_service.list_my_punch_logs(session=session,employee_email=user_data.get("email"),attendance_date=attendance_date)