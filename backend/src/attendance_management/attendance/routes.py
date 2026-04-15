import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.dependencies import PermissionChecker
from src.db.main import get_session
from .schema import AttendanceRead, AttendanceUpdate, AttendanceSyncRequest, AttendanceSyncResponse
from .service import attendance_service

attendance_router = APIRouter()

admin_module = "Attendance Overview"
employee_admin_module = "My Attendance Preview"


@attendance_router.get(
    "/",
    response_model=List[AttendanceRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(admin_module, "r"))],
)
async def get_all_attendance(
    employee_uid: Optional[uuid.UUID] = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    return await attendance_service.get_all_attendance(session=session, employee_uid=employee_uid)


@attendance_router.get(
    "/{attendance_uid}",
    response_model=AttendanceRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(employee_admin_module, "r"))],
)
async def get_attendance_by_uid(
    attendance_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    return await attendance_service.get_attendance_by_uid(session=session, attendance_uid=attendance_uid)


@attendance_router.post(
    "/sync",
    response_model=AttendanceSyncResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(admin_module, "u"))],
)
async def sync_attendance(
    data: AttendanceSyncRequest,
    session: AsyncSession = Depends(get_session),
):
    end_date = data.end_date or data.start_date
    result = await attendance_service.sync_attendance_range(
        session=session,
        start_date=data.start_date,
        end_date=end_date,
    )
    return AttendanceSyncResponse(**result)