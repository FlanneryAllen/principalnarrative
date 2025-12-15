# Caching, Historical Tracking & Batch Analysis

## Overview

The Principal Narrative system now includes intelligent caching, historical tracking, and batch analysis capabilities. These features significantly reduce API costs, enable trend analysis, and allow for large-scale website comparisons.

## Features

### 1. **Result Caching** 💾
- **24-hour cache** for all analysis results
- **Automatic cache invalidation** after expiration
- **Force refresh** option to bypass cache
- **SHA256-based cache keys** for unique identification
- **SQLite storage** for fast local access

**Benefits:**
- ⚡ **Instant results** for repeat analyses
- 💰 **Reduced API costs** (especially for AI analysis)
- 🔄 **Automatic background updates**

### 2. **Historical Tracking** 📊
- **Automatic snapshot saving** after every analysis
- **Unlimited history** (never expires)
- **Trend detection** (increasing/decreasing/stable)
- **Change tracking** across all metrics
- **Automatic insights** generation

**Benefits:**
- 📈 **Track narrative evolution** over time
- 🎯 **Identify drift patterns** early
- 💡 **Actionable insights** from AI analysis

### 3. **Batch URL Analysis** 🚀
- **Analyze 2-100 URLs** simultaneously
- **Parallel processing** (5-10 concurrent requests)
- **Progress tracking** in real-time
- **CSV export** of results
- **Intelligent caching** integration

**Benefits:**
- ⏱️ **Save time** analyzing multiple sites
- 📉 **Benchmark** against competitors
- 📊 **Export data** for external analysis

## Quick Start

### Dashboard Access

```bash
# Start the API
./run.sh

# Access dashboards:
# - Batch Analysis: http://localhost:8000/batch
# - Trend Analysis: http://localhost:8000/trends
# - Main Dashboard: http://localhost:8000/dashboard
```

### API Usage

#### Check Cache Status

```bash
# Get cache statistics
curl http://localhost:8000/website/health
```

#### Force Refresh Analysis

```bash
# Bypass cache and run fresh analysis
curl -X POST http://localhost:8000/website/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "path": "https://example.com",
    "force_refresh": true
  }'
```

#### Get Historical Snapshots

```bash
# List recent analyses
curl http://localhost:8000/website/history/recent?limit=20

# Get snapshots for a specific URL
curl "http://localhost:8000/website/history/snapshots/https%3A%2F%2Fexample.com"

# Get trend analysis
curl "http://localhost:8000/website/history/trends/https%3A%2F%2Fexample.com?days=30"
```

#### Batch Analysis

```bash
# Start batch job
curl -X POST http://localhost:8000/website/batch/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com",
      "https://competitor1.com",
      "https://competitor2.com"
    ],
    "analysis_type": "standard",
    "max_pages": 10
  }'

# Check job status
curl http://localhost:8000/website/batch/status/{job_id}

# Get results
curl http://localhost:8000/website/batch/results/{job_id}

# Export as CSV
curl http://localhost:8000/website/batch/export-csv/{job_id} -o results.csv
```

## Architecture

### Database Schema

```sql
-- Analysis cache (24-hour expiration)
CREATE TABLE analysis_cache (
    url_hash TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    analysis_type TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    max_pages INTEGER,
    render_js BOOLEAN
);

-- Historical snapshots (permanent)
CREATE TABLE analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_hash TEXT NOT NULL,
    url TEXT NOT NULL,
    snapshot_date TIMESTAMP NOT NULL,
    total_claims INTEGER,
    total_proof INTEGER,
    total_personas INTEGER,
    proof_ratio REAL,
    overall_score REAL,
    INDEX(url_hash, snapshot_date)
);

-- Batch analysis jobs
CREATE TABLE batch_jobs (
    job_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    total_urls INTEGER NOT NULL,
    completed_urls INTEGER DEFAULT 0,
    failed_urls INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL
);

-- Batch results
CREATE TABLE batch_results (
    job_id TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    total_claims INTEGER,
    total_proof INTEGER,
    FOREIGN KEY(job_id) REFERENCES batch_jobs(job_id)
);
```

### Services

#### CacheService

```python
from src.services.cache_service import get_cache_service

cache = get_cache_service()

# Check cache
result = cache.get_cached_result(url, 'standard', max_pages=20)

# Save to cache
cache.save_result(url, 'standard', analysis_result)

# Get statistics
stats = cache.get_cache_stats()

# Clear expired
cache.clear_expired_cache()
```

#### HistoryService

```python
from src.services.history_service import get_history_service

history = get_history_service()

# Save snapshot
history.save_snapshot(url, 'standard', result)

# Get snapshots
snapshots = history.get_snapshots(url, 'standard', limit=30)

# Analyze trends
trends = history.analyze_trends(url, 'standard', days=30)
```

#### BatchAnalyzer

