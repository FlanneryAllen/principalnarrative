# 📊 Narrative Analysis Dashboard

Visual web interface for analyzing website narrative structure.

## Quick Start

### 1. Start the Server

```bash
./run_dashboard.sh
```

Or manually:

```bash
uvicorn src.main:app --reload
```

### 2. Open the Dashboard

Visit: **http://localhost:8000/dashboard**

## Features

### 📊 Visual Analytics

- **Stats Overview**: Total claims, proof points, personas, proof ratio
- **Consistency Gauge**: 0-100 score with visual indicator
- **Claim Validation**: Progress bars showing evidence backing
- **Issue Tracking**: Categorized by severity (high/medium/low)

### 🎯 Narrative Insights

- **Claims Analysis**: Value propositions and features identified
- **Proof Validation**: Which claims have supporting evidence
- **Persona Cards**: Customer testimonials with attribution
- **Consistency Issues**: Messaging alignment across pages

### 🔍 Interactive Analysis

1. Enter website path (local directory)
2. Click "Analyze Website"
3. View real-time results with:
   - Animated charts and gauges
   - Issue categorization
   - Actionable recommendations

## API Endpoints

The dashboard uses these API endpoints:

- `POST /website/analyze` - Analyze website narrative
- `GET /dashboard` - Serve dashboard HTML
- `GET /docs` - API documentation

## Example Analysis

**CodePilot Website** (`/Users/julieallen/Desktop/codepilot-example-website`):

Results:
- ✅ 22 claims identified
- ✅ 24 proof points found
- ✅ 8 customer personas extracted
- ✅ 77% of claims backed by evidence
- ✅ 95/100 consistency score

Issues Found:
- ⚠️ 5 claims need additional evidence
- 🟡 Value proposition messaging could be more aligned

## Dashboard Components

### Stats Cards
- Total claims (value props + features)
- Proof points (stats + testimonials)
- Customer personas
- Proof ratio percentage

### Consistency Gauge
Circular gauge showing messaging alignment:
- 90-100: Excellent
- 70-89: Good
- 50-69: Needs work
- <50: Major issues

### Issues Lists
Color-coded by severity:
- 🔴 High - Critical messaging problems
- 🟡 Medium - Alignment issues
- 🟢 Low - Minor polish needed

### Persona Cards
Customer profile cards showing:
- Name and avatar (initials)
- Role/title
- Company
- Associated testimonial

## Customization

Edit `static/website-dashboard.html` to customize:
- Color scheme (CSS variables)
- Chart types and layouts
- Sections displayed
- Analysis thresholds

## Troubleshooting

**Dashboard won't load:**
- Check server is running on port 8000
- Verify `static/website-dashboard.html` exists
- Check browser console for errors

**Analysis fails:**
- Verify website path exists and is readable
- Check that HTML files are in the directory
- Look for errors in API response

**No data showing:**
- Ensure website has HTML files with content
- Check that analysis completed successfully
- Refresh page and try again

## Development

### Adding New Metrics

1. Update `website_analyzer.py` to extract metric
2. Add to API response in `website_routes.py`
3. Add display element to dashboard HTML
4. Update JavaScript to populate element

### Adding New Visualizations

1. Add HTML/CSS for chart container
2. Add JavaScript function to render chart
3. Call from `displayDashboard()` function
4. Test with sample data

## Future Enhancements

- [ ] Chart.js integration for better charts
- [ ] Export reports as PDF
- [ ] Compare multiple websites
- [ ] Historical tracking / trends
- [ ] Real-time website monitoring
- [ ] Competitive analysis views

---

*Built with ❤️ by Principal Narrative Agent*
