from typing import Any, Callable

from fastapi import FastAPI, status
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError


class ValidationError(Exception):
    """Validation errors with per-field details"""

    def __init__(self, errors: dict, message: str = "Validation failed"):
        self.errors = errors
        self.message = message
        super().__init__(message)





class InvalidToken(Exception):
    """User has provided an invalid or expired token"""

    pass


class AccessTokenRequired(Exception):
    """User has provided a refresh token when an access token is needed"""

    pass


class RefreshTokenRequired(Exception):
    """User has provided an access token when a refresh token is needed"""

    pass


class UserAlreadyExists(Exception):
    """User has provided an email for a user who exists during sign up."""

    pass




class InvalidCredentials(Exception):
    """User has provided wrong email or password during log in."""

    pass


class InsufficientPermission(Exception):
    """User does not have the neccessary permissions to perform an action."""

    pass





class InvalidEmail(Exception):
    """Invalid email address format"""

    pass


class UserNotFound(Exception):
    """User Not found"""

    pass

class EmployeeNotFound(Exception):
    """User Not found"""

    pass


class AccountNotVerified(Exception):
    """Account not yet verified"""

    pass



class RoleNotFound(Exception):
    """Role Not found"""

    pass


class RoleAlreadyExists(Exception):
    """Role with this name already exists"""

    pass


class RoleHasUsers(Exception):
    """Role cannot be deleted because it has associated users"""

    pass

class FileNotSupport(Exception):
    """Uploaded file is not supported"""
    pass

class NotRelatedError(Exception):
    """The provided IDs are not related as expected."""
    pass

class NotUniqueError(Exception):
    """Not Unique Error"""
    pass

class NotFoundError(Exception):
    """Not Found Error"""
    pass

class MissingColumnsError(Exception):
    """Not Found Error"""
    pass

class DeleteConflictError(Exception):
    """Not Found Error"""
    pass
 
def create_exception_handler(
    status_code: int, initial_detail: Any
) -> Callable[[Request, Exception], JSONResponse]:
    async def exception_handler(request: Request, exc: Exception):
        # Keep original structure exactly
        content = initial_detail.copy() if isinstance(initial_detail, dict) else initial_detail

        # If it's a dict response and exception has a message, override ONLY "message"
        if isinstance(content, dict):
            exc_msg = str(exc).strip()
            if exc_msg:
                content["message"] = exc_msg

        return JSONResponse(content=content, status_code=status_code)


    return exception_handler


