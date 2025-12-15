# 🤖 AI-Enhanced Narrative Analysis

Deep narrative intelligence powered by Claude API.

## Overview

The AI-enhanced analyzer uses Claude to go far beyond pattern matching, providing:
- **Smarter claim extraction** with strength scoring (0-100)
- **Narrative gap detection** - what's missing or weak
- **Automated recommendations** - actionable next steps
- **Tone & voice analysis** - consistency across pages
- **Value proposition scoring** - rate each claim's effectiveness

## Why AI Enhancement?

**Standard Analysis**:
- Pattern-based extraction (headers, bold text, etc.)
- Rule-based validation
- Fixed scoring formulas
- Good for basic insights

**AI-Enhanced Analysis**:
- Understands context and semantics
- Identifies implicit claims
- Detects subtle inconsistencies
- Generates custom recommendations
- Scores based on marketing best practices
- **10x more insightful**

## Prerequisites

### 1. Claude API Key

```bash
# Get your API key from: https://console.anthropic.com
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or add to `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### 2. Verify Setup

```bash
# Check API key is configured
python3 -c "import os; print('✅ API key configured' if os.getenv('ANTHROPIC_API_KEY') else '❌ No API key')"
```

## Quick Start

### Via Dashboard

1. Start the server:
   ```bash
   ./run_dashboard.sh
   ```

2. Open: http://localhost:8000/dashboard

3. **Check "🤖 AI-Enhanced Analysis"**

4. Enter website path or URL

5. Click "🔍 Analyze Website"

**Note**: AI analysis takes 30-90 seconds due to multiple Claude API calls.

### Via API

```bash
curl -X POST http://localhost:8000/website/analyze-ai \
  -H "Content-Type: application/json" \
  -d '{
    "path": "https://example.com",
    "max_pages": 20
  }'
```

### Via Python

```python
from src.services.ai_narrative_analyzer import AINavrativeAnalyzer
from pathlib import Path

# Analyze website
analyzer = AINavrativeAnalyzer(Path("/path/to/website"))
result = analyzer.analyze()

print(f"Overall Narrative Score: {result.overall_narrative_score}/100")
print(f"AI Claims Found: {len(result.ai_claims)}")
print(f"Narrative Gaps: {len(result.narrative_gaps)}")
print(f"Tone: {result.tone_analysis.primary_tone}")

# Get top recommendations
for rec in result.recommendations[:5]:
    print(f"  • {rec}")
```

## Features

### 1. AI-Powered Claim Extraction

Intelligently identifies and scores all value propositions, features, and benefits.

**Output**:
```python
AIClaim(
    text="50% faster deployments",
    type="benefit",           # value_prop, feature, benefit, differentiator
    strength=85,              # 0-100: How compelling?
    category="performance",   # product, pricing, team, security, etc.
    location="homepage",
    has_proof=True,
    proof_strength=70,        # 0-100: How strong is evidence?
    recommendations=[
        "Add specific customer case study",
        "Show before/after metrics"
    ]
)
```

**What it detects**:
- Primary value propositions
- Feature claims
- Benefits and outcomes
- Differentiators
- Implicit/subtle claims (not just headers)

### 2. Narrative Gap Identification

Finds what's missing or weak in your story.

**Gap Types**:
- `missing_proof` - Claims without evidence
- `weak_claim` - Vague or generic statements
- `missing_customer_voice` - No testimonials
- `tone_mismatch` - Inconsistent messaging
- `missing_cta` - Unclear next steps
- `unaddressed_objection` - Common concerns not handled

**Output**:
```python
NarrativeGap(
    gap_type="missing_proof",
    severity="high",          # low, medium, high, critical
    description="Claim about '50% faster' lacks supporting evidence",
    location="homepage hero",
    recommendation="Add case study or benchmark data",
    impact="Reduces credibility of main value prop"
)
```

### 3. Tone & Voice Analysis

