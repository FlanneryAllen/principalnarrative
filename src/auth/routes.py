"""
Authentication API routes.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from .models import User, Permission, Role, ROLE_PERMISSIONS
from .jwt_handler import create_access_token, create_refresh_token, verify_token
from .api_keys import get_api_key_manager
from .dependencies import (
    get_current_user,
    get_current_active_user,
    require_permission,
    get_user_by_email,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


# ============================================================================
# Request/Response Models
# ============================================================================

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class APIKeyCreateRequest(BaseModel):
    name: str
    role: Optional[str] = "viewer"
    expires_days: Optional[int] = None


class APIKeyResponse(BaseModel):
    id: str
    name: str
    key: Optional[str] = None  # Only included on creation
    permissions: list[str]
    rate_limit: int
    created_at: str
    expires_at: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    permissions: list[str]
    is_active: bool


# ============================================================================
# Authentication Endpoints
# ============================================================================

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """
    Authenticate with email and password.

    In production, this would verify against a user database.
    For demo purposes, accepts any email with password "demo".
    """
    # Demo authentication - in production, verify against database
    if request.password != "demo":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user = get_user_by_email(request.email)
    if not user:
        # Create a demo user for any email
        user = User(
            id=f"user_{hash(request.email) % 10000}",
            email=request.email,
            name=request.email.split("@")[0],
            role=Role.VIEWER,
        )

    permissions = [p.value for p in user.permissions]
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        permissions=permissions,
    )
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=3600,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    """
    Get a new access token using a refresh token.
    """
    token_data = verify_token(request.refresh_token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Get user (in production, from database)
    from .dependencies import get_user_by_id
    user = get_user_by_id(token_data.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    permissions = [p.value for p in user.permissions]
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        permissions=permissions,
    )
    new_refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=3600,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """
    Get current user information.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role.value,
        permissions=[p.value for p in current_user.permissions],
        is_active=current_user.is_active,
    )


# ============================================================================
# API Key Management
# ============================================================================

@router.post("/keys", response_model=APIKeyResponse)
async def create_api_key(
    request: APIKeyCreateRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_KEYS)),
):
    """
    Create a new API key.

    Requires manage:keys permission.
    """
    manager = get_api_key_manager()

    # Validate role
    try:
        role = Role(request.role)
    except ValueError:
        role = Role.VIEWER

    # Calculate expiration
    expires_at = None
    if request.expires_days:
        expires_at = datetime.utcnow() + timedelta(days=request.expires_days)

    raw_key, api_key = manager.create_key(
        name=request.name,
        owner_id=current_user.id,
        role=role,
        expires_at=expires_at,
    )

    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key=raw_key,  # Only returned on creation
        permissions=[p.value for p in api_key.permissions],
        rate_limit=api_key.rate_limit,
        created_at=api_key.created_at.isoformat(),
        expires_at=api_key.expires_at.isoformat() if api_key.expires_at else None,
    )


@router.get("/keys", response_model=list[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_active_user),
):
    """
    List API keys owned by the current user.
    """
    manager = get_api_key_manager()
    keys = manager.list_keys(owner_id=current_user.id)

    return [
        APIKeyResponse(
            id=k.id,
            name=k.name,
            permissions=[p.value for p in k.permissions],
            rate_limit=k.rate_limit,
            created_at=k.created_at.isoformat(),
            expires_at=k.expires_at.isoformat() if k.expires_at else None,
        )
        for k in keys
    ]


@router.delete("/keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Revoke an API key.
    """
    manager = get_api_key_manager()
    api_key = manager.get_key(key_id)

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    # Only owner or admin can revoke
    if api_key.owner_id != current_user.id and not current_user.has_permission(Permission.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to revoke this key",
        )

    manager.revoke_key(key_id)

    return {"message": "API key revoked", "key_id": key_id}


# ============================================================================
# Permission Check Endpoints
# ============================================================================

@router.get("/check-permission/{permission}")
async def check_permission(
    permission: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Check if the current user has a specific permission.
    """
    try:
        perm = Permission(permission)
        has_perm = current_user.has_permission(perm)
    except ValueError:
        has_perm = False

    return {
        "permission": permission,
        "granted": has_perm,
        "user_role": current_user.role.value,
    }


@router.get("/permissions")
async def list_permissions():
    """
    List all available permissions.
    """
    return {
        "permissions": [p.value for p in Permission],
        "roles": {
            role.value: [p.value for p in perms]
            for role, perms in ROLE_PERMISSIONS.items()
        },
    }
