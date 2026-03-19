import uuid
from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker
from src.db.main import get_session
from .schema import (
    GenerateEmployeeLeaveBalanceRequest,
    ManualGrantLeaveBalanceRequest,
    EmployeeLeaveBalanceRead,
)
from .service import employee_leave_balance_service

employee_leave_balance_router = APIRouter()
access_token_bearer = AccessTokenBearer()
role_checker = Depends(RoleChecker(["admin", "hr"]))
module= "Employee Leave Balance"

@employee_leave_balance_router.post("/generate",response_model=List[EmployeeLeaveBalanceRead],status_code=status.HTTP_201_CREATED,dependencies=[Depends(PermissionChecker(module, "c"))])
async def generate_leave_balances(data: GenerateEmployeeLeaveBalanceRequest,session: AsyncSession = Depends(get_session),
token_details: dict = Depends(access_token_bearer)):
    user_uid = token_details["user"]["user_uid"]
    return await employee_leave_balance_service.generate_balances(session, data, user_uid)


@employee_leave_balance_router.post("/manual-grant",response_model=EmployeeLeaveBalanceRead,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(module, "c"))])
async def manual_grant_leave(data: ManualGrantLeaveBalanceRequest,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    user_uid = token_details["user"]["user_uid"]
    return await employee_leave_balance_service.manual_grant_leave(session, data, user_uid)


@employee_leave_balance_router.get("/all",response_model=List[EmployeeLeaveBalanceRead],status_code=status.HTTP_200_OK,dependencies=[role_checker])
async def get_all_employees_leave_balances(year: int | None = Query(None, ge=2000, le=2100),session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    return await employee_leave_balance_service.get_all_employees_leave_balances(session, year)

@employee_leave_balance_router.get("/{employee_uid}",response_model=List[EmployeeLeaveBalanceRead],status_code=status.HTTP_200_OK)
async def get_employee_balances(employee_uid: uuid.UUID,year: int = Query(..., ge=2000, le=2100),session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    return await employee_leave_balance_service.get_employee_balances(session, employee_uid, year)

# @employee_leave_balance_router.get("/{employee_uid}",response_model=List[EmployeeLeaveBalanceRead],status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
# async def get_employee_balances(employee_uid: uuid.UUID,year: int = Query(..., ge=2000, le=2100),session: AsyncSession = Depends(get_session)):
#     return await employee_leave_balance_service.get_employee_balances(session, employee_uid, year)


# @employee_leave_balance_router.get("/all",response_model=List[EmployeeLeaveBalanceRead],status_code=status.HTTP_200_OK,
# dependencies=[Depends(PermissionChecker(module, "r"))])
# async def get_all_employees_leave_balances(year: int | None = Query(None, ge=2000, le=2100),session: AsyncSession = Depends(get_session)):
#     return await employee_leave_balance_service.get_all_employees_leave_balances(session, year)
