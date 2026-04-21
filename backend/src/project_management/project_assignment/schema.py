import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class ProjectAssignmentBase(BaseModel):
    project_uid: uuid.UUID
    employee_uid: uuid.UUID
    assigned_from: Optional[date] = None
    assigned_to: Optional[date] = None
    pod_name: Optional[str] = None
    team_lead: Optional[str] = None
    allocation_percentage: Optional[int] = 100
    status: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("pod_name", "team_lead", "status", "remarks")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None

    @field_validator("allocation_percentage")
    @classmethod
    def validate_allocation_percentage(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        if value < 1 or value > 100:
            raise ValueError("allocation_percentage must be between 1 and 100")
        return value

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.assigned_from and self.assigned_to and self.assigned_to < self.assigned_from:
            raise ValueError("assigned_to cannot be earlier than assigned_from")
        return self


class ProjectAssignmentCreate(ProjectAssignmentBase):
    pass


class ProjectAssignmentUpdate(BaseModel):
    project_uid: Optional[uuid.UUID] = None
    employee_uid: Optional[uuid.UUID] = None
    assigned_from: Optional[date] = None
    assigned_to: Optional[date] = None
    pod_name: Optional[str] = None
    team_lead: Optional[str] = None
    allocation_percentage: Optional[int] = None
    status: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("pod_name", "team_lead", "status", "remarks")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None

    @field_validator("allocation_percentage")
    @classmethod
    def validate_allocation_percentage(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        if value < 1 or value > 100:
            raise ValueError("allocation_percentage must be between 1 and 100")
        return value


class ProjectAssignmentRead(ProjectAssignmentBase):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ProjectAssignmentListResponse(BaseModel):
    items: list[ProjectAssignmentRead]
    total: int


class ProjectAssignmentMessageResponse(BaseModel):
    message: str
