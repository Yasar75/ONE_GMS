import uuid

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models.employee_metadata import EmployeeMetadata, MetadataCategory
from .schema import EmployeeMetadataCreate, EmployeeMetadataUpdate


class EmployeeMetadataService:
    async def _get_existing_by_label(self, session: AsyncSession, category: MetadataCategory, label: str, exclude_uid: uuid.UUID | None = None):
        stmt = select(EmployeeMetadata).where(
            EmployeeMetadata.category == category,
            EmployeeMetadata.label == label,
        )
        if exclude_uid:
            stmt = stmt.where(EmployeeMetadata.uid != exclude_uid)
        return (await session.exec(stmt)).first()

    async def create_entry(self, session: AsyncSession, data: EmployeeMetadataCreate, created_by: uuid.UUID | None):
        if await self._get_existing_by_label(session, data.category, data.label):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Metadata entry already exists for this category.")

        payload = data.model_dump()
        payload["value"] = payload["label"]
        entry = EmployeeMetadata(**payload, created_by=created_by)
        session.add(entry)
        await session.commit()
        await session.refresh(entry)
        return entry

    async def list_entries(self, session: AsyncSession, category: MetadataCategory | None = None, active_only: bool = False):
        stmt = select(EmployeeMetadata)
        if category:
            stmt = stmt.where(EmployeeMetadata.category == category)
        if active_only:
            stmt = stmt.where(EmployeeMetadata.is_active == True)  # noqa: E712
        stmt = stmt.order_by(EmployeeMetadata.category.asc(), EmployeeMetadata.sort_order.asc(), EmployeeMetadata.label.asc())
        return (await session.exec(stmt)).all()

    async def get_entry(self, session: AsyncSession, metadata_uid: uuid.UUID):
        entry = (await session.exec(select(EmployeeMetadata).where(EmployeeMetadata.uid == metadata_uid))).first()
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Metadata entry not found.")
        return entry

    async def update_entry(self, session: AsyncSession, metadata_uid: uuid.UUID, data: EmployeeMetadataUpdate):
        entry = await self.get_entry(session, metadata_uid)
        payload = data.model_dump(exclude_unset=True)

        next_label = payload.get("label")
        if next_label and await self._get_existing_by_label(session, entry.category, next_label, exclude_uid=entry.uid):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Metadata entry already exists for this category.")

        if next_label:
            payload["value"] = next_label

        for key, value in payload.items():
            setattr(entry, key, value)

        session.add(entry)
        await session.commit()
        await session.refresh(entry)
        return entry

    async def delete_entry(self, session: AsyncSession, metadata_uid: uuid.UUID):
        entry = await self.get_entry(session, metadata_uid)
        await session.delete(entry)
        await session.commit()
        return True


employee_metadata_service = EmployeeMetadataService()
