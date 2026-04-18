#!/usr/bin/env node
/**
 * narrative web — Hosted SaaS server for narrativeagent.ai
 *
 * This is the HOSTED counterpart to server.js (which is the LOCAL server).
 * Instead of reading .narrative/ from the local filesystem, this server:
 *   1. Authenticates users via GitHub OAuth
 *   2. Reads .narrative/ from any GitHub repo via the GitHub API
 *   3. Accepts webhooks to re-check on every push
 *   4. Serves the SaaS dashboard (app.html)
 *
 * Zero external dependencies — Node.js stdlib + yaml (already installed).
 *
 * Usage:
 *   GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=yyy SESSION_SECRET=zzz node web-app.js
 *
 * Environment:
 *   GITHUB_CLIENT_ID      — GitHub OAuth App client ID (required)
 *   GITHUB_CLIENT_SECRET  — GitHub OAuth App client secret (required)
 *   SESSION_SECRET         — HMAC key for signing session cookies (required)
 *   WEBHOOK_SECRET         — Secret for verifying GitHub webhook payloads
 *   PORT                   — Server port (default: 3000)
 *   BASE_URL               — Public URL (default: http://localhost:PORT)
 */

'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL, URLSearchParams } = require('url');
const YAML = require('yaml');

// Load .env file if present (no npm dependency needed)
(function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '..', '.env'),
    path.join(process.cwd(), '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
      break; // use first .env found
    }
  }
})();

const { createAlgebra, STAKEHOLDER_PRESETS, ALL_LAYERS } = require('./algebra');
const { checkContent } = require('./check');
const {
  GitHubAdapter, MemoryAdapter,
  unitsToYaml, skillsToTerminologyYaml, skillsToToneYaml,
  githubGet, githubPost, githubPutFile, fetchRepoCanon,
} = require('./store');
const { mineNarrativeUnits } = require('./storymining');
const { llmMineNarrativeUnits, getLLMConfig } = require('./storymining-llm');
const { harvestUrl, guessSourceType } = require('./url-harvest');
const { generateActions, generateAllActions, summarizeActions, buildLLMPrompt } = require('./prescriptive-actions');
const { DEFAULT_LAYER_WEIGHTS } = require('./algebra');

// ============================================================================
// Config
// ============================================================================

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window
const HARVEST_RATE_LIMIT_MAX = 3; // max harvests per minute (expensive operation)
const HARVEST_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// ============================================================================
// In-Memory Store
// ============================================================================

/** @type {Map<string, {githubToken: string, user: object, connectedRepos: Set<string>, rateLimit: {count: number, resetAt: number}, harvestRateLimit: {count: number, resetAt: number}, llmConfig?: {provider: string, encryptedKey: string, iv: string}, csrfToken: string}>} */
const sessions = new Map();

/** @type {Map<string, {canon: object, lastCheck: object, history: object[]}>} */
const repoCache = new Map();

/** @type {Map<string, Set<http.ServerResponse>>} sessionId → SSE connections */
const sseClients = new Map();

/** @type {Map<string, MemoryAdapter>} workspaceId → MemoryAdapter store */
const workspaces = new Map();

// ============================================================================
// Session Management — HMAC-SHA256 signed cookies
// ============================================================================

function createSessionId() {
  return crypto.randomBytes(24).toString('hex');
}

function createCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Encryption functions for API key storage
function encryptApiKey(apiKey, sessionId) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.createHash('sha256').update(SESSION_SECRET + sessionId).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex')
  };
}

function decryptApiKey(encryptedKey, iv, sessionId) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.createHash('sha256').update(SESSION_SECRET + sessionId).digest();
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));

  let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function signSession(sessionId) {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  return sessionId + '.' + hmac.digest('hex');
}

