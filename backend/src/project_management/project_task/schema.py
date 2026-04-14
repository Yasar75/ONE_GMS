import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class ProjectTaskBase(BaseModel):
    project_uid: uuid.UUID
    employee_uid: uuid.UUID
    project_assignment_uid: Optional[uuid.UUID] = None
    task_date: Optional[date] = None
    hour_work: int = 0
    task_completed: int = 0
    task_inprogress: int = 0
    task_rework: int = 0
    task_approved: int = 0
    task_rejected: int = 0
    task_reviewed: int = 0
    remarks: Optional[str] = None
 

    @field_validator(
        "hour_work",
        "task_completed",
        "task_inprogress",
        "task_rework",
        "task_approved",
        "task_rejected",
        "task_reviewed",
    )
    @classmethod
    def validate_non_negative_int(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Value cannot be negative")
        return value

    @field_validator("remarks")
    @classmethod
    def normalize_remarks(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None


class ProjectTaskCreate(ProjectTaskBase):
    pass


class ProjectTaskUpdate(BaseModel):
    project_uid: Optional[uuid.UUID] = None
    employee_uid: Optional[uuid.UUID] = None
    project_assignment_uid: Optional[uuid.UUID] = None
    task_date: Optional[date] = None
    hour_work: Optional[int] = None
    task_completed: Optional[int] = None
    task_inprogress: Optional[int] = None
    task_rework: Optional[int] = None
    task_approved: Optional[int] = None
    task_rejected: Optional[int] = None
    task_reviewed: Optional[int] = None
    remarks: Optional[str] = None

    @field_validator(
        "hour_work",
        "task_completed",
        "task_inprogress",
        "task_rework",
        "task_approved",
        "task_rejected",
        "task_reviewed",
    )
    @classmethod
    def validate_non_negative_optional_int(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        if value < 0:
            raise ValueError("Value cannot be negative")
        return value

    @field_validator("remarks")
    @classmethod
    def normalize_remarks(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None


class ProjectTaskRead(ProjectTaskBase):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ProjectTaskListResponse(BaseModel):
    items: list[ProjectTaskRead]
    total: int


class ProjectTaskMessageResponse(BaseModel):
    message: str