"""
Tests for Principal Narrative services.
"""
import pytest
from pathlib import Path
from datetime import datetime


class TestNarrativeService:
    """Tests for NarrativeService."""

    def test_load_narrative_units(self, temp_narrative_dir):
        """Test loading narrative units from directory."""
        from src.services.narrative import NarrativeService
        from src.config import Settings

        settings = Settings()
        settings.narrative_base_path = temp_narrative_dir

        service = NarrativeService(settings)
        units = service.get_all_units()

        assert len(units) > 0
        assert any(u.type.value == "strategy" for u in units)
        assert any(u.type.value == "messaging" for u in units)

    def test_query_by_type(self, temp_narrative_dir):
        """Test querying units by type."""
        from src.services.narrative import NarrativeService
        from src.config import Settings
        from src.models import QueryRequest

        settings = Settings()
        settings.narrative_base_path = temp_narrative_dir

        service = NarrativeService(settings)
        request = QueryRequest(type="messaging")
        units = service.query(request)

        for unit in units:
            assert unit.type.value == "messaging"

    def test_get_forbidden_terms(self, temp_narrative_dir):
        """Test getting forbidden terms."""
        from src.services.narrative import NarrativeService
        from src.config import Settings

        settings = Settings()
        settings.narrative_base_path = temp_narrative_dir

        service = NarrativeService(settings)
        terms = service.get_forbidden_terms()

        assert isinstance(terms, list)
        # Check for expected terms from test fixture
        term_names = [t.get("term", "").lower() for t in terms]
        assert "game-changing" in term_names or "synergy" in term_names


class TestValidatorService:
    """Tests for ValidatorService."""

    def test_validate_clean_claim(self, temp_narrative_dir):
        """Test validating a clean claim."""
        from src.services.narrative import NarrativeService
        from src.services.validator import ValidatorService
        from src.config import Settings
        from src.models import ValidateRequest

        settings = Settings()
        settings.narrative_base_path = temp_narrative_dir

        narrative_service = NarrativeService(settings)
        validator = ValidatorService(narrative_service)

        request = ValidateRequest(claim="Our platform helps teams work better")
        result = validator.validate(request)

        assert result.valid is True or len(result.issues) == 0

    def test_validate_forbidden_term(self, temp_narrative_dir):
        """Test detecting forbidden terms."""
        from src.services.narrative import NarrativeService
        from src.services.validator import ValidatorService
        from src.config import Settings
        from src.models import ValidateRequest

        settings = Settings()
        settings.narrative_base_path = temp_narrative_dir

        narrative_service = NarrativeService(settings)
        validator = ValidatorService(narrative_service)

        request = ValidateRequest(claim="Our game-changing solution is revolutionary")
        result = validator.validate(request)

        # Should have issues for forbidden terms
        naming_issues = [i for i in result.issues if "naming" in i.type.lower()]
        assert len(naming_issues) > 0 or not result.valid


class TestCoherenceService:
    """Tests for CoherenceService."""

    def test_compute_coherence(self, temp_narrative_dir):
        """Test computing coherence score."""
        from src.services.narrative import NarrativeService
        from src.services.coherence import CoherenceService
        from src.config import Settings

        settings = Settings()
        settings.narrative_base_path = temp_narrative_dir

        narrative_service = NarrativeService(settings)
        coherence_service = CoherenceService(narrative_service)

        score = coherence_service.compute_coherence()

        assert 0 <= score.overall <= 1
        assert score.timestamp is not None


class TestDriftDetector:
    """Tests for DriftDetector."""

    def test_run_full_scan(self, temp_narrative_dir):
        """Test running a full drift scan."""
        from src.services.narrative import NarrativeService
        from src.services.drift_detector import DriftDetector
        from src.config import Settings

        settings = Settings()
        settings.narrative_base_path = temp_narrative_dir

        narrative_service = NarrativeService(settings)
        detector = DriftDetector(narrative_service)

        events = detector.run_full_scan()

        # Events should be a list
        assert isinstance(events, list)
        # Each event should have required fields
        for event in events:
            assert hasattr(event, "type")
            assert hasattr(event, "severity")
            assert hasattr(event, "description")


class TestEvolutionTracker:
    """Tests for EvolutionTracker."""

    def test_record_change(self, tmp_path):
        """Test recording a change event."""
        from src.services.evolution import (
            EvolutionTracker,
            ChangeType,
            EvolutionTrigger
        )

        tracker = EvolutionTracker(storage_path=tmp_path / "evolution")

        event = tracker.record_change(
            unit_path="test/document.md",
            change_type=ChangeType.CREATE,
            trigger=EvolutionTrigger.MANUAL,
            description="Created test document",
            after_content="# Test Document\n\nThis is a test.",
            author="test_user"
        )

        assert event.id is not None
        assert event.unit_path == "test/document.md"
        assert event.change_type == ChangeType.CREATE
        assert event.author == "test_user"

    def test_get_timeline(self, tmp_path):
        """Test getting timeline for a unit."""
        from src.services.evolution import (
            EvolutionTracker,
            ChangeType,
            EvolutionTrigger
        )

        tracker = EvolutionTracker(storage_path=tmp_path / "evolution")

        # Record multiple changes
        tracker.record_change(
            unit_path="test/doc.md",
            change_type=ChangeType.CREATE,
            trigger=EvolutionTrigger.MANUAL,
            description="Created",
            after_content="# Initial"
        )
        tracker.record_change(
            unit_path="test/doc.md",
            change_type=ChangeType.UPDATE,
            trigger=EvolutionTrigger.MANUAL,
            description="Updated",
            before_content="# Initial",
            after_content="# Updated content"
        )

        timeline = tracker.get_timeline("test/doc.md")

        assert timeline is not None
        assert timeline.total_revisions == 2
        assert len(timeline.events) == 2

    def test_get_activity_summary(self, tmp_path):
        """Test getting activity summary."""
        from src.services.evolution import (
            EvolutionTracker,
            ChangeType,
            EvolutionTrigger
        )

        tracker = EvolutionTracker(storage_path=tmp_path / "evolution")

        # Record some changes
        for i in range(5):
            tracker.record_change(
                unit_path=f"test/doc{i}.md",
                change_type=ChangeType.CREATE,
                trigger=EvolutionTrigger.MANUAL,
                description=f"Created doc {i}",
                after_content=f"# Doc {i}"
            )

        summary = tracker.get_activity_summary(days=7)

        assert summary["total_events"] == 5
        assert summary["unique_units_modified"] == 5
