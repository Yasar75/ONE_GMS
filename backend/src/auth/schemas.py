from pydantic import BaseModel,Field, EmailStr
import uuid
from datetime import datetime
from typing import List, Optional

class UserCreateModel(BaseModel):
    first_name: Optional[str] = Field(max_length=25)
    last_name: Optional[str] = Field(max_length=25)
    username: str = Field(max_length=20)
    email: EmailStr = Field(max_length=40)
    password: str = Field(min_length=6)
    role_id: uuid.UUID
    is_verified: bool = False


class UserModel(BaseModel):
    uid: uuid.UUID 
    username: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    is_verified: bool  
    password_hash: str  = Field(exclude=True)
    created_at: datetime  
    updated_at: datetime 


class UserLoginModel(BaseModel):
    email: EmailStr = Field(max_length=40)
    password: str = Field(min_length=6)




class EmailModel(BaseModel):
    addresses : List[str]


class PasswordResetRequestModel(BaseModel):
    email: EmailStr


class PasswordResetConfirmModel(BaseModel):
    new_password: str
    confirm_new_password: str


class ChangePasswordModel(BaseModel):
    current_password: str = Field(min_length=6)
    new_password: str = Field(min_length=6)
    confirm_new_password: str = Field(min_length=6)


class UserUnlockRequest(BaseModel):
    email: EmailStr


class UserUnlockResponse(BaseModel):
    message: str
    email: EmailStr
    is_locked: bool
    unlocked_at: Optional[datetime]


class UserLockStatusRead(BaseModel):
    uid: uuid.UUID
    username: str | None = None
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    role_id: uuid.UUID | None = None
    is_verified: bool
    is_locked: bool
    locked_at: datetime | None = None
    locked_reason: str | None = None
    first_login_at: datetime | None = None
    unlocked_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True