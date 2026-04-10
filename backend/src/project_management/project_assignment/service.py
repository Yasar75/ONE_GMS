import uuid
from datetime import date
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import Employee, Project, ProjectAssignment
from src.project_management.project_assignment.schema import (
    ProjectAssignmentCreate,
    ProjectAssignmentUpdate,
)


ACTIVE_ASSIGNMENT_STATUSES = {"assigned", "active"}
NON_BILLABLE_ASSIGNMENT_STATUSES = {
    "released",
    "hold",
    "terminated",
    "inactive",
    "completed",
}


class ProjectAssignmentService:
    async def _get_project_or_404(self,db: AsyncSession,project_uid: uuid.UUID) -> Project:
        project = await db.get(Project, project_uid)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Project not found")
        return project

    async def _get_employee_or_404(self,db: AsyncSession,employee_uid: uuid.UUID,) -> Employee:
        employee = await db.get(Employee, employee_uid)
        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee not found")
        return employee

    def _normalize_status(self, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None

    def _is_date_overlap(self,assigned_from: Optional[date],assigned_to: Optional[date],existing_from: Optional[date],
    existing_to: Optional[date]) -> bool:
        start_1 = assigned_from or date.min
        end_1 = assigned_to or date.max
        start_2 = existing_from or date.min
        end_2 = existing_to or date.max
        return start_1 <= end_2 and start_2 <= end_1

    async def _ensure_no_overlap(self,db: AsyncSession,*,
        project_uid: uuid.UUID,
        employee_uid: uuid.UUID,
        assigned_from: Optional[date],
        assigned_to: Optional[date],
        exclude_uid: Optional[uuid.UUID] = None,
    ) -> None:
        stmt = select(ProjectAssignment).where(ProjectAssignment.project_uid == project_uid,ProjectAssignment.employee_uid == employee_uid)
        if exclude_uid:
            stmt = stmt.where(ProjectAssignment.uid != exclude_uid)

        result = await db.execute(stmt)
        assignments = result.scalars().all()

        for item in assignments:
            if self._is_date_overlap(assigned_from,assigned_to,item.assigned_from,item.assigned_to):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Employee already has an overlapping assignment for this project")

    async def _sync_employee_billing_status(self,db: AsyncSession,employee_uid: uuid.UUID) -> None:
        employee = await self._get_employee_or_404(db, employee_uid)

        stmt = select(ProjectAssignment).where(ProjectAssignment.employee_uid == employee_uid)
        result = await db.execute(stmt)
        assignments = result.scalars().all()

        today = date.today()
        has_active_assignment = False

        for item in assignments:
            normalized_status = (item.status or "").strip().lower()
            if normalized_status not in ACTIVE_ASSIGNMENT_STATUSES:
                continue

            if item.assigned_from and item.assigned_from > today:
                continue
            if item.assigned_to and item.assigned_to < today:
                continue

            has_active_assignment = True
            break

        employee.billing_status = "Billable" if has_active_assignment else "NonBillable"
        db.add(employee)

    async def create_project_assignment(self,db: AsyncSession,payload: ProjectAssignmentCreate,created_by: uuid.UUID) -> ProjectAssignment:
        await self._get_project_or_404(db, payload.project_uid)
        await self._get_employee_or_404(db, payload.employee_uid)
        await self._ensure_no_overlap(db,project_uid=payload.project_uid,employee_uid=payload.employee_uid,
            assigned_from=payload.assigned_from,assigned_to=payload.assigned_to)

        assignment = ProjectAssignment(
            created_by=created_by,
            project_uid=payload.project_uid,
            employee_uid=payload.employee_uid,
            assigned_from=payload.assigned_from,
            assigned_to=payload.assigned_to,
            pod_name=payload.pod_name,
            team_lead=payload.team_lead,
            allocation_percentage=payload.allocation_percentage,
            status=self._normalize_status(payload.status),
            remarks=payload.remarks,
        )

        db.add(assignment)
        await self._sync_employee_billing_status(db, payload.employee_uid)
        await db.commit()
        await db.refresh(assignment)
        return assignment

    async def get_project_assignment_by_uid(self,db: AsyncSession,assignment_uid: uuid.UUID) -> ProjectAssignment:
        assignment = await db.get(ProjectAssignment, assignment_uid)
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Project assignment not found")
        return assignment

    async def list_project_assignments(self,db: AsyncSession,*,search: Optional[str] = None,project_uid: Optional[uuid.UUID] = None,
        employee_uid: Optional[uuid.UUID] = None,status_filter: Optional[str] = None,
        skip: int = 0,limit: int = 20) -> tuple[list[ProjectAssignment], int]:
        conditions = []

        if search:
            search_value = f"%{search.strip()}%"
            conditions.append(
                or_(ProjectAssignment.pod_name.ilike(search_value),ProjectAssignment.team_lead.ilike(search_value),
                    ProjectAssignment.status.ilike(search_value),ProjectAssignment.remarks.ilike(search_value)))

        if project_uid:
            conditions.append(ProjectAssignment.project_uid == project_uid)

        if employee_uid:
            conditions.append(ProjectAssignment.employee_uid == employee_uid)

        if status_filter:
            conditions.append(func.lower(ProjectAssignment.status) == status_filter.strip().lower())

        data_stmt = select(ProjectAssignment)
        count_stmt = select(func.count(ProjectAssignment.uid))

        if conditions:
            data_stmt = data_stmt.where(and_(*conditions))
            count_stmt = count_stmt.where(and_(*conditions))

        data_stmt = (data_stmt.order_by(ProjectAssignment.created_at.desc()).offset(skip).limit(limit))
        result = await db.execute(data_stmt)
        items = result.scalars().all()
        total = await db.scalar(count_stmt)

        return items, total or 0

    async def update_project_assignment(self,db: AsyncSession,assignment_uid: uuid.UUID,payload: ProjectAssignmentUpdate) -> ProjectAssignment:
        assignment = await self.get_project_assignment_by_uid(db, assignment_uid)
        old_employee_uid = assignment.employee_uid

        update_data = payload.model_dump(exclude_unset=True)

        new_project_uid = update_data.get("project_uid", assignment.project_uid)
        new_employee_uid = update_data.get("employee_uid", assignment.employee_uid)
        new_assigned_from = update_data.get("assigned_from", assignment.assigned_from)
        new_assigned_to = update_data.get("assigned_to", assignment.assigned_to)

        await self._get_project_or_404(db, new_project_uid)
        await self._get_employee_or_404(db, new_employee_uid)

        if new_assigned_from and new_assigned_to and new_assigned_to < new_assigned_from:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="assigned_to cannot be earlier than assigned_from")

        await self._ensure_no_overlap(
            db,
            project_uid=new_project_uid,
            employee_uid=new_employee_uid,
            assigned_from=new_assigned_from,
            assigned_to=new_assigned_to,
            exclude_uid=assignment_uid,
        )

        if "status" in update_data:
            update_data["status"] = self._normalize_status(update_data["status"])

        for field, value in update_data.items():
            setattr(assignment, field, value)

        db.add(assignment)
        await self._sync_employee_billing_status(db, new_employee_uid)
        if old_employee_uid != new_employee_uid:
            await self._sync_employee_billing_status(db, old_employee_uid)
        await db.commit()
        await db.refresh(assignment)
        return assignment

    async def delete_project_assignment(self,db: AsyncSession,assignment_uid: uuid.UUID) -> None:
        assignment = await self.get_project_assignment_by_uid(db, assignment_uid)
        employee_uid = assignment.employee_uid
        await db.delete(assignment)
        await self._sync_employee_billing_status(db, employee_uid)
        await db.commit()


project_assignment_service = ProjectAssignmentService()
