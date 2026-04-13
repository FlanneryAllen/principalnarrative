# Drift Analytics Dashboard

Real-time visualization of drift trends, severity patterns, and problem areas. Track how your narrative documentation drifts over time and monitor resolution progress.

## Overview

The Drift Analytics Dashboard provides:
- **Historical Tracking**: Automatic snapshots after each drift scan
- **Trend Analysis**: Identify if drift is increasing, decreasing, or stable
- **Visual Charts**: Interactive graphs powered by Chart.js
- **Problem Identification**: Heatmap showing which documents have most drift
- **Resolution Monitoring**: Track how quickly drift is being fixed

## Quick Start

### 1. Run Your First Drift Scan

The dashboard tracks drift over time, so you need at least one scan to see data:

```bash
# Run a drift scan (pattern-based + semantic)
curl -X POST "http://localhost:8000/coherence/scan"
```

Every scan automatically records a snapshot for analytics.

### 2. Open the Dashboard

```bash
# Visit the dashboard
open http://localhost:8000/drift-dashboard

# Or if API is running on different port
open http://localhost:8000/drift-dashboard
```

### 3. Understand the Metrics

The dashboard shows 4 key stats:

| Metric | Description |
|--------|-------------|
| **Current Drift Events** | Total drift detected in latest scan |
| **30-Day Trend** | Direction: INCREASING, DECREASING, or STABLE |
| **Resolution Rate** | % of drift events that were resolved |
| **Total Snapshots** | Number of historical scans tracked |

## Dashboard Sections

### 1. Stats Cards

Top row shows real-time metrics:

```
┌──────────────────────┐  ┌──────────────────────┐
│ Current Drift Events │  │ 30-Day Trend         │
│        12            │  │   INCREASING         │
│ ↑ +3 this week       │  │ +5 this month        │
└──────────────────────┘  └──────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│ Resolution Rate      │  │ Total Snapshots      │
│      67.5%           │  │        24            │
│ ↑ Better             │  │ Historical data      │
└──────────────────────┘  └──────────────────────┘
```

### 2. Drift Trend Over Time

Line chart showing drift by severity over past 30 days:
- **Critical** (red): Contradictions, critical misalignments
- **High** (orange): Unverified claims, major gaps
- **Medium** (yellow): Minor inconsistencies
- **Low** (blue): Style variations

**Use Case**: Spot when drift spikes occurred and correlate with code changes.

### 3. Severity Breakdown

Doughnut chart showing current distribution:
- Critical: 2 events
- High: 5 events
- Medium: 3 events
- Low: 2 events

**Use Case**: Prioritize which severity levels need immediate attention.

### 4. Drift Types

Bar chart showing drift by category:
- `semantic`: Documentation contradictions, code drift
- `proof`: Claims without verified metrics
- `messaging`: Voice/tone violations
- `naming`: Forbidden terminology
- `promise_delivery`: Marketing unshipped features
- `opportunity_silence`: Shipped features not marketed

**Use Case**: Identify which types of drift are most common.

### 5. Document Heatmap

List of most problematic files with visual bars:

```
[12] technical-context/architecture.md     ████████████
[8]  src/main.py                          ████████
[5]  strategy/vision.md                   █████
[3]  brand-voice.md                       ███
```

**Use Case**: Focus fixes on high-drift documents first.

## API Endpoints

The dashboard pulls data from these endpoints:

### GET /drift/analytics/summary

Overview metrics for dashboard.

**Response:**
```json
{
  "current_drift": 12,
  "last_scan": "2025-12-15T10:30:00",
  "trend_7d": {
    "direction": "increasing",
    "change": 3
  },
  "trend_30d": {
    "direction": "increasing",
    "change": 5
  },
  "severity_breakdown": {
    "critical": 2,
    "high": 5,
    "medium": 3,
    "low": 2
  },
  "type_breakdown": {
    "semantic": 6,
    "proof": 3,
    "messaging": 2,
    "naming": 1
  },
  "resolution_rate": 67.5,
  "total_snapshots": 24
}
```

### GET /drift/analytics/timeseries?days=30

Time-series data for trend chart.

**Query Params:**
- `days`: Number of days to include (default: 30)

**Response:**
```json
{
  "data": [
    {
      "timestamp": "2025-11-15T09:00:00",
      "date": "2025-11-15",
      "total": 8,
      "critical": 1,
      "high": 3,
      "medium": 2,
      "low": 2
    },
    {
      "timestamp": "2025-11-16T09:00:00",
      "date": "2025-11-16",
      "total": 10,
      "critical": 2,
      "high": 4,
      "medium": 2,
      "low": 2
    }
  ]
}
```

### GET /drift/analytics/heatmap

Document-level drift counts.

**Response:**
```json
{
  "documents": [
    {
      "path": "technical-context/architecture.md",
      "drift_count": 12,
      "percentage": 50.0
    },
    {
      "path": "src/main.py",
      "drift_count": 8,
      "percentage": 33.3
    }
  ],
  "max_drift": 12,
  "total_documents": 5
}
```

