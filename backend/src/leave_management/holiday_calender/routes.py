import uuid
from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker
from src.db.main import get_session
from .schema import HolidayCalendarCreate, HolidayCalendarUpdate, HolidayCalendarRead
from .service import holiday_calendar_service

holiday_calender_router = APIRouter()
access_token_bearer = AccessTokenBearer()
#role_checker = Depends(RoleChecker(["admin", "hr"]))
module= "Holiday Calender"

@holiday_calender_router.post(
    "/",
    response_model=HolidayCalendarRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(PermissionChecker(module, "c"))],
)
async def create_holiday(
    data: HolidayCalendarCreate,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_uid = token_details["user"]["user_uid"]
    return await holiday_calendar_service.create_holiday(session, data, user_uid)


@holiday_calender_router.get(
    "/",
    response_model=List[HolidayCalendarRead],
    status_code=status.HTTP_200_OK,
)
async def list_holidays(
    year: int = Query(..., ge=2000, le=2100),
    session: AsyncSession = Depends(get_session),
):
    return await holiday_calendar_service.list_holidays(session, year)


@holiday_calender_router.get(
    "/{holiday_uid}",
    response_model=HolidayCalendarRead,
    status_code=status.HTTP_200_OK,
)
async def get_holiday(
    holiday_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    return await holiday_calendar_service.get_holiday(session, holiday_uid)


@holiday_calender_router.put(
    "/{holiday_uid}",
    response_model=HolidayCalendarRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(module, "u"))],
)
async def update_holiday(
    holiday_uid: uuid.UUID,
    data: HolidayCalendarUpdate,
    session: AsyncSession = Depends(get_session),
):
    return await holiday_calendar_service.update_holiday(session, holiday_uid, data)


@holiday_calender_router.delete(
    "/{holiday_uid}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(module, "d"))],
)
async def delete_holiday(
    holiday_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    return await holiday_calendar_service.delete_holiday(session, holiday_uid)