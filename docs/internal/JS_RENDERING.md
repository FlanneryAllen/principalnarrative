# 🎭 JavaScript Rendering with Playwright

Analyze modern single-page applications (SPAs) built with React, Vue, Angular, and other JavaScript frameworks.

## Why JavaScript Rendering?

**Standard HTTP fetching** works great for traditional server-rendered websites, but modern SPAs often:
- Load content dynamically via JavaScript
- Render components on the client side
- Fetch data via API calls after page load
- Use JavaScript-based routing

**Without JS rendering**, you might see:
- Empty divs and skeleton loaders
- Missing content that loads after page load
- Incomplete testimonials or stats
- Generic SEO meta tags instead of actual content

**With Playwright JS rendering**, you get:
- Fully-rendered HTML after JavaScript execution
- All dynamically-loaded content
- Complete testimonials and proof points
- Real narrative structure as users see it

## Installation

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs Playwright (`playwright>=1.40.0`).

### 2. Install Browser Binaries

```bash
./setup_playwright.sh
```

Or manually:
```bash
python3 -m playwright install chromium
```

**Download size**: ~300MB for Chromium browser

### 3. Verify Installation

```bash
python3 -c "from playwright.sync_api import sync_playwright; print('✅ Playwright ready!')"
```

## Quick Start

### Via Dashboard

1. Start the server:
   ```bash
   ./run_dashboard.sh
   ```

2. Open: http://localhost:8000/dashboard

3. Toggle to "🌐 URL" mode

4. **Check the "🎭 Render JavaScript" checkbox**

5. Enter a SPA website URL:
   ```
   https://react-app.com
   https://vue-example.com
   https://angular-site.com
   ```

6. Click "🔍 Analyze Website"

**Note**: JS rendering takes longer (~10-40 seconds) due to browser startup and rendering time.

### Via API

```bash
curl -X POST http://localhost:8000/website/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "path": "https://react-spa.com",
    "render_js": true,
    "max_pages": 10
  }'
```

### Via Python

```python
from src.services.js_fetcher import JSFetcher
from src.services.website_analyzer import WebsiteAnalyzer

# Fetch with JS rendering
fetcher = JSFetcher(max_pages=10, headless=True)
temp_path = fetcher.fetch_website_sync("https://react-app.com")

# Analyze
analyzer = WebsiteAnalyzer(temp_path)
report = analyzer.analyze()

print(f"Claims: {report['summary']['total_claims']}")
print(f"Proof: {report['summary']['total_proof']}")

# Clean up
fetcher.cleanup()
```

## When to Use JS Rendering

### Use JS Rendering For:
- ✅ React, Vue, Angular, Svelte apps
- ✅ Sites that show loading spinners initially
- ✅ Content that appears after page load
- ✅ Dynamic dashboards and web apps
- ✅ Sites with client-side routing

### Standard Fetch Works For:
- ✅ Traditional server-rendered sites
- ✅ WordPress, Webflow, Squarespace
- ✅ Static HTML sites
- ✅ Most marketing sites
- ✅ Faster analysis (no browser overhead)

**Tip**: If you're unsure, try standard fetch first. If the analysis results look sparse or incomplete, retry with JS rendering enabled.

## How It Works

### 1. Browser Launch
```
Playwright starts Chromium (headless mode)
   ↓
Creates browser context with user agent
   ↓
Ready to render pages
```

### 2. Page Rendering
```
Navigate to URL → Wait for network idle
   ↓
Wait additional 2 seconds for JS execution
   ↓
Extract fully-rendered HTML
   ↓
Save to temp directory
```

### 3. Link Discovery
```
Parse rendered HTML → Find internal links
   ↓
Download up to max_pages (same as standard fetch)
   ↓
Clean up browser and temp files
```

## Configuration

### Headless Mode

**Dashboard**: Always runs headless (no visible browser)

**Python API**:
```python
# Headless (default) - no browser window
fetcher = JSFetcher(headless=True)

# Visible browser (for debugging)
fetcher = JSFetcher(headless=False)
```

### Timeout

Set page load timeout (default: 60 seconds):

```python
fetcher = JSFetcher(timeout=120000)  # 120 seconds in milliseconds
```

### Max Pages

Control how many pages to download:

**Dashboard**: Fixed at 20 pages

**API**:
```json
{
  "path": "https://example.com",
  "render_js": true,
  "max_pages": 15
}
```

**Python**:
```python
fetcher = JSFetcher(max_pages=15)
```

## Performance Comparison

### Standard HTTP Fetch
- Main page: ~1-3 seconds
- Each additional page: ~0.5-2 seconds
- Total for 20 pages: ~10-40 seconds
- Resource usage: Minimal

### JavaScript Rendering (Playwright)
- Browser startup: ~3-5 seconds
- Main page: ~5-10 seconds
- Each additional page: ~3-8 seconds
- Total for 20 pages: ~60-180 seconds
- Resource usage: Higher (browser instance)