### GET /drift/analytics/types

Drift type distribution.

**Response:**
```json
{
  "current": {
    "semantic": 6,
    "proof": 3,
    "messaging": 2,
    "naming": 1
  },
  "total": 12,
  "types": [
    {
      "type": "semantic",
      "count": 6,
      "percentage": 50.0
    },
    {
      "type": "proof",
      "count": 3,
      "percentage": 25.0
    }
  ]
}
```

### GET /drift/analytics/severity

Severity breakdown with historical comparison.

**Response:**
```json
{
  "current": {
    "critical": 2,
    "high": 5,
    "medium": 3,
    "low": 2
  },
  "previous": {
    "critical": 1,
    "high": 4,
    "medium": 3,
    "low": 1
  },
  "changes": {
    "critical": 1,
    "high": 1,
    "medium": 0,
    "low": 1
  }
}
```

### GET /drift/analytics/trends?period=30d

Detailed trend analysis.

**Query Params:**
- `period`: `7d`, `30d`, or `90d`

**Response:**
```json
{
  "period": "30d",
  "start_date": "2025-11-15T00:00:00",
  "end_date": "2025-12-15T00:00:00",
  "total_change": 5,
  "trend_direction": "increasing",
  "severity_trends": {
    "critical": "increasing",
    "high": "stable",
    "medium": "decreasing",
    "low": "stable"
  },
  "most_problematic_docs": [
    "technical-context/architecture.md",
    "src/main.py",
    "strategy/vision.md"
  ],
  "resolution_rate": 67.5
}
```

## Understanding Trends

### Trend Direction

Calculated based on drift change over period:

- **INCREASING**: Drift grew by 3+ events
- **DECREASING**: Drift reduced by 3+ events
- **STABLE**: Change is less than 3 events

### Resolution Rate

Percentage of drift events that were resolved:

```
Resolution Rate = (Resolved Events / Total Events) × 100
```

Higher is better. Tracks how effectively your team is fixing drift.

### 7-Day vs 30-Day Trends

- **7-Day**: Short-term trend (good for sprint tracking)
- **30-Day**: Long-term trend (good for quarterly reviews)

If 7-day and 30-day trends differ, it indicates recent change in drift velocity.

## Workflow Integration

### Daily Monitoring

```bash
# Add to morning standup routine
curl -X POST "http://localhost:8000/coherence/scan" && \
open http://localhost:8000/drift-dashboard
```

### Weekly Review

```bash
# Check 7-day trend
curl "http://localhost:8000/drift/analytics/trends?period=7d"

# If increasing, run AI resolution
curl -X POST "http://localhost:8000/coherence/resolve" \
  -H "Content-Type: application/json" \
  -d '{"export_format": "markdown"}' > drift_fixes.md
```

### Monthly Reports

```bash
# Export 30-day data
curl "http://localhost:8000/drift/analytics/timeseries?days=30" > monthly_drift.json

# Get problem areas
curl "http://localhost:8000/drift/analytics/heatmap" | jq '.documents[:5]'
```

### Automated Tracking

Schedule periodic scans with cron:

```bash
crontab -e

# Daily at 9am
0 9 * * * curl -X POST http://localhost:8000/coherence/scan

# Weekly report (Monday 9am)
0 9 * * 1 curl http://localhost:8000/drift/analytics/summary | mail -s "Weekly Drift Report" team@company.com
```

## Data Management

### Storage

Snapshots are stored in `data/drift_analytics/snapshots.json`:

```json
{
  "snapshots": [
    {
      "timestamp": "2025-12-15T09:00:00",
      "total_drifts": 12,
      "by_severity": { "critical": 2, "high": 5, "medium": 3, "low": 2 },
      "by_type": { "semantic": 6, "proof": 3, "messaging": 2, "naming": 1 },
      "by_document": {
        "technical-context/architecture.md": 12,
        "src/main.py": 8
      },
      "events": [...]
    }
  ],
  "last_updated": "2025-12-15T10:30:00"
}
```

### Cleanup Old Data

Automatically remove snapshots older than 90 days:

```bash
# Via Python
from src.services.drift_analytics import DriftAnalytics

analytics = DriftAnalytics()
analytics.clear_old_snapshots(days=90)  # Keep last 90 days
```

Or configure retention in your deployment:

```python
# In scheduled job
drift_analytics.clear_old_snapshots(days=30)  # Keep 30 days
```

### Manual Snapshot

Force a snapshot without running full scan:

```python
from src.services.drift_analytics import DriftAnalytics
from src.services.drift_detector import DriftDetector

analytics = DriftAnalytics()
detector = DriftDetector()

# Get current drift
events = detector.scan()

# Record manually
analytics.record_snapshot(events)
```

## Customization

### Dashboard Refresh Rate

Edit `static/drift-dashboard.html`:

```javascript
// Change auto-refresh interval (default: 5 minutes)
setInterval(loadDashboard, 5 * 60 * 1000);  // 5 minutes
setInterval(loadDashboard, 15 * 60 * 1000); // 15 minutes
setInterval(loadDashboard, 60 * 60 * 1000); // 1 hour
```

