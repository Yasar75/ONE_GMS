import logging
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import desc, select
from src.db.models import Role, User
from src.errors import RoleAlreadyExists, RoleHasUsers, RoleNotFound
from src.utils.validations import parse_uuid
from .constants import ADMIN_ROLE_NAME
from .schemas import RoleCreateModel, RoleUpdateModel

logger = logging.getLogger(__name__)


class RoleService:
    def _transform_role_for_response(self, role: Role) -> dict:
        return {
            "id": role.uid,
            "role_name": role.role_name,
            "description": role.description,
            "access": role.permissions or {},
        }

    async def get_all_roles(self, session: AsyncSession) -> list[dict]:
        try:
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
            role_statement = select(Role).where(Role.role_name == role_data.role_name)
            role_result = await session.exec(role_statement)
            existing_role = role_result.first()

            if existing_role:
                raise RoleAlreadyExists()

            role_data_dict = role_data.model_dump(exclude={"access"})
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
                role_statement = select(Role).where(
                    Role.role_name == update_data_dict["role_name"],
                    Role.uid != uid,
                )
                role_result = await session.exec(role_statement)
                existing_role = role_result.first()

                if existing_role:
                    raise RoleAlreadyExists()

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