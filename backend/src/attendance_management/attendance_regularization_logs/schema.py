import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AttendanceRegularizationLogRead(BaseModel):
    uid: uuid.UUID
    regularization_uid: uuid.UUID
    actor_employee_uid: Optional[uuid.UUID]
    action: str
    note: Optional[str]
    created_at: datetime