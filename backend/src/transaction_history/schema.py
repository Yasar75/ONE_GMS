import uuid
from datetime import date, datetime
from typing import Optional, Literal, List
from pydantic import BaseModel


TransactionType = Literal["LEAVE", "REGULARIZATION"]


class TransactionHistoryRead(BaseModel):
    uid: uuid.UUID
    transaction_type: TransactionType
    request_date: date
    created_at: datetime
    status: str
    details: str
    pending_with: Optional[str] = None
    approver_employee_uid: Optional[uuid.UUID] = None
    reviewer_note: Optional[str] = None


class TransactionHistoryListRead(BaseModel):
    items: List[TransactionHistoryRead]
    total: int