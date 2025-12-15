# 🔍 Competitive Analysis

Compare your website against competitors side-by-side to identify gaps, strengths, and opportunities.

## Overview

The Competitive Analysis feature analyzes 2-5 websites simultaneously and compares:
- **Claims & Value Propositions**: Who makes more/better claims?
- **Proof Points**: Who has stronger evidence?
- **Customer Testimonials**: Who showcases more social proof?
- **Proof Ratio**: Claims-to-evidence ratio
- **Narrative Gaps**: What are you missing that competitors have?

## Quick Start

### Via Dashboard

1. Start the server:
   ```bash
   ./run_dashboard.sh
   ```

2. Open: http://localhost:8000/competitive

3. Enter sites to compare:
   - **First site**: Your website (used as baseline)
   - **Additional sites**: 1-4 competitors

4. Click "🔍 Compare Sites"

5. Review results:
   - Side-by-side comparison table
   - Visual charts
   - Competitive gaps
   - Your strengths
   - Opportunities

### Via API

```bash
curl -X POST http://localhost:8000/website/compare \
  -H "Content-Type: application/json" \
  -d '{
    "sites": [
      {"name": "Your Site", "url": "/path/to/your/site"},
      {"name": "Competitor A", "url": "https://competitor-a.com"},
      {"name": "Competitor B", "url": "https://competitor-b.com"}
    ],
    "max_pages": 20
  }'
```

### Via Python

```python
from src.services.competitive_analyzer import CompetitiveAnalyzer

sites = [
    {"name": "Your Site", "url": "/path/to/site"},
    {"name": "Competitor A", "url": "https://competitor-a.com"},
    {"name": "Competitor B", "url": "https://competitor-b.com"}
]

analyzer = CompetitiveAnalyzer(max_pages=20)
result = analyzer.analyze_sites(sites)

print(f"Total Gaps: {len(result.gaps)}")
print(f"Your Strengths: {len(result.strengths)}")

# High priority gaps
for gap in [g for g in result.gaps if g.priority == "high"]:
    print(f"[HIGH] {gap.description}")
    print(f"  → {gap.recommendation}")
```

## Features

### 1. Side-by-Side Comparison

Visual table comparing all metrics across sites:

| Site | Claims | Proof Points | Testimonials | Proof Ratio | Pages |
|------|--------|--------------|--------------|-------------|-------|
| Your Site | 22 | 24 | 8 | 109% | 12 |
| Competitor A | 18 | 30 | 5 | 167% | 15 |
| Competitor B | 25 | 20 | 12 | 80% | 18 |

