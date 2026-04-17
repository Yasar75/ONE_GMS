import logging
from datetime import datetime
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import desc, select
from src.db.models import Employee, Role, User
from src.errors import RoleAlreadyExists, RoleHasUsers, RoleNotFound
from src.utils.validations import parse_uuid
from .constants import ADMIN_ROLE_NAME
from .schemas import RoleCreateModel, RoleUpdateModel, canonicalize_role_name

logger = logging.getLogger(__name__)


class RoleService:
    def _normalize_role_name_for_compare(self, role_name: str) -> str:
        return " ".join(str(role_name or "").split()).strip().lower()

    async def _get_role_by_normalized_name(
        self,
        session: AsyncSession,
        role_name: str,
        *,
        exclude_uid=None,
    ) -> Optional[Role]:
        normalized_role_name = self._normalize_role_name_for_compare(role_name)
        if not normalized_role_name:
            return None

        statement = select(Role).where(
            func.lower(func.trim(Role.role_name)) == normalized_role_name
        )
        if exclude_uid is not None:
            statement = statement.where(Role.uid != exclude_uid)

        result = await session.exec(statement)
        return result.first()

    async def _cleanup_delivery_role_typos(self, session: AsyncSession) -> None:
        normalized_delivery_names = {"delivery", "delivary"}
        statement = select(Role).where(
            func.lower(func.trim(Role.role_name)).in_(normalized_delivery_names)
        )
        result = await session.exec(statement)
        delivery_roles = result.all()

        if not delivery_roles:
            return

        def _delivery_sort_key(role: Role):
            normalized_role_name = self._normalize_role_name_for_compare(role.role_name)
            created_at = role.created_at or datetime.min
            updated_at = role.updated_at or datetime.min
            return (
                0 if normalized_role_name == "delivery" else 1,
                created_at,
                updated_at,
                str(role.uid),
            )

        ordered_roles = sorted(delivery_roles, key=_delivery_sort_key)
        canonical_role = ordered_roles[0]
        duplicate_roles = ordered_roles[1:]
        has_changes = False

        for duplicate_role in duplicate_roles:
            users_result = await session.exec(select(User).where(User.role_id == duplicate_role.uid))
            users_with_duplicate_role = users_result.all()
            for user in users_with_duplicate_role:
                user.role_id = canonical_role.uid
                session.add(user)
                has_changes = True

            employees_result = await session.exec(select(Employee).where(Employee.role_type == duplicate_role.uid))
            employees_with_duplicate_role = employees_result.all()
            for employee in employees_with_duplicate_role:
                employee.role_type = canonical_role.uid
                session.add(employee)
                has_changes = True

            await session.delete(duplicate_role)
            has_changes = True

        if canonical_role.role_name != "Delivery":
            canonical_role.role_name = "Delivery"
            session.add(canonical_role)
            has_changes = True

        if has_changes:
            await session.commit()

    def _transform_role_for_response(self, role: Role) -> dict:
        return {
            "id": role.uid,
            "role_name": role.role_name,
            "description": role.description,
            "access": role.permissions or {},
        }

    async def get_all_roles(self, session: AsyncSession) -> list[dict]:
        try:
            await self._cleanup_delivery_role_typos(session)
            statement = select(Role).order_by(desc(Role.created_at))
            result = await session.exec(statement)
            roles = result.all()
            return [self._transform_role_for_response(role) for role in roles]
        except SQLAlchemyError:
            logger.exception("Error fetching all roles")
            raise

    async def get_role_by_id(self, role_uid: str, session: AsyncSession) -> dict:
        uid = parse_uuid(role_uid, "role_uid")
        try:
            statement = select(Role).where(Role.uid == uid)
            result = await session.exec(statement)
            role = result.first()

            if not role:
                raise RoleNotFound()

            return self._transform_role_for_response(role)
        except SQLAlchemyError:
            logger.exception("Error fetching role %s", uid)
            raise

    async def create_role(self,role_data: RoleCreateModel,
        user_uid: str,
        session: AsyncSession,
    ) -> Optional[Role]:
        user_uid = parse_uuid(user_uid, "user_uid")

        try:
            await self._cleanup_delivery_role_typos(session)
            canonical_role_name = canonicalize_role_name(role_data.role_name)
            existing_role = await self._get_role_by_normalized_name(session, canonical_role_name)

            if existing_role:
                raise RoleAlreadyExists()

            role_data_dict = role_data.model_dump(exclude={"access"})
            role_data_dict["role_name"] = canonical_role_name
            role_data_dict["permissions"] = role_data.access.copy()

            new_role = Role(**role_data_dict)
            new_role.created_by = user_uid

            session.add(new_role)
            await session.flush()
            await session.commit()
            await session.refresh(new_role)
            return new_role

        except RoleAlreadyExists:
            await session.rollback()
            raise
        except IntegrityError:
            await session.rollback()
            logger.exception("Integrity error creating role")
            raise
        except SQLAlchemyError:
            await session.rollback()
            logger.exception("Database error creating role")
            raise

    async def update_role(
        self,
        role_uid: str,
        update_data: RoleUpdateModel,
        session: AsyncSession,
    ) -> Optional[Role]:
        uid = parse_uuid(role_uid, "role_uid")

        try:
            await self._cleanup_delivery_role_typos(session)
            statement = select(Role).where(Role.uid == uid)
            result = await session.exec(statement)
            role = result.first()

            if not role:
                raise RoleNotFound()

            if role.role_name == ADMIN_ROLE_NAME:
                raise HTTPException(
                    status_code=403,
                    detail="Admin role permissions cannot be modified",
                )

            update_data_dict = update_data.model_dump(
                exclude_unset=True,
                exclude={"access", "permissions"},
            )

            if "role_name" in update_data_dict:
                canonical_role_name = canonicalize_role_name(update_data_dict["role_name"])
                existing_role = await self._get_role_by_normalized_name(
                    session,
                    canonical_role_name,
                    exclude_uid=uid,
                )

                if existing_role:
                    raise RoleAlreadyExists()
                update_data_dict["role_name"] = canonical_role_name

            for key, value in update_data_dict.items():
                setattr(role, key, value)

            if update_data.access is not None:
                role.permissions = dict(update_data.access)
                flag_modified(role, "permissions")

            session.add(role)
            await session.commit()
            await session.refresh(role)
            return role

        except RoleAlreadyExists:
            await session.rollback()
            raise
        except IntegrityError:
            await session.rollback()
            logger.exception("Integrity error updating role %s", uid)
            raise
        except SQLAlchemyError:
            await session.rollback()
            logger.exception("Database error updating role %s", uid)
            raise
        except Exception:
            await session.rollback()
            logger.exception("Unexpected error updating role %s", uid)
            raise

    async def delete_role(self, role_uid: str, session: AsyncSession) -> bool:
        uid = parse_uuid(role_uid, "role_uid")

        try:
            statement = select(Role).where(Role.uid == uid)
            result = await session.exec(statement)
            role = result.first()

            if not role:
                raise RoleNotFound()

            users_statement = select(User).where(User.role_id == uid)
            users_result = await session.exec(users_statement)
            users_with_role = users_result.all()

            if users_with_role:
                raise RoleHasUsers(
                    f"Cannot delete role {role.role_name} because it has {len(users_with_role)} associated users"
                )

            await session.delete(role)
            await session.commit()
            return True

        except RoleHasUsers:
            await session.rollback()
            raise
        except IntegrityError:
            await session.rollback()
            logger.exception("Integrity error deleting role %s", uid)
            raise
        except SQLAlchemyError:
            await session.rollback()
            logger.exception("Database error deleting role %s", uid)
            raise
        except Exception:
            await session.rollback()
            logger.exception("Unexpected error deleting role %s", uid)
            raise
