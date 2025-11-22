"""
Tests for the Principal Narrative API endpoints.
"""
import pytest


class TestHealthEndpoints:
    """Tests for health and info endpoints."""

    def test_health_check(self, api_client):
        """Test health check endpoint."""
        response = api_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data

    def test_root_info(self, api_client):
        """Test root info endpoint."""
        response = api_client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "endpoints" in data


class TestContextQuery:
    """Tests for context query endpoints."""

    def test_query_all(self, api_client):
        """Test querying all narrative units."""
        response = api_client.get("/context/query")
        assert response.status_code == 200
        data = response.json()
        assert "units" in data
        assert "total" in data
        assert data["total"] >= 0

    def test_query_by_type(self, api_client):
        """Test querying by narrative type."""
        response = api_client.get("/context/query?type=messaging")
        assert response.status_code == 200
        data = response.json()
        for unit in data.get("units", []):
            assert unit["type"] == "messaging"

    def test_query_with_search(self, api_client):
        """Test full-text search."""
        response = api_client.get("/context/query?search=vision")
        assert response.status_code == 200
        data = response.json()
        # Results should contain the search term
        assert "units" in data

    def test_query_exclude_content(self, api_client):
        """Test excluding content from response."""
        response = api_client.get("/context/query?include_content=false")
        assert response.status_code == 200
        data = response.json()
        for unit in data.get("units", []):
            assert unit.get("content") is None


class TestValidation:
    """Tests for validation endpoints."""

    def test_validate_clean_claim(self, api_client, sample_claims):
        """Test validating a clean claim."""
        response = api_client.post(
            "/context/validate",
            json={"claim": sample_claims["clean_claim"], "require_proof": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert "valid" in data
        assert "issues" in data

    def test_validate_forbidden_term(self, api_client, sample_claims):
        """Test detecting forbidden terms."""
        response = api_client.post(
            "/context/validate",
            json={"claim": sample_claims["forbidden_term"], "require_proof": False}
        )
        assert response.status_code == 200
        data = response.json()
        # Should detect naming issue
        assert "issues" in data

    def test_validate_quick_endpoint(self, api_client):
        """Test quick validation via GET."""
        response = api_client.get("/context/validate?claim=This is a test claim")
        assert response.status_code == 200
        assert "valid" in response.json()


class TestCoherence:
    """Tests for coherence endpoints."""

    def test_get_coherence(self, api_client):
        """Test getting coherence state."""
        response = api_client.get("/coherence")
        assert response.status_code == 200
        data = response.json()
        assert "score" in data

    def test_get_coherence_score(self, api_client):
        """Test getting just the coherence score."""
        response = api_client.get("/coherence/score")
        assert response.status_code == 200
        data = response.json()
        assert "overall" in data

    def test_get_drift_events(self, api_client):
        """Test getting drift events."""
        response = api_client.get("/coherence/drift")
        assert response.status_code == 200
        data = response.json()
        assert "drift_events" in data
        assert "total" in data

    def test_run_drift_scan(self, api_client):
        """Test running a drift scan."""
        response = api_client.post("/coherence/scan")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "events" in data


class TestProof:
    """Tests for proof endpoints."""

    def test_get_proof_metrics(self, api_client):
        """Test getting proof metrics."""
        response = api_client.get("/proof/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "metrics" in data
        assert "total" in data

    def test_get_verified_metrics_only(self, api_client):
        """Test filtering for verified metrics."""
        response = api_client.get("/proof/metrics?verified_only=true")
        assert response.status_code == 200
        data = response.json()
        for metric in data.get("metrics", []):
            assert metric.get("verified", False) is True


class TestNaming:
    """Tests for naming endpoints."""

    def test_get_forbidden_terms(self, api_client):
        """Test getting forbidden terms."""
        response = api_client.get("/naming/forbidden")
        assert response.status_code == 200
        data = response.json()
        assert "forbidden_terms" in data

    def test_check_naming_clean(self, api_client):
        """Test naming check with clean text."""
        response = api_client.get("/naming/check?text=Our platform helps developers")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert len(data["violations"]) == 0

    def test_check_naming_violation(self, api_client):
        """Test naming check detecting violation."""
        response = api_client.get("/naming/check?text=Our game-changing synergy platform")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert len(data["violations"]) > 0


class TestFeatures:
    """Tests for feature registry endpoints."""

    def test_get_features(self, api_client):
        """Test getting feature registry."""
        response = api_client.get("/features")
        assert response.status_code == 200
        data = response.json()
        assert "features" in data
        assert "total" in data

    def test_get_features_by_status(self, api_client):
        """Test filtering features by status."""
        response = api_client.get("/features?status=shipped")
        assert response.status_code == 200
        data = response.json()
        for feature in data.get("features", []):
            assert feature.get("status", "").lower() == "shipped"
