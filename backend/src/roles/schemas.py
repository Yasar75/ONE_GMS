from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field, constr, field_validator, model_validator

from .constants import ACCESS_LEVELS, AVAILABLE_MODULES

RoleNameStr = constr(strip_whitespace=True, min_length=1, max_length=100)
DescriptionStr = constr(strip_whitespace=True, max_length=500)

ROLE_NAME_ALIASES = {
    "delivary": "Delivery",
}


def canonicalize_role_name(role_name: str) -> str:
    cleaned_name = " ".join(str(role_name or "").split()).strip()
    if not cleaned_name:
        return ""

    normalized_name = cleaned_name.lower()
    return ROLE_NAME_ALIASES.get(normalized_name, cleaned_name)


class RoleResponse(BaseModel):
    id: uuid.UUID = Field(..., description="Unique identifier for the role")
    role_name: str = Field(..., description="Name of the role")
    description: Optional[str] = Field(None, description="Description of the role")
    access: dict = Field(..., description="Permissions dictionary")

    model_config = {"from_attributes": False}


class RoleCreateModel(BaseModel):
    role_name: RoleNameStr = Field(..., description="Name of the role (must be unique)")
    access: dict = Field(..., description="Access dictionary")
    description: Optional[DescriptionStr] = Field(None, description="Description of the role")

    @field_validator("role_name")
    @classmethod
    def normalize_role_name(cls, v: str) -> str:
        role_name = canonicalize_role_name(v)
        if not role_name:
            raise ValueError("Role name cannot be empty")
        return role_name

    @field_validator("access")
    @classmethod
    def validate_access(cls, v: dict) -> dict:
        if not isinstance(v, dict):
            raise ValueError("Access must be a dictionary")

        for module, access_levels in v.items():
            if module not in AVAILABLE_MODULES:
                raise ValueError(
                    f"Invalid module '{module}'. Available modules: {AVAILABLE_MODULES}"
                )

            if not isinstance(access_levels, list):
                raise ValueError(f"Access levels for module '{module}' must be a list")

            if len(access_levels) != len(set(access_levels)):
                raise ValueError(f"Duplicate access levels found for module '{module}'")

            for level in access_levels:
                if level not in ACCESS_LEVELS:
                    raise ValueError(
                        f"Invalid access level '{level}' for module '{module}'. "
                        f"Valid levels: {ACCESS_LEVELS}"
                    )

        return v


class RoleUpdateModel(BaseModel):
    role_name: Optional[RoleNameStr] = Field(None, description="Name of the role")
    access: Optional[dict] = Field(None, description="Access dictionary")
    permissions: Optional[dict] = Field(
        None,
        description="Alias support for older clients sending permissions instead of access",
    )
    description: Optional[DescriptionStr] = Field(None, description="Description of the role")

    @model_validator(mode="before")
    @classmethod
    def normalize_access_permissions(cls, data: Any):
        if isinstance(data, dict):
            if data.get("access") is None and data.get("permissions") is not None:
                data["access"] = data["permissions"]
        return data

    @field_validator("access")
    @classmethod
    def validate_access(cls, v: Optional[dict]) -> Optional[dict]:
        if v is None:
            return v

        if not isinstance(v, dict):
            raise ValueError("Access must be a dictionary")

        for module, access_levels in v.items():
            if module not in AVAILABLE_MODULES:
                raise ValueError(
                    f"Invalid module '{module}'. Available modules: {AVAILABLE_MODULES}"
                )

            if not isinstance(access_levels, list):
                raise ValueError(f"Access levels for module '{module}' must be a list")

            if len(access_levels) != len(set(access_levels)):
                raise ValueError(f"Duplicate access levels found for module '{module}'")

            for level in access_levels:
                if level not in ACCESS_LEVELS:
                    raise ValueError(
                        f"Invalid access level '{level}' for module '{module}'. "
                        f"Valid levels: {ACCESS_LEVELS}"
                    )

        return v

    @field_validator("role_name")
    @classmethod
    def normalize_role_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        role_name = canonicalize_role_name(v)
        if not role_name:
            raise ValueError("Role name cannot be empty")
        return role_name