function verifySession(signedValue) {
  if (!signedValue || !signedValue.includes('.')) return null;
  const [sessionId, sig] = signedValue.split('.');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  const expected = hmac.digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }
  return sessionId;
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  for (const pair of header.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const signed = cookies.na_session;
  if (!signed) return null;
  const sessionId = verifySession(signed);
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

function getSessionId(req) {
  const cookies = parseCookies(req);
  const signed = cookies.na_session;
  if (!signed) return null;
  return verifySession(signed);
}

function setSessionCookie(res, sessionId, csrfToken = null) {
  const signed = signSession(sessionId);
  const isSecure = BASE_URL.startsWith('https');
  const cookies = [
    `na_session=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isSecure ? '; Secure' : ''}`
  ];

  // Also set CSRF token as a separate cookie (not HttpOnly so JS can read it)
  if (csrfToken) {
    cookies.push(
      `csrf_token=${csrfToken}; Path=/; SameSite=Strict; Max-Age=604800${isSecure ? '; Secure' : ''}`
    );
  }

  res.setHeader('Set-Cookie', cookies);
}

function validateCSRF(req, session) {
  // Skip CSRF for GET requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }

  // Get CSRF token from header or cookie
  const headerToken = req.headers['x-csrf-token'];
  const cookies = parseCookies(req);
  const cookieToken = cookies.csrf_token;

  // Use header token if provided, otherwise fall back to cookie
  const clientToken = headerToken || cookieToken;

  if (!clientToken || !session || !session.csrfToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(clientToken),
    Buffer.from(session.csrfToken)
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'na_session=; Path=/; HttpOnly; Max-Age=0');
}

// ============================================================================
// Rate Limiting
// ============================================================================

function checkRateLimit(session) {
  if (!session) return true; // no session = no rate limit (auth will block anyway)
  const now = Date.now();
  if (!session.rateLimit || now > session.rateLimit.resetAt) {
    session.rateLimit = { count: 1, resetAt: now + RATE_LIMIT_WINDOW };
    return true;
  }
  session.rateLimit.count++;
  return session.rateLimit.count <= RATE_LIMIT_MAX;
}

// Enhanced rate limiting for harvest endpoint (expensive operation)
function checkHarvestRateLimit(session) {
  if (!session) return false; // Require session for harvest
  const now = Date.now();
  if (!session.harvestRateLimit || now > session.harvestRateLimit.resetAt) {
    session.harvestRateLimit = { count: 1, resetAt: now + HARVEST_RATE_LIMIT_WINDOW };
    return true;
  }
  session.harvestRateLimit.count++;
  return session.harvestRateLimit.count <= HARVEST_RATE_LIMIT_MAX;
}

// GitHub API helpers, YAML serializers, and fetchRepoCanon are imported from store.js

/**
 * Run a full clarion call on canon data (mirrors server.js runClarionCall).
 */
function runClarionCall(units, skills, trigger = 'demand') {
  const { algebra } = createAlgebra(units);
  const metrics = algebra.computeMetrics();
  const driftResult = algebra.drift();
  const coverResult = algebra.cover();

  // Skill-based checks
  const themeConflicts = checkThemeConflictsWeb(units);
  const orphans = checkOrphanedDepsWeb(units);
  const terminology = checkTerminologyWeb(units, skills);
  const tone = checkToneWeb(units, skills);

  const coherenceScore = Math.round(metrics.narrativeCoherenceIndex * 100);

  return {
    timestamp: new Date().toISOString(),
    trigger,
    totalUnits: units.length,
    coherenceScore,
    nci: metrics.narrativeCoherenceIndex,
    coverageRatio: metrics.coverageRatio,
    layerHealth: metrics.layerHealth,
    totalEdges: metrics.totalEdges,
    driftRate: driftResult.driftRate,
    driftedUnits: driftResult.driftedUnits.map(u => u.id),
    coverageByLayer: coverResult.byLayer,
    gaps: coverResult.gaps.map(u => u.id),
    orphanUnits: coverResult.orphans.map(u => u.id),
    driftAlerts: themeConflicts,
    terminologyViolations: terminology,
    toneViolations: tone,
    orphanedDependencies: orphans,
  };
}

// Skill checks (mirrored from server.js to avoid modifying it)
function checkThemeConflictsWeb(units) {
  const alerts = [];
  const unitMap = new Map(units.map(u => [u.id, u]));
  for (const unit of units) {
    for (const depId of unit.dependencies) {
      const dep = unitMap.get(depId);
      if (!dep) continue;
      const unitThemes = unit.intent?.constraints?.content?.required_themes || [];
      const depForbidden = dep.intent?.constraints?.content?.forbidden_themes || [];
      const conflicts = unitThemes.filter(t => depForbidden.includes(t));
      if (conflicts.length > 0) {
        alerts.push({
          unitId: unit.id, parentId: dep.id, severity: 'error',
          message: `Theme conflict: [${conflicts.join(', ')}] forbidden by parent "${dep.id}"`,
        });
      }
      const unitTone = unit.intent?.constraints?.content?.tone;
      const depTone = dep.intent?.constraints?.content?.tone;
      if (unitTone && depTone && unitTone !== depTone) {
        alerts.push({
          unitId: unit.id, parentId: dep.id, severity: 'warning',
          message: `Tone mismatch: "${unit.id}" uses "${unitTone}" but parent "${dep.id}" uses "${depTone}"`,
        });
      }
    }
  }
  return alerts;
}

function checkOrphanedDepsWeb(units) {
  const ids = new Set(units.map(u => u.id));
  const orphans = [];
  for (const unit of units) {
    for (const dep of unit.dependencies) {
      if (!ids.has(dep)) orphans.push({ unitId: unit.id, missingDep: dep });
    }
  }
  return orphans;
}

function checkTerminologyWeb(units, skills) {
  const violations = [];
  const forbidden = skills.terminology?.forbidden || [];
  const brandWrong = skills.brand?.never || [];
  const brandCorrect = skills.brand?.company_name || 'Principal AI';
  const products = skills.products || [];
  for (const unit of units) {
    const text = unit.assertion.toLowerCase();
    for (const term of forbidden) {
      if (text.includes(term.toLowerCase())) {
        violations.push({ unitId: unit.id, severity: 'warning', message: `Forbidden term: "${term}"` });
      }
    }
    for (const wrong of brandWrong) {
      if (unit.assertion.includes(wrong)) {
        violations.push({ unitId: unit.id, severity: 'error', message: `Wrong brand name: "${wrong}" → use "${brandCorrect}"` });
      }
    }
    for (const product of products) {
      for (const wrong of (product.never || [])) {
        if (unit.assertion.includes(wrong)) {
          violations.push({ unitId: unit.id, severity: 'error', message: `Wrong product name: "${wrong}" → use "${product.name}"` });
        }
      }
    }
  }
  return violations;
}

function checkToneWeb(units, skills) {
  const violations = [];
  const knownBad = [
    'cutting-edge', 'ai-powered', 'leverage', 'unlock',
    'unprecedented', 'maximize', 'revolutionize', 'game-changing',
    'best-in-class', 'synergy', 'holistic', 'paradigm',
    'comprehensive solution', 'enables organizations',
    'take back control', 'empower', 'lifecycle',
    'streamline', 'optimize', 'accelerate', 'drive value',
  ];
  for (const unit of units) {
    const text = unit.assertion.toLowerCase();
    for (const pattern of knownBad) {
      if (text.includes(pattern)) {
        violations.push({ unitId: unit.id, severity: 'warning', message: `Tone: "${pattern}" sounds like marketing-speak` });
      }
    }
  }
  return violations;
}

/** Review arbitrary text against narrative graph + skills */
function reviewContent(text, skills, units) {
  const violations = [];
  const lower = text.toLowerCase();
  for (const term of (skills.terminology?.forbidden || [])) {
    if (lower.includes(term.toLowerCase())) {
      violations.push({ severity: 'warning', message: `Forbidden term: "${term}"` });
    }
  }
  for (const wrong of (skills.brand?.never || [])) {
    if (text.includes(wrong)) {
      violations.push({ severity: 'error', message: `Brand: "${wrong}" → "${skills.brand.company_name}"` });
    }
  }
  for (const product of (skills.products || [])) {
    for (const wrong of (product.never || [])) {
      if (text.includes(wrong)) {
        violations.push({ severity: 'error', message: `Product: "${wrong}" → "${product.name}"` });
      }
    }
  }
  const badPatterns = [
    'ai-powered', 'comprehensive solution', 'enables organizations',
    'take back control', 'maximize', 'unprecedented', 'lifecycle',
    'streamline', 'optimize', 'accelerate', 'drive value',
    'cutting-edge', 'leverage', 'unlock', 'revolutionize',
    'game-changing', 'best-in-class', 'synergy', 'holistic',
    'paradigm', 'empower', 'disrupt',
  ];
  for (const pattern of badPatterns) {
    if (lower.includes(pattern)) {
      violations.push({ severity: 'warning', message: `Tone: "${pattern}" sounds like marketing-speak` });
    }
  }
  let resonance = null;
  if (units && units.length > 0 && text.length > 0) {
    const { algebra } = createAlgebra(units);
    const res = algebra.resonate(text);
    resonance = {
      resonance: res.resonance,
      relevance: res.relevance,
      scope: res.scope,
      urgency: res.urgency,
      matchedUnits: res.matchedUnits.map(m => ({ id: m.unit.id, type: m.unit.type, similarity: m.similarity })),
    };
    if (res.resonance === 0 && text.length > 100) {
      violations.push({ severity: 'warning', message: 'Content has no resonance with narrative graph — may not align with organizational narrative' });
    }
  }
  return { violations, resonance };
}

// ============================================================================
// Webhook Verification
// ============================================================================

function verifyWebhookSignature(payload, signature) {
  if (!WEBHOOK_SECRET || !signature) return false;
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payload);
  const expected = 'sha256=' + hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ============================================================================
// SSE
// ============================================================================

function broadcastSSE(repoFullName, event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [sessionId, clients] of sseClients) {
    const session = sessions.get(sessionId);
    if (session && session.connectedRepos.has(repoFullName)) {
      for (const res of clients) {
        res.write(msg);
      }
    }
  }
}

// ============================================================================
// Text Similarity (word-overlap Jaccard for dedup)
function assertionSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  return intersection / Math.max(wordsA.size, wordsB.size);
}

// Request Helpers
// ============================================================================

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) { req.destroy(); reject(new Error('Request body too large')); return; }
      body += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(body); }
    });
    req.on('error', reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) { req.destroy(); reject(new Error('Request body too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function redirect(res, url) {
  res.writeHead(302, { 'Location': url });
  res.end();
}

/** Parse :owner/:repo from URL path segments */
function parseRepoPath(pathname, prefix) {
  // prefix like /api/repos/ → extract owner/repo
  const rest = pathname.slice(prefix.length);
  const parts = rest.split('/');
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1], rest: parts.slice(2).join('/') };
}

// ============================================================================
// Repo Cache Helpers
// ============================================================================

