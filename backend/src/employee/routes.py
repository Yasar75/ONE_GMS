from typing import List
import uuid
from fastapi import APIRouter, Depends, status,BackgroundTasks
from sqlmodel.ext.asyncio.session import AsyncSession
 
from src.auth.dependencies import AccessTokenBearer, RoleChecker,AdminOnly,PermissionChecker
from src.db.main import get_session
from src.errors import EmployeeNotFound
from src.employee.service import EmployeeService
from .schema import EmployeeBase, EmployeeCreate, EmployeeUpdate

employee_router = APIRouter()
employee_service = EmployeeService()
access_token_bearer = AccessTokenBearer()
role_checker = Depends(RoleChecker(["admin", "HR"]))
adminonly= Depends(AdminOnly)
module = "Employee"

@employee_router.get("/", response_model=List[EmployeeBase], status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_all_employee(session: AsyncSession = Depends(get_session)):
    return await employee_service.get_all_employee(session)


@employee_router.get("/{employee_uid}", response_model=EmployeeBase, status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_employee_by_uid(employee_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
    return await employee_service.get_employee_by_uid(session, employee_uid)

    
@employee_router.post("", status_code=status.HTTP_201_CREATED, response_model=EmployeeBase,dependencies=[Depends(PermissionChecker(module, "c"))]) 
async def create_a_employee(
    employee_data: EmployeeCreate,
    bg_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_id = token_details.get("user", {}).get("user_uid")
    new_employee = await employee_service.create_Employees(employees_data=employee_data,
        user_uid=user_id,
        session=session,
        bg_tasks=bg_tasks,)
    return new_employee





@employee_router.put("/{employee_uid}", response_model=EmployeeBase, dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_employee(employee_uid: uuid.UUID,employee_data: EmployeeUpdate,
session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer),):
    return await employee_service.update_employee(session, employee_uid, employee_data)


@employee_router.delete("/{employee_uid}", status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "d"))])
async def delete_employee(
    employee_uid: str,
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    ok = await employee_service.delete_employee(employee_uid,session)
    if not ok:
        raise EmployeeNotFound()

    return {"detail": "Deleted successfully"}