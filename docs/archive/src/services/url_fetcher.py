"""
URL Fetcher

Downloads and caches website content for analysis.
"""

import httpx
import tempfile
from pathlib import Path
from typing import Optional, Dict, List
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import re


class URLFetcher:
    """Fetches and caches website content from URLs"""

    def __init__(self, timeout: int = 30, max_pages: int = 20):
        self.timeout = timeout
        self.max_pages = max_pages
        self.temp_dir: Optional[Path] = None
        self.downloaded_urls: List[str] = []

    def fetch_website(self, url: str) -> Path:
        """
        Fetch a website and save to temp directory

        Args:
            url: Website URL to fetch

        Returns:
            Path to temporary directory containing downloaded site
        """
        print(f"🌐 Fetching website: {url}")

        # Create temp directory
        self.temp_dir = Path(tempfile.mkdtemp(prefix="narrative_"))
        print(f"  📁 Temp directory: {self.temp_dir}")

        # Parse base URL
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"

        # Fetch main page
        main_html = self._fetch_url(url)
        if not main_html:
            raise ValueError(f"Failed to fetch {url}")

        # Save main page as index.html
        index_path = self.temp_dir / "index.html"
        index_path.write_text(main_html, encoding='utf-8')
        self.downloaded_urls.append(url)

        print(f"  ✅ Downloaded main page")

        # Find and download linked pages (blog posts, about, etc.)
        soup = BeautifulSoup(main_html, 'html.parser')
        internal_links = self._find_internal_links(soup, base_url, url)

        print(f"  🔗 Found {len(internal_links)} internal links")

        # Download linked pages (limit to max_pages)
        blog_dir = self.temp_dir / "blog"
        blog_dir.mkdir(exist_ok=True)

        downloaded_count = 0
        for link in internal_links[:self.max_pages - 1]:  # -1 for main page
            if downloaded_count >= self.max_pages - 1:
                break

            try:
                link_html = self._fetch_url(link)
                if link_html:
                    # Generate filename from URL
                    filename = self._url_to_filename(link)
                    filepath = blog_dir / filename

                    filepath.write_text(link_html, encoding='utf-8')
                    self.downloaded_urls.append(link)
                    downloaded_count += 1

                    print(f"  ✅ Downloaded: {filename}")
            except Exception as e:
                print(f"  ⚠️  Failed to download {link}: {e}")

        print(f"\n✅ Downloaded {len(self.downloaded_urls)} pages total")
        return self.temp_dir

    def _fetch_url(self, url: str) -> Optional[str]:
        """Fetch HTML content from URL"""
        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                response = client.get(url)
                response.raise_for_status()
                return response.text
        except Exception as e:
            print(f"  ❌ Error fetching {url}: {e}")
            return None

    def _find_internal_links(self, soup: BeautifulSoup, base_url: str, current_url: str) -> List[str]:
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


if __name__ == "__main__":
    # Test with a real website
    fetcher = URLFetcher(max_pages=5)

    # Test URL
    test_url = "https://example.com"

    try:
        temp_path = fetcher.fetch_website(test_url)
        print(f"\n✅ Website downloaded to: {temp_path}")
        print(f"📄 Files: {list(temp_path.rglob('*.html'))}")

        # Clean up
        # fetcher.cleanup()
    except Exception as e:
        print(f"❌ Error: {e}")
