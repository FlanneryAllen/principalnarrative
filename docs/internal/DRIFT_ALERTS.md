# Drift Alert System

Automated notifications when drift is detected across your narrative documentation. Get instant alerts via **Slack**, **Email**, or custom webhooks.

## Overview

The drift alert system monitors your narrative for inconsistencies and automatically notifies your team when issues are detected. Configure rules to control what triggers alerts, where they're sent, and how often.

### Features

- **Multi-Channel**: Slack, Email, and custom webhooks
- **Configurable Rules**: Set thresholds, filters, and cooldowns
- **Smart Filtering**: Alert only on specific drift types or severities
- **Cooldown Periods**: Prevent alert spam
- **Alert History**: Track what was sent and when
- **Test Mode**: Verify configuration before going live

## Quick Start

### 1. Configure Slack (Recommended)

```bash
# Get webhook URL from: https://api.slack.com/messaging/webhooks
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

**Create a Slack Webhook:**
1. Go to https://api.slack.com/apps
2. Create a new app or select existing
3. Navigate to "Incoming Webhooks"
4. Activate and create webhook for your channel
5. Copy the webhook URL

### 2. Or Configure Email

```bash
# Gmail example (use app password, not regular password)
export SMTP_SERVER="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASSWORD="your-app-password"
export SMTP_FROM_EMAIL="alerts@yourcompany.com"
export ALERT_EMAIL_RECIPIENTS="team@company.com,dev@company.com"
```

**Get Gmail App Password:**
1. Enable 2FA on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate app password for "Mail"
4. Use that password (not your regular password)

### 3. Enable Alert Rules

```bash
# Via API
curl -X PUT "http://localhost:8000/alerts/rules/semantic-drift" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "slack_webhook": "https://hooks.slack.com/..."}'

# Or update config file directly
vim data/alert_config.json
```

### 4. Test Your Configuration

```bash
# Run test script
python test_alerts.py

# Or via API
curl -X POST "http://localhost:8000/alerts/test?channel=slack"
```

### 5. Trigger Alerts

```bash
# Manual trigger
curl -X POST "http://localhost:8000/alerts/send"

# Or schedule with cron (daily at 9am)
crontab -e
# Add: 0 9 * * * curl -X POST http://localhost:8000/alerts/send
```

## Alert Rules

### Default Rules

The system comes with 3 pre-configured rules (disabled by default):

#### 1. Critical Drift Alerts
```json
{
  "id": "critical-drift",
  "name": "Critical Drift Alerts",
  "enabled": false,
  "min_severity": "critical",
  "drift_types": [],
  "channels": ["slack"],
  "cooldown_hours": 1
}
```

**Use Case:** Immediate notification for critical contradictions or issues

#### 2. High Severity Daily Digest
```json
{
  "id": "high-drift-daily",
  "name": "High Severity Daily Digest",
  "enabled": false,
  "min_severity": "high",
  "drift_types": [],
  "channels": ["email"],
  "cooldown_hours": 24
}
```

**Use Case:** Daily email summary of high-priority drift

#### 3. Semantic Drift Alerts
```json
{
  "id": "semantic-drift",
  "name": "Semantic Drift Alerts",
  "enabled": false,
  "min_severity": "medium",
  "drift_types": ["semantic"],
  "channels": ["slack"],
  "cooldown_hours": 12
}
```

**Use Case:** Slack notifications for documentation-code mismatches

### Creating Custom Rules

```bash
curl -X POST "http://localhost:8000/alerts/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-custom-rule",
    "name": "Custom Alert Rule",
    "enabled": true,
    "min_severity": "high",
    "drift_types": ["proof", "messaging"],
    "channels": ["slack", "email"],
    "slack_webhook": "https://hooks.slack.com/...",
    "email_recipients": ["team@company.com"],
    "cooldown_hours": 6
  }'