```python
from src.services.batch_analyzer import get_batch_analyzer
import asyncio

batch = get_batch_analyzer()

# Create job
job_id = batch.create_job(urls, 'standard')

# Run analysis (async)
results = await batch.run_batch_analysis(
    job_id,
    urls,
    'standard',
    max_pages=10
)

# Get status
status = batch.get_job_status(job_id)

# Export CSV
csv = batch.export_results_csv(job_id)
```

## Use Cases

### 1. Cost Optimization

**Problem:** Analyzing the same website multiple times wastes API calls.

**Solution:** Automatic 24-hour caching returns instant results for repeat analyses.

```python
# First analysis - hits API
POST /website/analyze-ai
# Takes 30s, costs $0.10

# Second analysis (within 24 hours) - from cache
POST /website/analyze-ai
# Takes <1s, costs $0.00
```

### 2. Narrative Drift Detection

**Problem:** Website messaging changes over time but you don't notice until it's too late.

**Solution:** Historical tracking + trend analysis identifies drift patterns.

```python
# View trends dashboard
GET /trends

# Shows:
# - Claims decreased by 5 over 30 days ⚠️
# - Proof ratio dropped from 85% to 72% 🚨
# - Last updated: 7 days ago (re-analyze recommended)
```

### 3. Competitive Benchmarking at Scale

**Problem:** Need to analyze 50 competitor websites for market research.

**Solution:** Batch analysis processes multiple URLs in parallel.

```python
# Analyze 50 competitors
POST /website/batch/analyze
{
  "urls": [...50 URLs...],
  "analysis_type": "standard"
}

# Monitor progress
GET /website/batch/status/{job_id}
# Progress: 45/50 (90%)

# Download results
GET /website/batch/export-csv/{job_id}
# → batch_results.csv
```

### 4. Monthly Reporting

**Problem:** Need monthly narrative quality reports for stakeholders.

**Solution:** Historical snapshots + automated insights.

```python
# Get trend analysis for last 90 days
GET /website/history/trends/{url}?days=90

# Returns:
# - 12 snapshots (analyzed weekly)
# - Claims improved +15
# - Score increased +12.3 points
# - 5 auto-generated insights
```

## Configuration

### Cache Duration

Edit `src/services/cache_service.py`:

```python
class CacheService:
    def __init__(self, cache_duration_hours: int = 24):  # ← Change here
        self.cache_duration = timedelta(hours=cache_duration_hours)
```

### Batch Concurrency

Edit `src/services/batch_analyzer.py`:

```python
class BatchAnalyzer:
    def __init__(self, max_concurrent: int = 5):  # ← Change here
        self.max_concurrent = max_concurrent
```

### Database Location

Edit `src/database/schema.py`:

```python
# Default: /data/narrative_analysis.db
db_path = Path(__file__).parent.parent.parent / "data" / "narrative_analysis.db"

# Or specify custom path:
db = Database(db_path=Path("/custom/path/db.sqlite"))
```

## API Reference

### Caching Endpoints

All analysis endpoints automatically use caching:

```
POST /website/analyze
POST /website/analyze-ai
POST /website/compare
```

Request parameters:
- `force_refresh: bool` - Bypass cache (default: false)

Response includes:
- `cache_metadata` - Cache info if from cache
  - `cached: true`
  - `cached_at: "2024-01-15T10:30:00"`
  - `expires_at: "2024-01-16T10:30:00"`

### History Endpoints

```
GET  /website/history/recent
GET  /website/history/snapshots/{url}
GET  /website/history/trends/{url}
```

**GET /website/history/recent**

Query parameters:
- `limit: int` - Max results (default: 20)

Response:
```json
{
  "recent_analyses": [
    {
      "url": "https://example.com",
      "analysis_type": "standard",
      "last_analyzed": "2024-01-15T10:30:00"
    }
  ]
}
```

**GET /website/history/snapshots/{url}**

Query parameters:
- `analysis_type: str` - 'standard' or 'ai' (default: 'standard')
- `limit: int` - Max snapshots (default: 30)

Response:
```json
{
  "snapshots": [
    {
      "id": 1,
      "snapshot_date": "2024-01-15T10:30:00",
      "total_claims": 25,
      "total_proof": 20,
      "overall_score": 82.5
    }
  ]
}
```

**GET /website/history/trends/{url}**

Query parameters:
- `analysis_type: str` - 'standard' or 'ai' (default: 'standard')
- `days: int` - Time range (default: 30)

Response:
```json
{
  "url": "https://example.com",
  "total_snapshots": 5,
  "date_range_days": 30,
  "claims_trend": "increasing",
  "proof_trend": "stable",
  "score_trend": "increasing",
  "claims_change": 5,
  "proof_change": 2,
  "score_change": 8.5,
  "insights": [
    "✅ Claims increased by 5 (20 → 25)",
    "🎉 Overall score improved by 8.5 points!"
  ]
}
```

### Batch Analysis Endpoints

