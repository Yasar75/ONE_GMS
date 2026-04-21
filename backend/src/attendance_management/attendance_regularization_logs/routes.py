import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import RoleChecker,PermissionChecker
from src.db.main import get_session
from .schema import AttendanceRegularizationLogRead
from .service import attendance_regularization_log_service

attendance_regularization_log_router = APIRouter()
#role_checker = Depends(RoleChecker(["admin", "hr", "manager"]))
module = "Self Regularization Logs"
#dependencies=[Depends(PermissionChecker(module, "c"))]

@attendance_regularization_log_router.get("/{regularization_uid}",response_model=List[AttendanceRegularizationLogRead],status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def list_regularization_logs(regularization_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
    return await attendance_regularization_log_service.list_logs(session, regularization_uid)