async function getRepoData(owner, repo, token) {
  const key = `${owner}/${repo}`;
  const cached = repoCache.get(key);

  // Return cache if fresh (< 5 min old)
  if (cached && (Date.now() - new Date(cached.lastCheck.timestamp).getTime()) < 5 * 60 * 1000) {
    return cached;
  }

  // Fetch fresh
  const canon = await fetchRepoCanon(owner, repo, token);
  const clarionResult = runClarionCall(canon.units, canon.skills, 'scan');

  const data = {
    canon,
    lastCheck: clarionResult,
    history: cached ? [...cached.history, clarionResult].slice(-50) : [clarionResult],
  };
  repoCache.set(key, data);
  return data;
}

// ============================================================================
// HTTP Server
// ============================================================================

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const pathname = url.pathname;

  // SECURITY: Comprehensive security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS (only for HTTPS)
  if (BASE_URL.startsWith('https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy - strict but allows D3.js
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://d3js.org",  // unsafe-inline needed for existing inline scripts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",  // unsafe-inline for inline styles
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // ---- Auth Routes (no session required) ----

    if (pathname === '/auth/github' && req.method === 'GET') {
      const state = crypto.randomBytes(16).toString('hex');
      const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: `${BASE_URL}/auth/callback`,
        scope: 'repo read:user',
        state,
      });
      redirect(res, `https://github.com/login/oauth/authorize?${params}`);
      return;
    }

    if (pathname === '/auth/callback' && req.method === 'GET') {
      const code = url.searchParams.get('code');
      if (!code) { json(res, 400, { error: 'Missing code' }); return; }

      // Exchange code for token
      const tokenRes = await githubPost('github.com', '/login/oauth/access_token', {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      });

      const token = tokenRes.body?.access_token;
      if (!token) { json(res, 401, { error: 'Failed to get access token' }); return; }

      // Get user info
      const userRes = await githubGet('/user', token);
      if (userRes.status !== 200) { json(res, 401, { error: 'Failed to get user info' }); return; }

      // Create session with CSRF token
      const sessionId = createSessionId();
      const csrfToken = createCSRFToken();
      sessions.set(sessionId, {
        githubToken: token,
        csrfToken: csrfToken,
        user: {
          login: userRes.body.login,
          name: userRes.body.name,
          avatar_url: userRes.body.avatar_url,
          id: userRes.body.id,
        },
        connectedRepos: new Set(),
        rateLimit: { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW },
        harvestRateLimit: { count: 0, resetAt: Date.now() + HARVEST_RATE_LIMIT_WINDOW },
      });

      setSessionCookie(res, sessionId, csrfToken);
      redirect(res, '/');
      return;
    }

    if (pathname === '/auth/logout' && req.method === 'GET') {
      const sessionId = getSessionId(req);
      if (sessionId) {
        sessions.delete(sessionId);
        sseClients.delete(sessionId);
      }
      clearSessionCookie(res);
      redirect(res, '/');
      return;
    }

    // ---- Webhook (no session — signature verified) ----

    if (pathname === '/webhook/github' && req.method === 'POST') {
      const rawBody = await readRawBody(req);
      const signature = req.headers['x-hub-signature-256'];

      if (!verifyWebhookSignature(rawBody.toString(), signature)) {
        json(res, 401, { error: 'Invalid signature' });
        return;
      }

      let payload;
      try { payload = JSON.parse(rawBody.toString()); } catch {
        json(res, 400, { error: 'Invalid JSON' });
        return;
      }

      const event = req.headers['x-github-event'];
      if (event === 'push') {
        const repoFullName = payload.repository?.full_name;
        if (repoFullName) {
          // Find a session with this repo connected to get a token
          let token = null;
          for (const [, session] of sessions) {
            if (session.connectedRepos.has(repoFullName)) {
              token = session.githubToken;
              break;
            }
          }

          if (token) {
            const [owner, repo] = repoFullName.split('/');
            // Invalidate cache so next fetch is fresh
            repoCache.delete(repoFullName);
            try {
              const data = await getRepoData(owner, repo, token);
              broadcastSSE(repoFullName, 'clarion-call', {
                repo: repoFullName,
                canon: { units: data.canon.units, skills: data.canon.skills },
                result: data.lastCheck,
              });
            } catch (err) {
              console.error(`Webhook re-scan failed for ${repoFullName}:`, err.message);
            }
          }
        }
      }

      json(res, 200, { ok: true });
      return;
    }

    // ---- Dashboard ----

    if ((pathname === '/' || pathname === '/index.html') && req.method === 'GET') {
      const dashboardPath = path.join(__dirname, 'app.html');
      if (fs.existsSync(dashboardPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(dashboardPath, 'utf-8'));
      } else {
        res.writeHead(404);
        res.end('Dashboard not found.');
      }
      return;
    }

    // ---- Guest Mode (no auth required) ----

    if (pathname === '/api/guest' && req.method === 'POST') {
      // Create a guest session with CSRF token
      const sessionId = createSessionId();
      const csrfToken = createCSRFToken();
      sessions.set(sessionId, {
        githubToken: null,
        csrfToken: csrfToken,
        user: {
          login: 'guest',
          name: 'Guest User',
          avatar_url: '',
          id: 'guest-' + Date.now(),
        },
        connectedRepos: new Set(),
        rateLimit: { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW },
        harvestRateLimit: { count: 0, resetAt: Date.now() + HARVEST_RATE_LIMIT_WINDOW },
        isGuest: true,
      });

      setSessionCookie(res, sessionId, csrfToken);
      json(res, 200, {
        user: {
          login: 'guest',
          name: 'Guest User',
          avatar_url: '',
        },
      });
      return;
    }

    // ---- All routes below require auth ----

    const session = getSession(req);
    const sessionId = getSessionId(req);

    // SSE endpoint (auth required)
    if (pathname === '/api/events' && req.method === 'GET') {
      if (!session) { json(res, 401, { error: 'Not authenticated' }); return; }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write('event: connected\ndata: {}\n\n');
      if (!sseClients.has(sessionId)) sseClients.set(sessionId, new Set());
      sseClients.get(sessionId).add(res);
      req.on('close', () => {
        const clients = sseClients.get(sessionId);
        if (clients) { clients.delete(res); if (clients.size === 0) sseClients.delete(sessionId); }
      });
      return;
    }

    if (!session) {
      json(res, 401, { error: 'Not authenticated. Redirect to /auth/github' });
      return;
    }

    // Rate limit
    if (!checkRateLimit(session)) {
      json(res, 429, { error: 'Rate limit exceeded. Try again in a minute.' });
      return;
    }

    // ---- User Info ----

    if (pathname === '/api/me' && req.method === 'GET') {
      json(res, 200, {
        user: session.user,
        connectedRepos: Array.from(session.connectedRepos),
      });
      return;
    }

    // ---- Repo Management ----

    if (pathname === '/api/repos' && req.method === 'GET') {
      const reposRes = await githubGet('/user/repos?per_page=100&sort=updated', session.githubToken);
      if (reposRes.status !== 200) { json(res, 502, { error: 'Failed to list repos' }); return; }
      const repos = reposRes.body.map(r => ({
        full_name: r.full_name,
        name: r.name,
        owner: r.owner.login,
        description: r.description,
        private: r.private,
        default_branch: r.default_branch,
        connected: session.connectedRepos.has(r.full_name),
      }));
      json(res, 200, { repos });
      return;
    }

    if (pathname === '/api/repos/connect' && req.method === 'POST') {
      // SECURITY: Validate CSRF token
      if (!validateCSRF(req, session)) {
        json(res, 403, { error: 'Invalid CSRF token. Please refresh and try again.' });
        return;
      }

      let body;
      try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
      const { owner, repo } = body || {};
      if (!owner || !repo) { json(res, 400, { error: 'Missing owner or repo' }); return; }

      const fullName = `${owner}/${repo}`;
      session.connectedRepos.add(fullName);

      try {
        const data = await getRepoData(owner, repo, session.githubToken);
        json(res, 200, {
          connected: true,
          repo: fullName,
          result: data.lastCheck,
          canon: { units: data.canon.units.length, skills: Object.keys(data.canon.skills).length, errors: data.canon.errors },
        });
      } catch (err) {
        session.connectedRepos.delete(fullName);
        json(res, 502, { error: `Failed to scan repo: ${err.message}` });
      }
      return;
    }

    if (pathname === '/api/repos/disconnect' && req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
      const { owner, repo } = body || {};
      if (!owner || !repo) { json(res, 400, { error: 'Missing owner or repo' }); return; }
      session.connectedRepos.delete(`${owner}/${repo}`);
      json(res, 200, { disconnected: true });
      return;
    }

    // ---- Repo-scoped API routes ----
    // /api/repos/:owner/:repo/...

    if (pathname.startsWith('/api/repos/') && pathname !== '/api/repos/connect' && pathname !== '/api/repos/disconnect') {
      const parsed = parseRepoPath(pathname, '/api/repos/');
      if (!parsed) { json(res, 400, { error: 'Invalid repo path' }); return; }

      const { owner, repo, rest } = parsed;
      const fullName = `${owner}/${repo}`;

      // Ensure repo is connected
      if (!session.connectedRepos.has(fullName)) {
        json(res, 403, { error: `Repo ${fullName} is not connected. POST /api/repos/connect first.` });
        return;
      }

      // Get repo data (cached or fresh)
      let data;
      try {
        data = await getRepoData(owner, repo, session.githubToken);
      } catch (err) {
        json(res, 502, { error: `Failed to fetch repo data: ${err.message}` });
        return;
      }

      const { canon } = data;
      const { graph, algebra } = createAlgebra(canon.units);

      // Route: /api/repos/:owner/:repo/scan
      if (rest === 'scan' && req.method === 'GET') {
        repoCache.delete(fullName); // Force refresh
        try {
          data = await getRepoData(owner, repo, session.githubToken);
          json(res, 200, { result: data.lastCheck, canon: { units: data.canon.units.length, errors: data.canon.errors } });
        } catch (err) {
          json(res, 502, { error: err.message });
        }
        return;
      }

      // Route: /api/repos/:owner/:repo/metrics
      if (rest === 'metrics' && req.method === 'GET') {
        json(res, 200, algebra.computeMetrics());
        return;
      }

      // Route: /api/repos/:owner/:repo/compose?stakeholder=
      if (rest === 'compose' && req.method === 'GET') {
        const stakeholder = url.searchParams.get('stakeholder');
        if (!stakeholder || !STAKEHOLDER_PRESETS[stakeholder]) {
          json(res, 400, { error: `Invalid stakeholder. Available: ${Object.keys(STAKEHOLDER_PRESETS).join(', ')}` });
          return;
        }
        const subgraph = algebra.composeForStakeholder(stakeholder);
        json(res, 200, {
          stakeholder,
          unitCount: subgraph.units.length,
          edgeCount: subgraph.edges.length,
          units: subgraph.units.map(u => ({ id: u.id, type: u.type, assertion: u.assertion, validationState: u.validationState, confidence: u.confidence })),
          edges: subgraph.edges,
          provenance: subgraph.provenance,
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/propagate?unit=
      if (rest === 'propagate' && req.method === 'GET') {
        const unitId = url.searchParams.get('unit');
        if (!unitId) { json(res, 400, { error: 'Missing ?unit= parameter' }); return; }
        try {
          const result = algebra.propagate(unitId);
          json(res, 200, {
            changedUnit: { id: result.changedUnit.id, type: result.changedUnit.type, assertion: result.changedUnit.assertion },
            affectedCount: result.affectedUnits.length,
            scope: result.scope,
            affectedUnits: result.affectedUnits.map(u => ({ id: u.id, type: u.type, assertion: u.assertion })),
            byLayer: Object.fromEntries(Object.entries(result.byLayer).map(([k, v]) => [k, v.length])),
          });
        } catch (err) {
          json(res, 404, { error: err.message });
        }
        return;
      }

      // Route: /api/repos/:owner/:repo/drift
      if (rest === 'drift' && req.method === 'GET') {
        const result = algebra.drift();
        json(res, 200, {
          driftRate: result.driftRate,
          driftedUnits: result.driftedUnits.map(u => ({ id: u.id, type: u.type, assertion: u.assertion })),
          byLayer: result.byLayer,
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/cover
      if (rest === 'cover' && req.method === 'GET') {
        const result = algebra.cover();
        json(res, 200, {
          coverage: result.coverage,
          byLayer: result.byLayer,
          gaps: result.gaps.map(u => ({ id: u.id, type: u.type })),
          orphans: result.orphans.map(u => ({ id: u.id, type: u.type })),
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/validate
      if (rest === 'validate' && req.method === 'POST') {
        const results = algebra.validateAll();
        json(res, 200, { results });
        return;
      }

      // Route: /api/repos/:owner/:repo/resonate
      if (rest === 'resonate' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const signal = body?.signal || body?.text || '';
        if (!signal) { json(res, 400, { error: 'Missing signal or text in request body' }); return; }
        const result = algebra.resonate(signal);
        json(res, 200, {
          resonance: result.resonance,
          relevance: result.relevance,
          scope: result.scope,
          urgency: result.urgency,
          matchedUnits: result.matchedUnits.map(m => ({
            id: m.unit.id, type: m.unit.type, assertion: m.unit.assertion, similarity: m.similarity,
          })),
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/scopes — list scopes + boundary coherence
      if (rest === 'scopes' && req.method === 'GET') {
        const scopes = graph.getScopes();
        const scopeDetails = {};
        for (const scope of scopes) {
          const scopeUnits = graph.getUnitsByScope(scope);
          const aligned = scopeUnits.filter(u => u.validationState === 'ALIGNED');
          const contested = scopeUnits.filter(u => u.validationState === 'CONTESTED');
          scopeDetails[scope] = {
            unitCount: scopeUnits.length,
            nci: scopeUnits.length > 0 ? aligned.length / scopeUnits.length : 1.0,
            contestedCount: contested.length,
            units: scopeUnits.map(u => ({ id: u.id, type: u.type, assertion: u.assertion, author: u.author, validationState: u.validationState })),
          };
        }
        const boundary = algebra.measureBoundaryCoherence();
        json(res, 200, {
          scopes: scopeDetails,
          boundary: {
            totalBoundaries: boundary.totalBoundaries,
            coherence: boundary.coherence,
            actionableTensions: boundary.actionableTensions.map(t => ({
              unitId: t.unit.id, unitAssertion: t.unit.assertion, fromScope: t.fromScope,
              depId: t.dependency.id, depAssertion: t.dependency.assertion, toScope: t.toScope,
            })),
            deliberateTensions: boundary.deliberateTensions.map(t => ({
              unitId: t.unit.id, unitAssertion: t.unit.assertion, fromScope: t.fromScope,
              depId: t.dependency.id, depAssertion: t.dependency.assertion, toScope: t.toScope,
            })),
          },
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/contested — list contested units
      if (rest === 'contested' && req.method === 'GET') {
        const contested = graph.getContestedUnits();
        json(res, 200, {
          contested: contested.map(u => ({
            id: u.id, type: u.type, assertion: u.assertion,
            author: u.author, scope: u.scope,
            contestedBy: u.contestedBy,
            tensionIntent: u.tensionIntent,
            validationState: u.validationState,
          })),
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/units/attribute — update author/scope on a unit
      if (rest === 'units/attribute' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const { unitId, author, scope } = body || {};
        if (!unitId) { json(res, 400, { error: 'Missing unitId' }); return; }
        const unit = graph.getUnit(unitId);
        if (!unit) { json(res, 404, { error: `Unit ${unitId} not found` }); return; }
        graph.updateAttribution(unitId, {
          author: author !== undefined ? author : undefined,
          authoredAt: author !== undefined ? new Date().toISOString() : undefined,
          scope: scope !== undefined ? scope : undefined,
        });
        json(res, 200, {
          unitId, author: unit.author, authoredAt: unit.authoredAt, scope: unit.scope,
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/units/contest — mark a unit as contested
      if (rest === 'units/contest' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const { unitId, contestedByUnitId } = body || {};
        if (!unitId || !contestedByUnitId) {
          json(res, 400, { error: 'Missing unitId or contestedByUnitId' });
          return;
        }
        const result = graph.markContested(unitId, contestedByUnitId);
        if (!result) { json(res, 404, { error: `Unit ${unitId} not found` }); return; }
        json(res, 200, {
          unitId, validationState: result.validationState,
          contestedBy: result.contestedBy,
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/units/tension-intent — classify tension
      if (rest === 'units/tension-intent' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const { unitId, intent, reason } = body || {};
        if (!unitId || !intent) {
          json(res, 400, { error: 'Missing unitId or intent' });
          return;
        }
        const validIntents = ['drift', 'evolution', 'deliberate_tension'];
        if (!validIntents.includes(intent)) {
          json(res, 400, { error: `Invalid intent. Must be one of: ${validIntents.join(', ')}` });
          return;
        }
        const unit = graph.getUnit(unitId);
        if (!unit) { json(res, 404, { error: `Unit ${unitId} not found` }); return; }
        graph.setTensionIntent(unitId, intent, {
          classifiedBy: session?.githubUser || 'anonymous',
          classifiedAt: new Date().toISOString(),
          reason: reason || null,
        });
        // Re-validate the unit with the new intent
        const validationResult = algebra.validate(unitId);
        json(res, 200, {
          unitId,
          tensionIntent: intent,
          validationState: validationResult.newState,
          confidence: validationResult.confidence,
          reasons: validationResult.reasons,
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/weighted-nci — weighted NCI with optional custom weights
      if (rest === 'weighted-nci' && req.method === 'GET') {
        const wnci = algebra.computeWeightedNCI();
        const scopedWNCI = algebra.computeScopedWeightedNCI();
        json(res, 200, { ...wnci, scopedWeightedNCI: scopedWNCI });
        return;
      }

      // Route: /api/repos/:owner/:repo/actions — prescriptive actions for all units
      if (rest === 'actions' && req.method === 'GET') {
        const allActions = generateAllActions(graph, algebra);
        const summary = summarizeActions(allActions);
        json(res, 200, { actions: allActions, summary });
        return;
      }

      // Route: /api/repos/:owner/:repo/actions/unit/:unitId — actions for a specific unit
      if (rest.startsWith('actions/unit/') && req.method === 'GET') {
        const targetUnitId = rest.replace('actions/unit/', '');
        const unit = graph.getUnit(targetUnitId);
        if (!unit) { json(res, 404, { error: `Unit ${targetUnitId} not found` }); return; }
        const unitActions = generateActions(unit, { graph, algebra, allUnits: graph.getAllUnits() });
        json(res, 200, { unitId: targetUnitId, actions: unitActions });
        return;
      }

      // Route: /api/repos/:owner/:repo/actions/recommend — LLM recommendation for a unit
      if (rest === 'actions/recommend' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const { unitId } = body || {};
        if (!unitId) { json(res, 400, { error: 'Missing unitId' }); return; }
        const unit = graph.getUnit(unitId);
        if (!unit) { json(res, 404, { error: `Unit ${unitId} not found` }); return; }

        const ruleBasedActions = generateActions(unit, { graph, algebra, allUnits: graph.getAllUnits() });
        const deps = graph.getDependencies(unitId);
        const dependents = graph.getDependents(unitId);
        const prompt = buildLLMPrompt(unit, {
          relatedUnits: { dependencies: deps, dependents },
          ruleBasedActions,
        });

        const llmConfig = getLLMConfig();
        if (!llmConfig.available) {
          json(res, 200, {
            unitId,
            ruleBasedActions,
            llmRecommendation: null,
            llmAvailable: false,
            prompt, // include prompt so client can use it elsewhere
          });
          return;
        }

        // Call LLM
        try {
          const https = require('https');
          const llmBody = JSON.stringify({
            model: llmConfig.model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1000,
          });
          const llmRes = await new Promise((resolve, reject) => {
            const req = https.request({
              hostname: new URL(llmConfig.baseUrl || 'https://api.openai.com').hostname,
              path: '/v1/chat/completions',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${llmConfig.apiKey}`,
                'Content-Length': Buffer.byteLength(llmBody),
              },
            }, (res) => {
              let data = '';
              res.on('data', chunk => { data += chunk; });
              res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ error: data }); } });
            });
            req.on('error', reject);
            req.write(llmBody);
            req.end();
          });

          const recommendation = llmRes.choices?.[0]?.message?.content || null;
          json(res, 200, {
            unitId,
            ruleBasedActions,
            llmRecommendation: recommendation,
            llmAvailable: true,
          });
        } catch (err) {
          json(res, 200, {
            unitId,
            ruleBasedActions,
            llmRecommendation: null,
            llmAvailable: false,
            error: err.message,
          });
        }
        return;
      }

      // Route: /api/repos/:owner/:repo/review
      if (rest === 'review' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const result = reviewContent(body?.text || '', canon.skills, canon.units);
        json(res, 200, result);
        return;
      }

      // ==================================================================
      // Editor API — save units, skills, and run wizard setup
      // ==================================================================

      // Route: /api/repos/:owner/:repo/canon — get full canon data for editing
      if (rest === 'canon' && req.method === 'GET') {
        json(res, 200, {
          units: canon.units,
          skills: canon.skills,
          files: canon.files,
          errors: canon.errors,
        });
        return;
      }

      // Route: /api/repos/:owner/:repo/units/save — save units to a canon file
      if (rest === 'units/save' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }

        const { units: newUnits, filename, metadata } = body || {};
        if (!newUnits || !Array.isArray(newUnits) || newUnits.length === 0) {
          json(res, 400, { error: 'Missing or empty units array' });
          return;
        }

        const file = filename || 'canon.yml';
        const filePath = `.narrative/canon/${file}`;
        const yamlContent = unitsToYaml(newUnits, metadata || {});
        const message = body.commitMessage || `Update ${file} via Narrative Agent`;

        try {
          const putRes = await githubPutFile(owner, repo, filePath, yamlContent, message, session.githubToken);
          if (putRes.status !== 200 && putRes.status !== 201) {
            json(res, 502, { error: `GitHub API error: ${putRes.status}`, details: putRes.body });
            return;
          }

          // Invalidate cache and re-scan
          repoCache.delete(fullName);
          const freshData = await getRepoData(owner, repo, session.githubToken);

          json(res, 200, {
            saved: true,
            file: filePath,
            sha: putRes.body?.content?.sha,
            result: freshData.lastCheck,
          });
        } catch (err) {
          json(res, 502, { error: `Failed to save: ${err.message}` });
        }
        return;
      }

      // Route: /api/repos/:owner/:repo/skills/save — save skills (terminology, tone)
      if (rest === 'skills/save' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }

        const { type, data: skillsData } = body || {};
        if (!type || !skillsData) {
          json(res, 400, { error: 'Missing type or data' });
          return;
        }

        let filePath, yamlContent;
        if (type === 'terminology') {
          filePath = '.narrative/skills/terminology.yml';
          yamlContent = skillsToTerminologyYaml(skillsData);
        } else if (type === 'tone') {
          filePath = '.narrative/skills/tone-of-voice.yml';
          yamlContent = skillsToToneYaml(skillsData);
        } else {
          json(res, 400, { error: `Unknown skills type: ${type}` });
          return;
        }

        const message = body.commitMessage || `Update ${type} skills via Narrative Agent`;

        try {
          const putRes = await githubPutFile(owner, repo, filePath, yamlContent, message, session.githubToken);
          if (putRes.status !== 200 && putRes.status !== 201) {
            json(res, 502, { error: `GitHub API error: ${putRes.status}`, details: putRes.body });
            return;
          }

          repoCache.delete(fullName);
          const freshData = await getRepoData(owner, repo, session.githubToken);

          json(res, 200, {
            saved: true,
            file: filePath,
            result: freshData.lastCheck,
          });
        } catch (err) {
          json(res, 502, { error: `Failed to save: ${err.message}` });
        }
        return;
      }

      // Route: /api/repos/:owner/:repo/wizard/setup — full wizard: create .narrative/ from scratch
      if (rest === 'wizard/setup' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }

        const { coreStory, positioning, brand, products, forbidden, voicePrinciples, owner: canonOwner } = body || {};

        if (!coreStory || !Array.isArray(coreStory) || coreStory.length === 0) {
          json(res, 400, { error: 'At least one core story unit is required' });
          return;
        }

        const results = { files: [], errors: [] };

        // 1. Save core-story.yml
        const coreYaml = unitsToYaml(coreStory, { owner: canonOwner });
        try {
          const r = await githubPutFile(owner, repo, '.narrative/canon/core-story.yml', coreYaml, 'Initialize core story via Narrative Agent', session.githubToken);
          if (r.status === 200 || r.status === 201) results.files.push('core-story.yml');
          else results.errors.push({ file: 'core-story.yml', error: `Status ${r.status}` });
        } catch (err) { results.errors.push({ file: 'core-story.yml', error: err.message }); }

        // 2. Save positioning.yml (if provided)
        if (positioning && positioning.length > 0) {
          const posYaml = unitsToYaml(positioning, { owner: canonOwner });
          try {
            const r = await githubPutFile(owner, repo, '.narrative/canon/positioning.yml', posYaml, 'Initialize positioning via Narrative Agent', session.githubToken);
            if (r.status === 200 || r.status === 201) results.files.push('positioning.yml');
            else results.errors.push({ file: 'positioning.yml', error: `Status ${r.status}` });
          } catch (err) { results.errors.push({ file: 'positioning.yml', error: err.message }); }
        }

        // 3. Save terminology.yml
        const termsData = {
          brand: brand || { company_name: '', never: [] },
          products: products || [],
          terminology: { forbidden: forbidden || [] },
        };
        const termsYaml = skillsToTerminologyYaml(termsData);
        try {
          const r = await githubPutFile(owner, repo, '.narrative/skills/terminology.yml', termsYaml, 'Initialize terminology via Narrative Agent', session.githubToken);
          if (r.status === 200 || r.status === 201) results.files.push('terminology.yml');
          else results.errors.push({ file: 'terminology.yml', error: `Status ${r.status}` });
        } catch (err) { results.errors.push({ file: 'terminology.yml', error: err.message }); }

        // 4. Save tone-of-voice.yml
        const toneData = {
          owner: canonOwner,
          voice: {
            name: brand?.company_name ? `${brand.company_name} Voice` : 'Brand Voice',
            summary: 'Confident without being loud. Technical without being cold.',
            principles: voicePrinciples || [],
          },
          terminology: { forbidden: forbidden || [] },
        };
        const toneYaml = skillsToToneYaml(toneData);
        try {
          const r = await githubPutFile(owner, repo, '.narrative/skills/tone-of-voice.yml', toneYaml, 'Initialize tone of voice via Narrative Agent', session.githubToken);
          if (r.status === 200 || r.status === 201) results.files.push('tone-of-voice.yml');
          else results.errors.push({ file: 'tone-of-voice.yml', error: `Status ${r.status}` });
        } catch (err) { results.errors.push({ file: 'tone-of-voice.yml', error: err.message }); }

        // Invalidate cache and re-scan
        repoCache.delete(fullName);
        let scanResult = null;
        try {
          const freshData = await getRepoData(owner, repo, session.githubToken);
          scanResult = freshData.lastCheck;
        } catch (err) {
          results.errors.push({ file: 'scan', error: err.message });
        }

        json(res, 200, { ...results, result: scanResult });
        return;
      }

      json(res, 404, { error: `Unknown route: ${rest}` });
      return;
    }

    // ---- LLM Status ----

    if (pathname === '/api/llm/status' && req.method === 'GET') {
      // Check if session has configured LLM
      if (session && session.llmConfig) {
        json(res, 200, {
          available: true,
          provider: session.llmConfig.provider,
          model: session.llmConfig.provider === 'anthropic' ? 'claude-3-5-sonnet' : 'gpt-4o-mini',
          source: 'session'
        });
      } else {
        // Fall back to environment config
        json(res, 200, getLLMConfig());
      }
      return;
    }

    // ---- Secure LLM Configuration ----

    if (pathname === '/api/user/llm-config' && req.method === 'GET') {
      if (!session) {
        json(res, 401, { error: 'Not authenticated' });
        return;
      }

      json(res, 200, {
        configured: !!session.llmConfig,
        provider: session.llmConfig?.provider || null
      });
      return;
    }

    if (pathname === '/api/user/llm-config' && req.method === 'POST') {
      if (!session) {
        json(res, 401, { error: 'Not authenticated' });
        return;
      }

      // SECURITY: Validate CSRF token
      if (!validateCSRF(req, session)) {
        json(res, 403, { error: 'Invalid CSRF token. Please refresh and try again.' });
        return;
      }

      let body;
      try { body = await readBody(req); } catch (err) {
        json(res, 413, { error: err.message });
        return;
      }

      const { provider, apiKey } = body || {};

      if (!provider || !apiKey) {
        json(res, 400, { error: 'Provider and API key required' });
        return;
      }

      // Validate provider
      if (!['anthropic', 'openai'].includes(provider)) {
        json(res, 400, { error: 'Invalid provider' });
        return;
      }

      // Encrypt and store API key in session
      const sessionId = getSessionId(req);
      const encrypted = encryptApiKey(apiKey, sessionId);

      session.llmConfig = {
        provider,
        encryptedKey: encrypted.encryptedKey,
        iv: encrypted.iv
      };

      json(res, 200, { saved: true });
      return;
    }

    if (pathname === '/api/user/llm-config' && req.method === 'DELETE') {
      if (!session) {
        json(res, 401, { error: 'Not authenticated' });
        return;
      }

      delete session.llmConfig;
      json(res, 200, { deleted: true });
      return;
    }

    // ---- StoryMining API ----

    if (pathname === '/api/mine/live' && req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
      const { text, sourceType, repoFullName } = body || {};
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        json(res, 400, { error: 'Missing or empty text field' });
        return;
      }

      let existingGraph;
      if (repoFullName && session.connectedRepos.has(repoFullName)) {
        const [rOwner, rRepo] = repoFullName.split('/');
        try {
          const data = await getRepoData(rOwner, rRepo, session.githubToken);
          existingGraph = data.canon.units;
        } catch { /* proceed without existing graph */ }
      }

      const mineResult = await llmMineNarrativeUnits(text, { sourceType, existingGraph });

      // Build algebra from mined candidates
      const algebraUnits = mineResult.candidates.map(c => ({
        id: c.id,
        type: c.type,
        assertion: c.assertion,
        confidence: c.confidence,
        dependencies: c.dependencies || [],
        intent: {},
        validationState: 'pending',
      }));

      let algebra = null;
      if (algebraUnits.length > 0) {
        try {
          const result = createAlgebra(algebraUnits);
          algebra = result.algebra;
        } catch { /* algebra may fail on minimal data */ }
      }

      const algebraResult = {};
      if (algebra) {
        try {
          const metrics = algebra.computeMetrics();
          algebraResult.nci = metrics.narrativeCoherenceIndex;
          algebraResult.layerHealth = metrics.layerHealth;
          algebraResult.totalEdges = metrics.totalEdges;
        } catch { algebraResult.nci = 0; }
        try {
          const coverResult = algebra.cover();
          algebraResult.coverage = coverResult.coverage;
          algebraResult.coverageByLayer = coverResult.byLayer;
          algebraResult.gaps = coverResult.gaps.map(u => u.id);
          algebraResult.orphans = coverResult.orphans.map(u => u.id);
        } catch { algebraResult.coverage = 0; }
        try {
          const driftResult = algebra.drift();
          algebraResult.drift = driftResult.driftRate;
          algebraResult.driftByLayer = driftResult.byLayer;
        } catch { algebraResult.drift = 0; }
        // Stakeholder views
        algebraResult.stakeholderViews = {};
        for (const preset of Object.keys(STAKEHOLDER_PRESETS)) {
          try {
            const view = algebra.composeForStakeholder(preset);
            algebraResult.stakeholderViews[preset] = {
              unitCount: view.units.length,
              edgeCount: view.edges.length,
            };
          } catch { algebraResult.stakeholderViews[preset] = { unitCount: 0, edgeCount: 0 }; }
        }
      }

      json(res, 200, {
        candidates: mineResult.candidates,
        coverage: mineResult.coverage,
        meta: mineResult.meta,
        algebra: algebraResult,
      });
      return;
    }

    if (pathname === '/api/mine' && req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
      const { text, sourceType, repoFullName } = body || {};
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        json(res, 400, { error: 'Missing or empty text field' });
        return;
      }

      // If repo provided, load existing graph for dependency matching
      let existingGraph;
      if (repoFullName && session.connectedRepos.has(repoFullName)) {
        const [rOwner, rRepo] = repoFullName.split('/');
        try {
          const data = await getRepoData(rOwner, rRepo, session.githubToken);
          existingGraph = data.canon.units;
        } catch { /* proceed without existing graph */ }
      }

      const useLLM = body.llm !== false && getLLMConfig().available;
      let result;
      if (useLLM) {
        result = await llmMineNarrativeUnits(text, { sourceType, existingGraph });
      } else {
        result = mineNarrativeUnits(text, { sourceType, existingGraph });
      }
      json(res, 200, result);
      return;
    }

    // ---- Workspace API (memory-backed, no GitHub needed) ----

    if (pathname === '/api/workspaces' && req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
      const name = body?.name || 'Untitled Workspace';
      const store = new MemoryAdapter(name);
      workspaces.set(store.id, store);
      json(res, 201, { id: store.id, name: store.name, type: 'memory' });
      return;
    }

    if (pathname.startsWith('/api/workspaces/') && pathname !== '/api/workspaces/') {
      const parts = pathname.slice('/api/workspaces/'.length).split('/');
      const workspaceId = parts[0];
      const wsRest = parts.slice(1).join('/');
      const store = workspaces.get(workspaceId);

      if (!store) {
        json(res, 404, { error: `Workspace ${workspaceId} not found` });
        return;
      }

      // GET /api/workspaces/:id/canon
      if (wsRest === 'canon' && req.method === 'GET') {
        const data = await store.load();
        json(res, 200, data);
        return;
      }

      // POST /api/workspaces/:id/units/save
      if (wsRest === 'units/save' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const { units: newUnits, filename, metadata } = body || {};
        if (!newUnits || !Array.isArray(newUnits) || newUnits.length === 0) {
          json(res, 400, { error: 'Missing or empty units array' });
          return;
        }
        const result = await store.saveUnits(newUnits, filename, metadata || {});
        json(res, 200, result);
        return;
      }

      // POST /api/workspaces/:id/mine
      if (wsRest === 'mine' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const { text, sourceType } = body || {};
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          json(res, 400, { error: 'Missing or empty text field' });
          return;
        }
        const existing = await store.load();
        const useLLM = body.llm !== false && getLLMConfig().available;
        let result;
        if (useLLM) {
          result = await llmMineNarrativeUnits(text, { sourceType, existingGraph: existing.units });
        } else {
          result = mineNarrativeUnits(text, { sourceType, existingGraph: existing.units });
        }
        json(res, 200, result);
        return;
      }

      // GET /api/workspaces/:id/weights — get layer weights
      if (wsRest === 'weights' && req.method === 'GET') {
        const weights = await store.getWeights();
        json(res, 200, { weights: weights || DEFAULT_LAYER_WEIGHTS, isCustom: weights !== null });
        return;
      }

      // PUT /api/workspaces/:id/weights — save layer weights
      if (wsRest === 'weights' && req.method === 'PUT') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const { weights } = body || {};
        if (!weights || typeof weights !== 'object') {
          json(res, 400, { error: 'Missing or invalid weights object' });
          return;
        }
        await store.saveWeights(weights);
        json(res, 200, { saved: true, weights });
        return;
      }

      // POST /api/workspaces/:id/harvest — URL-based narrative harvest
      if (wsRest === 'harvest' && req.method === 'POST') {
        // SECURITY: Validate CSRF token
        if (!validateCSRF(req, session)) {
          json(res, 403, { error: 'Invalid CSRF token. Please refresh and try again.' });
          return;
        }

        // SECURITY: Check harvest-specific rate limit
        if (!checkHarvestRateLimit(session)) {
          json(res, 429, {
            error: 'Harvest rate limit exceeded. Maximum 3 harvests per minute.',
            retryAfter: 60
          });
          return;
        }

        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        // SECURITY FIX: Remove llmConfig from client - use server-stored encrypted keys
        const { url: harvestUrlStr, depth, maxPages, dateAfter, pathPrefix } = body || {};
        if (!harvestUrlStr || typeof harvestUrlStr !== 'string') {
          json(res, 400, { error: 'Missing or invalid url field' });
          return;
        }

        try {
          // 1. Fetch pages
          const harvest = await harvestUrl(harvestUrlStr, {
            depth: depth || 0,
            maxPages: maxPages || 20,
            dateAfter: dateAfter || null,
            sameDomain: true,
            pathPrefix: pathPrefix || null,
          });

          if (harvest.pages.length === 0) {
            json(res, 200, {
              pages: [],
              candidates: [],
              algebra: {},
              totalPages: 0,
              totalUnits: 0,
              errors: harvest.errors,
            });
            return;
          }

          // 2. Mine each page
          const existing = await store.load();
          const allCandidates = [];
          const pageResults = [];

          // SECURITY FIX: Use server-side encrypted keys instead of client-provided keys
          let useLLM = false;
          let tempEnvBackup = null;
          let tempEnvBackup2 = null;

          if (session && session.llmConfig) {
            // Decrypt API key from session
            const sessionId = getSessionId(req);
            const apiKey = decryptApiKey(
              session.llmConfig.encryptedKey,
              session.llmConfig.iv,
              sessionId
            );

            // Temporarily set env var for this request
            if (session.llmConfig.provider === 'openai') {
              tempEnvBackup = process.env.OPENAI_API_KEY;
              process.env.OPENAI_API_KEY = apiKey;
              useLLM = true;
            } else {
              tempEnvBackup2 = process.env.ANTHROPIC_API_KEY;
              process.env.ANTHROPIC_API_KEY = apiKey;
              useLLM = true;
            }
          } else {
            useLLM = getLLMConfig().available;
          }

          for (const page of harvest.pages) {
            let mineResult;
            const combinedGraph = [...(existing.units || []), ...allCandidates];
            try {
              if (useLLM) {
                mineResult = await llmMineNarrativeUnits(page.text, {
                  sourceType: page.sourceType,
                  existingGraph: combinedGraph,
                });
              } else {
                mineResult = mineNarrativeUnits(page.text, {
                  sourceType: page.sourceType,
                  existingGraph: combinedGraph,
                });
              }
            } catch {
              mineResult = { candidates: [], coverage: {}, meta: {} };
            }

            // Dedup: skip candidates whose assertion is >80% similar to existing
            const newCandidates = [];
            for (const c of mineResult.candidates) {
              const isDup = allCandidates.some(existing =>
                assertionSimilarity(c.assertion, existing.assertion) > 0.8
              );
              if (!isDup) {
                // Tag with source URL
                c.source = { url: page.url, title: page.title };
                newCandidates.push(c);
                allCandidates.push(c);
              }
            }

            pageResults.push({
              url: page.url,
              title: page.title,
              wordCount: page.wordCount,
              sourceType: page.sourceType,
              publishDate: page.publishDate,
              unitsFound: newCandidates.length,
            });
          }

          // 3. Run algebra on merged set
          const algebraUnits = allCandidates.map(c => ({
            id: c.id,
            type: c.type,
            assertion: c.assertion,
            confidence: c.confidence,
            dependencies: c.dependencies || [],
            intent: {},
            validationState: 'pending',
          }));

          let algebraResult = {};
          if (algebraUnits.length > 0) {
            try {
              const { algebra } = createAlgebra(algebraUnits);
              const metrics = algebra.computeMetrics();
              algebraResult.nci = metrics.narrativeCoherenceIndex;
              algebraResult.layerHealth = metrics.layerHealth;
              algebraResult.totalEdges = metrics.totalEdges;
              try {
                const coverResult = algebra.cover();
                algebraResult.coverage = coverResult.coverage;
                algebraResult.gaps = coverResult.gaps.map(u => u.id);
              } catch { algebraResult.coverage = 0; }
              try {
                const driftResult = algebra.drift();
                algebraResult.drift = driftResult.driftRate;
              } catch { algebraResult.drift = 0; }
            } catch { /* algebra may fail on minimal data */ }
          }

          // 4. Auto-save to workspace
          if (allCandidates.length > 0) {
            const unitsToSave = algebraUnits;
            try {
              await store.saveUnits(unitsToSave, 'harvest-' + Date.now() + '.yaml', {
                source: harvestUrlStr,
                harvestedAt: new Date().toISOString(),
                pageCount: harvest.pages.length,
              });
            } catch { /* save failure is non-fatal */ }
          }

          // Restore original env vars if temporarily overridden
          if (session && session.llmConfig) {
            if (session.llmConfig.provider === 'openai') {
              if (tempEnvBackup) process.env.OPENAI_API_KEY = tempEnvBackup;
              else delete process.env.OPENAI_API_KEY;
            } else {
              if (tempEnvBackup2) process.env.ANTHROPIC_API_KEY = tempEnvBackup2;
              else delete process.env.ANTHROPIC_API_KEY;
            }
          }

          json(res, 200, {
            pages: pageResults,
            candidates: allCandidates,
            algebra: algebraResult,
            totalPages: harvest.totalFetched,
            totalUnits: allCandidates.length,
            errors: harvest.errors,
          });
        } catch (err) {
          // Restore original env vars on error too
          if (session && session.llmConfig) {
            if (session.llmConfig.provider === 'openai') {
              if (tempEnvBackup) process.env.OPENAI_API_KEY = tempEnvBackup;
              else delete process.env.OPENAI_API_KEY;
            } else {
              if (tempEnvBackup2) process.env.ANTHROPIC_API_KEY = tempEnvBackup2;
              else delete process.env.ANTHROPIC_API_KEY;
            }
          }
          json(res, 500, { error: `Harvest failed: ${err.message}` });
        }
        return;
      }

      json(res, 404, { error: `Unknown workspace route: ${wsRest}` });
      return;
    }

    // 404
    json(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('Unhandled error:', err);
    json(res, 500, { error: 'Internal server error' });
  }
});

// ============================================================================
// Start
// ============================================================================

if (require.main === module) {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    console.error('\n  Missing required environment variables:');
    console.error('    GITHUB_CLIENT_ID');
    console.error('    GITHUB_CLIENT_SECRET');
    console.error('\n  Create a GitHub OAuth App at https://github.com/settings/applications/new');
    console.error(`  Set the callback URL to: ${BASE_URL}/auth/callback\n`);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log('');
    console.log('  ┌───────────────────────────────────────────────────┐');
    console.log('  │                                                   │');
    console.log('  │   Narrative Agent — Web Dashboard                  │');
    console.log('  │                                                   │');
    console.log(`  │   App:      ${BASE_URL.padEnd(37)}│`);
    console.log(`  │   Auth:     ${(BASE_URL + '/auth/github').padEnd(37)}│`);
    console.log(`  │   Webhook:  ${(BASE_URL + '/webhook/github').padEnd(37)}│`);
    console.log('  │                                                   │');
    console.log('  └───────────────────────────────────────────────────┘');
    console.log('');
  });
}

// ============================================================================
// Exports (for testing)
// ============================================================================

module.exports = {
  server,
  sessions,
  repoCache,
  sseClients,
  workspaces,
  signSession,
  verifySession,
  verifyWebhookSignature,
  checkRateLimit,
  runClarionCall,
  reviewContent,
  fetchRepoCanon,
  createSessionId,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  getSessionId,
  parseCookies,
  // For testing route handler directly
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW,
  // Editor helpers (re-exported from store.js)
  unitsToYaml,
  skillsToTerminologyYaml,
  skillsToToneYaml,
  githubPutFile,
  // Store classes (re-exported from store.js)
  GitHubAdapter,
  MemoryAdapter,
  // StoryMining (re-exported from storymining.js)
  mineNarrativeUnits,
  // LLM StoryMining (re-exported from storymining-llm.js)
  llmMineNarrativeUnits,
  getLLMConfig,
  // Prescriptive actions (re-exported from prescriptive-actions.js)
  generateActions,
  generateAllActions,
  summarizeActions,
  buildLLMPrompt,
};
