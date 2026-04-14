import uuid
from datetime import date
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.models import Employee, Project, ProjectAssignment, ProjectTask
from src.project_management.project_task.schema import ProjectTaskCreate,ProjectTaskUpdate


class ProjectTaskService:
    async def _get_project_or_404(self,db: AsyncSession,project_uid: uuid.UUID) -> Project:
        stmt = select(Project).where(Project.uid == project_uid)
        project = await db.scalar(stmt)

        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Project not found")
        return project

    async def _get_employee_or_404(self,db: AsyncSession,employee_uid: uuid.UUID) -> Employee:
        stmt = select(Employee).where(Employee.uid == employee_uid)
        employee = await db.scalar(stmt)

        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee not found")
        return employee

    async def _get_project_assignment_or_404(self,db: AsyncSession,project_assignment_uid: uuid.UUID) -> ProjectAssignment:
        stmt = select(ProjectAssignment).where(ProjectAssignment.uid == project_assignment_uid)
        assignment = await db.scalar(stmt)

        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Project assignment not found")
        return assignment

    async def _validate_assignment_mapping(self,db: AsyncSession,*,project_uid: uuid.UUID,employee_uid: uuid.UUID,project_assignment_uid: Optional[uuid.UUID]) -> None:
        if not project_assignment_uid:
            return

        assignment = await self._get_project_assignment_or_404(db=db,project_assignment_uid=project_assignment_uid)

        if assignment.project_uid != project_uid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="project_assignment_uid does not belong to the given project")

        if assignment.employee_uid != employee_uid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="project_assignment_uid does not belong to the given employee")

    async def create_project_task(self,db: AsyncSession,payload: ProjectTaskCreate,created_by: uuid.UUID) -> ProjectTask:
        await self._get_project_or_404(db, payload.project_uid)
        await self._get_employee_or_404(db, payload.employee_uid)

        await self._validate_assignment_mapping(db=db,project_uid=payload.project_uid,employee_uid=payload.employee_uid,
        project_assignment_uid=payload.project_assignment_uid)

        project_task = ProjectTask(
            created_by=created_by,
            project_uid=payload.project_uid,
            employee_uid=payload.employee_uid,
            project_assignment_uid=payload.project_assignment_uid,
            task_date=payload.task_date,
            hour_work=payload.hour_work,
            task_completed=payload.task_completed,
            task_inprogress=payload.task_inprogress,
            task_rework=payload.task_rework,
            task_approved=payload.task_approved,
            task_rejected=payload.task_rejected,
            task_reviewed=payload.task_reviewed,
            remarks=payload.remarks,
        )

        db.add(project_task)
        await db.commit()
        await db.refresh(project_task)
        return project_task

    async def get_project_task_by_uid(self,db: AsyncSession,project_task_uid: uuid.UUID) -> ProjectTask:
        stmt = select(ProjectTask).where(ProjectTask.uid == project_task_uid)
        project_task = await db.scalar(stmt)

        if not project_task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Project task not found")

        return project_task

    async def list_project_tasks(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        project_uid: Optional[uuid.UUID] = None,
        employee_uid: Optional[uuid.UUID] = None,
        project_assignment_uid: Optional[uuid.UUID] = None,
        task_date: Optional[date] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[ProjectTask], int]:
        conditions = []

        if search:
            search_value = f"%{search.strip()}%"
            conditions.append(ProjectTask.remarks.ilike(search_value))

        if project_uid:
            conditions.append(ProjectTask.project_uid == project_uid)

        if employee_uid:
            conditions.append(ProjectTask.employee_uid == employee_uid)

        if project_assignment_uid:
            conditions.append(ProjectTask.project_assignment_uid == project_assignment_uid)

        if task_date:
            conditions.append(ProjectTask.task_date == task_date)

        if from_date:
            conditions.append(ProjectTask.task_date >= from_date)

        if to_date:
            conditions.append(ProjectTask.task_date <= to_date)

        data_stmt = select(ProjectTask)
        count_stmt = select(func.count(ProjectTask.uid))

        if conditions:
            data_stmt = data_stmt.where(*conditions)
            count_stmt = count_stmt.where(*conditions)

        data_stmt = (data_stmt.order_by(ProjectTask.created_at.desc()).offset(skip).limit(limit))

        result = await db.execute(data_stmt)
        items = result.scalars().all()

        total = await db.scalar(count_stmt)
        return items, total or 0

    async def update_project_task(self,db: AsyncSession,project_task_uid: uuid.UUID,payload: ProjectTaskUpdate) -> ProjectTask:
        project_task = await self.get_project_task_by_uid(db, project_task_uid)

        update_data = payload.model_dump(exclude_unset=True)

        new_project_uid = update_data.get("project_uid", project_task.project_uid)
        new_employee_uid = update_data.get("employee_uid", project_task.employee_uid)
        new_project_assignment_uid = update_data.get(
            "project_assignment_uid",
            project_task.project_assignment_uid,
        )

        await self._get_project_or_404(db, new_project_uid)
        await self._get_employee_or_404(db, new_employee_uid)

        await self._validate_assignment_mapping(
            db=db,
            project_uid=new_project_uid,
            employee_uid=new_employee_uid,
            project_assignment_uid=new_project_assignment_uid,
        )

        for field, value in update_data.items():
            setattr(project_task, field, value)

        db.add(project_task)
        await db.commit()
        await db.refresh(project_task)
        return project_task

    async def delete_project_task(self,db: AsyncSession,project_task_uid: uuid.UUID) -> None:
        project_task = await self.get_project_task_by_uid(db, project_task_uid)
        await db.delete(project_task)
        await db.commit()


project_task_service = ProjectTaskService()