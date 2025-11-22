"""
Tests for authentication and authorization.
"""
import pytest
from datetime import datetime, timedelta


class TestJWTHandler:
    """Tests for JWT token handling."""

    def test_create_access_token(self):
        """Test creating an access token."""
        from src.auth.jwt_handler import create_access_token
        from src.auth.models import Role

        token = create_access_token(
            user_id="test_user",
            email="test@example.com",
            role=Role.VIEWER,
            permissions=["read:context"]
        )

        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_verify_token(self):
        """Test verifying a valid token."""
        from src.auth.jwt_handler import create_access_token, verify_token
        from src.auth.models import Role

        token = create_access_token(
            user_id="test_user",
            email="test@example.com",
            role=Role.VIEWER,
            permissions=["read:context"]
        )

        token_data = verify_token(token)

        assert token_data is not None
        assert token_data.user_id == "test_user"
        assert token_data.email == "test@example.com"
        assert token_data.role == Role.VIEWER

    def test_verify_invalid_token(self):
        """Test verifying an invalid token."""
        from src.auth.jwt_handler import verify_token

        result = verify_token("invalid.token.here")

        assert result is None

    def test_token_expiration(self):
        """Test that expired tokens are rejected."""
        from src.auth.jwt_handler import create_access_token, verify_token
        from src.auth.models import Role

        # Create token with negative expiration (already expired)
        token = create_access_token(
            user_id="test_user",
            email="test@example.com",
            role=Role.VIEWER,
            permissions=[],
            expires_delta=timedelta(seconds=-1)
        )

        # Should return None for expired token
        result = verify_token(token)
        assert result is None


class TestAPIKeyManager:
    """Tests for API key management."""

    def test_create_api_key(self, tmp_path):
        """Test creating an API key."""
        from src.auth.api_keys import APIKeyManager
        from src.auth.models import Role

        manager = APIKeyManager(storage_path=tmp_path / "api_keys.json")

        raw_key, api_key = manager.create_key(
            name="Test Key",
            owner_id="test_user",
            role=Role.VIEWER
        )

        assert raw_key is not None
        assert raw_key.startswith("pn_")
        assert api_key.name == "Test Key"
        assert api_key.owner_id == "test_user"

    def test_verify_api_key(self, tmp_path):
        """Test verifying an API key."""
        from src.auth.api_keys import APIKeyManager
        from src.auth.models import Role

        manager = APIKeyManager(storage_path=tmp_path / "api_keys.json")

        raw_key, _ = manager.create_key(
            name="Test Key",
            owner_id="test_user",
            role=Role.VIEWER
        )

        verified = manager.verify_key(raw_key)

        assert verified is not None
        assert verified.name == "Test Key"

    def test_revoke_api_key(self, tmp_path):
        """Test revoking an API key."""
        from src.auth.api_keys import APIKeyManager
        from src.auth.models import Role

        manager = APIKeyManager(storage_path=tmp_path / "api_keys.json")

        raw_key, api_key = manager.create_key(
            name="Test Key",
            owner_id="test_user",
            role=Role.VIEWER
        )

        # Revoke the key
        result = manager.revoke_key(api_key.id)
        assert result is True

        # Verify revoked key doesn't work
        verified = manager.verify_key(raw_key)
        assert verified is None


class TestPermissions:
    """Tests for permission checking."""

    def test_user_has_permission(self):
        """Test checking user permissions."""
        from src.auth.models import User, Role, Permission

        user = User(
            id="test_user",
            email="test@example.com",
            name="Test User",
            role=Role.EDITOR
        )

        assert user.has_permission(Permission.READ_CONTEXT) is True
        assert user.has_permission(Permission.WRITE_CONTEXT) is True

    def test_admin_has_all_permissions(self):
        """Test that admin role has all permissions."""
        from src.auth.models import User, Role, Permission

        admin = User(
            id="admin_user",
            email="admin@example.com",
            name="Admin User",
            role=Role.ADMIN
        )

        assert admin.has_permission(Permission.ADMIN) is True
        assert admin.has_permission(Permission.MANAGE_USERS) is True
        assert admin.has_permission(Permission.READ_CONTEXT) is True

    def test_viewer_limited_permissions(self):
        """Test that viewer has limited permissions."""
        from src.auth.models import User, Role, Permission

        viewer = User(
            id="viewer_user",
            email="viewer@example.com",
            name="Viewer User",
            role=Role.VIEWER
        )

        assert viewer.has_permission(Permission.READ_CONTEXT) is True
        assert viewer.has_permission(Permission.WRITE_CONTEXT) is False
        assert viewer.has_permission(Permission.ADMIN) is False


class TestAuthEndpoints:
    """Tests for authentication API endpoints."""

    def test_login_endpoint(self, api_client):
        """Test login endpoint."""
        response = api_client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "demo"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_invalid_password(self, api_client):
        """Test login with invalid password."""
        response = api_client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "wrong"}
        )

        assert response.status_code == 401

    def test_get_permissions_list(self, api_client):
        """Test getting available permissions."""
        response = api_client.get("/auth/permissions")

        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        assert "roles" in data
