"""
Alert Service - Sends notifications when drift is detected.

Supports:
- Slack notifications (via webhook)
- Email alerts (via SMTP)
- Configurable thresholds and channels
- Weekly drift summary reports
- Alert history tracking
"""
import os
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path

from ..logging_config import get_logger
from ..models import DriftEvent, DriftSeverity, DriftType

logger = get_logger("services.alert_service")

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    logger.warning("requests library not available - Slack alerts will be disabled")


@dataclass
class AlertRule:
    """Configuration for an alert rule."""
    id: str
    name: str
    enabled: bool
    min_severity: DriftSeverity
    drift_types: List[str]  # Empty = all types
    channels: List[str]  # "slack", "email", "webhook"
    slack_webhook: Optional[str] = None
    email_recipients: Optional[List[str]] = None
    webhook_url: Optional[str] = None
    cooldown_hours: int = 24  # Don't spam same alert


@dataclass
class AlertHistory:
    """Record of sent alerts."""
    alert_id: str
    rule_id: str
    drift_event_id: str
    channel: str
    sent_at: datetime
    success: bool
    error_message: Optional[str] = None


class AlertService:
    """
    Service for sending drift detection alerts via multiple channels.

    Features:
    - Slack notifications with formatted messages
    - Email alerts with HTML formatting
    - Configurable alert rules
    - Cooldown periods to prevent spam
    - Alert history tracking
    """

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize alert service with optional config file."""
        self.config_path = config_path or Path("data/alert_config.json")
        self.rules: List[AlertRule] = []
        self.history: List[AlertHistory] = []
        self._load_config()

    def _load_config(self):
        """Load alert rules from config file."""
        if not self.config_path.exists():
            logger.info("No alert config found, creating default config")
            self._create_default_config()
            return

        try:
            data = json.loads(self.config_path.read_text(encoding='utf-8'))
            self.rules = [
                AlertRule(
                    id=r['id'],
                    name=r['name'],
                    enabled=r.get('enabled', True),
                    min_severity=DriftSeverity(r['min_severity']),
                    drift_types=r.get('drift_types', []),
                    channels=r['channels'],
                    slack_webhook=r.get('slack_webhook'),
                    email_recipients=r.get('email_recipients'),
                    webhook_url=r.get('webhook_url'),
                    cooldown_hours=r.get('cooldown_hours', 24)
                )
                for r in data.get('rules', [])
            ]
            logger.info(f"Loaded {len(self.rules)} alert rules")
        except Exception as e:
            logger.error(f"Failed to load alert config: {e}", exc_info=True)
            self._create_default_config()

    def _create_default_config(self):
        """Create default alert configuration."""
        self.rules = [
            AlertRule(
                id="critical-drift",
                name="Critical Drift Alerts",
                enabled=False,  # Disabled by default, user must configure
                min_severity=DriftSeverity.CRITICAL,
                drift_types=[],
                channels=["slack"],
                slack_webhook=os.getenv("SLACK_WEBHOOK_URL"),
                cooldown_hours=1
            ),
            AlertRule(
                id="high-drift-daily",
                name="High Severity Daily Digest",
                enabled=False,
                min_severity=DriftSeverity.HIGH,
                drift_types=[],
                channels=["email"],
                email_recipients=os.getenv("ALERT_EMAIL_RECIPIENTS", "").split(","),
                cooldown_hours=24
            ),
            AlertRule(
                id="semantic-drift",
                name="Semantic Drift Alerts",
                enabled=False,
                min_severity=DriftSeverity.MEDIUM,
                drift_types=["semantic"],
                channels=["slack"],
                slack_webhook=os.getenv("SLACK_WEBHOOK_URL"),
                cooldown_hours=12
            )
        ]
        self._save_config()

    def _save_config(self):
        """Save alert rules to config file."""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            data = {
                "rules": [
                    {
                        "id": r.id,
                        "name": r.name,
                        "enabled": r.enabled,
                        "min_severity": r.min_severity.value,
                        "drift_types": r.drift_types,
                        "channels": r.channels,
                        "slack_webhook": r.slack_webhook,
                        "email_recipients": r.email_recipients,
                        "webhook_url": r.webhook_url,
                        "cooldown_hours": r.cooldown_hours
                    }
                    for r in self.rules
                ]
            }
            self.config_path.write_text(json.dumps(data, indent=2), encoding='utf-8')
            logger.info(f"Saved alert config to {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to save alert config: {e}", exc_info=True)

    def send_drift_alerts(
        self,
        drift_events: List[DriftEvent],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, int]:
        """
        Send alerts for detected drift events.

        Args:
            drift_events: List of drift events to alert on
            context: Optional context (scan metadata, etc.)

        Returns:
            Dict with counts of alerts sent per channel
        """
        if not drift_events:
            logger.debug("No drift events to alert on")
            return {"total": 0}

        stats = {"slack": 0, "email": 0, "webhook": 0, "total": 0}

        for rule in self.rules:
            if not rule.enabled:
                continue

            # Filter events matching this rule
            matching_events = self._filter_events(drift_events, rule)

            if not matching_events:
                continue

            # Check cooldown
            if self._is_in_cooldown(rule.id, matching_events):
                logger.debug(f"Rule {rule.id} in cooldown, skipping")
                continue

            # Send to each configured channel
            for channel in rule.channels:
                try:
                    if channel == "slack" and rule.slack_webhook:
                        success = self._send_slack_alert(rule, matching_events, context)
                        if success:
                            stats["slack"] += 1
                            stats["total"] += 1

                    elif channel == "email" and rule.email_recipients:
                        success = self._send_email_alert(rule, matching_events, context)
                        if success:
                            stats["email"] += 1
                            stats["total"] += 1

                    elif channel == "webhook" and rule.webhook_url:
                        success = self._send_webhook_alert(rule, matching_events, context)
                        if success:
                            stats["webhook"] += 1
                            stats["total"] += 1

                except Exception as e:
                    logger.error(f"Failed to send {channel} alert for rule {rule.id}: {e}", exc_info=True)

        logger.info(f"Sent {stats['total']} alerts: {stats}")
        return stats

    def _filter_events(
        self,
        drift_events: List[DriftEvent],
        rule: AlertRule
    ) -> List[DriftEvent]:
        """Filter events matching alert rule criteria."""
        severity_order = [DriftSeverity.LOW, DriftSeverity.MEDIUM, DriftSeverity.HIGH, DriftSeverity.CRITICAL]
        min_index = severity_order.index(rule.min_severity)

        filtered = []
        for event in drift_events:
            # Check severity
            if severity_order.index(event.severity) < min_index:
                continue

            # Check drift type
            if rule.drift_types and event.type.value not in rule.drift_types:
                continue

            filtered.append(event)

        return filtered

    def _is_in_cooldown(self, rule_id: str, events: List[DriftEvent]) -> bool:
        """Check if any of these events were recently alerted on."""
        if not self.history:
            return False

        cooldown_start = datetime.now() - timedelta(hours=self.rules[0].cooldown_hours)

        for event in events:
            for record in self.history:
                if (record.rule_id == rule_id and
                    record.drift_event_id == event.id and
                    record.sent_at > cooldown_start and
                    record.success):
                    return True

        return False

    # =========================================================================
    # SLACK ALERTS
    # =========================================================================

    def _send_slack_alert(
        self,
        rule: AlertRule,
        events: List[DriftEvent],
        context: Optional[Dict[str, Any]]
    ) -> bool:
        """Send formatted Slack notification."""
        if not REQUESTS_AVAILABLE or not rule.slack_webhook:
            return False

        try:
            # Build Slack message
            message = self._build_slack_message(rule, events, context)

            response = requests.post(
                rule.slack_webhook,
                json=message,
                headers={"Content-Type": "application/json"},
                timeout=10
            )

            success = response.status_code == 200

            # Record history
            for event in events:
                self.history.append(AlertHistory(
                    alert_id=f"alert-{datetime.now().timestamp()}",
                    rule_id=rule.id,
                    drift_event_id=event.id,
                    channel="slack",
                    sent_at=datetime.now(),
                    success=success,
                    error_message=None if success else response.text
                ))

            return success

        except Exception as e:
            logger.error(f"Slack alert failed: {e}", exc_info=True)
            return False

    def _build_slack_message(
        self,
        rule: AlertRule,
        events: List[DriftEvent],
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build Slack message with blocks."""
        severity_emoji = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🔵"
        }

        # Group by severity
        by_severity = {}
        for event in events:
            by_severity.setdefault(event.severity.value, []).append(event)

        # Build message blocks
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"⚠️ Drift Detected: {rule.name}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{len(events)} drift events* detected"
                }
            }
        ]

        # Severity breakdown
        severity_text = "\n".join([
            f"{severity_emoji.get(sev, '⚪')} *{sev.upper()}*: {len(evts)}"
            for sev, evts in sorted(by_severity.items(), key=lambda x: ["low", "medium", "high", "critical"].index(x[0]))
        ])

        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": severity_text
            }
        })

        # Show top 3 events
        blocks.append({"type": "divider"})
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Top Issues:*"
            }
        })

        for i, event in enumerate(events[:3], 1):
            emoji = severity_emoji.get(event.severity.value, "⚪")
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{emoji} *{i}. {event.source_unit}*\n{event.description[:150]}..."
                }
            })

        if len(events) > 3:
            blocks.append({
                "type": "context",
                "elements": [{
                    "type": "mrkdwn",
                    "text": f"_+ {len(events) - 3} more issues_"
                }]
            })

        return {"blocks": blocks}

    # =========================================================================
    # EMAIL ALERTS
    # =========================================================================

    def _send_email_alert(
        self,
        rule: AlertRule,
        events: List[DriftEvent],
        context: Optional[Dict[str, Any]]
    ) -> bool:
        """Send HTML email notification."""
        if not rule.email_recipients:
            return False

        try:
            # Get SMTP config from environment
            smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER")
            smtp_password = os.getenv("SMTP_PASSWORD")
            from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)

            if not smtp_user or not smtp_password:
                logger.warning("SMTP credentials not configured, skipping email alert")
                return False

            # Build email
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"[Drift Alert] {rule.name} - {len(events)} issues detected"
            msg["From"] = from_email
            msg["To"] = ", ".join(rule.email_recipients)

            html_body = self._build_email_html(rule, events, context)
            msg.attach(MIMEText(html_body, "html"))

            # Send via SMTP
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

            logger.info(f"Email alert sent to {len(rule.email_recipients)} recipients")

            # Record history
            for event in events:
                self.history.append(AlertHistory(
                    alert_id=f"alert-{datetime.now().timestamp()}",
                    rule_id=rule.id,
                    drift_event_id=event.id,
                    channel="email",
                    sent_at=datetime.now(),
                    success=True
                ))

            return True

        except Exception as e:
            logger.error(f"Email alert failed: {e}", exc_info=True)
            return False

    def _build_email_html(
        self,
        rule: AlertRule,
        events: List[DriftEvent],
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Build HTML email body."""
        severity_colors = {
            "critical": "#dc2626",
            "high": "#ea580c",
            "medium": "#ca8a04",
            "low": "#2563eb"
        }

        # Group by severity
        by_severity = {}
        for event in events:
            by_severity.setdefault(event.severity.value, []).append(event)

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }}
        .summary {{ background: white; padding: 15px; margin: 15px 0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        .event {{ background: white; padding: 15px; margin: 10px 0; border-left: 4px solid; border-radius: 4px; }}
        .footer {{ margin-top: 20px; padding: 15px; color: #6b7280; font-size: 0.875rem; text-align: center; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0;">⚠️ Drift Alert</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">{rule.name}</p>
        </div>
        <div class="content">
            <div class="summary">
                <h2 style="margin-top: 0;">Summary</h2>
                <p><strong>{len(events)} drift events</strong> detected on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
                <ul style="margin: 10px 0;">
"""

        for sev in ["critical", "high", "medium", "low"]:
            count = len(by_severity.get(sev, []))
            if count > 0:
                html += f'<li><strong style="color: {severity_colors[sev]}">{sev.upper()}</strong>: {count}</li>\n'

        html += """
                </ul>
            </div>
            <h3>Events</h3>
"""

        for event in events[:10]:  # Limit to 10 in email
            color = severity_colors.get(event.severity.value, "#6b7280")
            html += f"""
            <div class="event" style="border-left-color: {color};">
                <strong>{event.source_unit}</strong><br/>
                <span style="color: {color}; font-size: 0.875rem; font-weight: 600;">{event.severity.value.upper()} - {event.type.value}</span>
                <p style="margin: 10px 0;">{event.description}</p>
                {f'<p style="margin: 10px 0; color: #059669;"><em>💡 {event.suggested_resolution}</em></p>' if event.suggested_resolution else ''}
            </div>
"""

        if len(events) > 10:
            html += f'<p style="text-align: center; color: #6b7280;"><em>+ {len(events) - 10} more events</em></p>'

        html += """
        </div>
        <div class="footer">
            Generated by Principal Narrative Drift Detection
        </div>
    </div>
</body>
</html>
"""
        return html

    # =========================================================================
    # WEBHOOK ALERTS
    # =========================================================================

    def _send_webhook_alert(
        self,
        rule: AlertRule,
        events: List[DriftEvent],
        context: Optional[Dict[str, Any]]
    ) -> bool:
        """Send generic webhook notification."""
        if not REQUESTS_AVAILABLE or not rule.webhook_url:
            return False

        try:
            payload = {
                "rule_id": rule.id,
                "rule_name": rule.name,
                "timestamp": datetime.now().isoformat(),
                "event_count": len(events),
                "events": [
                    {
                        "id": e.id,
                        "type": e.type.value,
                        "severity": e.severity.value,
                        "source": e.source_unit,
                        "target": e.target_unit,
                        "description": e.description,
                        "resolution": e.suggested_resolution
                    }
                    for e in events
                ],
                "context": context or {}
            }

            response = requests.post(
                rule.webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )

            success = response.status_code in [200, 201, 202]

            for event in events:
                self.history.append(AlertHistory(
                    alert_id=f"alert-{datetime.now().timestamp()}",
                    rule_id=rule.id,
                    drift_event_id=event.id,
                    channel="webhook",
                    sent_at=datetime.now(),
                    success=success,
                    error_message=None if success else response.text
                ))

            return success

        except Exception as e:
            logger.error(f"Webhook alert failed: {e}", exc_info=True)
            return False

    # =========================================================================
    # CONFIGURATION MANAGEMENT
    # =========================================================================

    def add_rule(self, rule: AlertRule) -> bool:
        """Add a new alert rule."""
        if any(r.id == rule.id for r in self.rules):
            logger.warning(f"Rule {rule.id} already exists")
            return False

        self.rules.append(rule)
        self._save_config()
        return True

    def update_rule(self, rule_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing alert rule."""
        for rule in self.rules:
            if rule.id == rule_id:
                for key, value in updates.items():
                    if hasattr(rule, key):
                        setattr(rule, key, value)
                self._save_config()
                return True

        logger.warning(f"Rule {rule_id} not found")
        return False

    def delete_rule(self, rule_id: str) -> bool:
        """Delete an alert rule."""
        self.rules = [r for r in self.rules if r.id != rule_id]
        self._save_config()
        return True

    def get_rules(self) -> List[AlertRule]:
        """Get all alert rules."""
        return self.rules

    def get_history(self, limit: int = 100) -> List[AlertHistory]:
        """Get recent alert history."""
        return sorted(self.history, key=lambda x: x.sent_at, reverse=True)[:limit]
