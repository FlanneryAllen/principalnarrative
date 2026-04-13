file# AI-Powered Conflict Resolution

Uses **Claude AI** to analyze drift events and generate **specific, actionable fix recommendations** with exact code changes, documentation updates, and priority rankings.

## Overview

Traditional drift detection tells you *what's wrong*. AI-powered resolution tells you *exactly how to fix it*.

### What You Get

- **Specific Actions**: "Update line 42 in architecture.md: replace 'PostgreSQL' with 'SQLite'"
- **Before/After Snippets**: See exactly what to change
- **Priority Rankings**: Fix high-impact issues first
- **Effort Estimates**: Know if it's "5 minutes" or "2 hours"
- **Quick Wins**: Easy fixes with immediate value
- **Business Impact**: Understand why each fix matters

## Quick Start

### Prerequisites

```bash
# Requires Claude API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Or add to .env file
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
```

Get your API key from: https://console.anthropic.com

### API Call

```bash
# Generate AI resolution plan
curl -X POST "http://localhost:8000/coherence/resolve"

# Get as markdown (human-readable)
curl -X POST "http://localhost:8000/coherence/resolve?format=markdown"

# Only high-severity drifts
curl -X POST "http://localhost:8000/coherence/resolve?min_severity=high"
```

### Python Usage

```python
from services.drift_detector import DriftDetector
from services.ai_conflict_resolver import AIConflictResolver

# Detect drift
detector = DriftDetector()
drift_events = detector.run_full_scan(include_semantic=True)

# Generate AI resolution plan
resolver = AIConflictResolver()
plan = resolver.resolve_drift_events(drift_events)

# Access recommendations
for rec in plan.recommendations:
    print(f"{rec.priority}: {rec.specific_action}")
    print(f"Effort: {rec.estimated_effort}")
    print(f"File: {rec.file_path}")
```

### CLI Test

```bash
# Run interactive test
python test_ai_resolution.py
```

## Example Output

### JSON Response

```json
{
  "total_drifts": 5,
  "estimated_total_effort": "2 hours",
  "summary": "Found 5 drift events: 2 doc-code mismatches, 2 tech stack inconsistencies, 1 contradiction. Priority: fix architecture.md first.",
  "quick_wins_count": 2,
  "quick_wins": ["drift-abc123", "drift-def456"],
  "recommendations": [
    {
      "drift_event_id": "drift-abc123",
      "priority": "high",
      "business_impact": "Documentation incorrectly states we use PostgreSQL, but codebase uses SQLite. This confuses new developers and could lead to wrong architectural decisions.",
      "resolution_type": "doc_update",
      "specific_action": "Update technical-context/architecture.md line 42 to reflect actual database usage",
      "before_snippet": "We use PostgreSQL for all data persistence",
      "after_snippet": "We use SQLite for local data persistence with plans to migrate to PostgreSQL in production",
      "file_path": "technical-context/architecture.md",
      "line_numbers": "42",
      "estimated_effort": "5 minutes",
      "rationale": "Quick documentation fix that prevents confusion. Update single line to match reality."
    }
  ]
}
```

### Markdown Export

```markdown
# Drift Resolution Plan

**Generated:** 2025-01-15 14:30:00
**Total Drifts:** 5
**Estimated Effort:** 2 hours

## Summary

Found 5 drift events across documentation and code:
- 2 documentation-to-code mismatches (architecture docs outdated)
- 2 technology stack inconsistencies (FastAPI not documented)
- 1 cross-document contradiction (vision vs marketing messaging)

**Recommended Priority:** Fix architecture.md first (affects onboarding), then resolve messaging contradiction.

## 🎯 Quick Wins (Fix These First!)

These 2 issues can be resolved quickly for immediate impact:

- **technical-context/architecture.md**: Update database reference from PostgreSQL to SQLite (5 minutes)
- **technical-context/stack.md**: Add FastAPI to documented tech stack (10 minutes)

## 📋 All Recommendations

### 1. 🟠 technical-context/architecture.md

**Priority:** HIGH
**Effort:** 5 minutes
**Type:** doc_update

**Business Impact:**
Documentation incorrectly states we use PostgreSQL, but codebase uses SQLite. This confuses new developers and could lead to wrong architectural decisions.

**Action Required:**
Update line 42 in technical-context/architecture.md to accurately reflect current database usage.

**Before:**
```
We use PostgreSQL for all data persistence and complex queries.
```

**After:**
```
We use SQLite for local data persistence with plans to migrate to PostgreSQL for production deployment.
```

**Why:** Quick documentation fix that prevents developer confusion. Simply update one line to match current implementation.

---

### 2. 🟡 technical-context/stack.md

**Priority:** MEDIUM
**Effort:** 10 minutes
**Type:** doc_update

**Business Impact:**
Code extensively uses FastAPI framework but it's not mentioned in official tech stack documentation. This creates incomplete onboarding materials.

**Action Required:**
Add FastAPI to the documented technology stack with brief description of its role.

**After:**
```markdown
### Web Framework
- **FastAPI**: Modern Python web framework for building APIs
  - Used for all REST endpoints
  - Automatic OpenAPI documentation
  - High performance with async support
