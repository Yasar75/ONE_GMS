import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker
from src.db.main import get_session
from src.auth.dependencies import get_current_user
from src.project_management.project.schema import (
    ProjectCreate,
    ProjectListResponse,
    ProjectMessageResponse,
    ProjectRead,
    ProjectUpdate,
)
from src.project_management.project.service import ProjectService

project_router = APIRouter()
module= "Project"

@project_router.post("",response_model=ProjectRead,status_code=status.HTTP_201_CREATED,dependencies=[Depends(PermissionChecker(module, "c"))])
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    return await ProjectService.create_project(
        db=db,
        payload=payload,
        created_by=current_user.uid,
    )


@project_router.get("",response_model=ProjectListResponse,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def list_projects(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    items, total = await ProjectService.list_projects(
        db=db,
        search=search,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )
    return ProjectListResponse(items=items, total=total)


@project_router.get("/{project_uid}",response_model=ProjectRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_project(
    project_uid: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    return await ProjectService.get_project_by_uid(
        db=db,
        project_uid=project_uid,
    )


@project_router.put("/{project_uid}",response_model=ProjectRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_project(
    project_uid: uuid.UUID,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    return await ProjectService.update_project(
        db=db,
        project_uid=project_uid,
        payload=payload,
    )


@project_router.delete("/{project_uid}",response_model=ProjectMessageResponse,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "d"))])
async def delete_project(
    project_uid: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    await ProjectService.delete_project(
        db=db,
        project_uid=project_uid,
    )
    return ProjectMessageResponse(message="Project deleted successfully")