# app/modules/employee_shift/schema.py

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class EmployeeShiftRead(BaseModel):
    uid: uuid.UUID
    employee_uid: uuid.UUID
    shift_uid: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    user_uid: uuid.UUID

class EmployeeShiftCreate(BaseModel):
    employee_uid: uuid.UUID = Field(..., description="Employee unique ID")
    shift_uid: uuid.UUID = Field(..., description="Shift roster unique ID")
    is_active: bool = Field(default=True, description="Whether this employee shift assignment is active")


class EmployeeShiftUpdate(BaseModel):
    shift_uid: Optional[uuid.UUID] = Field(default=None, description="Shift roster unique ID")
    is_active: Optional[bool] = Field(default=None, description="Whether this employee shift assignment is active")

   





