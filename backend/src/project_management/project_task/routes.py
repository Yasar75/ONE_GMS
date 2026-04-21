import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.dependencies import PermissionChecker, get_current_user
from src.db.main import get_session
from src.project_management.project_task.schema import (
    ProjectTaskCreate,
    ProjectTaskListResponse,
    ProjectTaskMessageResponse,
    ProjectTaskRead,
    ProjectTaskUpdate,
)
from src.project_management.project_task.service import project_task_service


project_task_router = APIRouter()
module = "Project Task"


@project_task_router.post("",response_model=ProjectTaskRead,status_code=status.HTTP_201_CREATED,dependencies=[Depends(PermissionChecker(module, "c"))])
async def create_project_task(payload: ProjectTaskCreate,db: AsyncSession = Depends(get_session),current_user=Depends(get_current_user)):
    return await project_task_service.create_project_task(db=db,payload=payload,created_by=current_user.uid)


@project_task_router.get("",response_model=ProjectTaskListResponse,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(module, "r"))])
async def list_project_tasks(
    search: str | None = Query(default=None),
    project_uid: uuid.UUID | None = Query(default=None),
    employee_uid: uuid.UUID | None = Query(default=None),
    project_assignment_uid: uuid.UUID | None = Query(default=None),
    task_date: date | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    items, total = await project_task_service.list_project_tasks(
        db=db,
        search=search,
        project_uid=project_uid,
        employee_uid=employee_uid,
        project_assignment_uid=project_assignment_uid,
        task_date=task_date,
        from_date=from_date,
        to_date=to_date,
        skip=skip,
        limit=limit,
    )
    return ProjectTaskListResponse(items=items, total=total)


@project_task_router.get("/{project_task_uid}",response_model=ProjectTaskRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_project_task(project_task_uid: uuid.UUID,db: AsyncSession = Depends(get_session),
current_user=Depends(get_current_user),):
    return await project_task_service.get_project_task_by_uid(db=db,project_task_uid=project_task_uid)


@project_task_router.put("/{project_task_uid}",response_model=ProjectTaskRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_project_task(
    project_task_uid: uuid.UUID,
    payload: ProjectTaskUpdate,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    return await project_task_service.update_project_task(
        db=db,
        project_task_uid=project_task_uid,
        payload=payload,
    )


@project_task_router.delete("/{project_task_uid}",response_model=ProjectTaskMessageResponse,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(module, "d"))])
async def delete_project_task(
    project_task_uid: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    await project_task_service.delete_project_task(db=db,project_task_uid=project_task_uid)
    
    return ProjectTaskMessageResponse(message="Project task deleted successfully")