### Chart Colors

Customize severity colors in dashboard:

```javascript
// In static/drift-dashboard.html
backgroundColor: [
  '#dc2626',  // Critical - change to your brand color
  '#ea580c',  // High
  '#ca8a04',  // Medium
  '#2563eb'   // Low
]
```

### Trend Thresholds

Adjust what counts as "increasing" vs "stable" in `src/services/drift_analytics.py`:

```python
# Current: 3-event threshold
if abs(total_change) < 3:
    trend_direction = "stable"

# More sensitive (1-event threshold)
if abs(total_change) < 1:
    trend_direction = "stable"
```

## Troubleshooting

### "No data available"

**Cause:** No drift scans have been run yet

**Fix:**
```bash
curl -X POST "http://localhost:8000/coherence/scan"
# Then refresh dashboard
```

### Dashboard shows old data

**Cause:** Browser cache or dashboard hasn't refreshed

**Fix:**
1. Click "🔄 Refresh Data" button
2. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
3. Clear browser cache

### Charts not rendering

**Cause:** Chart.js library failed to load

**Fix:**
1. Check browser console for errors
2. Verify internet connection (Chart.js loads from CDN)
3. Check if using ad blocker that blocks CDN

### API errors in console

**Cause:** Backend is not running or endpoints are failing

**Fix:**
```bash
# Check API is running
curl http://localhost:8000/health

# Check drift data exists
curl http://localhost:8000/drift/analytics/summary

# Restart API
./run.sh
```

## Best Practices

1. **Run Regular Scans**: Daily scans provide best trend data
2. **Monitor Trends**: Focus on direction (increasing/decreasing), not absolute numbers
3. **Use Heatmap**: Fix high-drift documents first for maximum impact
4. **Track Resolution Rate**: Aim for >80% resolution rate
5. **Compare Periods**: Use 7-day for sprints, 30-day for planning
6. **Alert on Spikes**: Combine with drift alerts to catch sudden increases
7. **Document Fixes**: When drift decreases, note what worked
8. **Share Dashboard**: Make it visible to whole team
9. **Set Goals**: e.g., "Reduce critical drift to 0 by end of sprint"
10. **Clean Old Data**: Remove snapshots >90 days to keep dashboard fast

## Example Workflow

### Sprint Planning

```bash
# Monday: Check last sprint's drift
curl "http://localhost:8000/drift/analytics/trends?period=7d"

# Review heatmap - which docs had most drift?
curl "http://localhost:8000/drift/analytics/heatmap"

# Add fixes to sprint backlog
# Run resolution recommendations
curl -X POST "http://localhost:8000/coherence/resolve" \
  -H "Content-Type: application/json" \
  -d '{"export_format": "markdown"}' > sprint_fixes.md
```

### Daily Standup

```bash
# Check if drift increased overnight
curl "http://localhost:8000/drift/analytics/summary" | jq '.trend_7d'

# If increasing, investigate
curl "http://localhost:8000/coherence/drift"
```

### Sprint Review

```bash
# Compare start vs end of sprint
curl "http://localhost:8000/drift/analytics/trends?period=14d"

# Calculate improvement
# Start: 15 drift events
# End: 8 drift events
# Improvement: 47% reduction 🎉
```

## Integration with Other Features

### With AI Conflict Resolution

```bash
# 1. Check dashboard to see drift trend
open http://localhost:8000/drift-dashboard

# 2. If drift is high, get AI recommendations
curl -X POST "http://localhost:8000/coherence/resolve" \
  -H "Content-Type: application/json" \
  -d '{"export_format": "json"}' > fixes.json

# 3. Implement fixes

# 4. Run new scan to see improvement
curl -X POST "http://localhost:8000/coherence/scan"

# 5. Check dashboard - drift should decrease
```

### With Drift Alerts

```bash
# Configure alert when drift increases
curl -X PUT "http://localhost:8000/alerts/rules/trend-alert" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "min_severity": "medium",
    "channels": ["slack"],
    "cooldown_hours": 24
  }'

# Alert will fire when dashboard shows increasing trend
```

## Roadmap

- ✅ Historical drift tracking
- ✅ Trend analysis (7d, 30d)
- ✅ Interactive charts
- ✅ Document heatmap
- ✅ Resolution rate tracking
- 🔄 Drill-down views (click chart to filter)
- 🔄 Export dashboard as PDF
- 🔄 Custom date ranges
- 🔄 Compare two time periods
- 🔄 Drift velocity (events per day)
- 🔄 Predictive trends (forecast future drift)
- 🔄 Team-level attribution
- 🔄 Integration with issue trackers

---

**Related Documentation:**
- [Semantic Drift Detection](SEMANTIC_DRIFT.md)
- [AI Conflict Resolution](AI_CONFLICT_RESOLUTION.md)
- [Drift Alerts](DRIFT_ALERTS.md)
