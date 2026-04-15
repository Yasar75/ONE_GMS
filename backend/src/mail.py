import tempfile
from pathlib import Path

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from src.config import Config

# 1. Define the base directory
BASE_DIR = Path(__file__).resolve().parent

# 2. Prefer the bundled templates folder. If it is missing, fall back
# to a writable temp directory because Vercel deploys /var/task read-only.
TEMPLATE_FOLDER = BASE_DIR / "templates"
if not TEMPLATE_FOLDER.exists():
    TEMPLATE_FOLDER = Path(tempfile.gettempdir()) / "one_gms_mail_templates"
    TEMPLATE_FOLDER.mkdir(parents=True, exist_ok=True)

# 4. Configure FastMail with proper settings
mail_config = ConnectionConfig(
    MAIL_USERNAME=Config.MAIL_USERNAME,
    MAIL_PASSWORD=Config.MAIL_PASSWORD,
    MAIL_FROM=Config.MAIL_FROM,
    MAIL_PORT=Config.MAIL_PORT,
    MAIL_SERVER=Config.MAIL_SERVER,
    MAIL_FROM_NAME=Config.MAIL_FROM_NAME,
    MAIL_STARTTLS=Config.MAIL_STARTTLS,
    MAIL_SSL_TLS=Config.MAIL_SSL_TLS,
    USE_CREDENTIALS=Config.USE_CREDENTIALS,
    VALIDATE_CERTS=Config.VALIDATE_CERTS,
    TEMPLATE_FOLDER=TEMPLATE_FOLDER,
)


mail = FastMail(config=mail_config)


def create_message(recipients: list[str], subject: str, body: str):
    message = MessageSchema(
        recipients=recipients, subject=subject, body=body, subtype=MessageType.html
    )

    return message
