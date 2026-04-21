import asyncio
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from src.attendance_management.attendance.service import attendance_service
from src.config import Config
from src.db.main import get_async_engine

IST = ZoneInfo(Config.TIME_ZONE)


def _seconds_until_next_run(hour: int = 0, minute: int = 5) -> float:
    now = datetime.now(IST)
    next_run = datetime.combine(now.date(), time(hour, minute), tzinfo=IST)
    if now >= next_run:
        next_run = next_run + timedelta(days=1)
    return max((next_run - now).total_seconds(), 1.0)


async def _run_sync_for_today() -> None:
    SessionLocal = sessionmaker(bind=get_async_engine(), class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as session:
        await attendance_service.sync_daily_attendance(
            session=session,
            target_date=datetime.now(IST).date(),
        )


async def attendance_scheduler_loop() -> None:
    while True:
        await asyncio.sleep(_seconds_until_next_run())
        try:
            await _run_sync_for_today()
        except Exception as exc:
            print(f"Attendance scheduler failed: {exc}")