```

**Why:** Complete the tech stack documentation to help new developers understand our architecture. Low effort, high value for onboarding.

---
```

## Features

### 1. Specific Code/Doc Changes

AI analyzes the drift and provides exact text to change:

```python
rec.before_snippet = "We use PostgreSQL for persistence"
rec.after_snippet = "We use SQLite for local persistence"
rec.file_path = "technical-context/architecture.md"
rec.line_numbers = "42"
```

### 2. Business Impact Assessment

Understands *why* drift matters:

```
"This confuses new developers and could lead to wrong architectural decisions."
"Creates inconsistent customer messaging across channels."
"Undocumented technology makes maintenance harder."
```

### 3. Priority Ranking

Sorts fixes by impact, not just severity:

- **Critical**: Strategic contradictions, security issues
- **High**: Developer onboarding, customer-facing docs
- **Medium**: Internal documentation gaps
- **Low**: Nice-to-have improvements

### 4. Effort Estimation

Realistic time estimates:

- "5 minutes" - Single line change
- "30 minutes" - Multiple file updates
- "2 hours" - Requires code refactoring
- "1 day" - Architectural change needed

### 5. Quick Wins Identification

Finds high-value, low-effort fixes:

```json
"quick_wins": ["drift-abc123", "drift-def456"],
"quick_wins_count": 2
```

These are perfect for immediate action and quick morale boost.

### 6. Resolution Types

Categorizes fixes:

- **doc_update**: Documentation changes only
- **code_change**: Code modifications required
- **process_change**: Workflow or policy updates

## Use Cases

### Use Case 1: Onboarding New Developers

**Problem:** Architecture docs say "PostgreSQL" but code uses "SQLite"

**AI Resolution:**
```json
{
  "priority": "high",
  "business_impact": "New developers waste time setting up wrong database",
  "specific_action": "Update architecture.md line 42",
  "before_snippet": "PostgreSQL for all persistence",
  "after_snippet": "SQLite for local dev, PostgreSQL for production",
  "estimated_effort": "5 minutes"
}
```

### Use Case 2: Marketing-Vision Contradiction

**Problem:** Vision doc says "developer-first" but marketing says "non-technical teams"

**AI Resolution:**
```json
{
  "priority": "critical",
  "business_impact": "Inconsistent messaging confuses customers and internal teams",
  "specific_action": "Reconcile target audience: Update vision.md to clarify we serve both technical and non-technical users with different products",
  "estimated_effort": "1 hour",
  "rationale": "Need stakeholder discussion to align on positioning"
}
```

### Use Case 3: Undocumented Technology

**Problem:** Code uses FastAPI extensively, not mentioned in tech docs

**AI Resolution:**
```json
{
  "priority": "medium",
  "business_impact": "Incomplete tech stack knowledge for hiring and onboarding",
  "specific_action": "Add FastAPI section to stack.md with usage details",
  "after_snippet": "### FastAPI\\n- REST API framework\\n- Auto OpenAPI docs\\n- Used in: main API, webhooks",
  "estimated_effort": "15 minutes"
}
```

## API Reference

### POST /coherence/resolve

Generate AI-powered resolution plan for all detected drift.

**Query Parameters:**
- `min_severity` (optional): `low`, `medium`, `high`, `critical`
- `format` (optional): `json` (default) or `markdown`
- `include_context` (optional): Include file content for better recommendations

**Response (JSON):**
```json
{
  "total_drifts": 5,
  "estimated_total_effort": "2 hours",
  "summary": "Overall assessment...",
  "quick_wins_count": 2,
  "quick_wins": ["id1", "id2"],
  "priority_order": ["id1", "id2", "id3", "id4", "id5"],
  "recommendations": [...]
}
```

**Response (Markdown):**
```json
{
  "format": "markdown",
  "content": "# Drift Resolution Plan\\n\\n..."
}
```

### Python API

```python
# Initialize
resolver = AIConflictResolver(api_key="sk-ant-...")

# Resolve all drifts
plan = resolver.resolve_drift_events(drift_events)

# Resolve single drift with context
rec = resolver.resolve_single_drift(
    drift_event=event,
    include_code_context=True
)

# Export plan
markdown = resolver.export_resolution_plan(plan, format="markdown")
json_str = resolver.export_resolution_plan(plan, format="json")
```

