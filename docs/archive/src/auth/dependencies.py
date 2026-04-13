"""
FastAPI dependencies for authentication.
"""
from typing import Optional, List, Callable
from functools import wraps

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader

from .models import User, Permission, Role, AuthResult, ROLE_PERMISSIONS
from .jwt_handler import verify_token
from .api_keys import get_api_key_manager


# Security schemes
bearer_scheme = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


# In-memory user store (in production, use a database)
_users = {
    "system": User(
        id="system",
        email="system@principalnarrative.ai",
        name="System",
        role=Role.ADMIN,
    ),
    "demo": User(
        id="demo",
        email="demo@example.com",
        name="Demo User",
        role=Role.EDITOR,
    ),
}


def get_user_by_id(user_id: str) -> Optional[User]:
    """Get a user by their ID."""
    return _users.get(user_id)


def get_user_by_email(email: str) -> Optional[User]:
    """Get a user by their email."""
    for user in _users.values():
        if user.email == email:
            return user
    return None


async def authenticate(
    request: Request,
    bearer_token: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    api_key: Optional[str] = Depends(api_key_header),
) -> AuthResult:
    """
    Authenticate request using either JWT token or API key.

    This is a flexible authentication dependency that supports:
    - Bearer JWT tokens
    - X-API-Key header
    - No authentication (returns unsuccessful result)
    """
    # Try Bearer token first
    if bearer_token:
        token_data = verify_token(bearer_token.credentials)
        if token_data:
            user = get_user_by_id(token_data.user_id)
            if user and user.is_active:
                return AuthResult(
                    success=True,
                    user=user,
                    method="jwt"
                )
        return AuthResult(
            success=False,
            error="Invalid or expired token",
            method="jwt"
        )

    # Try API key
    if api_key:
        manager = get_api_key_manager()
        key = manager.verify_key(api_key)
        if key:
            return AuthResult(
                success=True,
                api_key=key,
                method="api_key"
            )
        return AuthResult(
            success=False,
            error="Invalid or expired API key",
            method="api_key"
        )

    # No authentication provided
    return AuthResult(
        success=False,
        error="No authentication provided",
        method="none"
    )


async def get_current_user(
    auth_result: AuthResult = Depends(authenticate),
) -> User:
    """
    Get the current authenticated user.

    Raises HTTPException if not authenticated.
    """
    if not auth_result.success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_result.error or "Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if auth_result.user:
        return auth_result.user

    # For API key auth, create a synthetic user
    if auth_result.api_key:
        return User(
            id=f"apikey:{auth_result.api_key.id}",
            email=f"{auth_result.api_key.name}@api.local",
            name=auth_result.api_key.name,
            role=Role.AGENT,
            permissions=auth_result.api_key.permissions,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication failed",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get the current user, ensuring they are active.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )
    return current_user


async def get_api_key(
    auth_result: AuthResult = Depends(authenticate),
):
    """
    Get the API key if authentication was via API key.
    """
    if auth_result.api_key:
        return auth_result.api_key
    return None


def require_permission(*permissions: Permission):
    """
    Dependency factory that requires specific permissions.

    Usage:
        @app.get("/admin", dependencies=[Depends(require_permission(Permission.ADMIN))])
        def admin_only():
            pass
    """
    async def check_permissions(
        current_user: User = Depends(get_current_active_user),
    ):
        for permission in permissions:
            if not current_user.has_permission(permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing required permission: {permission.value}",
                )
        return current_user

    return check_permissions


def require_any_permission(*permissions: Permission):
    """
    Dependency factory that requires at least one of the specified permissions.
    """
    async def check_permissions(
        current_user: User = Depends(get_current_active_user),
    ):
        if not current_user.has_any_permission(list(permissions)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {[p.value for p in permissions]}",
            )
        return current_user

    return check_permissions


def require_role(*roles: Role):
    """
    Dependency factory that requires specific roles.
    """
    async def check_role(
        current_user: User = Depends(get_current_active_user),
    ):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {[r.value for r in roles]}",
            )
        return current_user

    return check_role


class OptionalAuth:
    """
    Optional authentication that doesn't raise errors.

    Useful for endpoints that behave differently for authenticated vs anonymous users.
    """

    def __init__(self, auth_result: AuthResult = Depends(authenticate)):
        self.auth_result = auth_result
        self.is_authenticated = auth_result.success
        self.user = auth_result.user
        self.api_key = auth_result.api_key

    def has_permission(self, permission: Permission) -> bool:
        """Check if authenticated user/key has permission."""
        if not self.is_authenticated:
            return False
        if self.user:
            return self.user.has_permission(permission)
        if self.api_key:
            return self.api_key.has_permission(permission)
        return False
