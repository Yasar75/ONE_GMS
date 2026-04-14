import ast
import json

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from datetime import time
from typing import ClassVar, Set, List

DEFAULT_ROLE_MODULES = [
    "Roles",
    "Employee Metadata",
    "Employees Management",
    "User Status",
    "My Skills",
    "Employee Skills",
    "My Documents",
    "Employee Documents",
    "My Family Details",
    "Employee's Family Details",
    "My Work Experience",
    "Employee Work Experience",
    "Shift Roster",
    "Assign Shift",
    "My Shift",
    "Attendance Overview",
    "My Attendance Preview",
    "Manage Regularization",
    "Holiday Calendar",
    "Leave type",
    "Assign Leave",
    "My Leave Balance",
    "Leave Request",
    "Manage Leave",
    "Project",
    "Project Assignment", 
    "Project Task",
]

class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str

    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int
    MAIL_SERVER: str
    MAIL_FROM_NAME: str
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True
    DOMAIN: str

    DB_POOL_SIZE: int = Field(default=2, ge=1)
    DB_MAX_OVERFLOW: int = Field(default=0, ge=0)
    DB_POOL_TIMEOUT: int = Field(default=30, ge=1)
    DB_POOL_RECYCLE: int = Field(default=1800, ge=0)
    DB_FORCE_SSL: bool = True
    DB_DISABLE_SSL: bool = False
    DB_SSL_CA_CERT: str | None = None
    DB_APP_NAME: str | None = None

    FRONTEND_URL: str
    BACKEND_URL: str

    ## Attendance
    MAX_WORKING_HOURS_PER_DAY: int
    GRACE_MINUTES: int
    TIME_ZONE: str
    WORKING_DAYS_PER_WEEK: int = Field(default=5, ge=5, le=6)

    ## Role base access control
    MODULES_LIST: List[str] = Field(default_factory=lambda: DEFAULT_ROLE_MODULES.copy())

    ## Employees Documents
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str
    ALLOWED_EXTENSIONS: str
    ALLOWED_MIME_TYPES: str
    MAX_FILE_SIZE: int

    ## SendGrid mail service.
    APIKEY: str
    FROM: str

    @property
    def WEEKEND_DAYS(self) -> Set[int]:
        # Python weekday(): Monday=0 ... Sunday=6
        return {5, 6} if self.WORKING_DAYS_PER_WEEK == 5 else {6}

    @field_validator("MODULES_LIST", mode="before")
    @classmethod
    def parse_modules_list(cls, value):
        if value is None:
            return DEFAULT_ROLE_MODULES.copy()

        if isinstance(value, list):
            normalized = [str(item).strip() for item in value if str(item).strip()]
            return normalized or DEFAULT_ROLE_MODULES.copy()

        if isinstance(value, str):
            raw_value = value.strip()
            if not raw_value:
                return DEFAULT_ROLE_MODULES.copy()

            if raw_value[0] == raw_value[-1] and raw_value[0] in {"'", '"'}:
                raw_value = raw_value[1:-1].strip()

            for parser in (json.loads, ast.literal_eval):
                try:
                    parsed = parser(raw_value)
                except (ValueError, SyntaxError, TypeError, json.JSONDecodeError):
                    continue

                if isinstance(parsed, list):
                    normalized = [str(item).strip() for item in parsed if str(item).strip()]
                    return normalized or DEFAULT_ROLE_MODULES.copy()

            normalized = [segment.strip().strip("'\"") for segment in raw_value.split(",") if segment.strip()]
            return normalized or DEFAULT_ROLE_MODULES.copy()

        return DEFAULT_ROLE_MODULES.copy()

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


Config = Settings()