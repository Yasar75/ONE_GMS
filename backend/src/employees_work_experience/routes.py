import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import AccessTokenBearer, PermissionChecker
from src.db.main import get_session
from .schema import (
    EmployeeWorkExperienceCreate,
    EmployeeWorkExperienceUpdate,
    EmployeeWorkExperienceRead,
)
from .service import employee_work_experience_service

employee_work_experience_router = APIRouter()
access_token_bearer = AccessTokenBearer()
admin_module = "Employee Work Experience"
employee_admin_module = "My Work Experience"


@employee_work_experience_router.post("/",response_model=EmployeeWorkExperienceRead,status_code=status.HTTP_201_CREATED,dependencies=[Depends(PermissionChecker(employee_admin_module, "c"))])
async def create_employee_work_experience(payload: EmployeeWorkExperienceCreate,session: AsyncSession = Depends(get_session),
token_details: dict = Depends(access_token_bearer)):
    user_uid = token_details.get("user", {}).get("user_uid")
    return await employee_work_experience_service.create(session, payload, user_uid)


@employee_work_experience_router.get("/employee/{employee_uid}",response_model=List[EmployeeWorkExperienceRead],status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(employee_admin_module, "r"))])
async def get_work_experience_by_employee_uid(employee_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
    return await employee_work_experience_service.get_by_employee_uid(session, employee_uid)


@employee_work_experience_router.get("/{experience_uid}",response_model=EmployeeWorkExperienceRead,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(employee_admin_module, "r"))])
async def get_employee_work_experience_by_uid(experience_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
    return await employee_work_experience_service.get_by_uid(session, experience_uid)


@employee_work_experience_router.get("/",response_model=List[EmployeeWorkExperienceRead],status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(admin_module, "r"))])
async def get_all_employee_work_experience(session: AsyncSession = Depends(get_session)):
    return await employee_work_experience_service.get_all(session)


@employee_work_experience_router.put("/{experience_uid}",response_model=EmployeeWorkExperienceRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(employee_admin_module, "u"))])
async def update_employee_work_experience(experience_uid: uuid.UUID,payload: EmployeeWorkExperienceUpdate,session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer)):
    return await employee_work_experience_service.update(session, experience_uid, payload)


@employee_work_experience_router.delete("/{experience_uid}",status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(employee_admin_module, "d"))])
async def delete_employee_work_experience(experience_uid: uuid.UUID,session: AsyncSession = Depends(get_session),
_: dict = Depends(access_token_bearer)):
    await employee_work_experience_service.delete(session, experience_uid)
    return {"detail": "Employee work experience deleted successfully."}