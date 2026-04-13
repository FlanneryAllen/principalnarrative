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

const { createAlgebra, STAKEHOLDER_PRESETS, ALL_LAYERS } = require('./algebra');
const { checkContent } = require('./check');

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

// ============================================================================
// In-Memory Store
// ============================================================================

/** @type {Map<string, {githubToken: string, user: object, connectedRepos: Set<string>, rateLimit: {count: number, resetAt: number}}>} */
const sessions = new Map();

/** @type {Map<string, {canon: object, lastCheck: object, history: object[]}>} */
const repoCache = new Map();

/** @type {Map<string, Set<http.ServerResponse>>} sessionId → SSE connections */
const sseClients = new Map();

// ============================================================================
// Session Management — HMAC-SHA256 signed cookies
// ============================================================================

function createSessionId() {
  return crypto.randomBytes(24).toString('hex');
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

function setSessionCookie(res, sessionId) {
  const signed = signSession(sessionId);
  const isSecure = BASE_URL.startsWith('https');
  res.setHeader('Set-Cookie',
    `na_session=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isSecure ? '; Secure' : ''}`
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

// ============================================================================
// GitHub API — stdlib https only
// ============================================================================

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function githubGet(apiPath, token) {
  return httpsRequest({
    hostname: 'api.github.com',
    path: apiPath,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'NarrativeAgent/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
}

function githubPost(hostname, apiPath, data, headers = {}) {
  const postData = typeof data === 'string' ? data : new URLSearchParams(data).toString();
  return httpsRequest({
    hostname,
    path: apiPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'application/json',
      'User-Agent': 'NarrativeAgent/1.0',
      ...headers,
    },
  }, postData);
}

/**
 * Fetch .narrative/ canon and skills from a GitHub repo via the Contents API.
 * Returns the same { units, skills, files, errors } shape as parseCanon() in server.js.
 */
async function fetchRepoCanon(owner, repo, token) {
  const result = { units: [], skills: {}, files: [], errors: [] };

  // Helper: list directory contents
  async function listDir(dirPath) {
    const res = await githubGet(`/repos/${owner}/${repo}/contents/${dirPath}`, token);
    if (res.status === 404) return [];
    if (res.status !== 200) {
      result.errors.push({ file: dirPath, error: `GitHub API ${res.status}` });
      return [];
    }
    return Array.isArray(res.body) ? res.body : [];
  }

  // Helper: get file content (base64 decoded)
  async function getFileContent(filePath) {
    const res = await githubGet(`/repos/${owner}/${repo}/contents/${filePath}`, token);
    if (res.status !== 200) {
      result.errors.push({ file: filePath, error: `GitHub API ${res.status}` });
      return null;
    }
    if (res.body.encoding === 'base64' && res.body.content) {
      return Buffer.from(res.body.content, 'base64').toString('utf-8');
    }
    result.errors.push({ file: filePath, error: 'Unexpected encoding' });
    return null;
  }

  // Parse canon files
  const canonFiles = await listDir('.narrative/canon');
  for (const file of canonFiles) {
    if (!file.name.match(/\.ya?ml$/)) continue;
    const content = await getFileContent(file.path);
    if (!content) continue;
    result.files.push(file.path);
    try {
      const parsed = YAML.parse(content);
      if (parsed?.units) {
        for (const unit of parsed.units) {
          result.units.push({
            id: unit.id,
            type: unit.type,
            assertion: (unit.assertion || '').trim(),
            intent: unit.intent || {},
            dependencies: unit.dependencies || [],
            confidence: unit.confidence ?? 1.0,
            evidence_required: unit.evidence_required || [],
            source_file: file.name,
          });
        }
      }
    } catch (err) {
      result.errors.push({ file: file.path, error: err.message });
    }
  }

  // Parse skill files
  const skillFiles = await listDir('.narrative/skills');
  for (const file of skillFiles) {
    if (!file.name.match(/\.ya?ml$/)) continue;
    const content = await getFileContent(file.path);
    if (!content) continue;
    result.files.push(file.path);
    try {
      const parsed = YAML.parse(content);
      if (parsed?.voice) result.skills.voice = parsed.voice;
      if (parsed?.terminology) result.skills.terminology = parsed.terminology;
      if (parsed?.brand) result.skills.brand = parsed.brand;
      if (parsed?.products) result.skills.products = parsed.products;
    } catch (err) {
      result.errors.push({ file: file.path, error: err.message });
    }
  }

  return result;
}

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

  // CORS — same-origin only for hosted app
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

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

      // Create session
      const sessionId = createSessionId();
      sessions.set(sessionId, {
        githubToken: token,
        user: {
          login: userRes.body.login,
          name: userRes.body.name,
          avatar_url: userRes.body.avatar_url,
          id: userRes.body.id,
        },
        connectedRepos: new Set(),
        rateLimit: { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW },
      });

      setSessionCookie(res, sessionId);
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
      const { algebra } = createAlgebra(canon.units);

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

      // Route: /api/repos/:owner/:repo/review
      if (rest === 'review' && req.method === 'POST') {
        let body;
        try { body = await readBody(req); } catch (err) { json(res, 413, { error: err.message }); return; }
        const result = reviewContent(body?.text || '', canon.skills, canon.units);
        json(res, 200, result);
        return;
      }

      json(res, 404, { error: `Unknown route: ${rest}` });
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
};