**Recommendation**: Use JS rendering only when necessary. For most marketing sites, standard fetch is faster and sufficient.

## Examples

### Analyze React App

```bash
curl -X POST http://localhost:8000/website/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "path": "https://react-marketing-site.com",
    "render_js": true,
    "max_pages": 10
  }'
```

### Analyze Vue Dashboard

```python
from src.services.js_fetcher import JSFetcher
from src.services.website_analyzer import WebsiteAnalyzer

# Fetch Vue app with visible browser for debugging
fetcher = JSFetcher(max_pages=5, headless=False)
temp_path = fetcher.fetch_website_sync("https://vue-dashboard.com")

analyzer = WebsiteAnalyzer(temp_path)
report = analyzer.analyze()

print(f"Personas found: {len(report['personas'])}")
fetcher.cleanup()
```

### Async Usage (Advanced)

```python
import asyncio
from src.services.js_fetcher import JSFetcher

async def analyze_multiple_sites():
    fetcher = JSFetcher(max_pages=10)

    sites = [
        "https://react-site-1.com",
        "https://vue-site-2.com",
        "https://angular-site-3.com"
    ]

    for site in sites:
        temp_path = await fetcher.fetch_website(site)
        print(f"Downloaded: {temp_path}")
        # ... run analysis
        fetcher.cleanup()

asyncio.run(analyze_multiple_sites())
```

## Troubleshooting

### "Playwright not installed"

**Error**:
```
ImportError: Playwright not installed. Install with: pip install playwright && playwright install chromium
```

**Fix**:
```bash
pip install -r requirements.txt
./setup_playwright.sh
```

### "Browser executable not found"

**Error**:
```
playwright._impl._api_types.Error: Executable doesn't exist
```

**Fix**:
```bash
python3 -m playwright install chromium
```

### Page Timeout

**Error**:
```
TimeoutError: page.goto: Timeout 60000ms exceeded
```

**Fix**: Increase timeout
```python
fetcher = JSFetcher(timeout=120000)  # 2 minutes
```

Or reduce max_pages if site is slow:
```python
fetcher = JSFetcher(max_pages=5)
```

### Incomplete Content

**Issue**: Still missing content even with JS rendering

**Possible causes**:
- Content loads after 2-second wait period
- Infinite scroll or lazy loading
- Content behind authentication
- Rate limiting or bot detection

**Fix**: For manual control, use headless=False to see what's rendering:
```python
fetcher = JSFetcher(headless=False, timeout=120000)
```

### Memory Issues

**Issue**: High memory usage during analysis

**Fix**: Reduce max_pages or analyze in batches:
```python
fetcher = JSFetcher(max_pages=5)  # Fewer pages per run
```

## Limitations

### What Works
- ✅ Public SPAs with JavaScript rendering
- ✅ React, Vue, Angular, Svelte apps
- ✅ Client-side routing
- ✅ Dynamically loaded content
- ✅ Most modern web apps

### What Doesn't Work
- ❌ Sites requiring authentication/login
- ❌ Infinite scroll (only initial content)
- ❌ Content behind CAPTCHA
- ❌ Sites with aggressive bot detection
- ❌ WebSocket-dependent real-time data

## Best Practices

1. **Try standard fetch first**: Faster and works for most sites
2. **Use JS rendering for SPAs**: React, Vue, Angular clearly benefit
3. **Start with fewer pages**: Test with max_pages=5 before scaling up
4. **Monitor performance**: JS rendering is slower, plan accordingly
5. **Headless for production**: Only use headless=False for debugging
6. **Clean up temp files**: Always call fetcher.cleanup()

## Security & Privacy

- **Headless browsing**: No GUI displayed in production
- **Temp directories**: Auto-cleaned after analysis
- **No cookies persisted**: Each run starts fresh
- **Read-only**: Only downloads public content
- **User agent**: Standard browser user agent
- **No tracking**: No analytics or session management

## Technical Details

### Browser
- **Engine**: Chromium (via Playwright)
- **Mode**: Headless by default
- **Version**: Latest stable Chromium
- **Download size**: ~300MB

### Rendering Process
1. Launch browser with custom user agent
2. Navigate to URL with 60s timeout
3. Wait for `networkidle` state
4. Wait additional 2 seconds for JS execution
5. Extract `page.content()` (fully rendered HTML)
6. Close page, continue with next URL

### Playwright vs Selenium
- **Playwright**: Modern, faster, better async support
- **Auto-wait**: Built-in waiting for elements
- **Network idle**: Waits for network requests to complete
- **Cross-browser**: Supports Chromium, Firefox, WebKit

## Future Enhancements

- [ ] Support for authenticated pages (login forms)
- [ ] Infinite scroll detection and handling
- [ ] Screenshot capture for visual verification
- [ ] PDF export of rendered pages
- [ ] Custom wait conditions (wait for specific elements)
- [ ] Firefox/WebKit browser options
- [ ] HAR file capture (network traffic analysis)
- [ ] Cookie/session persistence across pages

---

*Built with Playwright - Modern browser automation*
