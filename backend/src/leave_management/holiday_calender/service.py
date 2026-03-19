from datetime import date
import uuid

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models.leave_management import HolidayCalendar
from .schema import HolidayCalendarCreate, HolidayCalendarUpdate


class HolidayCalendarService:
    async def create_holiday(self, session: AsyncSession, data: HolidayCalendarCreate, user_uid: uuid.UUID):
        stmt = select(HolidayCalendar).where(HolidayCalendar.holiday_date == data.holiday_date)
        existing = (await session.exec(stmt)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Holiday already exists for this date.")

        holiday = HolidayCalendar(
            holiday_date=data.holiday_date,
            name=data.name,
            description=data.description,
            is_active=data.is_active,
            user_uid=user_uid,
        )
        session.add(holiday)
        await session.commit()
        await session.refresh(holiday)
        return holiday

    async def list_holidays(self, session: AsyncSession, year: int):
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)

        stmt = (
            select(HolidayCalendar)
            .where(HolidayCalendar.holiday_date >= start_date, HolidayCalendar.holiday_date <= end_date)
            .order_by(HolidayCalendar.holiday_date.asc())
        )
        result = await session.exec(stmt)
        return result.all()

    async def get_holiday(self, session: AsyncSession, holiday_uid: uuid.UUID):
        stmt = select(HolidayCalendar).where(HolidayCalendar.uid == holiday_uid)
        holiday = (await session.exec(stmt)).first()
        if not holiday:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holiday not found.")
        return holiday

    async def update_holiday(self, session: AsyncSession, holiday_uid: uuid.UUID, data: HolidayCalendarUpdate):
        holiday = await self.get_holiday(session, holiday_uid)

        if data.holiday_date is not None and data.holiday_date != holiday.holiday_date:
            existing = (await session.exec(
                select(HolidayCalendar).where(
                    HolidayCalendar.holiday_date == data.holiday_date,
                    HolidayCalendar.uid != holiday_uid,
                )
            )).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Holiday already exists for this date.")
            holiday.holiday_date = data.holiday_date

        if data.name is not None:
            holiday.name = data.name
        if data.description is not None:
            holiday.description = data.description
        if data.is_active is not None:
            holiday.is_active = data.is_active

        await session.commit()
        await session.refresh(holiday)
        return holiday

    async def delete_holiday(self, session: AsyncSession, holiday_uid: uuid.UUID):
        holiday = await self.get_holiday(session, holiday_uid)
        await session.delete(holiday)
        await session.commit()
        return {"message": "Holiday deleted successfully."}


holiday_calendar_service = HolidayCalendarService()