```

### Rule Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Unique identifier for the rule |
| `name` | string | Human-readable name |
| `enabled` | boolean | Whether rule is active |
| `min_severity` | string | Minimum severity: `low`, `medium`, `high`, `critical` |
| `drift_types` | array | Filter by drift type (empty = all types) |
| `channels` | array | Where to send: `slack`, `email`, `webhook` |
| `slack_webhook` | string | Slack webhook URL (if using Slack) |
| `email_recipients` | array | Email addresses (if using email) |
| `webhook_url` | string | Custom webhook URL |
| `cooldown_hours` | number | Hours to wait before re-alerting same drift |

### Drift Types

Filter alerts by drift type:

- `naming` - Forbidden terminology usage
- `proof` - Claims without verified metrics
- `promise_delivery` - Marketing claims for unshipped features
- `opportunity_silence` - Shipped features not marketed
- `messaging` - Voice/tone guideline violations
- `semantic` - Documentation contradictions, code drift

Example: Alert only on semantic and proof drift:
```json
{
  "drift_types": ["semantic", "proof"]
}
```

## Slack Alerts

### Message Format

Slack alerts include:
- Alert header with rule name
- Total drift count
- Severity breakdown with emojis (🔴 🟠 🟡 🔵)
- Top 3 drift events with details
- Link to full report (if configured)

### Example Slack Message

```
⚠️ Drift Detected: Semantic Drift Alerts

5 drift events detected

🟠 HIGH: 2
🟡 MEDIUM: 2
🔵 LOW: 1

---

Top Issues:

🟠 1. technical-context/architecture.md
Documentation says PostgreSQL but code uses SQLite...

🟠 2. src/main.py
Code uses FastAPI but it's not documented...

🟡 3. strategy/vision.md
Contradiction with marketing messaging...

+ 2 more issues
```

### Customizing Slack Messages

Edit `src/services/alert_service.py`:

```python
def _build_slack_message(self, rule, events, context):
    # Customize blocks, add buttons, etc.
    blocks = [
        # Your custom blocks here
    ]
    return {"blocks": blocks}
```

## Email Alerts

### Message Format

HTML email with:
- Branded header
- Summary statistics
- Color-coded event list
- Suggested resolutions
- Footer with timestamp

### Example Email

```html
⚠️ Drift Alert
Semantic Drift Alerts

Summary
5 drift events detected on December 15, 2025 at 9:00 AM

• CRITICAL: 0
• HIGH: 2
• MEDIUM: 2
• LOW: 1

Events

[🟠] technical-context/architecture.md
HIGH - semantic

Documentation says PostgreSQL but code uses SQLite

💡 Update architecture.md to reflect actual database usage

[... more events ...]
```

### Email Providers

#### Gmail

```bash
export SMTP_SERVER="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASSWORD="your-app-password"  # Not regular password!
```

#### SendGrid

```bash
export SMTP_SERVER="smtp.sendgrid.net"
export SMTP_PORT="587"
export SMTP_USER="apikey"
export SMTP_PASSWORD="your-sendgrid-api-key"
```

#### Outlook/Office 365

```bash
export SMTP_SERVER="smtp-mail.outlook.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@outlook.com"
export SMTP_PASSWORD="your-password"
```

## Webhook Alerts

### Custom Webhook Format

Webhooks receive JSON payload:

```json
{
  "rule_id": "my-rule",
  "rule_name": "Custom Alert Rule",
  "timestamp": "2025-12-15T09:00:00",
  "event_count": 5,
  "events": [
    {
      "id": "drift-abc123",
      "type": "semantic",
      "severity": "high",
      "source": "technical-context/architecture.md",
      "target": "src/main.py",
      "description": "...",
      "resolution": "..."
    }
  ],
  "context": {}
}
```

### Webhook Integration Examples

#### Microsoft Teams

```bash
# Use Teams Incoming Webhook connector
export WEBHOOK_URL="https://your-org.webhook.office.com/webhookb2/..."
```

#### Discord

```bash
# Add /slack to Discord webhook URL
export WEBHOOK_URL="https://discord.com/api/webhooks/.../slack"
```

#### Custom Service

```python
# Your webhook handler
@app.post("/drift-webhook")
async def handle_drift_alert(payload: dict):
    event_count = payload["event_count"]
    events = payload["events"]

    # Process events
    for event in events:
        if event["severity"] == "critical":
            # Trigger incident response
            pass

    return {"status": "received"}
