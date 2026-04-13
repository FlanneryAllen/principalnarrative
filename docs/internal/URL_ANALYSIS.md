# 🌐 Live URL Analysis

Analyze any website on the internet by URL - not just local files!

## Features

### 🚀 Live Website Scraping
- Download and analyze any public website
- Automatically discovers and downloads linked pages
- Configurable page limit (default: 20 pages)
- Smart link filtering (skips images, feeds, etc.)

### 🎯 Automatic Discovery
- Finds internal links on the main page
- Downloads blog posts and subpages
- Preserves website structure in temp directory
- Cleans up automatically after analysis

### 📊 Full Narrative Analysis
All standard analysis features work on live URLs:
- Claims and value propositions
- Proof points (stats, testimonials)
- Customer personas
- Messaging consistency
- Narrative structure

## Quick Start

### Via Dashboard

1. Start the server:
   ```bash
   ./run_dashboard.sh
   ```

2. Open: http://localhost:8000/dashboard

3. Toggle to "🌐 URL" mode

4. Enter any website URL:
   ```
   https://example.com
   https://stripe.com
   https://anthropic.com
   ```

5. Click "🔍 Analyze Website"

### Via API

```bash
curl -X POST http://localhost:8000/website/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "path": "https://example.com",
    "max_pages": 20
  }'
```

### Via Python

```python
from src.services.url_fetcher import URLFetcher
from src.services.website_analyzer import WebsiteAnalyzer

# Fetch website
fetcher = URLFetcher(max_pages=10)
temp_path = fetcher.fetch_website("https://example.com")

# Analyze
analyzer = WebsiteAnalyzer(temp_path)
report = analyzer.analyze()

# Clean up
fetcher.cleanup()
```

## How It Works

### 1. Download Phase
```
User enters URL → Fetch main page → Parse HTML
   ↓
Find internal links (blog, about, etc.)
   ↓
Download up to max_pages (default: 20)
   ↓
Save to temporary directory
```

### 2. Analysis Phase
```
Temp directory created → Same analysis as local files
   ↓
Extract claims, proof, personas
   ↓
Generate insights and recommendations
```

### 3. Cleanup Phase
```
Analysis complete → Return results → Delete temp directory
```

## Configuration

### Page Limit

Control how many pages to download:

**Dashboard**: Updates automatically (20 pages)

**API**:
```json
{
  "path": "https://example.com",
  "max_pages": 10
}
```

**Python**:
```python
fetcher = URLFetcher(max_pages=10)
```

### Timeout

Set request timeout (default: 30 seconds):

```python
fetcher = URLFetcher(timeout=60)
```

## Smart Link Filtering

The fetcher automatically skips:
- ❌ External domains
- ❌ Images, PDFs, downloads
- ❌ RSS feeds and sitemaps
- ❌ Tag/category pages
- ❌ Duplicate URLs
- ✅ Blog posts and content pages

## Examples

### Analyze Stripe's Website
```bash
curl -X POST http://localhost:8000/website/analyze \
  -H "Content-Type: application/json" \
  -d '{"path": "https://stripe.com", "max_pages": 15}'
```

### Analyze Anthropic
```python
from src.services.url_fetcher import URLFetcher
from src.services.website_analyzer import WebsiteAnalyzer

fetcher = URLFetcher(max_pages=20)
temp_path = fetcher.fetch_website("https://anthropic.com")

analyzer = WebsiteAnalyzer(temp_path)
report = analyzer.analyze()

print(f"Claims: {report['summary']['total_claims']}")
print(f"Proof: {report['summary']['total_proof']}")

fetcher.cleanup()
```

## Limitations

### What Works
- ✅ Public websites (no auth required)
- ✅ Static HTML pages
- ✅ Client-rendered content (downloaded as-is)
- ✅ Most modern websites

### What Doesn't Work
- ❌ Sites requiring authentication
- ❌ JavaScript-heavy SPAs (may miss dynamic content)
- ❌ Rate-limited sites (may timeout)
- ❌ Sites blocking scrapers

## Troubleshooting

**Download fails:**
- Check URL is correct and publicly accessible
- Verify site doesn't block scraping
- Increase timeout if site is slow
- Check network connection

**No pages downloaded:**
- Site may have no internal links
- Links may be external only
- JavaScript-based navigation (not HTML links)

**Analysis incomplete:**
- Some pages may fail to download (skipped)
- Increase max_pages if needed
- Check for rate limiting

**Timeout errors:**
- Increase timeout parameter
- Reduce max_pages
- Site may be slow or blocking requests

## Performance

### Speed
- Main page: ~1-3 seconds
- Each additional page: ~0.5-2 seconds
- Total for 20 pages: ~10-40 seconds

### Resource Usage
- Temp directory: ~5-50MB (depends on site)
- Memory: Minimal (pages processed one at a time)
- Network: ~1-5MB per page

## Best Practices

1. **Start small**: Use 5-10 pages for initial testing
2. **Respect sites**: Don't hammer servers with huge page limits
3. **Check robots.txt**: Some sites disallow scraping
4. **Use responsibly**: For research and analysis only
5. **Clean up**: Temp directories are auto-cleaned, but check if errors occur

## Security & Privacy

- **No data stored**: Temp directories deleted after analysis
- **No tracking**: No cookies or session management
- **Read-only**: Only downloads public content
- **HTTPS preferred**: More secure than HTTP
- **User-agent**: Identifies as web client (not hidden)

## Advanced Usage

### Custom Headers

```python
import httpx
from src.services.url_fetcher import URLFetcher

# For sites requiring specific user agents
# (Note: Would need to modify URLFetcher to accept headers)
```

### Selective Page Download

```python
# Download only blog posts
fetcher = URLFetcher(max_pages=50)

# Manually filter links
# (Note: Would need to extend URLFetcher)
```

## Future Enhancements

- [ ] JavaScript rendering (Playwright/Selenium)
- [ ] Authentication support (login forms)
- [ ] Respect robots.txt automatically
- [ ] Rate limiting / throttling
- [ ] Recursive depth control
- [ ] Content-type filtering
- [ ] Sitemap parsing

---

*Built with ❤️ by Principal Narrative Agent*
