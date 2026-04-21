import uuid
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session  
from .schema import EmployeeShiftRead,EmployeeShiftCreate,EmployeeShiftUpdate
from .service import EmployeeShiftService,ShiftNotFound
from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker

access_token_bearer = AccessTokenBearer()
#role_checker = Depends(RoleChecker(["admin", "HR"]))
employee_shift_router = APIRouter()
employee_shift_service = EmployeeShiftService()
admin_module="Assign Shift"
employee_admin_module="My Shift"

## Get all employee's shift Details.
@employee_shift_router.get("/", response_model=List[EmployeeShiftRead], status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(admin_module, "r"))])
async def get_all_employees_shift(session: AsyncSession = Depends(get_session)):
    return await employee_shift_service.get_all_employee_shift(session)


## Get employee shift detail by shift UID.
@employee_shift_router.get("/{employee_shift_uid}", response_model=EmployeeShiftRead, status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(admin_module, "r"))])
async def get_employee_shift_by_uid(employee_shift_uid: uuid.UUID, session: AsyncSession = Depends(get_session)):
    return await employee_shift_service.get_employee_shift_by_uid(session, employee_shift_uid)

## Get employee shift details by employee_uid.
@employee_shift_router.get("/employee-uid/{employee_uid}", response_model=EmployeeShiftRead, status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(employee_admin_module, "r"))])
async def get_employee_shift_by_employee_uid(employee_uid: uuid.UUID, session: AsyncSession = Depends(get_session)):
    return await employee_shift_service.get_employee_shift_by_employee_uid(session, employee_uid)


## Create Employee's shift
@employee_shift_router.post("", status_code=status.HTTP_201_CREATED, response_model=EmployeeShiftRead, dependencies=[Depends(PermissionChecker(admin_module, "c"))])
async def create_a_employees_shift(
    employee_shift_data: EmployeeShiftCreate,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer)
):
    user_id = token_details.get("user", {}).get("user_uid")
    return await employee_shift_service.create_employee_shift(employee_shift_data, user_id, session)


## Update Employee's shift.
@employee_shift_router.patch("/{employee_shift_uid}", response_model=EmployeeShiftRead, dependencies=[Depends(PermissionChecker(admin_module, "u"))])
async def update_employee_shift(
    employee_shift_uid: uuid.UUID,
    employee_shift_data: EmployeeShiftUpdate,
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    return await employee_shift_service.update_employee_shift(session, employee_shift_uid, employee_shift_data)


## Delete employee's shift.
@employee_shift_router.delete("/{employee_shift_uid}", status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(admin_module, "d"))])
async def delete_employee_shift(
    employee_shift_uid: str,
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer)
):
    ok = await employee_shift_service.delete_employee_shift(employee_shift_uid, session)
    if not ok:
        raise ShiftNotFound()

    return {"detail": "Deleted successfully"}

# @employee_shift_router.get("/", response_model=List[EmployeeShiftRead], status_code=status.HTTP_200_OK,dependencies=[role_checker])
# async def get_all_employees_shift(session: AsyncSession = Depends(get_session)):
#     return await employee_shift_router.get_all_employee_shift(session)


# @employee_shift_router.get("/{employee_shift_uid}", response_model=EmployeeShiftRead, status_code=status.HTTP_200_OK,dependencies=[role_checker])
# async def get_employee_shift_by_uid(employee_shift_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
#     return await employee_shift_router.get_employee_shift_by_uid(session, employee_shift_uid)

    
# @employee_shift_router.post("", status_code=status.HTTP_201_CREATED, response_model=EmployeeShiftRead, dependencies=[role_checker])
# async def create_a_employees_shift(employee_shift_data: EmployeeShiftCreate,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
#     user_id = token_details.get("user", {}).get("user_uid")
#     new_employee_shift = await employee_shift_router.create_employee_shift(employee_shift_data, user_id, session)
#     return new_employee_shift


# @employee_shift_router.patch("/{employee_shift_uid}", response_model=EmployeeShiftRead, dependencies=[role_checker])
# async def update_employee_shift(employee_shift_uid: uuid.UUID,employee_shift_data: EmployeeShiftUpdate,
# session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer),):
#     return await employee_shift_router.update_employee_shift(session, employee_shift_uid, employee_shift_data)


# @employee_shift_router.delete("/{employee_shift_uid}", status_code=status.HTTP_200_OK, dependencies=[role_checker])
# async def delete_employee_shift(employee_shift_uid: str,session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer)):
#     ok = await employee_shift_router.delete_employee_shift(employee_shift_uid,session)
#     if not ok:
#         raise ShiftNotFound()

#     return {"detail": "Deleted successfully"}



