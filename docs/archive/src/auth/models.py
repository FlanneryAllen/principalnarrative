"""
Authentication data models.
"""
from dataclasses import dataclass, field
from typing import Optional, List, Set
from datetime import datetime
from enum import Enum


class Permission(str, Enum):
    """Available permissions in the system."""
    # Read permissions
    READ_CONTEXT = "read:context"
    READ_COHERENCE = "read:coherence"
    READ_PROOF = "read:proof"
    READ_AGENTS = "read:agents"

    # Write permissions
    WRITE_CONTEXT = "write:context"
    WRITE_COHERENCE = "write:coherence"
    WRITE_PROOF = "write:proof"

    # Admin permissions
    MANAGE_AGENTS = "manage:agents"
    MANAGE_USERS = "manage:users"
    MANAGE_KEYS = "manage:keys"
    RUN_SYNTHESIS = "run:synthesis"
    RUN_INGESTION = "run:ingestion"
    GIT_OPERATIONS = "git:operations"

    # Full access
    ADMIN = "admin"


class Role(str, Enum):
    """Predefined roles with permission sets."""
    VIEWER = "viewer"
    AGENT = "agent"
    EDITOR = "editor"
    ADMIN = "admin"


# Role to permissions mapping
ROLE_PERMISSIONS: dict[Role, Set[Permission]] = {
    Role.VIEWER: {
        Permission.READ_CONTEXT,
        Permission.READ_COHERENCE,
        Permission.READ_PROOF,
        Permission.READ_AGENTS,
    },
    Role.AGENT: {
        Permission.READ_CONTEXT,
        Permission.READ_COHERENCE,
        Permission.READ_PROOF,
        Permission.READ_AGENTS,
        Permission.WRITE_CONTEXT,
        Permission.RUN_SYNTHESIS,
    },
    Role.EDITOR: {
        Permission.READ_CONTEXT,
        Permission.READ_COHERENCE,
        Permission.READ_PROOF,
        Permission.READ_AGENTS,
        Permission.WRITE_CONTEXT,
        Permission.WRITE_COHERENCE,
        Permission.WRITE_PROOF,
        Permission.RUN_SYNTHESIS,
        Permission.RUN_INGESTION,
        Permission.GIT_OPERATIONS,
    },
    Role.ADMIN: {p for p in Permission},  # All permissions
}


@dataclass
class User:
    """A user in the system."""
    id: str
    email: str
    name: str
    role: Role
    permissions: Set[Permission] = field(default_factory=set)
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

    def __post_init__(self):
        """Initialize permissions from role if not explicitly set."""
        if not self.permissions:
            self.permissions = ROLE_PERMISSIONS.get(self.role, set())

    def has_permission(self, permission: Permission) -> bool:
        """Check if user has a specific permission."""
        if Permission.ADMIN in self.permissions:
            return True
        return permission in self.permissions

    def has_any_permission(self, permissions: List[Permission]) -> bool:
        """Check if user has any of the specified permissions."""
        return any(self.has_permission(p) for p in permissions)

    def has_all_permissions(self, permissions: List[Permission]) -> bool:
        """Check if user has all specified permissions."""
        return all(self.has_permission(p) for p in permissions)


@dataclass
class TokenData:
    """Data extracted from a JWT token."""
    user_id: str
    email: str
    role: Role
    permissions: List[str]
    exp: datetime
    iat: datetime
    jti: Optional[str] = None  # Token ID for revocation


@dataclass
class APIKey:
    """An API key for programmatic access."""
    id: str
    key_hash: str  # Hashed key, never store plaintext
    name: str
    owner_id: str
    permissions: Set[Permission]
    rate_limit: int = 1000  # Requests per hour
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_used: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    def is_expired(self) -> bool:
        """Check if the API key has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def has_permission(self, permission: Permission) -> bool:
        """Check if API key has a specific permission."""
        return permission in self.permissions


@dataclass
class AuthResult:
    """Result of an authentication attempt."""
    success: bool
    user: Optional[User] = None
    api_key: Optional[APIKey] = None
    error: Optional[str] = None
    method: str = "unknown"  # "jwt", "api_key", "none"
