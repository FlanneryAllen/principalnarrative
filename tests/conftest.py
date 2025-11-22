"""
Pytest configuration and fixtures for Principal Narrative tests.
"""
import pytest
from pathlib import Path
from datetime import datetime
import tempfile
import shutil

from fastapi.testclient import TestClient


@pytest.fixture
def temp_narrative_dir():
    """Create a temporary narrative directory for testing."""
    temp_dir = Path(tempfile.mkdtemp())

    # Create basic structure
    (temp_dir / "strategy").mkdir(parents=True)
    (temp_dir / "messaging").mkdir(parents=True)
    (temp_dir / "proof").mkdir(parents=True)
    (temp_dir / "naming").mkdir(parents=True)
    (temp_dir / "features").mkdir(parents=True)

    # Create sample narrative documents
    (temp_dir / "strategy" / "vision.md").write_text("""---
type: strategy
subtype: vision
status: active
tags: [core, vision]
---

# Company Vision

We help teams build better software faster.

## Mission
Enable developers to ship with confidence.
""")

    (temp_dir / "messaging" / "pillars.md").write_text("""---
type: messaging
subtype: pillars
status: active
tags: [messaging, core]
---

# Core Messaging Pillars

1. **Speed** - Ship faster without compromising quality
2. **Confidence** - Know your code works before it goes live
3. **Collaboration** - Work better together
""")

    (temp_dir / "proof" / "metrics.md").write_text("""---
type: proof
subtype: metrics
status: active
---

# Proof Metrics

## Performance
- id: perf_001
  metric: "Code review time reduction"
  value: "50%"
  verified: true
  source: "Internal benchmark Q3 2024"

## Adoption
- id: adopt_001
  metric: "Enterprise customers"
  value: "500+"
  verified: true
  source: "Sales data"
""")

    (temp_dir / "naming" / "forbidden.md").write_text("""---
type: naming
subtype: forbidden
status: active
---

# Forbidden Terms

| Term | Reason | Alternative |
|------|--------|-------------|
| game-changing | Overused marketing speak | transformative |
| revolutionary | Overpromises | innovative |
| synergy | Corporate jargon | collaboration |
""")

    (temp_dir / "features" / "registry.md").write_text("""---
type: features
subtype: registry
status: active
---

# Feature Registry

| Feature | Status | Launched |
|---------|--------|----------|
| Code Review | Shipped | 2024-01-15 |
| PR Analytics | Shipped | 2024-03-01 |
| Team Insights | Beta | N/A |
| AI Suggestions | Planned | N/A |
""")

    yield temp_dir

    # Cleanup
    shutil.rmtree(temp_dir)


@pytest.fixture
def api_client(temp_narrative_dir, monkeypatch):
    """Create a test client with temporary narrative directory."""
    # Patch the narrative base path
    from src.config import settings
    monkeypatch.setattr(settings, "narrative_base_path", temp_narrative_dir)

    # Import and create app
    from src.main import app

    return TestClient(app)


@pytest.fixture
def sample_claims():
    """Sample claims for validation testing."""
    return {
        "valid_claim": "Our platform reduces code review time by 50%",
        "forbidden_term": "Our game-changing solution transforms development",
        "unverified_metric": "We deliver 10x faster deployments",
        "unknown_feature": "Our quantum computing integration is amazing",
        "clean_claim": "Our platform helps teams collaborate better",
    }


@pytest.fixture
def sample_agent():
    """Sample agent registration data."""
    return {
        "agent_type": "coding",
        "name": "TestCodeAgent",
        "capabilities": ["python", "typescript", "testing"]
    }
