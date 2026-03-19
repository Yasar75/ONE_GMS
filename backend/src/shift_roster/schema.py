import uuid
from datetime import time, datetime
from typing import Optional, List
from pydantic import BaseModel, Field as PydField, model_validator


class ShiftRosterCreate(BaseModel):
    code: str = PydField(..., max_length=20)
    name: str = PydField(..., max_length=80)
    start_time: time
    end_time: time
    is_active: bool = True

class ShiftRosterUpdate(BaseModel):
    name: Optional[str] = PydField(default=None, max_length=80)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_active: Optional[bool] = None

class ShiftRosterRead(BaseModel):
    uid: uuid.UUID
    code: str
    name: str
    start_time: time
    end_time: time
    is_active: bool
    user_uid: uuid.UUID
    created_at: datetime
    updated_at: datetime


 

 

class PaginatedResponse(BaseModel):
    total: int
    items: List