def register_all_errors(app: FastAPI):
    app.add_exception_handler(
        FileNotSupport,
        create_exception_handler(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            initial_detail={
                "message": "The uploaded file type is not supported",
                "error_code": "file_not_supported",
                "resolution": "Please upload a supported file type (e.g., .xlsx, .xls)",
            },
        ),
    )

    app.add_exception_handler(
        NotRelatedError,
        create_exception_handler(
            status_code=status.HTTP_400_BAD_REQUEST,
            initial_detail={
                "message": "The provided IDs are not related as expected",
                "error_code": "ids_not_related",
                "resolution": "Please verify the relationships between the provided IDs and try again",
            },
        ),
    )

    app.add_exception_handler(
        NotFoundError,
        create_exception_handler(
            status_code=status.HTTP_400_BAD_REQUEST,
            initial_detail={
                "message": "ID not Found",
                "error_code": "id_not_found",
            },
        ),
    )


    app.add_exception_handler(
        MissingColumnsError,
        create_exception_handler(
            status_code=status.HTTP_400_BAD_REQUEST,
            initial_detail={
                "message": "Uploaded file is not following required format",
                "error_code": "missing_columns",
                "resolution": "Please use given template format to update data successfully",
            },
        )
    )

   

    app.add_exception_handler(
        DeleteConflictError,
        create_exception_handler(
            status_code=status.HTTP_409_CONFLICT,
            initial_detail={
                "message": "Resource cannot be deleted because it is referenced by other records",
                "error_code": "delete_conflict",
                "resolution": "Please remove all references to this record before attempting deletion",
            },
        ),
    )
    app.add_exception_handler(
        UserAlreadyExists,
        create_exception_handler(
            status_code=status.HTTP_403_FORBIDDEN,
            initial_detail={
                "message": "User with email already exists",
                "error_code": "user_exists",
            },
        ),
    )

   

    app.add_exception_handler(
        UserNotFound,
        create_exception_handler(
            status_code=status.HTTP_404_NOT_FOUND,
            initial_detail={
                "message": "User not found",
                "error_code": "user_not_found",
            },
        ),
    )

    app.add_exception_handler(
        EmployeeNotFound,
        create_exception_handler(
            status_code=status.HTTP_404_NOT_FOUND,
            initial_detail={
                "message": "Employee not found",
                "error_code": "employee_not_found",
            },
        ),
    )
    

    app.add_exception_handler(
        RoleNotFound,
        create_exception_handler(
            status_code=status.HTTP_404_NOT_FOUND,
            initial_detail={
                "message": "Role not found",
                "error_code": "role_not_found",
            },
        ),
    )

    app.add_exception_handler(
        RoleAlreadyExists,
        create_exception_handler(
            status_code=status.HTTP_409_CONFLICT,
            initial_detail={
                "message": "Role with this name already exists",
                "error_code": "role_already_exists",
            },
        ),
    )

    
    
    app.add_exception_handler(
        RoleHasUsers,
        create_exception_handler(
            status_code=status.HTTP_409_CONFLICT,
            initial_detail={
                "message": "Cannot delete role because it has associated users. Please reassign or delete all users first.",
                "error_code": "role_has_users",
            },
        ),
    )

    app.add_exception_handler(
        AccountNotVerified,
        create_exception_handler(
            status_code=status.HTTP_404_NOT_FOUND, initial_detail={"message": ""}
        ),
    )
    app.add_exception_handler(
        InvalidCredentials,
        create_exception_handler(
            status_code=status.HTTP_400_BAD_REQUEST,
            initial_detail={
                "message": "Invalid Email Or Password",
                "error_code": "invalid_email_or_password",
            },
        ),
    )
    app.add_exception_handler(
        InvalidToken,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message": "Token is invalid Or expired",
                "resolution": "Please get new token",
                "error_code": "invalid_token",
            },
        ),
    )

    app.add_exception_handler(
        AccessTokenRequired,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message": "Please provide a valid access token",
                "resolution": "Please get an access token",
                "error_code": "access_token_required",
            },
        ),
    )
    app.add_exception_handler(
        RefreshTokenRequired,
        create_exception_handler(
            status_code=status.HTTP_403_FORBIDDEN,
            initial_detail={
                "message": "Please provide a valid refresh token",
                "resolution": "Please get an refresh token",
                "error_code": "refresh_token_required",
            },
        ),
    )
    app.add_exception_handler(
        InsufficientPermission,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message": "You do not have enough permissions to perform this action",
                "error_code": "insufficient_permissions",
            },
        ),
    )

    app.add_exception_handler(
        AccountNotVerified,
        create_exception_handler(
            status_code=status.HTTP_403_FORBIDDEN,
            initial_detail={
                "message": "Account Not verified",
                "error_code": "account_not_verified",
                "resolution": "Please check your email for verification details",
            },
        ),
    )

    app.add_exception_handler(
        InvalidEmail,
        create_exception_handler(
            status_code=status.HTTP_400_BAD_REQUEST,
            initial_detail={
                "message": "Invalid email address format",
                "error_code": "invalid_email",
                "resolution": "Please provide a valid email address (e.g., user@example.com)",
            },
        ),
    )

    @app.exception_handler(500)
    async def internal_server_error(request, exc):
        return JSONResponse(
            content={
                "message": "Oops! Something went wrong",
                "error_code": "server_error",
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    @app.exception_handler(SQLAlchemyError)
    async def database__error(request, exc):
        print(str(exc))
        return JSONResponse(
            content={
                "message": "Oops! Something went wrong",
                "error_code": "server_error",
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    
    


    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "message": exc.message,
                "error_code": "validation_error",
                "errors": exc.errors,
            },
        )


    