"""
JWT token handling for Principal Narrative API.
"""
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

from .models import TokenData, Role


# Configuration - in production, load from environment/secrets
SECRET_KEY = os.getenv("PN_JWT_SECRET", "principal-narrative-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("PN_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("PN_REFRESH_TOKEN_DAYS", "7"))


def create_access_token(
    user_id: str,
    email: str,
    role: Role,
    permissions: list[str],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.

    Args:
        user_id: User's unique identifier
        email: User's email
        role: User's role
        permissions: List of permission strings
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    now = datetime.utcnow()

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": user_id,
        "email": email,
        "role": role.value if isinstance(role, Role) else role,
        "permissions": permissions,
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),  # Unique token ID
        "type": "access"
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """
    Create a refresh token for obtaining new access tokens.

    Args:
        user_id: User's unique identifier

    Returns:
        Encoded refresh token string
    """
    now = datetime.utcnow()
    expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "refresh"
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode a JWT token without verification (for inspection).

    Args:
        token: JWT token string

    Returns:
        Decoded payload dictionary
    """
    return jwt.decode(token, options={"verify_signature": False})


def verify_token(token: str) -> Optional[TokenData]:
    """
    Verify and decode a JWT token.

    Args:
        token: JWT token string

    Returns:
        TokenData if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Extract token data
        user_id = payload.get("sub")
        email = payload.get("email")
        role_str = payload.get("role")
        permissions = payload.get("permissions", [])
        exp = payload.get("exp")
        iat = payload.get("iat")
        jti = payload.get("jti")

        if not all([user_id, email, role_str]):
            return None

        return TokenData(
            user_id=user_id,
            email=email,
            role=Role(role_str),
            permissions=permissions,
            exp=datetime.fromtimestamp(exp),
            iat=datetime.fromtimestamp(iat),
            jti=jti
        )

    except ExpiredSignatureError:
        return None
    except InvalidTokenError:
        return None
    except Exception:
        return None


def is_token_expired(token: str) -> bool:
    """
    Check if a token is expired.

    Args:
        token: JWT token string

    Returns:
        True if expired, False otherwise
    """
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return False
    except ExpiredSignatureError:
        return True
    except Exception:
        return True


def get_token_expiry(token: str) -> Optional[datetime]:
    """
    Get the expiration time of a token.

    Args:
        token: JWT token string

    Returns:
        Expiration datetime or None
    """
    try:
        payload = decode_token(token)
        exp = payload.get("exp")
        if exp:
            return datetime.fromtimestamp(exp)
        return None
    except Exception:
        return None
