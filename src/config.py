"""
Configuration for the Principal Narrative API.
"""
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Paths
    app_name: str = "Principal Narrative API"
    app_version: str = "1.0.0"

    # Applied Narrative directory (relative to project root)
    narrative_base_path: Path = Path(__file__).parent.parent / "applied-narrative"

    # Coherence thresholds
    coherence_warning_threshold: float = 0.7
    coherence_critical_threshold: float = 0.5

    # Proof validation
    proof_max_age_days: int = 60

    class Config:
        env_prefix = "NARRATIVE_"


settings = Settings()
