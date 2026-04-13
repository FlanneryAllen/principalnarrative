"""
JavaScript-Enabled Website Fetcher

Uses Playwright to render JavaScript-heavy websites (SPAs).
"""

import asyncio
from pathlib import Path
from typing import Optional, List
from urllib.parse import urlparse, urljoin
import re
import tempfile


class JSFetcher:
    """Fetches websites with JavaScript rendering using Playwright"""

    def __init__(self, timeout: int = 60000, max_pages: int = 20, headless: bool = True):
        """
        Initialize JS-enabled fetcher

        Args:
            timeout: Page load timeout in milliseconds (default: 60s)
            max_pages: Maximum number of pages to download
            headless: Run browser in headless mode
        """
        self.timeout = timeout
        self.max_pages = max_pages
        self.headless = headless
        self.temp_dir: Optional[Path] = None
        self.downloaded_urls: List[str] = []
        self.playwright = None
        self.browser = None

    async def fetch_website(self, url: str) -> Path:
        """
        Fetch a JavaScript-heavy website

        Args:
            url: Website URL to fetch

        Returns:
            Path to temporary directory containing downloaded site
        """
        print(f"🎭 Fetching website with JavaScript rendering: {url}")

        # Create temp directory
        self.temp_dir = Path(tempfile.mkdtemp(prefix="narrative_js_"))
        print(f"  📁 Temp directory: {self.temp_dir}")

        try:
            # Import playwright here to avoid import errors if not installed
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                # Launch browser
                print(f"  🌐 Launching browser (headless={self.headless})...")
                browser = await p.chromium.launch(headless=self.headless)
                context = await browser.new_context(
                    user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                )

                # Fetch main page
                main_html = await self._fetch_page(context, url)
                if not main_html:
                    raise ValueError(f"Failed to fetch {url}")

                # Save main page
                index_path = self.temp_dir / "index.html"
                index_path.write_text(main_html, encoding='utf-8')
                self.downloaded_urls.append(url)

                print(f"  ✅ Downloaded main page")

                # Find internal links
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(main_html, 'html.parser')
                parsed = urlparse(url)
                base_url = f"{parsed.scheme}://{parsed.netloc}"
                internal_links = self._find_internal_links(soup, base_url, url)

                print(f"  🔗 Found {len(internal_links)} internal links")

                # Download linked pages
                blog_dir = self.temp_dir / "blog"
                blog_dir.mkdir(exist_ok=True)

                downloaded_count = 0
                for link in internal_links[:self.max_pages - 1]:
                    if downloaded_count >= self.max_pages - 1:
                        break

                    try:
                        link_html = await self._fetch_page(context, link)
                        if link_html:
                            filename = self._url_to_filename(link)
                            filepath = blog_dir / filename

                            filepath.write_text(link_html, encoding='utf-8')
                            self.downloaded_urls.append(link)
                            downloaded_count += 1

                            print(f"  ✅ Downloaded: {filename}")
                    except Exception as e:
                        print(f"  ⚠️  Failed to download {link}: {e}")

                await browser.close()

            print(f"\n✅ Downloaded {len(self.downloaded_urls)} pages total with JS rendering")
            return self.temp_dir

        except ImportError:
            raise ImportError(
                "Playwright not installed. Install with: pip install playwright && playwright install chromium"
            )
        except Exception as e:
            print(f"❌ Error during JS fetch: {e}")
            raise

    async def _fetch_page(self, context, url: str) -> Optional[str]:
        """Fetch a page with JavaScript rendering"""
        try:
            page = await context.new_page()

            # Navigate and wait for network to be idle
            await page.goto(url, timeout=self.timeout, wait_until='networkidle')

            # Wait a bit for any additional JS to execute
            await page.wait_for_timeout(2000)

            # Get rendered HTML
            html = await page.content()

            await page.close()
            return html

        except Exception as e:
            print(f"  ❌ Error fetching {url}: {e}")
            return None

    def _find_internal_links(self, soup, base_url: str, current_url: str) -> List[str]:
        """Find internal links on the page"""
        links = set()
        current_parsed = urlparse(current_url)

        for a in soup.find_all('a', href=True):
            href = a['href']

            # Convert relative URLs to absolute
            absolute_url = urljoin(current_url, href)
            parsed = urlparse(absolute_url)

            # Only include links from same domain
            if parsed.netloc == current_parsed.netloc:
                # Clean URL (remove fragments)
                clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                if parsed.query:
                    clean_url += f"?{parsed.query}"

                # Skip common non-content URLs
                skip_patterns = [
                    r'/tag/', r'/category/', r'/author/',
                    r'/feed', r'/rss', r'/sitemap',
                    r'\.(jpg|png|gif|pdf|zip|css|js)$',
                    r'#', r'mailto:', r'tel:'
                ]

                if not any(re.search(pattern, clean_url.lower()) for pattern in skip_patterns):
                    if clean_url != current_url and clean_url not in links:
                        links.add(clean_url)

        return list(links)

    def _url_to_filename(self, url: str) -> str:
        """Convert URL to safe filename"""
        parsed = urlparse(url)
        path = parsed.path.strip('/')

        if not path:
            return "page.html"

        # Replace slashes with underscores
        filename = path.replace('/', '_')

        # Remove special characters
        filename = re.sub(r'[^a-zA-Z0-9_-]', '', filename)

        # Add .html extension if not present
        if not filename.endswith('.html'):
            filename += '.html'

        return filename

    def cleanup(self):
        """Clean up temporary directory"""
        if self.temp_dir and self.temp_dir.exists():
            import shutil
            shutil.rmtree(self.temp_dir)
            print(f"🗑️  Cleaned up temp directory: {self.temp_dir}")

    def fetch_website_sync(self, url: str) -> Path:
        """Synchronous wrapper for fetch_website"""
        return asyncio.run(self.fetch_website(url))


if __name__ == "__main__":
    # Test with a JavaScript-heavy website
    async def test():
        fetcher = JSFetcher(max_pages=3, headless=True)

        # Test with a site that uses JS (example.com is static, but this shows the pattern)
        test_url = "https://example.com"

        try:
            temp_path = await fetcher.fetch_website(test_url)
            print(f"\n✅ Website downloaded to: {temp_path}")
            print(f"📄 Files: {list(temp_path.rglob('*.html'))}")

            # Clean up
            fetcher.cleanup()
        except Exception as e:
            print(f"❌ Error: {e}")

    asyncio.run(test())
