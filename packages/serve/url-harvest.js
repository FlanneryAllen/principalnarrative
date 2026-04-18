/**
 * url-harvest.js — URL-based Narrative Harvest Module
 *
 * Fetches web pages, extracts text content, follows links to configurable depth,
 * and prepares content for StoryMining. Zero external dependencies — Node.js
 * built-in http/https/url modules only.
 *
 * Usage:
 *   const { harvestUrl, fetchPage, extractMainContent, guessSourceType } = require('./url-harvest');
 *   const result = await harvestUrl('https://example.com/about', { depth: 1, maxPages: 20 });
 */

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ============================================================================
// Constants
// ============================================================================

const USER_AGENT = 'NarrativeAgent/1.0 (https://narrativeagent.ai)';
const FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_REDIRECTS = 5;
const MAX_CONCURRENT = 5;
const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB per page
const SKIP_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
  '.css', '.js', '.json', '.xml', '.zip', '.gz', '.tar', '.mp4',
  '.mp3', '.wav', '.woff', '.woff2', '.ttf', '.eot', '.map',
]);

// ============================================================================
// URL Utilities
// ============================================================================

function normalizeUrl(urlStr, baseUrl) {
  try {
    const u = new URL(urlStr, baseUrl);
    // Strip fragment
    u.hash = '';
    // Strip trailing slash (except root)
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return null;
  }
}

function isSameDomain(url1, url2) {
  try {
    return new URL(url1).hostname === new URL(url2).hostname;
  } catch {
    return false;
  }
}

function hasSkipExtension(urlStr) {
  try {
    const pathname = new URL(urlStr).pathname.toLowerCase();
    return [...SKIP_EXTENSIONS].some(ext => pathname.endsWith(ext));
  } catch {
    return true;
  }
}

function matchesPathPrefix(urlStr, prefix) {
  if (!prefix) return true;
  try {
    const pathname = new URL(urlStr).pathname;
    return pathname.startsWith(prefix);
  } catch {
    return false;
  }
}

// ============================================================================
// HTML Content Extraction
// ============================================================================

/**
 * Extract main text content from HTML, stripping navigation, scripts, etc.
 * @param {string} html — Raw HTML string
 * @returns {string} — Clean text content
 */
function extractMainContent(html) {
  if (!html || typeof html !== 'string') return '';

  let text = html;

  // Remove script, style, nav, footer, header, aside, noscript tags and content
  const stripTags = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe', 'svg'];
  for (const tag of stripTags) {
    const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    text = text.replace(re, ' ');
  }

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');

  // Remove all remaining HTML tags but insert newlines for block elements
  const blockTags = /(<\/?(?:div|p|h[1-6]|li|tr|br|section|article|blockquote|figcaption|dt|dd)[^>]*>)/gi;
  text = text.replace(blockTags, '\n');
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#x27;/g, "'");
  text = text.replace(/&#x2F;/g, '/');
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  text = text.replace(/&hellip;/g, '…');
  // Numeric entities
  text = text.replace(/&#(\d+);/g, (_, code) => {
    const c = parseInt(code, 10);
    return c > 31 && c < 127 ? String.fromCharCode(c) : ' ';
  });

  // Collapse whitespace: multiple spaces → single space, multiple newlines → double newline
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n[ \t]*/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Extract page title from HTML.
 * @param {string} html
 * @returns {string|null}
 */
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null;
}

/**
 * Extract publish date from HTML meta tags.
 * @param {string} html
 * @returns {string|null} — ISO date string or null
 */
function extractPublishDate(html) {
  // Try common meta tags
  const patterns = [
    /property="article:published_time"\s+content="([^"]+)"/i,
    /content="([^"]+)"\s+property="article:published_time"/i,
    /name="date"\s+content="([^"]+)"/i,
    /content="([^"]+)"\s+name="date"/i,
    /name="publish[_-]?date"\s+content="([^"]+)"/i,
    /content="([^"]+)"\s+name="publish[_-]?date"/i,
    /name="DC\.date"\s+content="([^"]+)"/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /"dateCreated"\s*:\s*"([^"]+)"/i,
    /itemprop="datePublished"\s+content="([^"]+)"/i,
    /content="([^"]+)"\s+itemprop="datePublished"/i,
  ];

  for (const re of patterns) {
    const match = html.match(re);
    if (match && match[1]) {
      try {
        const d = new Date(match[1]);
        if (!isNaN(d.getTime())) return d.toISOString();
      } catch { /* try next */ }
    }
  }

  return null;
}

