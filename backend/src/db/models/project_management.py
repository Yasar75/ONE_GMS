import uuid
from datetime import datetime, date
from enum import Enum
from typing import Optional

import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg
from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlmodel import Field, SQLModel




class Project(SQLModel, table=True):
    __tablename__ = "projects"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    created_by: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    project_code: str = Field(sa_column=Column(pg.VARCHAR(30), nullable=False, index=True, unique=True))
    project_name: str = Field(sa_column=Column(pg.VARCHAR(150), nullable=False, index=True))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    start_date: Optional[date] = Field(default=None)
    end_date: Optional[date] = Field(default=None)
    status: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    # pod_name: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    # team_lead: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))


class ProjectAssignment(SQLModel, table=True):
    __tablename__ = "project_assignments"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    created_by: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    project_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("projects.uid", ondelete="CASCADE"), nullable=False, index=True))
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False, index=True))
    assigned_from: Optional[date] = Field(default=None)
    assigned_to: Optional[date] = Field(default=None)
    pod_name: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    team_lead: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    allocation_percentage: Optional[int] = Field(default=100, nullable=True)
    status: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    #billing_status: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    remarks: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))


class ProjectTask(SQLModel, table=True):
    __tablename__ = "project_tasks"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    created_by: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    project_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("projects.uid", ondelete="CASCADE"), nullable=False, index=True))
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False, index=True))
    project_assignment_uid: Optional[uuid.UUID] = Field(default=None, sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("project_assignments.uid", ondelete="SET NULL"), nullable=True, index=True))
    task_date: Optional[date] = Field(default=None)
    hour_work: int = Field(default=0)
    task_completed: int = Field(default=0)
    task_inprogress: int = Field(default=0)
    task_rework: int = Field(default=0)
    task_approved: int = Field(default=0)
    task_rejected: int = Field(default=0)
    task_reviewed: int = Field(default=0)

    
    remarks: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))


    # class ProjectStatus(str, Enum):
#     Draft = "Draft"
#     Active = "Active"
#     Hold = "Hold"
#     Terminated = "Terminated"
#     Completed = "Completed"


# class BillingStatus(str, Enum):
#     Billable = "Billable"
#     NonBillable = "NonBillable"


# class ProjectAssignmentStatus(str, Enum):
#     Assigned = "Assigned"
#     Released = "Released"
#     Hold = "Hold"
#     Terminated = "Terminated"


# class TaskStatus(str, Enum):
#     New = "New"
#     InProgress = "InProgress"
#     Completed = "Completed"
#     Rework = "Rework"
#     Hold = "Hold"
#     Cancelled = "Cancelled"