Analyzes consistency of messaging tone across your site.

**Output**:
```python
ToneAnalysis(
    primary_tone="conversational",     # technical, formal, aspirational, bold, etc.
    consistency_score=75,              # 0-100
    audience="technical",              # technical, business, mixed
    emotion="confident",               # confident, cautious, bold, neutral, friendly
    variations=[
        {"page": "homepage", "tone": "bold and aspirational"},
        {"page": "pricing", "tone": "more cautious and detailed"}
    ],
    recommendations=[
        "Make pricing page match homepage confidence",
        "Add more personality to blog posts"
    ]
)
```

### 4. Value Proposition Scoring

Rates the effectiveness of your main value props.

**Scoring Dimensions**:
- **Clarity** (0-100): Is it immediately clear what this means?
- **Specificity** (0-100): Specific or vague?
- **Proof** (0-100): How well supported?
- **Differentiation** (0-100): Unique or generic?
- **Overall** (0-100): Combined strength

**Output**:
```python
ValuePropScore(
    claim="50% faster deployments",
    clarity_score=90,
    specificity_score=80,
    proof_score=60,
    differentiation_score=70,
    overall_score=75,
    strengths=["Specific percentage", "Clear benefit"],
    weaknesses=["Needs case study", "Compared to what?"],
    improvement_suggestions=[
        "Add customer testimonial",
        "Specify baseline comparison"
    ]
)
```

### 5. Automated Recommendations

Top actionable insights prioritized by impact.

**Example**:
```
1. [HIGH] Add case study for homepage '50% faster' claim
2. Make pricing page match homepage confidence level
3. Strengthen 'Enterprise-grade security': Add compliance badges
4. Add proof points for 8 high-strength claims
5. Address common objection: "How does this integrate?"
```

### 6. Overall Narrative Score

Comprehensive 0-100 score combining:
- Claim strength (30%)
- Gap penalty (30%)
- Tone consistency (20%)
- Value prop effectiveness (20%)

**Score Guide**:
- **90-100**: Exceptional narrative, minor tweaks only
- **75-89**: Strong narrative, a few gaps to address
- **60-74**: Decent narrative, several improvements needed
- **45-59**: Weak narrative, major gaps present
- **Below 45**: Poor narrative, significant work needed

## API Response

### POST /website/analyze-ai

**Request**:
```json
{
  "path": "https://example.com",
  "generate_report": true,
  "max_pages": 20,
  "render_js": false
}
```

**Response**:
```json
{
  "ai_claims": [
    {
      "text": "50% faster deployments",
      "type": "benefit",
      "strength": 85,
      "category": "performance",
      "location": "homepage",
      "has_proof": true,
      "proof_strength": 70,
      "recommendations": ["Add case study"]
    }
  ],
  "narrative_gaps": [
    {
      "gap_type": "missing_proof",
      "severity": "high",
      "description": "Main value prop lacks evidence",
      "location": "hero section",
      "recommendation": "Add customer testimonial",
      "impact": "Reduces credibility"
    }
  ],
  "tone_analysis": {
    "primary_tone": "conversational",
    "consistency_score": 75,
    "audience": "technical",
    "emotion": "confident",
    "variations": [...],
    "recommendations": [...]
  },
  "value_prop_scores": [
    {
      "claim": "50% faster deployments",
      "clarity_score": 90,
      "specificity_score": 80,
      "proof_score": 60,
      "differentiation_score": 70,
      "overall_score": 75,
      "strengths": [...],
      "weaknesses": [...],
      "improvement_suggestions": [...]
    }
  ],
  "recommendations": [
    "[HIGH] Add case study for main claim",
    "Strengthen social proof section",
    ...
  ],
  "overall_narrative_score": 72.5,
  "summary": {
    "total_ai_claims": 15,
    "high_strength_claims": 9,
    "total_gaps": 8,
    "critical_gaps": 2,
    "tone_consistency": 75,
    "avg_value_prop_score": 68,
    "overall_narrative_score": 72.5
  }
}
```

