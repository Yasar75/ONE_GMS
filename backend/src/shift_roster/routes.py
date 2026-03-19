import uuid
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.main import get_session  # your async session dependency
from .schema import ShiftRosterCreate, ShiftRosterUpdate, ShiftRosterRead
from .service import RosterService,ShiftNotFound
from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker

access_token_bearer = AccessTokenBearer()
#role_checker = Depends(RoleChecker(["admin", "HR"]))
shift_router = APIRouter()
roster_service = RosterService()
module= "Shift Roster"

@shift_router.get("/", response_model=List[ShiftRosterRead], status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_all_shift(session: AsyncSession = Depends(get_session)):
    return await roster_service.get_all_shift(session)


@shift_router.get("/{shift_uid}", response_model=ShiftRosterRead, status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_shift_by_uid(shift_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
    return await roster_service.get_shift_by_uid(session, shift_uid)

    
@shift_router.post("", status_code=status.HTTP_201_CREATED, response_model=ShiftRosterRead, dependencies=[Depends(PermissionChecker(module, "c"))])
async def create_a_shift(shift_data: ShiftRosterCreate,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    user_id = token_details.get("user", {}).get("user_uid")
    new_employee = await roster_service.create_shift(shift_data, user_id, session)
    return new_employee


@shift_router.patch("/{shift_uid}", response_model=ShiftRosterRead, dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_shift(shift_uid: uuid.UUID,shift_data: ShiftRosterUpdate,
session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer),):
    return await roster_service.update_shift(session, shift_uid, shift_data)


@shift_router.delete("/{shift_uid}", status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "d"))])
async def delete_employee(shift_uid: str,session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer)):
    ok = await roster_service.delete_employee(shift_uid,session)
    if not ok:
        raise ShiftNotFound()

    return {"detail": "Deleted successfully"}