## Configuration

### Model Selection

Default: `claude-sonnet-4-20250514`

Change in `ai_conflict_resolver.py`:
```python
self.model = "claude-sonnet-4-20250514"  # or claude-opus-4, etc.
```

### Context Window

Read file context for better recommendations:

```python
resolver.resolve_single_drift(
    drift_event=event,
    include_code_context=True  # Reads actual file content
)
```

Adjust context size:
```python
def _read_file_context(self, file_path: str, max_lines: int = 50):
    # Change max_lines to control context size
```

## Performance

### API Costs

Using Claude Sonnet 4:

- **Single drift**: ~$0.01 (500-1000 tokens)
- **Batch (10 drifts)**: ~$0.05 (2000-4000 tokens)
- **Batch (50 drifts)**: ~$0.15 (8000-12000 tokens)

### Response Time

- **Single drift**: 2-5 seconds
- **Batch (10 drifts)**: 5-10 seconds
- **Batch (50 drifts)**: 15-30 seconds

### Optimization Tips

1. **Filter by severity** to reduce API calls:
   ```bash
   POST /coherence/resolve?min_severity=high
   ```

2. **Batch resolutions** instead of one-by-one:
   ```python
   plan = resolver.resolve_drift_events(all_drifts)  # Better than loop
   ```

3. **Cache plans** for repeated analysis:
   ```python
   plan_json = resolver.export_resolution_plan(plan, format="json")
   # Save to file, reuse for 24 hours
   ```

## Workflow Integration

### CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Check Drift and Generate Fixes
  run: |
    curl -X POST "http://api/coherence/resolve?format=markdown" > drift-plan.md
    if [ -s drift-plan.md ]; then
      # Post to Slack, create PR comment, etc.
      gh pr comment $PR_NUMBER --body-file drift-plan.md
    fi
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for drift
DRIFT_COUNT=$(curl -s "http://localhost:8000/coherence/scan" | jq '.total')

if [ "$DRIFT_COUNT" -gt 0 ]; then
    echo "⚠️  $DRIFT_COUNT drift events detected!"
    echo "Run: curl -X POST http://localhost:8000/coherence/resolve"
    echo "to get AI-powered fix recommendations"
fi
```

### Scheduled Scans

Weekly drift resolution report:

```bash
#!/bin/bash
# cron: 0 9 * * MON  # Every Monday 9am

curl -X POST "http://localhost:8000/coherence/resolve?format=markdown" \
  > "drift-reports/$(date +%Y-%m-%d)-resolution.md"

# Send to team via Slack, email, etc.
```

## Troubleshooting

### "AI conflict resolver unavailable"

**Cause:** Missing or invalid ANTHROPIC_API_KEY

**Fix:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# or add to .env file
```

### "Failed to parse AI response"

**Cause:** Claude returned non-JSON response

**Fix:** Usually temporary. Retry the request. If persistent, check API status.

### "Recommendations seem generic"

**Cause:** Not enough context provided

**Fix:**
```bash
# Include file context
POST /coherence/resolve?include_context=true
```

### "Estimated effort seems off"

**Cause:** AI estimates are approximate

**Fix:** Estimates improve with feedback. Consider them guidelines, not guarantees.

## Best Practices

1. **Review Before Applying**: AI suggestions are recommendations, not commands
2. **Start with Quick Wins**: Build momentum with easy fixes
3. **Batch Similar Changes**: Group doc updates, code changes separately
4. **Track Patterns**: If AI repeatedly flags same issue, fix root cause
5. **Export as Markdown**: Easier to review, commit, share with team
6. **Run Regularly**: Weekly or bi-weekly drift checks prevent accumulation
7. **Prioritize by Business Impact**: Not all drift is equal
8. **Combine with Manual Review**: AI + human judgment = best results

## Roadmap

- ✅ Single drift AI resolution
- ✅ Batch drift resolution plan
- ✅ Priority ranking & quick wins
- ✅ Markdown export for human review
- ✅ Business impact assessment
- 🔄 Auto-apply low-risk fixes (in progress)
- 🔄 Pull request generation
- 🔄 Historical tracking (drift reduction over time)
- 🔄 Custom prompts for domain-specific fixes
- 🔄 Multi-language support (Go, TypeScript, etc.)

## Examples

See working examples in:
- **test_ai_resolution.py** - Interactive CLI test
- **POST /coherence/resolve** - API endpoint
- **drift-resolutions/** - Example exported plans

---

**Related Documentation:**
- [Semantic Drift Detection](SEMANTIC_DRIFT.md)
- [Drift Detection](docs/drift-detection.md)
- [Coherence Scoring](docs/coherence.md)
