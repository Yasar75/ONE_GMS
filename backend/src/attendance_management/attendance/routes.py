import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import RoleChecker,PermissionChecker,AccessTokenBearer
from src.db.main import get_session
from .schema import AttendanceRead, AttendanceUpdate
from .service import attendance_service

access_token_bearer = AccessTokenBearer()
attendance_router = APIRouter()
role_checker = Depends(RoleChecker(["admin", "Hr"]))
module = "Attendance"
#dependencies=[Depends(PermissionChecker(module, "c"))]

@attendance_router.get("/", response_model=List[AttendanceRead], status_code=status.HTTP_200_OK, dependencies=[role_checker])
async def get_all_attendance(employee_uid: Optional[uuid.UUID] = Query(default=None), session: AsyncSession = Depends(get_session)):
    return await attendance_service.get_all_attendance(session=session, employee_uid=employee_uid)


@attendance_router.get("/{attendance_uid}", response_model=AttendanceRead, status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_attendance_by_uid(attendance_uid: uuid.UUID, session: AsyncSession = Depends(get_session)):
    return await attendance_service.get_attendance_by_uid(session=session, attendance_uid=attendance_uid)


@attendance_router.patch("/{attendance_uid}", response_model=AttendanceRead, status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_attendance(attendance_uid: uuid.UUID, data: AttendanceUpdate, session: AsyncSession = Depends(get_session)):
    return await attendance_service.update_attendance(session=session, attendance_uid=attendance_uid, data=data)

