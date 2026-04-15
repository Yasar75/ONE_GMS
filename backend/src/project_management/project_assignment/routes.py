import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import PermissionChecker, get_current_user
from src.db.main import get_session
from src.project_management.project_assignment.schema import (
    ProjectAssignmentCreate,
    ProjectAssignmentListResponse,
    ProjectAssignmentMessageResponse,
    ProjectAssignmentRead,
    ProjectAssignmentUpdate,
)
from src.project_management.project_assignment.service import project_assignment_service


project_assignment_router = APIRouter()
module = "Project Assignment"


@project_assignment_router.post("",response_model=ProjectAssignmentRead,status_code=status.HTTP_201_CREATED,
dependencies=[Depends(PermissionChecker(module, "c"))])
async def create_project_assignment(payload: ProjectAssignmentCreate,
    db: AsyncSession = Depends(get_session),current_user=Depends(get_current_user)):
    return await project_assignment_service.create_project_assignment(db=db,payload=payload,created_by=current_user.uid)


@project_assignment_router.get("",response_model=ProjectAssignmentListResponse,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(module, "r"))])
async def list_project_assignments(
    search: str | None = Query(default=None),
    project_uid: uuid.UUID | None = Query(default=None),
    employee_uid: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    items, total = await project_assignment_service.list_project_assignments(
        db=db,
        search=search,
        project_uid=project_uid,
        employee_uid=employee_uid,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )
    return ProjectAssignmentListResponse(items=items, total=total)


@project_assignment_router.get("/{assignment_uid}",response_model=ProjectAssignmentRead,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_project_assignment(assignment_uid: uuid.UUID,db: AsyncSession = Depends(get_session),
current_user=Depends(get_current_user)):
    return await project_assignment_service.get_project_assignment_by_uid(db=db,assignment_uid=assignment_uid)


@project_assignment_router.put("/{assignment_uid}",response_model=ProjectAssignmentRead,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_project_assignment(assignment_uid: uuid.UUID,payload: ProjectAssignmentUpdate,
db: AsyncSession = Depends(get_session),current_user=Depends(get_current_user)):
    return await project_assignment_service.update_project_assignment(db=db,assignment_uid=assignment_uid,payload=payload)


@project_assignment_router.delete("/{assignment_uid}",response_model=ProjectAssignmentMessageResponse,
status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "d"))])
async def delete_project_assignment(assignment_uid: uuid.UUID,db: AsyncSession = Depends(get_session),
current_user=Depends(get_current_user)):
    await project_assignment_service.delete_project_assignment(db=db,assignment_uid=assignment_uid)
    return ProjectAssignmentMessageResponse(message="Project assignment deleted successfully")