```

## API Reference

### GET /alerts/rules

Get all configured alert rules.

**Response:**
```json
{
  "total": 3,
  "rules": [...]
}
```

### POST /alerts/rules

Create a new alert rule.

**Request:**
```json
{
  "id": "my-rule",
  "name": "My Rule",
  "enabled": true,
  "min_severity": "high",
  "channels": ["slack"]
}
```

### PUT /alerts/rules/{rule_id}

Update an existing rule.

**Request:**
```json
{
  "enabled": false,
  "min_severity": "critical"
}
```

### DELETE /alerts/rules/{rule_id}

Delete an alert rule.

### POST /alerts/test

Send a test alert.

**Query Params:**
- `channel`: `slack`, `email`, or `webhook`
- `rule_id`: (optional) Specific rule to test

### POST /alerts/send

Manually trigger alerts for current drift.

**Query Params:**
- `min_severity`: (optional) Only alert on drift above this level

**Response:**
```json
{
  "message": "Sent 3 alerts for 5 drift events",
  "events_found": 5,
  "alerts_sent": 3,
  "by_channel": {
    "slack": 2,
    "email": 1,
    "webhook": 0
  }
}
```

### GET /alerts/history

Get recent alert history.

**Query Params:**
- `limit`: Number of records (default: 50)

**Response:**
```json
{
  "total": 10,
  "history": [
    {
      "alert_id": "alert-123",
      "rule_id": "semantic-drift",
      "drift_event_id": "drift-abc",
      "channel": "slack",
      "sent_at": "2025-12-15T09:00:00",
      "success": true,
      "error": null
    }
  ]
}
```

## Automation

### Scheduled Drift Scans

#### Cron (Linux/Mac)

```bash
crontab -e

# Daily at 9am
0 9 * * * curl -X POST http://localhost:8000/alerts/send

# Every 6 hours
0 */6 * * * curl -X POST http://localhost:8000/alerts/send

# Weekly on Monday at 9am
0 9 * * 1 curl -X POST http://localhost:8000/alerts/send
```

#### GitHub Actions

```yaml
name: Drift Detection

on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9am UTC
  workflow_dispatch:  # Manual trigger

jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Run Drift Detection
        run: |
          curl -X POST "${{ secrets.API_URL }}/alerts/send" \
            -H "Authorization: Bearer ${{ secrets.API_TOKEN }}"
```

#### Jenkins

```groovy
pipeline {
    triggers {
        cron('0 9 * * *')  // Daily at 9am
    }
    stages {
        stage('Drift Check') {
            steps {
                sh 'curl -X POST http://api/alerts/send'
            }
        }
    }
}
```

### CI/CD Integration

#### Block PRs on Drift

```yaml
# .github/workflows/pr-check.yml
name: PR Drift Check

on: [pull_request]

jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Check for Drift
        run: |
          DRIFT_COUNT=$(curl -s http://api/coherence/scan | jq '.total')

          if [ "$DRIFT_COUNT" -gt 0 ]; then
            echo "❌ $DRIFT_COUNT drift events detected!"
            echo "Run: curl -X POST http://api/coherence/resolve"
            echo "to get fix recommendations"
            exit 1
          fi

          echo "✅ No drift detected"
```

## Configuration File

Alert rules are stored in `data/alert_config.json`:

```json
{
  "rules": [
    {
      "id": "critical-drift",
      "name": "Critical Drift Alerts",
      "enabled": true,
      "min_severity": "critical",
      "drift_types": [],
      "channels": ["slack"],
      "slack_webhook": "https://hooks.slack.com/...",
      "email_recipients": null,
      "webhook_url": null,
      "cooldown_hours": 1
    }
  ]
}
```

Edit directly or use API endpoints.

## Troubleshooting

### Slack: "Invalid webhook URL"

**Cause:** Webhook URL is incorrect or expired

**Fix:**
1. Verify URL starts with `https://hooks.slack.com/`
2. Regenerate webhook in Slack app settings
3. Update alert rule with new webhook

### Email: "Authentication failed"

**Cause:** SMTP credentials are incorrect

**Fix:**
1. Use app password (not regular password) for Gmail
2. Enable "less secure apps" if required
3. Check SMTP server and port are correct
4. Verify email/password with manual test:
   ```bash
   python -c "import smtplib; s=smtplib.SMTP('smtp.gmail.com', 587); s.starttls(); s.login('email', 'password'); print('Success!')"
   ```

### "No alerts sent"

**Causes:**
- Alert rule is disabled
- Drift severity below threshold
- Cooldown period active
- No drift detected

**Debug:**
1. Check rule is enabled: `GET /alerts/rules`
2. Check drift exists: `POST /coherence/scan`
3. Check alert history: `GET /alerts/history`
4. Test channel: `POST /alerts/test?channel=slack`

### Alerts sent but not received

**Slack:**
- Check webhook URL is for correct channel
- Verify app is installed in workspace
- Check channel permissions

**Email:**
- Check spam folder
- Verify email addresses are correct
- Check SMTP logs for errors

## Best Practices

1. **Start with Slack** - Easier setup than email
2. **Use Cooldowns** - Prevent alert fatigue (12-24 hours recommended)
3. **Filter by Severity** - Don't alert on everything (high+ recommended)
4. **Test First** - Use test endpoints before enabling rules
5. **Monitor History** - Review sent alerts regularly
6. **Gradual Rollout** - Start with one channel, expand later
7. **Set Expectations** - Tell team alerts are coming
8. **Weekly Summaries** - Better than real-time for low-priority drift
9. **Combine with CI/CD** - Block PRs that introduce drift
10. **Review and Adjust** - Tune rules based on team feedback

## Examples

### Example 1: Slack-Only Setup

```bash
# 1. Get Slack webhook
# 2. Set environment variable
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# 3. Enable rule
curl -X PUT "http://localhost:8000/alerts/rules/semantic-drift" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "slack_webhook": "'"$SLACK_WEBHOOK_URL"'"}'

# 4. Test
curl -X POST "http://localhost:8000/alerts/test?channel=slack"

# 5. Schedule (cron)
echo "0 9 * * * curl -X POST http://localhost:8000/alerts/send" | crontab -
```

### Example 2: Multi-Channel Setup

```bash
# Configure both Slack and Email
curl -X POST "http://localhost:8000/alerts/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "multi-channel-alerts",
    "name": "Multi-Channel Drift Alerts",
    "enabled": true,
    "min_severity": "high",
    "drift_types": [],
    "channels": ["slack", "email"],
    "slack_webhook": "https://hooks.slack.com/...",
    "email_recipients": ["team@company.com", "dev@company.com"],
    "cooldown_hours": 24
  }'
```

### Example 3: Critical-Only Alerts

```bash
# Alert immediately on critical drift
curl -X PUT "http://localhost:8000/alerts/rules/critical-drift" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "min_severity": "critical",
    "channels": ["slack", "email"],
    "cooldown_hours": 1
  }'
```

## Roadmap

- ✅ Slack notifications
- ✅ Email alerts
- ✅ Custom webhooks
- ✅ Configurable rules
- ✅ Alert history
- ✅ Test mode
- 🔄 Microsoft Teams integration
- 🔄 PagerDuty integration
- 🔄 Alert templates
- 🔄 Digest mode (batched alerts)
- 🔄 Alert analytics dashboard

---

**Related Documentation:**
- [Semantic Drift Detection](SEMANTIC_DRIFT.md)
- [AI Conflict Resolution](AI_CONFLICT_RESOLUTION.md)
- [Drift Detection](docs/drift-detection.md)
