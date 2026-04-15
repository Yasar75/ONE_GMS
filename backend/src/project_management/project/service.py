import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Project
from src.project_management.project.schema import ProjectCreate, ProjectUpdate


class ProjectService:
    @staticmethod
    async def create_project(
        db: AsyncSession,
        payload: ProjectCreate,
        created_by: uuid.UUID,
    ) -> Project:
        stmt = select(Project).where(
            func.lower(Project.project_code) == payload.project_code.lower()
        )

        existing_code = await db.scalar(stmt)
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project code already exists",
            )

        project = Project(
            created_by=created_by,
            project_code=payload.project_code,
            project_name=payload.project_name,
            description=payload.description,
            start_date=payload.start_date,
            end_date=payload.end_date,
            status=payload.status,
        )

        db.add(project)
        await db.commit()
        await db.refresh(project)
        return project

    @staticmethod
    async def get_project_by_uid(
        db: AsyncSession,
        project_uid: uuid.UUID,
    ) -> Project:
        stmt = select(Project).where(Project.uid == project_uid)
        project = await db.scalar(stmt)

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        return project

    @staticmethod
    async def list_projects(
        db: AsyncSession,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Project], int]:
        conditions = []

        if search:
            search_value = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Project.project_code.ilike(search_value),
                    Project.project_name.ilike(search_value),
                    Project.description.ilike(search_value),
                )
            )

        if status_filter:
            conditions.append(
                func.lower(Project.status) == status_filter.strip().lower()
            )

        data_stmt = select(Project)
        count_stmt = select(func.count(Project.uid))

        if conditions:
            data_stmt = data_stmt.where(*conditions)
            count_stmt = count_stmt.where(*conditions)

        data_stmt = (
            data_stmt
            .order_by(Project.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(data_stmt)
        items = result.scalars().all()

        total = await db.scalar(count_stmt)
        return items, total or 0

    @staticmethod
    async def update_project(
        db: AsyncSession,
        project_uid: uuid.UUID,
        payload: ProjectUpdate,
    ) -> Project:
        project = await ProjectService.get_project_by_uid(db, project_uid)

        update_data = payload.model_dump(exclude_unset=True)

        if "project_code" in update_data and update_data["project_code"]:
            stmt = select(Project).where(
                func.lower(Project.project_code) == update_data["project_code"].lower(),
                Project.uid != project_uid,
            )
            existing_code = await db.scalar(stmt)
            if existing_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Project code already exists",
                )

        for field, value in update_data.items():
            setattr(project, field, value)

        db.add(project)
        await db.commit()
        await db.refresh(project)
        return project

    @staticmethod
    async def delete_project(
        db: AsyncSession,
        project_uid: uuid.UUID,
    ) -> None:
        project = await ProjectService.get_project_by_uid(db, project_uid)
        await db.delete(project)
        await db.commit()