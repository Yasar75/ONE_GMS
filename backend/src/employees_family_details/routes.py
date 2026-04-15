import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import AccessTokenBearer, PermissionChecker,AdminOnly
from src.db.main import get_session
from .schema import EmployeeFamilyDetailCreate,EmployeeFamilyDetailUpdate,EmployeeFamilyDetailRead
from .service import employee_family_detail_service


employee_family_detail_router = APIRouter()
access_token_bearer = AccessTokenBearer()
employee_admin_module = "My Family Details"
admin_module="Employee's Family Details"


@employee_family_detail_router.post("/",response_model=EmployeeFamilyDetailRead,status_code=status.HTTP_201_CREATED,dependencies=[Depends(PermissionChecker(employee_admin_module, "c"))])
async def create_employee_family_detail(payload: EmployeeFamilyDetailCreate,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    user_uid = token_details["user"]["user_uid"]
    return await employee_family_detail_service.create(session, payload, user_uid)

@employee_family_detail_router.put("/{family_uid}",response_model=EmployeeFamilyDetailRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(employee_admin_module, "u"))])
async def update_employee_family_detail(family_uid: uuid.UUID,payload: EmployeeFamilyDetailUpdate,session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer)):
    return await employee_family_detail_service.update(session, family_uid, payload)

@employee_family_detail_router.get("/",response_model=List[EmployeeFamilyDetailRead],status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(admin_module, "r"))])
async def get_all_employee_family_details(session: AsyncSession = Depends(get_session)):
    return await employee_family_detail_service.get_all(session)


@employee_family_detail_router.get("/{family_uid}",response_model=EmployeeFamilyDetailRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(employee_admin_module, "r"))])
async def get_employee_family_detail_by_uid(family_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
    return await employee_family_detail_service.get_by_uid(session, family_uid)


@employee_family_detail_router.get("/employee/{employee_uid}",response_model=List[EmployeeFamilyDetailRead],status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(employee_admin_module, "r"))])
async def get_family_details_by_employee_uid(employee_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
    return await employee_family_detail_service.get_by_employee_uid(session, employee_uid)


@employee_family_detail_router.delete("/{family_uid}",status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(employee_admin_module, "r"))])
async def delete_employee_family_detail(family_uid: uuid.UUID,session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer)):
    await employee_family_detail_service.delete(session, family_uid)
    return {"detail": "Employee family detail deleted successfully."}