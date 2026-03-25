from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from datetime import time
from typing import ClassVar, Set,List

class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str
    # REDIS_HOST: str = "localhost"
    # REDIS_PORT: int =6379

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


     # Pool settings (config-driven with defaults)
    DB_POOL_SIZE: int = Field(default=2, ge=1)
    DB_MAX_OVERFLOW: int = Field(default=0, ge=0)
    DB_POOL_TIMEOUT: int = Field(default=30, ge=1)
    DB_POOL_RECYCLE: int = Field(default=1800, ge=0)
    # SSL toggles + certs (config-driven)
    DB_FORCE_SSL: bool = False
    DB_DISABLE_SSL: bool = False
    DB_SSL_CA_CERT: str | None = None          # PEM (multiline)
    DB_APP_NAME: str | None = None
    
    FRONTEND_URL:str
    BACKEND_URL:str
    ## Attendance vaiable
    MAX_WORKING_HOURS_PER_DAY:int
    GRACE_MINUTES:int
    TIME_ZONE:str

    ## Leave Request
    WEEKEND_DAYS:ClassVar[Set[str]] = set()
    
    ## Role base access control
    # MODULES_LIST: List[str] = Field(default_factory=lambda: DEFAULT_ROLE_MODULES.copy())
    MODULES_LIST: List[str] = []
    
    ##Employees Documents
    CLOUDINARY_CLOUD_NAME:str
    CLOUDINARY_API_KEY:str
    CLOUDINARY_API_SECRET:str
    ALLOWED_EXTENSIONS:str
    ALLOWED_MIME_TYPES:str
    MAX_FILE_SIZE:int

    ## SendGrid mail service.
    APIKEY: str
    FROM:str

    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


Config = Settings()
