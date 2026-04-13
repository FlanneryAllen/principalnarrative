#!/usr/bin/env python3
"""
Test script for semantic drift detection.

Demonstrates:
1. Cross-document contradiction detection
2. Documentation-to-codebase drift
3. Technology stack misalignment
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from services.semantic_drift_detector import SemanticDriftDetector
from services.narrative import NarrativeService
from logging_config import get_logger

logger = get_logger("test_semantic_drift")


def main():
    """Run semantic drift detection tests."""
    print("=" * 70)
    print("SEMANTIC DRIFT DETECTION TEST")
    print("=" * 70)
    print()

    # Initialize services
    logger.info("Initializing services...")
    narrative = NarrativeService()
    detector = SemanticDriftDetector(narrative_service=narrative)

    # Run semantic scan
    logger.info("Running semantic drift scan...")
    print()
    drift_events = detector.run_semantic_scan()

    # Display results
    print()
    print("=" * 70)
    print("RESULTS")
    print("=" * 70)
    print()

    if not drift_events:
        print("✅ No semantic drift detected! All clear.")
        return

    # Group by severity
    by_severity = {}
    for event in drift_events:
        sev = event.severity.value
        by_severity.setdefault(sev, []).append(event)

    # Summary
    print(f"Found {len(drift_events)} semantic drift events:\n")
    for sev in ['critical', 'high', 'medium', 'low']:
        count = len(by_severity.get(sev, []))
        if count > 0:
            emoji = "🔴" if sev == "critical" else "🟠" if sev == "high" else "🟡" if sev == "medium" else "🔵"
            print(f"{emoji} {sev.upper()}: {count}")

    # Detailed events
    print()
    print("-" * 70)
    print()

    for sev in ['critical', 'high', 'medium', 'low']:
        events = by_severity.get(sev, [])
        if not events:
            continue

        print(f"{sev.upper()} SEVERITY EVENTS ({len(events)}):")
        print("-" * 70)

        for i, event in enumerate(events, 1):
            print(f"\n{i}. [{event.type.value}] {event.source_unit}")
            print(f"   {event.description}")
            if event.target_unit:
                print(f"   Target: {event.target_unit}")
            if event.suggested_resolution:
                print(f"   💡 Resolution: {event.suggested_resolution}")

        print()

    # Show codebase analysis summary
    print()
    print("=" * 70)
    print("CODEBASE ANALYSIS SUMMARY")
    print("=" * 70)

    summary = detector.get_summary()

    print(f"\nCodebase entities found: {summary['codebase_entities_found']}")

    if summary['entities_by_type']:
        print("\nBy type:")
        for entity_type, count in sorted(summary['entities_by_type'].items()):
            print(f"  • {entity_type}: {count}")

    print()
    print("=" * 70)
    print("Test complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