```
POST /website/batch/analyze
GET  /website/batch/status/{job_id}
GET  /website/batch/results/{job_id}
GET  /website/batch/export-csv/{job_id}
```

**POST /website/batch/analyze**

Request:
```json
{
  "urls": ["https://site1.com", "https://site2.com"],
  "analysis_type": "standard",
  "max_pages": 10,
  "render_js": false
}
```

Response:
```json
{
  "job_id": "a1b2c3d4e5f6",
  "status": "pending",
  "total_urls": 2,
  "completed_urls": 0,
  "failed_urls": 0,
  "progress_percent": 0.0
}
```

**GET /website/batch/status/{job_id}**

Response:
```json
{
  "job_id": "a1b2c3d4e5f6",
  "status": "running",
  "total_urls": 2,
  "completed_urls": 1,
  "failed_urls": 0,
  "progress_percent": 50.0,
  "created_at": "2024-01-15T10:30:00",
  "started_at": "2024-01-15T10:30:05"
}
```

**GET /website/batch/results/{job_id}**

Response:
```json
{
  "job_id": "a1b2c3d4e5f6",
  "results": [
    {
      "url": "https://site1.com",
      "status": "success",
      "total_claims": 25,
      "total_proof": 20,
      "overall_score": 82.5,
      "cached": false
    }
  ],
  "summary": {
    "total_urls": 2,
    "successful": 2,
    "failed": 0,
    "from_cache": 1,
    "avg_claims": 24.5,
    "avg_proof": 19.0,
    "avg_score": 80.2
  }
}
```

## Troubleshooting

### Cache Not Working

**Issue:** Results not being cached

**Solutions:**
1. Check database exists: `ls data/narrative_analysis.db`
2. Check cache stats: `GET /website/health`
3. Verify cache table: `sqlite3 data/narrative_analysis.db "SELECT COUNT(*) FROM analysis_cache"`

### Historical Data Missing

**Issue:** No snapshots available

**Solutions:**
1. Run an analysis first (snapshots saved automatically)
2. Check history table: `sqlite3 data/narrative_analysis.db "SELECT COUNT(*) FROM analysis_history"`
3. Verify URL matches exactly (case-sensitive)

### Batch Jobs Stuck

**Issue:** Batch job shows "running" indefinitely

**Solutions:**
1. Check logs for errors
2. Verify network connectivity
3. Restart API server
4. Check job status: `GET /website/batch/status/{job_id}`

### Database Locked

**Issue:** "Database is locked" error

**Solutions:**
1. Close all connections to the database
2. Stop and restart the API
3. Check for multiple API instances running

## Performance

### Cache Hit Rates

Typical cache performance:

- **First analysis**: ~30s (API call)
- **Cached analysis**: <1s (database lookup)
- **Cache hit rate**: ~60-80% for typical usage

### Batch Analysis Speed

Concurrent processing with max_concurrent=5:

- **10 URLs**: ~60s (6s per URL)
- **50 URLs**: ~300s (6s per URL)
- **100 URLs**: ~600s (6s per URL)

With caching (50% hit rate):
- **50 URLs**: ~150s (50% faster)

### Database Size

Approximate storage requirements:

- **Per cached result**: ~50KB
- **Per historical snapshot**: ~5KB
- **Per batch result**: ~10KB

Example:
- 1000 cached results = ~50MB
- 10,000 historical snapshots = ~50MB
- 100 batch jobs (1000 URLs total) = ~10MB

## Best Practices

### 1. Regular Analysis Schedule

```python
# Analyze key pages weekly
schedule.every().monday.at("09:00").do(analyze_homepage)

# Check trends monthly
schedule.every().month.do(generate_trend_report)
```

### 2. Cache Cleanup

```python
# Run daily cleanup job
cache.clear_expired_cache()
```

### 3. Batch Analysis Optimization

```python
# Group similar sites together
ecommerce_sites = [...]
saas_sites = [...]

# Analyze during off-peak hours
run_batch_at_night(ecommerce_sites)
```

### 4. Trend Monitoring

```python
# Set up alerts for significant changes
trends = history.analyze_trends(url, days=7)

if trends.score_change < -10:
    send_alert("Score dropped significantly!")
```

## Future Enhancements

Planned features:

- [ ] **Automatic re-analysis** scheduling
- [ ] **Email notifications** for trend alerts
- [ ] **Webhook integration** for batch completion
- [ ] **Advanced analytics** dashboard
- [ ] **Export to PDF** for trend reports
- [ ] **Comparison views** across time periods

## Related Documentation

- [AI Analysis Guide](AI_ANALYSIS.md)
- [Competitive Analysis Guide](COMPETITIVE_ANALYSIS.md)
- [Dashboard Guide](DASHBOARD.md)
- [Production Deployment](PRODUCTION.md)

---

**Questions?** Open an issue on GitHub or check the API docs at http://localhost:8000/docs
