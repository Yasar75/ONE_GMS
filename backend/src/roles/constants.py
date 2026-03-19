"""
Constants for Role-Based Access Control system.
Defines available modules and access levels.
"""

from ..config import Config

ACCESS_LEVELS = ["c", "r", "u", "d"]  # Create, Read, Update, Delete

DEFAULT_ROLE_MODULES = [
    "Roles",
    "Employee",
    "Employee Requests",
    "Employee Documents",
    "Employee Skills",
    "Shift Roster",
    "Assign Shift",
    "Employee Leave Balance",
    "Employee Metadata",
    "Holiday Calender",
    "Leave Request",
    "Leave Type",
    "Assign Leave",
    "Attendance",
    "Attendance Punch Log",
    "Attendance Regularization Logs",
    "Attendance Regularization",
]


# Available modules in the system
AVAILABLE_MODULES = list(dict.fromkeys((Config.MODULES_LIST or []) + DEFAULT_ROLE_MODULES))

# Admin role name (case-insensitive comparison)
ADMIN_ROLE_NAME = "Admin"

# Full access permissions for Admin role
ADMIN_PERMISSIONS = {module: ACCESS_LEVELS.copy() for module in AVAILABLE_MODULES}
