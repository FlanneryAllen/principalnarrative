#!/usr/bin/env python3
"""
Test script for drift alert system.

Demonstrates:
1. Configuring alert rules
2. Sending test alerts to Slack/Email
3. Triggering alerts on detected drift
4. Viewing alert history
"""
import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from services.drift_detector import DriftDetector
from services.alert_service import AlertService, AlertRule
from services.narrative import NarrativeService
from models import DriftSeverity
from logging_config import get_logger

logger = get_logger("test_alerts")


def main():
    """Run alert system test."""
    print("=" * 80)
    print("DRIFT ALERT SYSTEM TEST")
    print("=" * 80)
    print()

    # Check for Slack webhook
    slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
    email_recipients = os.getenv("ALERT_EMAIL_RECIPIENTS", "").split(",")

    if not slack_webhook and not email_recipients[0]:
        print("⚠️  No alert channels configured")
        print()
        print("To test alerts, set one or more of:")
        print("  - SLACK_WEBHOOK_URL (get from: https://api.slack.com/messaging/webhooks)")
        print("  - ALERT_EMAIL_RECIPIENTS (comma-separated email addresses)")
        print("  - SMTP_SERVER, SMTP_USER, SMTP_PASSWORD (for email)")
        print()
        print("Example:")
        print('  export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"')
        print()

    # Initialize services
    logger.info("Initializing services...")
    narrative = NarrativeService()
    detector = DriftDetector(narrative_service=narrative)
    alert_service = AlertService()

    # Step 1: Show current alert rules
    print("-" * 80)
    print("STEP 1: Current Alert Rules")
    print("-" * 80)
    print()

    rules = alert_service.get_rules()
    print(f"Found {len(rules)} alert rules:\n")

    for rule in rules:
        status_emoji = "✅" if rule.enabled else "❌"
        print(f"{status_emoji} {rule.name} ({rule.id})")
        print(f"   Min Severity: {rule.min_severity.value}")
        print(f"   Channels: {', '.join(rule.channels)}")
        if rule.slack_webhook:
            print(f"   Slack: Configured")
        if rule.email_recipients:
            print(f"   Email: {len(rule.email_recipients)} recipients")
        print(f"   Cooldown: {rule.cooldown_hours} hours")
        print()

    # Step 2: Enable a rule for testing
    print("-" * 80)
    print("STEP 2: Configure Alert Rule")
    print("-" * 80)
    print()

    if slack_webhook:
        print("Enabling 'semantic-drift' rule for testing...")
        alert_service.update_rule("semantic-drift", {
            "enabled": True,
            "slack_webhook": slack_webhook
        })
        print("✅ Slack alerts enabled")
        print()

    # Step 3: Run drift detection
    print("-" * 80)
    print("STEP 3: Running Drift Detection")
    print("-" * 80)
    print()

    print("Scanning for drift...")
    drift_events = detector.run_full_scan(include_semantic=True)

    if not drift_events:
        print("✅ No drift detected!")
        print()
        print("Creating a mock drift event for testing...")

        # Create mock drift for testing
        from models import DriftEvent, DriftType, DriftStatus
        from datetime import datetime
        import uuid

        drift_events = [
            DriftEvent(
                id=f"test-{uuid.uuid4().hex[:8]}",
                type=DriftType.SEMANTIC,
                severity=DriftSeverity.HIGH,
                detected_at=datetime.now(),
                source_unit="test/example.md",
                target_unit="test/target.md",
                description="Test drift event: Documentation says PostgreSQL but code uses SQLite",
                suggested_resolution="Update architecture.md to reflect actual database",
                status=DriftStatus.OPEN
            )
        ]
        print("✅ Created test drift event")
    else:
        print(f"Found {len(drift_events)} drift events")

        # Show summary
        by_severity = {}
        for event in drift_events:
            by_severity.setdefault(event.severity.value, []).append(event)

        for sev in ['critical', 'high', 'medium', 'low']:
            count = len(by_severity.get(sev, []))
            if count > 0:
                emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}.get(sev)
                print(f"{emoji} {sev.upper()}: {count}")

    print()

    # Step 4: Send alerts
    print("-" * 80)
    print("STEP 4: Sending Alerts")
    print("-" * 80)
    print()

    confirm = input("Send alerts now? (y/n): ").strip().lower()

    if confirm == 'y':
        print()
        print("📤 Sending alerts...")
        stats = alert_service.send_drift_alerts(drift_events)

        print()
        print(f"✅ Sent {stats['total']} alerts:")
        if stats.get('slack', 0) > 0:
            print(f"   📱 Slack: {stats['slack']}")
        if stats.get('email', 0) > 0:
            print(f"   📧 Email: {stats['email']}")
        if stats.get('webhook', 0) > 0:
            print(f"   🔗 Webhook: {stats['webhook']}")
        print()

        if stats['total'] == 0:
            print("⚠️  No alerts sent. Check your alert rule configuration:")
            print("   - Is the rule enabled?")
            print("   - Does it match the drift severity?")
            print("   - Are channels configured?")
            print()
    else:
        print("Skipped sending alerts")
        print()

    # Step 5: View alert history
    print("-" * 80)
    print("STEP 5: Alert History")
    print("-" * 80)
    print()

    history = alert_service.get_history(limit=10)

    if history:
        print(f"Last {len(history)} alerts:\n")
        for record in history:
            status = "✅" if record.success else "❌"
            print(f"{status} {record.channel.upper()} - {record.sent_at.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"   Rule: {record.rule_id}")
            print(f"   Drift: {record.drift_event_id}")
            if record.error_message:
                print(f"   Error: {record.error_message}")
            print()
    else:
        print("No alert history yet")
        print()

    # Step 6: Next steps
    print("=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    print()

    print("✅ Alert system is configured!")
    print()
    print("To use alerts in production:")
    print()
    print("1. Configure Slack webhook:")
    print('   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."')
    print()
    print("2. Or configure email:")
    print('   export ALERT_EMAIL_RECIPIENTS="team@company.com"')
    print('   export SMTP_SERVER="smtp.gmail.com"')
    print('   export SMTP_USER="your-email@gmail.com"')
    print('   export SMTP_PASSWORD="your-app-password"')
    print()
    print("3. Enable rules via API:")
    print('   curl -X PUT "http://localhost:8000/alerts/rules/semantic-drift" \\')
    print('     -H "Content-Type: application/json" \\')
    print('     -d \'{"enabled": true}\'')
    print()
    print("4. Trigger manual alerts:")
    print('   curl -X POST "http://localhost:8000/alerts/send"')
    print()
    print("5. Set up scheduled scans (cron):")
    print('   0 9 * * * curl -X POST http://localhost:8000/alerts/send')
    print()

    print("=" * 80)
    print("Test complete!")
    print("=" * 80)


if __name__ == "__main__":
    main()
