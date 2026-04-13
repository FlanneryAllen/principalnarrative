#!/usr/bin/env node
/**
 * narrative serve — Local API server + live dashboard
 *
 * Reads .narrative/canon/ and .narrative/skills/ from disk,
 * serves an API and the Clarion Call dashboard backed by real data.
 * File changes push updates via SSE so the dashboard refreshes live.
 *
 * Usage: node packages/serve/server.js [--port 3333] [--dir .]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { checkContent, findFiles } = require('./check');

// ============================================================================
// Config
// ============================================================================

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const PORT = parseInt(getArg('--port', '3333'), 10);
const PROJECT_DIR = path.resolve(getArg('--dir', '.'));
const NARRATIVE_DIR = path.join(PROJECT_DIR, '.narrative');

// ============================================================================
// Canon Parser (mirrors packages/agent/canon-parser.ts)
// ============================================================================

function parseCanon() {
  const result = { units: [], skills: {}, files: [], errors: [] };

  // Parse canon files
  const canonDir = path.join(NARRATIVE_DIR, 'canon');
  if (fs.existsSync(canonDir)) {
    const files = fs.readdirSync(canonDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const file of files) {
      const filePath = path.join(canonDir, file);
      result.files.push(filePath);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
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
              source_file: path.basename(filePath),
            });
          }
        }
      } catch (err) {
        result.errors.push({ file: filePath, error: err.message });
      }
    }
  }

  // Parse skill files
  const skillsDir = path.join(NARRATIVE_DIR, 'skills');
  if (fs.existsSync(skillsDir)) {
    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const file of files) {
      const filePath = path.join(skillsDir, file);
      result.files.push(filePath);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = YAML.parse(content);
        if (parsed?.voice) result.skills.voice = parsed.voice;
        if (parsed?.terminology) result.skills.terminology = parsed.terminology;
        if (parsed?.brand) result.skills.brand = parsed.brand;
        if (parsed?.products) result.skills.products = parsed.products;
      } catch (err) {
        result.errors.push({ file: filePath, error: err.message });
      }
    }
  }

  return result;
}

// ============================================================================
// Clarion Call Engine (mirrors packages/agent/clarion-call.ts)
// ============================================================================

function runClarionCall(units, skills, trigger = 'demand') {
  const drift = checkDrift(units);
  const orphans = checkOrphanedDeps(units);
  const terminology = checkTerminology(units, skills);
  const tone = checkTone(units, skills);

  const totalIssues = drift.length + orphans.length + terminology.length + tone.length;
  const maxIssues = units.length * 4;
  const score = maxIssues > 0
    ? Math.round(Math.max(0, 100 - (totalIssues / maxIssues * 100)))
    : 100;

  return {
    timestamp: new Date().toISOString(),
    trigger,
    totalUnits: units.length,
    coherenceScore: score,
    driftAlerts: drift,
    terminologyViolations: terminology,
    toneViolations: tone,
    orphanedDependencies: orphans,
  };
}

function checkDrift(units) {
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
          unitId: unit.id,
          parentId: dep.id,
          severity: 'error',
          message: `Theme conflict: [${conflicts.join(', ')}] forbidden by parent "${dep.id}"`,
        });
      }

      const unitTone = unit.intent?.constraints?.content?.tone;
      const depTone = dep.intent?.constraints?.content?.tone;
      if (unitTone && depTone && unitTone !== depTone) {
        alerts.push({
          unitId: unit.id,
          parentId: dep.id,
          severity: 'warning',
          message: `Tone mismatch: "${unit.id}" uses "${unitTone}" but parent "${dep.id}" uses "${depTone}"`,
        });
      }
    }
  }
  return alerts;
}

function checkOrphanedDeps(units) {
  const ids = new Set(units.map(u => u.id));
  const orphans = [];
  for (const unit of units) {
    for (const dep of unit.dependencies) {
      if (!ids.has(dep)) {
        orphans.push({ unitId: unit.id, missingDep: dep });
      }
    }
  }
  return orphans;
}

function checkTerminology(units, skills) {
  const violations = [];
  const forbidden = skills.terminology?.forbidden || [];
  const brandWrong = skills.brand?.never || [];
  const brandCorrect = skills.brand?.company_name || 'Principal AI';
  const products = skills.products || [];

  for (const unit of units) {
    const text = unit.assertion.toLowerCase();

    // Forbidden terms
    for (const term of forbidden) {
      if (text.includes(term.toLowerCase())) {
        violations.push({
          unitId: unit.id, severity: 'warning',
          message: `Forbidden term: "${term}"`,
        });
      }
    }

    // Brand violations
    for (const wrong of brandWrong) {
      if (unit.assertion.includes(wrong)) {
        violations.push({
          unitId: unit.id, severity: 'error',
          message: `Wrong brand name: "${wrong}" → use "${brandCorrect}"`,
        });
      }
    }

    // Product name violations
    for (const product of products) {
      for (const wrong of (product.never || [])) {
        if (unit.assertion.includes(wrong)) {
          violations.push({
            unitId: unit.id, severity: 'error',
            message: `Wrong product name: "${wrong}" → use "${product.name}"`,
          });
        }
      }
    }
  }
  return violations;
}

function checkTone(units, skills) {
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
        violations.push({
          unitId: unit.id, severity: 'warning',
          message: `Tone: "${pattern}" sounds like marketing-speak`,
        });
      }
    }
  }
  return violations;
}

// Content review — checks arbitrary text (not a unit) against skills
function reviewContent(text, skills) {
  const violations = [];
  const lower = text.toLowerCase();

  // Forbidden terms
  for (const term of (skills.terminology?.forbidden || [])) {
    if (lower.includes(term.toLowerCase())) {
      violations.push({ severity: 'warning', message: `Forbidden term: "${term}"` });
    }
  }

  // Brand
  for (const wrong of (skills.brand?.never || [])) {
    if (text.includes(wrong)) {
      violations.push({ severity: 'error', message: `Brand: "${wrong}" → "${skills.brand.company_name}"` });
    }
  }

  // Product names
  for (const product of (skills.products || [])) {
    for (const wrong of (product.never || [])) {
      if (text.includes(wrong)) {
        violations.push({ severity: 'error', message: `Product: "${wrong}" → "${product.name}"` });
      }
    }
  }

  // Tone
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

  // Theme alignment
  const coreThemes = ['visibility', 'builders', 'software', 'see', 'building', 'human', 'structure', 'motion', 'meaning'];
  const hasRelevantTheme = coreThemes.some(t => lower.includes(t));
  if (!hasRelevantTheme && text.length > 100) {
    violations.push({ severity: 'warning', message: 'Content may not align with core narrative themes (visibility, builders, seeing more)' });
  }

  return violations;
}

// ============================================================================
// SSE — Server-Sent Events for live updates
// ============================================================================

const sseClients = new Set();

function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(msg);
  }
}

// ============================================================================
// File Watcher
// ============================================================================

let fsWatchHandles = [];

function startFileWatcher() {
  const dirs = [
    path.join(NARRATIVE_DIR, 'canon'),
    path.join(NARRATIVE_DIR, 'skills'),
  ];

  // Debounce
  let timer = null;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const handle = fs.watch(dir, { persistent: true }, (eventType, filename) => {
        if (!filename || !filename.match(/\.(yml|yaml)$/)) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          console.log(`\n  File changed: ${dir}/${filename}`);
          console.log(`  Running clarion call...\n`);

          const canon = parseCanon();
          const result = runClarionCall(canon.units, canon.skills, 'change');

          console.log(`  Score: ${result.coherenceScore}/100`);
          console.log(`  Drift: ${result.driftAlerts.length}  Terminology: ${result.terminologyViolations.length}  Tone: ${result.toneViolations.length}`);

          // Push to all connected dashboards
          broadcastSSE('clarion-call', {
            canon: {
              units: canon.units,
              skills: canon.skills,
            },
            result,
          });
        }, 800);
      });
      fsWatchHandles.push(handle);
    } catch (err) {
      console.error(`  Warning: could not watch ${dir}: ${err.message}`);
    }
  }
}

// ============================================================================
// HTTP Server
// ============================================================================

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(body); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ---- API Routes ----

  if (url.pathname === '/api/canon' && req.method === 'GET') {
    const canon = parseCanon();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(canon));
    return;
  }

  if (url.pathname === '/api/clarion-call' && req.method === 'POST') {
    const body = await readBody(req);
    const canon = parseCanon();

    // If body includes a test assertion, add it as a temporary unit
    let units = [...canon.units];
    if (body?.testAssertion) {
      units.push({
        id: 'test_assertion',
        type: 'test',
        assertion: body.testAssertion,
        intent: {},
        dependencies: ['core_visibility'],
        confidence: 0,
        _isTest: true,
      });
    }

    const result = runClarionCall(units, canon.skills, body?.trigger || 'demand');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (url.pathname === '/api/review' && req.method === 'POST') {
    const body = await readBody(req);
    const canon = parseCanon();
    const violations = reviewContent(body?.text || '', canon.skills);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ violations }));
    return;
  }

  // ---- Content check: scan actual files ----

  if (url.pathname === '/api/check' && req.method === 'GET') {
    const canon = parseCanon();
    const target = url.searchParams.get('file');
    const targets = target ? [target] : [];

    // Find files relative to PROJECT_DIR
    let filePaths;
    if (targets.length > 0) {
      filePaths = targets.map(t => path.resolve(PROJECT_DIR, t)).filter(f => fs.existsSync(f));
    } else {
      filePaths = findFiles([], PROJECT_DIR).slice(0, 200); // cap for safety
    }

    const results = [];
    for (const fp of filePaths) {
      const content = fs.readFileSync(fp, 'utf-8');
      const rel = path.relative(PROJECT_DIR, fp);
      const result = checkContent(content, canon.skills, rel);
      results.push({ file: rel, ...result });
    }

    results.sort((a, b) => a.score - b.score);

    const totalWords = results.reduce((s, r) => s + r.wordCount, 0);
    const overallScore = totalWords > 0
      ? Math.round(results.reduce((s, r) => s + r.score * r.wordCount, 0) / totalWords)
      : 100;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      overallScore,
      filesChecked: results.length,
      totalViolations: results.reduce((s, r) => s + r.violations.length, 0),
      files: results,
    }));
    return;
  }

  if (url.pathname === '/api/check' && req.method === 'POST') {
    const body = await readBody(req);
    const canon = parseCanon();
    // Check inline content against skills
    const content = body?.content || body?.text || '';
    const filename = body?.filename || 'inline';
    const result = checkContent(content, canon.skills, filename);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ file: filename, ...result }));
    return;
  }

  // ---- History endpoint ----

  if (url.pathname === '/api/history' && req.method === 'GET') {
    const historyDir = path.join(NARRATIVE_DIR, 'history');
    const entries = [];
    if (fs.existsSync(historyDir)) {
      const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json')).sort();
      // Return last 50 entries
      for (const file of files.slice(-50)) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf-8'));
          entries.push(data);
        } catch {}
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ entries }));
    return;
  }

  // ---- SSE endpoint ----

  if (url.pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('event: connected\ndata: {}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ---- Serve dashboard ----

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const dashboardPath = path.join(__dirname, '..', '..', 'clarion-dashboard', 'index.html');
    if (fs.existsSync(dashboardPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(dashboardPath, 'utf-8'));
    } else {
      res.writeHead(404);
      res.end('Dashboard not found. Expected at clarion-dashboard/index.html');
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', routes: ['/api/canon', '/api/clarion-call', '/api/review', '/api/check', '/api/history', '/api/events', '/'] }));
});

// ============================================================================
// Start
// ============================================================================

server.listen(PORT, () => {
  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log('  │                                               │');
  console.log(`  │   Clarion Call — Narrative Coherence Server    │`);
  console.log('  │                                               │');
  console.log(`  │   Dashboard:  http://localhost:${PORT}            │`);
  console.log(`  │   API:        http://localhost:${PORT}/api/canon  │`);
  console.log(`  │   Events:     http://localhost:${PORT}/api/events │`);
  console.log('  │                                               │');
  console.log(`  │   Watching:   ${path.relative(process.cwd(), NARRATIVE_DIR)}/     │`);
  console.log('  │                                               │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log('');

  // Run initial check
  const canon = parseCanon();
  const result = runClarionCall(canon.units, canon.skills, 'schedule');
  console.log(`  Initial check: ${result.coherenceScore}/100 — ${canon.units.length} units, ${result.driftAlerts.length + result.terminologyViolations.length + result.toneViolations.length} issues`);
  console.log(`  Watching for changes...\n`);

  startFileWatcher();
});

process.on('SIGINT', () => {
  console.log('\n  Shutting down...');
  for (const h of fsWatchHandles) h.close();
  server.close();
  process.exit(0);
});
