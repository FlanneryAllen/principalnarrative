/**
 * test-url-harvest.js — Tests for URL Harvest Module
 *
 * Run: node --test packages/serve/test-url-harvest.js
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const {
  extractMainContent,
  extractTitle,
  extractPublishDate,
  extractLinks,
  guessSourceType,
  normalizeUrl,
  fetchPage,
  harvestUrl,
  _internals: { hasSkipExtension, isSameDomain, matchesPathPrefix },
} = require('./url-harvest');

// ============================================================================
// Test HTTP Server (serves mock pages for integration tests)
// ============================================================================

let testServer;
let testPort;

before(async () => {
  testServer = http.createServer((req, res) => {
    const url = req.url;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (url === '/') {
      res.end(`<html><head><title>Test Homepage</title></head><body>
        <nav>Navigation here</nav>
        <main>
          <h1>Welcome to TestCorp</h1>
          <p>We are a leading provider of enterprise solutions.</p>
          <p>Our mission is to transform digital workflows.</p>
          <a href="/about">About Us</a>
          <a href="/blog">Blog</a>
          <a href="/products">Products</a>
          <a href="https://external.com/link">External</a>
        </main>
        <footer>Footer content</footer>
      </body></html>`);
    } else if (url === '/about') {
      res.end(`<html><head><title>About TestCorp</title>
        <meta property="article:published_time" content="2026-03-15T10:00:00Z">
      </head><body>
        <h1>About Us</h1>
        <p>Founded in 2020, TestCorp believes in the power of narrative alignment.</p>
        <p>Our values include transparency, innovation, and customer obsession.</p>
        <a href="/about/team">Our Team</a>
        <a href="/about/mission">Our Mission</a>
      </body></html>`);
    } else if (url === '/about/team') {
      res.end(`<html><head><title>Our Team</title></head><body>
        <p>Our leadership team brings decades of enterprise experience.</p>
        <p>The executive team drives our strategic vision forward.</p>
      </body></html>`);
    } else if (url === '/about/mission') {
      res.end(`<html><head><title>Our Mission</title></head><body>
        <p>Our mission is to make organizational truth measurable and maintainable.</p>
      </body></html>`);
    } else if (url === '/blog') {
      res.end(`<html><head><title>TestCorp Blog</title>
        <meta property="article:published_time" content="2025-06-01T10:00:00Z">
      </head><body>
        <h1>Blog</h1>
        <p>Read our latest insights on narrative intelligence and organizational alignment.</p>
        <a href="/blog/post-1">Latest Post</a>
      </body></html>`);
    } else if (url === '/blog/post-1') {
      res.end(`<html><head><title>Blog Post 1</title>
        <meta property="article:published_time" content="2026-04-01T10:00:00Z">
      </head><body>
        <p>This is a blog post about the future of narrative coherence in large organizations.</p>
      </body></html>`);
    } else if (url === '/products') {
      res.end(`<html><head><title>Products</title></head><body>
        <p>Our platform delivers real-time narrative coherence monitoring.</p>
        <p>Features include StoryMining, Resonate, and Clarion.</p>
      </body></html>`);
    } else if (url === '/redirect') {
      res.writeHead(301, { Location: '/about' });
      res.end();
    } else if (url === '/non-html') {
      res.setHeader('Content-Type', 'application/pdf');
      res.end('not html');
    } else if (url === '/slow') {
      // Don't respond — will timeout
    } else if (url === '/empty') {
      res.end('<html><body></body></html>');
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      testPort = testServer.address().port;
      resolve();
    });
  });
});

after(() => {
  if (testServer) testServer.close();
});

// ============================================================================
// extractMainContent
// ============================================================================

describe('extractMainContent', () => {
  it('strips script tags', () => {
    const html = '<p>Hello</p><script>alert("x")</script><p>World</p>';
    const text = extractMainContent(html);
    assert.ok(!text.includes('alert'));
    assert.ok(text.includes('Hello'));
    assert.ok(text.includes('World'));
  });

  it('strips style tags', () => {
    const html = '<style>.foo { color: red; }</style><p>Content here</p>';
    const text = extractMainContent(html);
    assert.ok(!text.includes('color'));
    assert.ok(text.includes('Content here'));
  });

  it('strips nav, footer, header tags', () => {
    const html = '<nav>Skip this</nav><main><p>Keep this</p></main><footer>Skip too</footer>';
    const text = extractMainContent(html);
    assert.ok(!text.includes('Skip this'));
    assert.ok(!text.includes('Skip too'));
    assert.ok(text.includes('Keep this'));
  });

  it('decodes HTML entities', () => {
    const html = '<p>Tom &amp; Jerry &mdash; the classic</p>';
    const text = extractMainContent(html);
    assert.ok(text.includes('Tom & Jerry'));
    assert.ok(text.includes('—'));
  });

  it('collapses excessive whitespace', () => {
    const html = '<p>Hello</p>     <p>World</p>      <p>End</p>';
    const text = extractMainContent(html);
    assert.ok(!text.includes('     '));
  });

  it('handles empty input', () => {
    assert.strictEqual(extractMainContent(''), '');
    assert.strictEqual(extractMainContent(null), '');
    assert.strictEqual(extractMainContent(undefined), '');
  });

  it('preserves paragraph breaks', () => {
    const html = '<p>First paragraph</p><p>Second paragraph</p>';
    const text = extractMainContent(html);
    assert.ok(text.includes('First paragraph'));
    assert.ok(text.includes('Second paragraph'));
  });
});

// ============================================================================
// extractTitle
// ============================================================================

describe('extractTitle', () => {
  it('extracts title from standard HTML', () => {
    assert.strictEqual(extractTitle('<html><head><title>My Page</title></head></html>'), 'My Page');
  });

  it('returns null when no title', () => {
    assert.strictEqual(extractTitle('<html><head></head></html>'), null);
  });

  it('trims whitespace', () => {
    assert.strictEqual(extractTitle('<title>  Spaced Title  </title>'), 'Spaced Title');
  });
});

// ============================================================================
// extractPublishDate
// ============================================================================

describe('extractPublishDate', () => {
  it('extracts from article:published_time meta', () => {
    const html = '<meta property="article:published_time" content="2026-03-15T10:00:00Z">';
    const date = extractPublishDate(html);
    assert.ok(date);
    assert.ok(date.includes('2026-03-15'));
  });

  it('extracts from JSON-LD datePublished', () => {
    const html = '<script type="application/ld+json">{"datePublished": "2026-01-20"}</script>';
    const date = extractPublishDate(html);
    assert.ok(date);
    assert.ok(date.includes('2026-01-20'));
  });

  it('returns null when no date found', () => {
    assert.strictEqual(extractPublishDate('<html><body>No date here</body></html>'), null);
  });
});

// ============================================================================
// extractLinks
// ============================================================================

describe('extractLinks', () => {
  it('extracts absolute links', () => {
    const html = '<a href="https://example.com/page">Link</a>';
    const links = extractLinks(html, 'https://example.com');
    assert.ok(links.includes('https://example.com/page'));
  });

  it('resolves relative links', () => {
    const html = '<a href="/about">About</a>';
    const links = extractLinks(html, 'https://example.com/');
    assert.ok(links.some(l => l.includes('/about')));
  });

  it('skips javascript: and mailto: links', () => {
    const html = '<a href="javascript:void(0)">JS</a><a href="mailto:a@b.com">Mail</a>';
    const links = extractLinks(html, 'https://example.com');
    assert.strictEqual(links.length, 0);
  });

  it('deduplicates links', () => {
    const html = '<a href="/page">A</a><a href="/page">B</a><a href="/page#section">C</a>';
    const links = extractLinks(html, 'https://example.com');
    // /page and /page#section normalize to same (fragment stripped)
    assert.ok(links.length <= 2);
  });
});

// ============================================================================
// guessSourceType
// ============================================================================

describe('guessSourceType', () => {
  it('detects press releases', () => {
    assert.strictEqual(guessSourceType('https://example.com/newsroom/release-1', ''), 'press_release');
    assert.strictEqual(guessSourceType('https://example.com/press/2026', ''), 'press_release');
  });

  it('detects strategy pages', () => {
    assert.strictEqual(guessSourceType('https://example.com/about', ''), 'strategy');
    assert.strictEqual(guessSourceType('https://example.com/mission', ''), 'strategy');
    assert.strictEqual(guessSourceType('https://example.com/values', ''), 'strategy');
  });

  it('detects product pages', () => {
    assert.strictEqual(guessSourceType('https://example.com/products/platform', ''), 'product_doc');
    assert.strictEqual(guessSourceType('https://example.com/features', ''), 'product_doc');
  });

  it('detects investor pages', () => {
    assert.strictEqual(guessSourceType('https://example.com/investors', ''), 'investor');
  });

  it('detects customer stories', () => {
    assert.strictEqual(guessSourceType('https://example.com/case-study/acme', ''), 'customer_story');
  });

  it('falls back to marketing', () => {
    assert.strictEqual(guessSourceType('https://example.com/random', ''), 'marketing');
  });

  it('uses text heuristics when URL is ambiguous', () => {
    assert.strictEqual(
      guessSourceType('https://example.com/page', 'FOR IMMEDIATE RELEASE: Company announces'),
      'press_release'
    );
    assert.strictEqual(
      guessSourceType('https://example.com/page', 'Our mission is to change the world. We believe in innovation.'),
      'strategy'
    );
  });
});

// ============================================================================
// URL Utilities
// ============================================================================

describe('normalizeUrl', () => {
  it('strips fragments', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page#section', 'https://example.com'), 'https://example.com/page');
  });

  it('strips trailing slashes', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page/', 'https://example.com'), 'https://example.com/page');
  });

  it('keeps root slash', () => {
    const normalized = normalizeUrl('https://example.com/', 'https://example.com');
    assert.ok(normalized.endsWith('.com/') || normalized.endsWith('.com'));
  });

  it('returns null for invalid URLs', () => {
    assert.strictEqual(normalizeUrl('not a url', ''), null);
  });
});

describe('hasSkipExtension', () => {
  it('skips PDFs', () => assert.ok(hasSkipExtension('https://example.com/doc.pdf')));
  it('skips images', () => assert.ok(hasSkipExtension('https://example.com/logo.png')));
  it('skips CSS', () => assert.ok(hasSkipExtension('https://example.com/style.css')));
  it('allows HTML pages', () => assert.ok(!hasSkipExtension('https://example.com/about')));
  it('allows pages with no extension', () => assert.ok(!hasSkipExtension('https://example.com/news/latest')));
});

describe('isSameDomain', () => {
  it('matches same domain', () => assert.ok(isSameDomain('https://example.com/a', 'https://example.com/b')));
  it('rejects different domain', () => assert.ok(!isSameDomain('https://a.com', 'https://b.com')));
});

describe('matchesPathPrefix', () => {
  it('matches when prefix matches', () => assert.ok(matchesPathPrefix('https://example.com/about/team', '/about')));
  it('rejects when prefix does not match', () => assert.ok(!matchesPathPrefix('https://example.com/blog/post', '/about')));
  it('allows everything when no prefix', () => assert.ok(matchesPathPrefix('https://example.com/anything', null)));
});

// ============================================================================
// fetchPage (integration — uses test server)
// ============================================================================

describe('fetchPage', () => {
  it('fetches a page and extracts content', async () => {
    const result = await fetchPage(`http://127.0.0.1:${testPort}/`);
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.title, 'Test Homepage');
    assert.ok(result.text.includes('leading provider'));
    assert.ok(result.wordCount > 5);
    assert.ok(result.links.length > 0);
  });

  it('follows redirects', async () => {
    const result = await fetchPage(`http://127.0.0.1:${testPort}/redirect`);
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.title, 'About TestCorp');
  });

  it('handles non-HTML content', async () => {
    const result = await fetchPage(`http://127.0.0.1:${testPort}/non-html`);
    assert.ok(result.error);
    assert.ok(result.error.includes('Non-HTML'));
  });

  it('handles 404', async () => {
    const result = await fetchPage(`http://127.0.0.1:${testPort}/nonexistent`);
    assert.ok(result.error);
    assert.ok(result.error.includes('404'));
  });

  it('extracts publish date', async () => {
    const result = await fetchPage(`http://127.0.0.1:${testPort}/about`);
    assert.ok(result.publishDate);
    assert.ok(result.publishDate.includes('2026-03-15'));
  });
});

// ============================================================================
// harvestUrl (integration — uses test server)
// ============================================================================

describe('harvestUrl', () => {
  it('fetches just the seed page at depth 0', async () => {
    const result = await harvestUrl(`http://127.0.0.1:${testPort}/`, { depth: 0 });
    assert.strictEqual(result.totalFetched, 1);
    assert.strictEqual(result.pages[0].title, 'Test Homepage');
  });

  it('follows links at depth 1', async () => {
    const result = await harvestUrl(`http://127.0.0.1:${testPort}/`, { depth: 1, maxPages: 10 });
    assert.ok(result.totalFetched > 1);
    const urls = result.pages.map(p => p.url);
    assert.ok(urls.some(u => u.includes('/about')));
  });

  it('respects maxPages', async () => {
    const result = await harvestUrl(`http://127.0.0.1:${testPort}/`, { depth: 2, maxPages: 3 });
    assert.ok(result.totalFetched <= 3);
  });

  it('respects pathPrefix', async () => {
    const result = await harvestUrl(`http://127.0.0.1:${testPort}/about`, { depth: 1, maxPages: 10, pathPrefix: '/about' });
    for (const page of result.pages) {
      const pathname = new URL(page.url).pathname;
      assert.ok(pathname.startsWith('/about'), `${pathname} should start with /about`);
    }
  });

  it('filters by date', async () => {
    const result = await harvestUrl(`http://127.0.0.1:${testPort}/blog`, { depth: 1, maxPages: 10, dateAfter: '2026-01-01' });
    // Blog index has date 2025-06-01, should be filtered out
    // Blog post-1 has date 2026-04-01, should be included
    for (const page of result.pages) {
      if (page.publishDate) {
        assert.ok(new Date(page.publishDate) >= new Date('2026-01-01'), `${page.url} has old date ${page.publishDate}`);
      }
    }
  });

  it('skips non-same-domain links', async () => {
    const result = await harvestUrl(`http://127.0.0.1:${testPort}/`, { depth: 1, maxPages: 20 });
    for (const page of result.pages) {
      assert.ok(page.url.includes(`127.0.0.1:${testPort}`), `Should not follow external links: ${page.url}`);
    }
  });

  it('skips pages with very little content', async () => {
    const result = await harvestUrl(`http://127.0.0.1:${testPort}/empty`, { depth: 0 });
    assert.strictEqual(result.totalFetched, 0);
    assert.ok(result.skipped > 0);
  });

  it('handles invalid URLs gracefully', async () => {
    const result = await harvestUrl('not-a-valid-url', { depth: 0 });
    assert.strictEqual(result.totalFetched, 0);
    assert.ok(result.errors.length > 0);
  });

  it('auto-detects source type', async () => {
    const result = await harvestUrl(`http://127.0.0.1:${testPort}/about`, { depth: 0 });
    assert.strictEqual(result.pages[0].sourceType, 'strategy');
  });

  it('calls onProgress callback', async () => {
    const progressCalls = [];
    await harvestUrl(`http://127.0.0.1:${testPort}/`, {
      depth: 0,
      onProgress: (info) => progressCalls.push(info),
    });
    assert.ok(progressCalls.length > 0);
    assert.strictEqual(progressCalls[0].phase, 'fetching');
  });
});
