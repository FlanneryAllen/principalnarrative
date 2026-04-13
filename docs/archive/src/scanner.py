#!/usr/bin/env python3
"""
Principal Narrative Drift Scanner CLI

Usage:
    python -m src.scanner              # Run full scan
    python -m src.scanner --report     # Run scan and show report
    python -m src.scanner --save       # Run scan and save to coherence/current.json
    python -m src.scanner --json       # Output results as JSON
"""
import argparse
import json
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.drift_detector import DriftDetector
from src.services.narrative import NarrativeService


def main():
    parser = argparse.ArgumentParser(
        description="Scan narrative layers for drift",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python -m src.scanner                    # Quick scan
    python -m src.scanner --report           # Full report
    python -m src.scanner --save --report    # Save and report
    python -m src.scanner --json             # JSON output
        """
    )
    parser.add_argument(
        '--report', '-r',
        action='store_true',
        help='Generate detailed report'
    )
    parser.add_argument(
        '--save', '-s',
        action='store_true',
        help='Save results to coherence/current.json'
    )
    parser.add_argument(
        '--json', '-j',
        action='store_true',
        help='Output results as JSON'
    )
    parser.add_argument(
        '--severity',
        choices=['low', 'medium', 'high', 'critical'],
        help='Filter by minimum severity'
    )
    parser.add_argument(
        '--type', '-t',
        choices=['semantic', 'strategic', 'messaging', 'naming', 'proof', 'promise-delivery', 'opportunity-silence'],
        help='Filter by drift type'
    )

    args = parser.parse_args()

    # Initialize and run scanner
    detector = DriftDetector()
    events = detector.run_full_scan()

    # Filter by severity if specified
    if args.severity:
        severity_order = ['low', 'medium', 'high', 'critical']
        min_index = severity_order.index(args.severity)
        events = [e for e in events if severity_order.index(e.severity.value) >= min_index]

    # Filter by type if specified
    if args.type:
        events = [e for e in events if e.type.value == args.type]

    # Output
    if args.json:
        output = {
            'total': len(events),
            'events': [
                {
                    'id': e.id,
                    'type': e.type.value,
                    'severity': e.severity.value,
                    'source': e.source_unit,
                    'target': e.target_unit,
                    'description': e.description,
                    'resolution': e.suggested_resolution
                }
                for e in events
            ]
        }
        print(json.dumps(output, indent=2))
    elif args.report:
        # Update detector's events for report generation
        detector.detected_drifts = events
        print(detector.generate_report())
    else:
        # Simple summary
        print(f"\nDrift Scan Complete")
        print(f"=" * 40)
        print(f"Total events: {len(events)}")

        if events:
            print(f"\nBy severity:")
            for sev in ['critical', 'high', 'medium', 'low']:
                count = len([e for e in events if e.severity.value == sev])
                if count:
                    print(f"  {sev}: {count}")

            print(f"\nBy type:")
            types = {}
            for e in events:
                types[e.type.value] = types.get(e.type.value, 0) + 1
            for t, c in sorted(types.items()):
                print(f"  {t}: {c}")

    # Save if requested
    if args.save:
        detector.detected_drifts = events
        output_path = detector.save_results()
        print(f"\nResults saved to: {output_path}")

    # Exit code based on severity
    critical_count = len([e for e in events if e.severity.value == 'critical'])
    high_count = len([e for e in events if e.severity.value == 'high'])

    if critical_count > 0:
        sys.exit(2)  # Critical issues
    elif high_count > 0:
        sys.exit(1)  # High severity issues
    else:
        sys.exit(0)  # All clear or only low/medium


if __name__ == '__main__':
    main()
