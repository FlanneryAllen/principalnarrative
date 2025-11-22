"""
Authentication and Authorization for Principal Narrative API.
"""

from .models import User, TokenData, APIKey, Permission, Role
from .jwt_handler import create_access_token, verify_token, decode_token
from .dependencies import (
    get_current_user,
    get_current_active_user,
    require_permission,
    get_api_key,
    authenticate,
)
from .api_keys import APIKeyManager

__all__ = [
    "User",
    "TokenData",
    "APIKey",
    "Permission",
    "Role",
    "create_access_token",
    "verify_token",
    "decode_token",
    "get_current_user",
    "get_current_active_user",
    "require_permission",
    "get_api_key",
    "authenticate",
    "APIKeyManager",
]