## Dashboard Display

When AI analysis is enabled, the dashboard shows:

### Stats Cards
- **Total AI Claims**: All claims found by AI
- **High-Strength Claims**: Claims scoring 70+
- **Narrative Gaps**: Issues identified
- **Overall Score**: 0-100 narrative strength

### Consistency Gauge
- Shows **Tone Consistency Score** (instead of generic consistency)
- Based on actual tone analysis across pages

### Claim Validation
- Shows percentage of **high-strength** claims
- Validates claims against AI scoring

### Critical Gaps
- Displays high/critical severity gaps
- Includes AI recommendations for each

### Tone Variations
- Shows page-by-page tone differences
- Recommendations for improving consistency

### AI Recommendations Section
- Top 10 actionable insights
- Prioritized by impact
- Specific, not generic advice

## Performance

### Speed
- Standard analysis: ~5-15 seconds
- AI-enhanced analysis: ~30-90 seconds

**Why slower?**
- Multiple Claude API calls
- Deep semantic analysis
- Complex reasoning and scoring

**Optimization tips**:
- Use standard analysis for quick checks
- Use AI analysis for deep audits
- Reduce `max_pages` to speed up URL analysis

### Cost

Claude API pricing (as of 2025):
- Input: ~$3 per million tokens
- Output: ~$15 per million tokens

**Typical analysis**:
- Small website (5 pages): ~$0.05-0.15
- Medium website (20 pages): ~$0.20-0.50
- Large website (50+ pages): ~$0.50-1.50

**Cost control**:
- Limit `max_pages` for URLs
- Cache results for repeat analysis
- Use standard analysis when budget-conscious

## Comparison: Standard vs AI

| Feature | Standard | AI-Enhanced |
|---------|----------|-------------|
| Claim Detection | Pattern-based | Context-aware |
| Strength Scoring | No | 0-100 per claim |
| Gap Identification | No | Yes, with severity |
| Tone Analysis | No | Yes, detailed |
| Value Prop Scoring | No | Multi-dimensional |
| Recommendations | Generic | Specific, actionable |
| Speed | Fast (~10s) | Slower (~60s) |
| Cost | Free | ~$0.20 per site |
| API Key Required | No | Yes |

## Use Cases

### Marketing Team Audit
```bash
# Quarterly narrative review
curl -X POST http://localhost:8000/website/analyze-ai \
  -H "Content-Type: application/json" \
  -d '{"path": "https://yourcompany.com", "max_pages": 30}'
```

**Output**: Comprehensive gaps, tone issues, weak claims

### Competitive Analysis
```python
# Compare your site to competitors
from src.services.ai_narrative_analyzer import AINavrativeAnalyzer

sites = [
    ("Your Site", "/path/to/your/site"),
    ("Competitor A", "https://competitor-a.com"),
    ("Competitor B", "https://competitor-b.com")
]

for name, path in sites:
    analyzer = AINavrativeAnalyzer(path)
    result = analyzer.analyze()
    print(f"\n{name}:")
    print(f"  Score: {result.overall_narrative_score:.1f}/100")
    print(f"  Tone: {result.tone_analysis.primary_tone}")
    print(f"  Gaps: {len([g for g in result.narrative_gaps if g.severity == 'critical'])}")
```

### Content Review Before Launch
```bash
# Analyze staging site before going live
./run_dashboard.sh

# Open dashboard, paste staging URL, enable AI
# Review gaps and recommendations
# Fix critical issues before launch
```

### Website Redesign Validation
```python
# Before/after comparison
before = AINavrativeAnalyzer("/old-site-backup").analyze()
after = AINavrativeAnalyzer("/new-site").analyze()

print(f"Score change: {before.overall_narrative_score:.1f} → {after.overall_narrative_score:.1f}")
print(f"Gaps reduced: {len(before.narrative_gaps)} → {len(after.narrative_gaps)}")
```