Each metric shows ranking badges (#1, #2, #3) for quick visual comparison.

### 2. Visual Charts

Interactive bar charts showing:
- Claims by site
- Proof points by site
- Testimonials by site

Powered by Chart.js for responsive, interactive visualization.

### 3. Competitive Gaps

Identifies where competitors outperform you:

**Gap Types**:
- `fewer_claims`: Competitor has more value propositions
- `fewer_proof_points`: Competitor has more evidence
- `fewer_personas`: Competitor showcases more testimonials
- `weaker_proof_ratio`: Competitor backs claims better
- `missing_proof_types`: Competitor uses proof types you don't

**Priority Levels**:
- **High**: Significant gap (>10 claims, >15 proof points, etc.)
- **Medium**: Moderate gap (5-10 difference)
- **Low**: Minor gap (<5 difference)

**Example Gap**:
```
[HIGH] Competitor A has 12 more proof points
  vs Competitor A: You (24) vs Them (36)
  💡 Add more statistics, testimonials, or case studies
```

### 4. Your Strengths

Areas where you're ahead of competitors:

Examples:
- ✅ More comprehensive value propositions (22 vs avg 18)
- ✅ Stronger evidence base (24 vs avg 20)
- ✅ More customer testimonials (8 vs avg 6)
- ✅ Better proof-to-claim ratio (109% vs avg 95%)

### 5. Opportunities

Actionable recommendations based on gap analysis:

Examples:
1. Expand value proposition coverage to match Competitor A
2. Add more statistics, testimonials, or case studies
3. Industry standard: Add customer testimonials section
4. All competitors use case studies - consider adding

### 6. Summary Statistics

Quick overview:
- **Sites Analyzed**: Total number of sites
- **Your Claims Rank**: #1, #2, #3, etc.
- **Your Proof Rank**: Ranking for proof points
- **Gaps Identified**: Total competitive gaps
- **High Priority Gaps**: Critical gaps to address

## API Reference

### POST /website/compare

**Request**:
```json
{
  "sites": [
    {"name": "Your Site", "url": "/path/or/url"},
    {"name": "Competitor A", "url": "https://example.com"},
    {"name": "Competitor B", "url": "https://example2.com"}
  ],
  "max_pages": 20,
  "render_js": false
}
```

**Parameters**:
- `sites` (required): Array of 2-5 sites with `name` and `url`
  - First site is considered "your site" for gap analysis
  - URLs can be live websites or local paths
- `max_pages` (optional): Max pages to download per URL (default: 20)
- `render_js` (optional): Use Playwright for SPAs (default: false)

**Response**:
```json
{
  "sites": [
    {
      "name": "Your Site",
      "url": "/path/to/site",
      "total_claims": 22,
      "total_proof": 24,
      "total_personas": 8,
      "proof_ratio": 109.1,
      "consistency_score": 95,
      "pages_analyzed": 12,
      "top_claims": ["Claim 1", "Claim 2", "..."],
      "missing_proof_types": ["award"],
      "unique_strengths": ["Strong customer voice"]
    }
  ],
  "gaps": [
    {
      "gap_type": "fewer_proof_points",
      "description": "Competitor A has 12 more proof points",
      "competitor": "Competitor A",
      "your_value": 24,
      "their_value": 36,
      "recommendation": "Add more statistics, testimonials, or case studies",
      "priority": "high"
    }
  ],
  "strengths": [
    "More comprehensive value propositions (22 vs avg 18)"
  ],
  "opportunities": [
    "Expand value proposition coverage to match Competitor A",
    "Add customer testimonials section"
  ],
  "summary": {
    "total_sites": 3,
    "your_rank_claims": 2,
    "your_rank_proof": 3,
    "your_rank_personas": 1,
    "total_gaps": 5,
    "high_priority_gaps": 2,
    "avg_competitor_claims": 21,
    "avg_competitor_proof": 25
  }
}
```

## Use Cases

### Marketing Team Quarterly Review

Compare your site against top 3 competitors:

```python
sites = [
    {"name": "Your Product", "url": "https://yourproduct.com"},
    {"name": "Market Leader", "url": "https://leader.com"},
    {"name": "Competitor A", "url": "https://comp-a.com"},
    {"name": "Competitor B", "url": "https://comp-b.com"}
]

analyzer = CompetitiveAnalyzer(max_pages=30)
result = analyzer.analyze_sites(sites)

# Generate report
print("QUARTERLY COMPETITIVE ANALYSIS")
print(f"Your Claims Rank: #{result.summary['your_rank_claims']}")
print(f"Your Proof Rank: #{result.summary['your_rank_proof']}")
print(f"\nTop 3 Opportunities:")
for i, opp in enumerate(result.opportunities[:3], 1):
    print(f"{i}. {opp}")
```

### Pre-Launch Validation

Before launching new messaging:

```python
# Compare old vs new site + competitors
sites = [
    {"name": "New Site (Staging)", "url": "https://staging.yoursite.com"},
    {"name": "Current Site", "url": "https://yoursite.com"},
    {"name": "Competitor", "url": "https://competitor.com"}
]

result = analyzer.analyze_sites(sites)

# Check if new site is more competitive
new_site = result.sites[0]
current_site = result.sites[1]

if new_site.total_claims > current_site.total_claims:
    print("✅ New site has more claims")
if new_site.proof_ratio > current_site.proof_ratio:
    print("✅ New site has better proof ratio")
```

### Continuous Monitoring

Monthly competitor tracking:

```bash
# Scheduled cron job
0 9 1 * * cd /app && python -c "
from src.services.competitive_analyzer import CompetitiveAnalyzer
import json
from datetime import datetime

sites = [
    {'name': 'Your Site', 'url': 'https://yoursite.com'},
    {'name': 'Competitor A', 'url': 'https://comp-a.com'},
    {'name': 'Competitor B', 'url': 'https://comp-b.com'}
]

analyzer = CompetitiveAnalyzer()
result = analyzer.analyze_sites(sites)

# Save snapshot
snapshot = {
    'date': datetime.now().isoformat(),
    'your_rank_claims': result.summary['your_rank_claims'],
    'your_rank_proof': result.summary['your_rank_proof'],
    'total_gaps': result.summary['total_gaps']
}

with open('competitive_history.json', 'a') as f:
    f.write(json.dumps(snapshot) + '\n')
"
```

## Dashboard Features

### Input Section

- **Add/Remove Sites**: Dynamic site input with + Add button
- **Site Names**: Custom names for each site
- **URLs or Paths**: Accepts both live URLs and local paths
- **Validation**: Requires 2-5 sites minimum/maximum

### Results Display

1. **Summary Stats**: Quick overview cards
2. **Comparison Table**: Sortable table with rankings
3. **Visual Chart**: Interactive bar chart
4. **Gaps Section**: Priority-coded gap list
5. **Strengths Section**: Green highlighted strengths
6. **Opportunities Section**: Numbered action items

### Interactive Features

- **Hover Effects**: Table rows highlight on hover
- **Responsive Charts**: Chart.js responsive visualization
- **Priority Badges**: Color-coded priority levels
- **Ranking Badges**: Visual rank indicators (#1, #2, #3)

## Performance

### Speed

- **2 sites**: ~20-40 seconds
- **3 sites**: ~30-60 seconds
- **5 sites**: ~60-120 seconds

Depends on:
- Number of pages per site
- Whether JavaScript rendering is enabled
- Website response times

### Resource Usage

- **Memory**: ~100-500MB (temp directories for downloads)
- **Network**: 1-5MB per page downloaded
- **Storage**: Temp directories auto-cleaned after analysis

## Best Practices

### 1. Choose Representative Competitors

```python
# Good: Direct competitors in same category
sites = [
    {"name": "Your Product", "url": "https://yourproduct.com"},
    {"name": "Direct Competitor 1", "url": "https://similar-product-1.com"},
    {"name": "Direct Competitor 2", "url": "https://similar-product-2.com"}
]

# Avoid: Mixing different product categories
# sites = [Your SaaS, Their E-commerce, Different Industry]
```

### 2. Use Consistent Page Counts

```python
# Good: Same max_pages for all sites
analyzer = CompetitiveAnalyzer(max_pages=20)

# Avoid: Don't mix different page counts
# It skews comparison if one site has 5 pages and another has 50
```

### 3. Focus on High-Priority Gaps First

```python
result = analyzer.analyze_sites(sites)

# Fix critical issues first
high_priority = [g for g in result.gaps if g.priority == "high"]
for gap in high_priority:
    print(f"🔴 {gap.description}")
    print(f"   Action: {gap.recommendation}")
```

### 4. Track Changes Over Time

```python
import json
from datetime import datetime

# Run monthly
result = analyzer.analyze_sites(sites)

# Save snapshot
snapshot = {
    "date": datetime.now().isoformat(),
    "your_rank_claims": result.summary["your_rank_claims"],
    "your_rank_proof": result.summary["your_rank_proof"],
    "gaps": len(result.gaps),
    "strengths": len(result.strengths)
}

# Append to history
with open("competitive_history.jsonl", "a") as f:
    f.write(json.dumps(snapshot) + "\n")
```

### 5. Combine with AI Analysis (Future)

```python
# When AI analysis is available
from src.services.ai_narrative_analyzer import AINavrativeAnalyzer

# Deep dive on your site
ai_result = AINavrativeAnalyzer("/path/to/your/site").analyze()

# Compare AI insights with competitive gaps
print(f"AI Overall Score: {ai_result.overall_narrative_score}/100")
print(f"Competitive Rank: #{result.summary['your_rank_claims']}")
```

## Limitations

### What Works
- ✅ Public websites (no authentication)
- ✅ Static HTML sites
- ✅ Local file paths
- ✅ 2-5 sites per comparison

### What Doesn't Work
- ❌ Sites requiring login
- ❌ More than 5 sites at once (API limit)
- ❌ Real-time updating (run manually/scheduled)
- ❌ Historical trend visualization (save data yourself)

## Troubleshooting

### "Please provide at least 2 sites"

**Cause**: Less than 2 sites in request

**Fix**:
```json
{
  "sites": [
    {"name": "Site 1", "url": "..."},
    {"name": "Site 2", "url": "..."}
  ]
}
```

### "Maximum 5 sites allowed"

**Cause**: More than 5 sites in request

**Fix**: Reduce to 5 sites or run multiple comparisons:
```python
# Compare in batches
batch1 = sites[:5]
batch2 = sites[5:10]

result1 = analyzer.analyze_sites(batch1)
result2 = analyzer.analyze_sites(batch2)
```

### Analysis takes too long

**Cause**: Large sites or many pages

**Fix**: Reduce max_pages:
```python
analyzer = CompetitiveAnalyzer(max_pages=10)  # Instead of 20
```

### Some sites fail to analyze

**Cause**: Network issues, blocked scrapers, invalid URLs

**Behavior**: Failed sites show 0 for all metrics
**Fix**:
- Check URL is correct and publicly accessible
- Try again later
- Use local paths if you have site copies

### Results seem inaccurate

**Cause**: Different page counts, SPAs not rendered

**Fix**:
```python
# Enable JS rendering for SPAs
analyzer = CompetitiveAnalyzer(render_js=True)

# Use same max_pages for all
analyzer = CompetitiveAnalyzer(max_pages=15)
```

## Future Enhancements

Planned features:

- [ ] **Export to PDF**: Generate PDF comparison reports
- [ ] **Export to CSV**: Download data as spreadsheet
- [ ] **Historical tracking UI**: Built-in trend charts
- [ ] **AI-enhanced gaps**: Use Claude to identify subtle differences
- [ ] **Automated scheduling**: Weekly/monthly automated runs
- [ ] **Email reports**: Send results to stakeholders
- [ ] **Slack integration**: Post results to channels
- [ ] **More than 5 sites**: Increase limit or batch processing
- [ ] **Radar charts**: Multi-dimensional comparison visualization
- [ ] **Custom metrics**: Add your own comparison dimensions

## Support

**Issues**:
- GitHub: https://github.com/FlanneryAllen/principalnarrative/issues
- API docs: http://localhost:8000/docs

**Related Documentation**:
- [Website Analysis](DASHBOARD.md)
- [URL Analysis](URL_ANALYSIS.md)
- [AI Analysis](AI_ANALYSIS.md)

---

*Built for competitive intelligence and strategic positioning*
