import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from src.db.models.employee_metadata import MetadataCategory


class EmployeeMetadataCreate(BaseModel):
    category: MetadataCategory
    label: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=255)
    is_active: bool = True
    sort_order: int = 0


class EmployeeMetadataUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=255)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class EmployeeMetadataRead(BaseModel):
    uid: uuid.UUID
    category: MetadataCategory
    label: str
    description: Optional[str]
    is_active: bool
    sort_order: int
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
