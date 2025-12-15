#!/usr/bin/env python3
"""
Test script for AI-powered drift resolution.

Demonstrates:
1. Detecting drift across narrative documents
2. Using Claude AI to generate specific fix recommendations
3. Exporting resolution plans in different formats
"""
import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from services.drift_detector import DriftDetector
from services.semantic_drift_detector import SemanticDriftDetector
from services.ai_conflict_resolver import AIConflictResolver
from services.narrative import NarrativeService
from logging_config import get_logger

logger = get_logger("test_ai_resolution")


def main():
    """Run AI-powered drift resolution test."""
    print("=" * 80)
    print("AI-POWERED DRIFT RESOLUTION TEST")
    print("=" * 80)
    print()

    # Check API key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ERROR: ANTHROPIC_API_KEY environment variable not set")
        print()
        print("To use AI-powered resolution, you need a Claude API key:")
        print("1. Get one from: https://console.anthropic.com")
        print("2. Set it: export ANTHROPIC_API_KEY='your-key-here'")
        print()
        return

    print(f"✅ API Key found: {api_key[:20]}...")
    print()

    # Initialize services
    logger.info("Initializing services...")
    narrative = NarrativeService()
    detector = DriftDetector(narrative_service=narrative)
    resolver = AIConflictResolver()

    # Step 1: Run drift detection
    print("-" * 80)
    print("STEP 1: Running drift detection scan...")
    print("-" * 80)
    print()

    drift_events = detector.run_full_scan(include_semantic=True)

    if not drift_events:
        print("✅ No drift detected! Your narrative is perfectly aligned.")
        print()
        return

    print(f"Found {len(drift_events)} drift events:\n")

    # Group by severity
    by_severity = {}
    for event in drift_events:
        sev = event.severity.value
        by_severity.setdefault(sev, []).append(event)

    for sev in ['critical', 'high', 'medium', 'low']:
        count = len(by_severity.get(sev, []))
        if count > 0:
            emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}.get(sev, "⚪")
            print(f"{emoji} {sev.upper()}: {count}")

    print()

    # Step 2: Generate AI resolution plan
    print("-" * 80)
    print("STEP 2: Generating AI-powered resolution plan...")
    print("-" * 80)
    print()
    print("⏳ Analyzing drift with Claude AI...")
    print()

    plan = resolver.resolve_drift_events(drift_events)

    print(f"✅ Plan generated!")
    print()

    # Step 3: Display results
    print("=" * 80)
    print("RESOLUTION PLAN")
    print("=" * 80)
    print()

    print(f"📊 **Total Drifts:** {plan.total_drifts}")
    print(f"⏱️  **Estimated Total Effort:** {plan.estimated_total_effort}")
    print(f"🎯 **Quick Wins:** {len(plan.quick_wins)} easy fixes identified")
    print()

    print("**Summary:**")
    print(plan.summary)
    print()

    if plan.quick_wins:
        print("-" * 80)
        print("🎯 QUICK WINS (Fix These First!)")
        print("-" * 80)
        print()

        for drift_id in plan.quick_wins:
            rec = next((r for r in plan.recommendations if r.drift_event_id == drift_id), None)
            if rec:
                print(f"✓ **{rec.file_path or 'General'}** ({rec.estimated_effort})")
                print(f"  {rec.specific_action[:100]}...")
                print()

    # Detailed recommendations
    print("-" * 80)
    print("📋 ALL RECOMMENDATIONS")
    print("-" * 80)
    print()

    for i, rec in enumerate(plan.recommendations, 1):
        priority_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}.get(rec.priority, "⚪")

        print(f"{i}. {priority_emoji} {rec.file_path or 'General'}")
        print(f"   Priority: {rec.priority.upper()} | Effort: {rec.estimated_effort}")
        print()
        print(f"   **Business Impact:**")
        print(f"   {rec.business_impact}")
        print()
        print(f"   **Action Required:**")
        print(f"   {rec.specific_action}")
        print()

        if rec.before_snippet and rec.after_snippet:
            print(f"   **Before:**")
            print(f"   {rec.before_snippet[:150]}...")
            print()
            print(f"   **After:**")
            print(f"   {rec.after_snippet[:150]}...")
            print()

        print(f"   **Rationale:** {rec.rationale}")
        print()
        print("   " + "-" * 76)
        print()

    # Step 4: Export options
    print("=" * 80)
    print("EXPORT OPTIONS")
    print("=" * 80)
    print()

    print("Want to save this plan? Choose a format:")
    print()
    print("1. JSON:     Great for programmatic processing")
    print("2. Markdown: Human-readable, ready to commit")
    print()

    choice = input("Export format (json/markdown/skip): ").strip().lower()

    if choice in ['json', 'markdown']:
        output_dir = Path("drift-resolutions")
        output_dir.mkdir(exist_ok=True)

        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"resolution_plan_{timestamp}.{choice if choice == 'json' else 'md'}"
        output_path = output_dir / filename

        content = resolver.export_resolution_plan(plan, format=choice)
        output_path.write_text(content, encoding='utf-8')

        print()
        print(f"✅ Plan exported to: {output_path}")
        print()

    print("=" * 80)
    print("Test complete!")
    print("=" * 80)


if __name__ == "__main__":
    main()