/**
 * Extract internal links from HTML.
 * @param {string} html
 * @param {string} baseUrl — The page URL for resolving relative links
 * @returns {string[]} — Array of absolute URLs
 */
function extractLinks(html, baseUrl) {
  const links = [];
  const seen = new Set();
  const re = /<a\s[^>]*href="([^"#][^"]*)"[^>]*>/gi;
  let match;

  while ((match = re.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;

    const normalized = normalizeUrl(href, baseUrl);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      links.push(normalized);
    }
  }

  return links;
}

// ============================================================================
// Source Type Detection
// ============================================================================

/**
 * Guess the StoryMining source type from URL path and content.
 * @param {string} url
 * @param {string} text — Extracted page text (optional)
 * @returns {string}
 */
function guessSourceType(url, text) {
  const pathname = (() => {
    try { return new URL(url).pathname.toLowerCase(); } catch { return ''; }
  })();

  // URL-based heuristics
  if (/\/(newsroom|press|press-release|media|news)\b/.test(pathname)) return 'press_release';
  if (/\/(about|mission|values|purpose|who-we-are|our-story|leadership)\b/.test(pathname)) return 'strategy';
  if (/\/(blog|insights|thought-leadership|perspectives)\b/.test(pathname)) return 'marketing';
  if (/\/(product|features|solutions|capabilities|platform|technology)\b/.test(pathname)) return 'product_doc';
  if (/\/(investor|ir|investors|shareholder|annual-report|earnings)\b/.test(pathname)) return 'investor';
  if (/\/(case-study|case-studies|customer|customers|success-stor|testimonial)\b/.test(pathname)) return 'customer_story';

  // Text-based heuristics if URL didn't match
  if (text) {
    const lower = text.toLowerCase().slice(0, 2000);
    if (/press release|for immediate release|media contact/.test(lower)) return 'press_release';
    if (/our mission|our values|founded in|we believe/.test(lower)) return 'strategy';
    if (/case study|customer success|the challenge|the results/.test(lower)) return 'customer_story';
    if (/investor|quarterly|earnings|shareholder/.test(lower)) return 'investor';
  }

  return 'marketing';
}

// ============================================================================
// HTTP Fetching
// ============================================================================

/**
 * Raw HTTP/HTTPS fetch with redirect following.
 * @param {string} urlStr
 * @param {number} redirectCount
 * @returns {Promise<{statusCode: number, headers: object, body: string, finalUrl: string}>}
 */
