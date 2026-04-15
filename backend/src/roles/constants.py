"""
Constants for Role-Based Access Control system.
Defines available modules and access levels.
"""

from ..config import Config, DEFAULT_ROLE_MODULES

ACCESS_LEVELS = ["c", "r", "u", "d"]  # Create, Read, Update, Delete

# Available modules in the system
AVAILABLE_MODULES = Config.MODULES_LIST or DEFAULT_ROLE_MODULES.copy()

# Admin role name (case-insensitive comparison)
ADMIN_ROLE_NAME = "Admin"

# Full access permissions for Admin role
ADMIN_PERMISSIONS = {module: ACCESS_LEVELS.copy() for module in AVAILABLE_MODULES}
