import tempfile
from functools import lru_cache
from pathlib import Path

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from src.config import Config

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_FOLDER = BASE_DIR / "templates"


def get_template_folder() -> Path:
    if TEMPLATE_FOLDER.exists():
        return TEMPLATE_FOLDER

    writable_template_folder = Path(tempfile.gettempdir()) / "one_gms_mail_templates"
    writable_template_folder.mkdir(parents=True, exist_ok=True)
    return writable_template_folder


@lru_cache(maxsize=1)
def get_mail_client() -> FastMail:
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
        TEMPLATE_FOLDER=get_template_folder(),
    )

    return FastMail(config=mail_config)


class LazyMail:
    async def send_message(self, *args, **kwargs):
        return await get_mail_client().send_message(*args, **kwargs)


mail = LazyMail()


def create_message(recipients: list[str], subject: str, body: str):
    message = MessageSchema(
        recipients=recipients, subject=subject, body=body, subtype=MessageType.html
    )

    return message
