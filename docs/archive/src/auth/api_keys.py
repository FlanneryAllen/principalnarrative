"""
API Key management for Principal Narrative API.
"""
import os
import secrets
import hashlib
from datetime import datetime
from typing import Optional, Dict, Set
from pathlib import Path
import json

from .models import APIKey, Permission, Role, ROLE_PERMISSIONS


class APIKeyManager:
    """
    Manages API keys for programmatic access.

    In production, this should use a proper database.
    For now, uses a JSON file for persistence.
    """

    def __init__(self, storage_path: Optional[Path] = None):
        """
        Initialize the API key manager.

        Args:
            storage_path: Path to store API keys (JSON file)
        """
        self.storage_path = storage_path or Path(".principalnarrative/api_keys.json")
        self._keys: Dict[str, APIKey] = {}
        self._key_lookup: Dict[str, str] = {}  # hash -> key_id
        self._load_keys()

    def _hash_key(self, key: str) -> str:
        """Hash an API key for secure storage."""
        return hashlib.sha256(key.encode()).hexdigest()

    def _load_keys(self):
        """Load API keys from storage."""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r") as f:
                    data = json.load(f)

                for key_data in data.get("keys", []):
                    api_key = APIKey(
                        id=key_data["id"],
                        key_hash=key_data["key_hash"],
                        name=key_data["name"],
                        owner_id=key_data["owner_id"],
                        permissions={Permission(p) for p in key_data["permissions"]},
                        rate_limit=key_data.get("rate_limit", 1000),
                        is_active=key_data.get("is_active", True),
                        created_at=datetime.fromisoformat(key_data["created_at"]),
                        last_used=datetime.fromisoformat(key_data["last_used"]) if key_data.get("last_used") else None,
                        expires_at=datetime.fromisoformat(key_data["expires_at"]) if key_data.get("expires_at") else None,
                    )
                    self._keys[api_key.id] = api_key
                    self._key_lookup[api_key.key_hash] = api_key.id
            except Exception:
                pass

    def _save_keys(self):
        """Save API keys to storage."""
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "keys": [
                {
                    "id": k.id,
                    "key_hash": k.key_hash,
                    "name": k.name,
                    "owner_id": k.owner_id,
                    "permissions": [p.value for p in k.permissions],
                    "rate_limit": k.rate_limit,
                    "is_active": k.is_active,
                    "created_at": k.created_at.isoformat(),
                    "last_used": k.last_used.isoformat() if k.last_used else None,
                    "expires_at": k.expires_at.isoformat() if k.expires_at else None,
                }
                for k in self._keys.values()
            ]
        }

        with open(self.storage_path, "w") as f:
            json.dump(data, f, indent=2)

    def create_key(
        self,
        name: str,
        owner_id: str,
        role: Optional[Role] = None,
        permissions: Optional[Set[Permission]] = None,
        rate_limit: int = 1000,
        expires_at: Optional[datetime] = None
    ) -> tuple[str, APIKey]:
        """
        Create a new API key.

        Args:
            name: Human-readable name for the key
            owner_id: ID of the user who owns this key
            role: Role to derive permissions from (if permissions not specified)
            permissions: Explicit permissions (overrides role)
            rate_limit: Requests per hour
            expires_at: Optional expiration time

        Returns:
            Tuple of (raw_key, APIKey object)
            The raw key is only returned once and should be shown to the user
        """
        # Generate secure random key
        raw_key = f"pn_{secrets.token_urlsafe(32)}"
        key_hash = self._hash_key(raw_key)
        key_id = f"key_{secrets.token_hex(8)}"

        # Determine permissions
        if permissions:
            key_permissions = permissions
        elif role:
            key_permissions = ROLE_PERMISSIONS.get(role, set())
        else:
            key_permissions = ROLE_PERMISSIONS[Role.VIEWER]

        api_key = APIKey(
            id=key_id,
            key_hash=key_hash,
            name=name,
            owner_id=owner_id,
            permissions=key_permissions,
            rate_limit=rate_limit,
            expires_at=expires_at,
        )

        self._keys[key_id] = api_key
        self._key_lookup[key_hash] = key_id
        self._save_keys()

        return raw_key, api_key

    def verify_key(self, raw_key: str) -> Optional[APIKey]:
        """
        Verify an API key and return its data.

        Args:
            raw_key: The raw API key string

        Returns:
            APIKey if valid, None otherwise
        """
        key_hash = self._hash_key(raw_key)
        key_id = self._key_lookup.get(key_hash)

        if not key_id:
            return None

        api_key = self._keys.get(key_id)

        if not api_key:
            return None

        if not api_key.is_active:
            return None

        if api_key.is_expired():
            return None

        # Update last used time
        api_key.last_used = datetime.utcnow()
        self._save_keys()

        return api_key

    def revoke_key(self, key_id: str) -> bool:
        """
        Revoke an API key.

        Args:
            key_id: ID of the key to revoke

        Returns:
            True if revoked, False if not found
        """
        api_key = self._keys.get(key_id)

        if not api_key:
            return False

        api_key.is_active = False
        self._save_keys()

        return True

    def delete_key(self, key_id: str) -> bool:
        """
        Permanently delete an API key.

        Args:
            key_id: ID of the key to delete

        Returns:
            True if deleted, False if not found
        """
        api_key = self._keys.get(key_id)

        if not api_key:
            return False

        del self._key_lookup[api_key.key_hash]
        del self._keys[key_id]
        self._save_keys()

        return True

    def list_keys(self, owner_id: Optional[str] = None) -> list[APIKey]:
        """
        List all API keys, optionally filtered by owner.

        Args:
            owner_id: Optional owner ID to filter by

        Returns:
            List of API keys (without hash for security)
        """
        keys = list(self._keys.values())

        if owner_id:
            keys = [k for k in keys if k.owner_id == owner_id]

        return keys

    def get_key(self, key_id: str) -> Optional[APIKey]:
        """
        Get an API key by ID.

        Args:
            key_id: ID of the key

        Returns:
            APIKey if found, None otherwise
        """
        return self._keys.get(key_id)


# Global instance
_api_key_manager: Optional[APIKeyManager] = None


def get_api_key_manager() -> APIKeyManager:
    """Get the global API key manager instance."""
    global _api_key_manager
    if _api_key_manager is None:
        _api_key_manager = APIKeyManager()
    return _api_key_manager
