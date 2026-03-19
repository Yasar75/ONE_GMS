import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.dependencies import AccessTokenBearer, AdminOnly,PermissionChecker
from src.db.main import get_session
from src.db.models.employee_metadata import MetadataCategory
from .schema import EmployeeMetadataCreate, EmployeeMetadataRead, EmployeeMetadataUpdate
from .service import employee_metadata_service

employee_metadata_router = APIRouter()
access_token_bearer = AccessTokenBearer()
adminonly = Depends(AdminOnly)
module= "Employee Metadata"

@employee_metadata_router.get("/", response_model=List[EmployeeMetadataRead], status_code=status.HTTP_200_OK)
async def list_employee_metadata(
    category: Optional[MetadataCategory] = Query(default=None),
    active_only: bool = Query(default=False),
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    return await employee_metadata_service.list_entries(session, category, active_only)


@employee_metadata_router.post("/", response_model=EmployeeMetadataRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(PermissionChecker(module, "c"))])
async def create_employee_metadata(
    data: EmployeeMetadataCreate,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_uid = token_details.get("user", {}).get("user_uid")
    return await employee_metadata_service.create_entry(session, data, uuid.UUID(user_uid) if user_uid else None)


@employee_metadata_router.put("/{metadata_uid}", response_model=EmployeeMetadataRead, status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_employee_metadata(
    metadata_uid: uuid.UUID,
    data: EmployeeMetadataUpdate,
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    return await employee_metadata_service.update_entry(session, metadata_uid, data)


@employee_metadata_router.delete("/{metadata_uid}", status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "d"))])
async def delete_employee_metadata(
    metadata_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    await employee_metadata_service.delete_entry(session, metadata_uid)
    return {"detail": "Metadata entry deleted successfully."}