function rawFetch(urlStr, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error(`Too many redirects (>${MAX_REDIRECTS})`));
      return;
    }

    let parsedUrl;
    try { parsedUrl = new URL(urlStr); } catch (e) { reject(new Error(`Invalid URL: ${urlStr}`)); return; }

    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: FETCH_TIMEOUT,
    };

    const req = mod.request(options, (res) => {
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = normalizeUrl(res.headers.location, urlStr);
        if (!redirectUrl) { reject(new Error(`Bad redirect location: ${res.headers.location}`)); return; }
        res.resume(); // drain the response
        resolve(rawFetch(redirectUrl, redirectCount + 1));
        return;
      }

      const chunks = [];
      let totalSize = 0;

      res.on('data', (chunk) => {
        totalSize += chunk.length;
        if (totalSize > MAX_BODY_SIZE) {
          res.destroy();
          reject(new Error(`Response too large (>${MAX_BODY_SIZE} bytes)`));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
          finalUrl: urlStr,
        });
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${urlStr}`));
    });

    req.end();
  });
}

// ============================================================================
// Page Fetching
// ============================================================================

/**
 * Fetch a single page and extract content.
 * @param {string} url
 * @returns {Promise<{url, finalUrl, title, text, links, publishDate, wordCount, error?}>}
 */
async function fetchPage(url) {
  try {
    const { statusCode, headers, body, finalUrl } = await rawFetch(url);

    if (statusCode !== 200) {
      return { url, finalUrl, title: null, text: '', links: [], publishDate: null, wordCount: 0, error: `HTTP ${statusCode}` };
    }

    // Check content type
    const contentType = (headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { url, finalUrl, title: null, text: '', links: [], publishDate: null, wordCount: 0, error: `Non-HTML content: ${contentType}` };
    }

    const title = extractTitle(body);
    const text = extractMainContent(body);
    const links = extractLinks(body, finalUrl);
    const publishDate = extractPublishDate(body);
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return { url, finalUrl, title, text, links, publishDate, wordCount, error: null };
  } catch (err) {
    return { url, finalUrl: url, title: null, text: '', links: [], publishDate: null, wordCount: 0, error: err.message };
  }
}

// ============================================================================
// Concurrent Execution Utility
// ============================================================================

async function runConcurrent(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ============================================================================
// Harvest Orchestrator
// ============================================================================

/**
 * Harvest narrative content from a URL and its linked pages.
 *
 * @param {string} startUrl — The seed URL
 * @param {object} options
 * @param {number} options.depth — 0=just this page, 1=+linked, 2=two levels. Default 0, max 2.
 * @param {number} options.maxPages — Max pages to fetch. Default 20, max 50.
 * @param {string} options.dateAfter — ISO date. Only include pages published after this.
 * @param {boolean} options.sameDomain — Only follow same-domain links. Default true.
 * @param {string} options.pathPrefix — Only follow links under this path prefix.
 * @param {function} options.onProgress — Callback: ({phase, current, total, url}) => void
 * @returns {Promise<{pages: Array, totalFetched: number, skipped: number, errors: Array}>}
 */
async function harvestUrl(startUrl, options = {}) {
  const depth = Math.min(Math.max(parseInt(options.depth) || 0, 0), 2);
  const maxPages = Math.min(Math.max(parseInt(options.maxPages) || 20, 1), 50);
  const dateAfter = options.dateAfter ? new Date(options.dateAfter) : null;
  const sameDomain = options.sameDomain !== false;
  const pathPrefix = options.pathPrefix || null;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

  const visited = new Set();
  const results = [];
  const errors = [];
  let skipped = 0;

  // BFS queue: [{ url, currentDepth }]
  const queue = [{ url: normalizeUrl(startUrl, startUrl), currentDepth: 0 }];
  if (!queue[0].url) {
    return { pages: [], totalFetched: 0, skipped: 0, errors: [{ url: startUrl, error: 'Invalid URL' }] };
  }

  while (queue.length > 0 && results.length < maxPages) {
    // Collect batch at current depth
    const batch = [];
    while (queue.length > 0 && batch.length < maxPages - results.length) {
      const item = queue.shift();
      if (visited.has(item.url)) continue;
      if (hasSkipExtension(item.url)) { skipped++; continue; }
      if (sameDomain && !isSameDomain(item.url, startUrl)) { skipped++; continue; }
      if (pathPrefix && !matchesPathPrefix(item.url, pathPrefix)) { skipped++; continue; }

      visited.add(item.url);
      batch.push(item);
    }

    if (batch.length === 0) break;

    // Fetch batch concurrently
    const tasks = batch.map((item, i) => async () => {
      onProgress({ phase: 'fetching', current: results.length + i + 1, total: results.length + batch.length, url: item.url });
      const page = await fetchPage(item.url);
      return { ...page, requestedDepth: item.currentDepth };
    });

    const fetched = await runConcurrent(tasks, MAX_CONCURRENT);

    for (const page of fetched) {
      if (page.error) {
        errors.push({ url: page.url, error: page.error });
        continue;
      }

      // Date filter
      if (dateAfter && page.publishDate) {
        const pubDate = new Date(page.publishDate);
        if (pubDate < dateAfter) {
          skipped++;
          continue;
        }
      }

      // Skip pages with very little content
      if (page.wordCount < 15) {
        skipped++;
        continue;
      }

      const sourceType = guessSourceType(page.url, page.text);
      results.push({
        url: page.finalUrl || page.url,
        title: page.title,
        text: page.text,
        publishDate: page.publishDate,
        wordCount: page.wordCount,
        sourceType,
      });

      // Enqueue child links if we haven't hit max depth
      if (page.requestedDepth < depth && page.links) {
        for (const link of page.links) {
          const normalized = normalizeUrl(link, page.url);
          if (normalized && !visited.has(normalized)) {
            queue.push({ url: normalized, currentDepth: page.requestedDepth + 1 });
          }
        }
      }
    }
  }

  return {
    pages: results.map(p => ({
      url: p.url,
      title: p.title,
      publishDate: p.publishDate,
      wordCount: p.wordCount,
      sourceType: p.sourceType,
      // text included for downstream StoryMining — can be stripped in API response
      text: p.text,
    })),
    totalFetched: results.length,
    skipped,
    errors,
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  fetchPage,
  harvestUrl,
  extractMainContent,
  extractTitle,
  extractPublishDate,
  extractLinks,
  guessSourceType,
  normalizeUrl,
  // Exposed for testing
  _internals: { rawFetch, runConcurrent, hasSkipExtension, isSameDomain, matchesPathPrefix },
};