## Troubleshooting

### "RuntimeError: Claude API not available"

**Cause**: ANTHROPIC_API_KEY not set

**Fix**:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# Or add to .env file
```

### "503: Service Unavailable"

**Cause**: API key missing or invalid

**Fix**:
1. Verify API key is correct
2. Check API key has credits
3. Visit https://console.anthropic.com

### AI analysis takes too long

**Cause**: Large website with many pages

**Fix**:
```json
{
  "path": "https://example.com",
  "max_pages": 10  // Reduce from 20
}
```

### "Rate limit exceeded"

**Cause**: Too many API calls too fast

**Fix**:
- Wait 60 seconds between analyses
- Upgrade Claude API tier
- Implement caching (future enhancement)

### Results seem inaccurate

**Possible causes**:
- Website has very little content
- Content is behind JavaScript (use `render_js: true`)
- Site structure is unusual

**Debug**:
```python
# Check what content AI is seeing
analyzer = AINavrativeAnalyzer(path)
content = analyzer._extract_content_for_ai()
print(content)  # Verify this looks correct
```

## Best Practices

### 1. Start with Standard, Upgrade to AI

```bash
# Quick check first
curl -X POST http://localhost:8000/website/analyze ...

# Deep dive with AI if needed
curl -X POST http://localhost:8000/website/analyze-ai ...
```

### 2. Use AI for Important Pages

Don't AI-analyze your entire 100-page site. Focus on:
- Homepage
- Product/feature pages
- Pricing page
- Key landing pages

### 3. Act on Critical Gaps First

```python
result = analyzer.analyze()

critical = [g for g in result.narrative_gaps if g.severity == 'critical']
for gap in critical:
    print(f"🔴 {gap.description}")
    print(f"   Fix: {gap.recommendation}\n")
```

### 4. Track Score Over Time

```python
# Save results to compare later
import json
from datetime import datetime

result = analyzer.analyze()
snapshot = {
    "date": datetime.now().isoformat(),
    "score": result.overall_narrative_score,
    "gaps": len(result.narrative_gaps),
    "tone_consistency": result.tone_analysis.consistency_score
}

with open("narrative_history.json", "a") as f:
    f.write(json.dumps(snapshot) + "\n")
```

### 5. Combine with Competitor Analysis

```python
# Your site vs top 3 competitors
competitors = {
    "You": "https://yoursite.com",
    "Competitor A": "https://competitor-a.com",
    "Competitor B": "https://competitor-b.com",
    "Competitor C": "https://competitor-c.com"
}

results = {}
for name, url in competitors.items():
    analyzer = AINavrativeAnalyzer(url)
    results[name] = analyzer.analyze()

# Compare scores
for name, result in results.items():
    print(f"{name}: {result.overall_narrative_score:.1f}/100")
```

## Future Enhancements

Planned improvements:

- [ ] **Caching**: Store AI results to avoid re-analysis costs
- [ ] **Historical tracking**: Built-in score tracking over time
- [ ] **A/B testing**: Compare two versions of a page
- [ ] **Multi-site comparison**: Side-by-side competitor dashboard
- [ ] **Custom prompts**: Override AI prompts for specific industries
- [ ] **Export reports**: PDF/CSV export of AI insights
- [ ] **Scheduled analysis**: Weekly/monthly automated audits
- [ ] **Slack/Email alerts**: Notify when score drops

## Support

**Issues**:
- GitHub: https://github.com/FlanneryAllen/principalnarrative/issues
- Check API docs: http://localhost:8000/docs

**Documentation**:
- Dashboard: [DASHBOARD.md](DASHBOARD.md)
- URL Analysis: [URL_ANALYSIS.md](URL_ANALYSIS.md)
- JS Rendering: [JS_RENDERING.md](JS_RENDERING.md)

---

*Powered by Claude - Deep narrative intelligence at your fingertips*
