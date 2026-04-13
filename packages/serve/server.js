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
const { createAlgebra, STAKEHOLDER_PRESETS, ALL_LAYERS } = require('./algebra');

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
// Clarion Call Engine — powered by Narrative Algebra (Σ Δ Ω ρ κ δ)
// ============================================================================

function runClarionCall(units, skills, trigger = 'demand') {
  // Build the real algebra from canon units
  const { algebra } = createAlgebra(units);

  // Algebra-powered metrics
  const metrics = algebra.computeMetrics();
  const driftResult = algebra.drift();
  const coverResult = algebra.cover();

  // Skill-based checks (terminology, tone, orphans)
  const themeConflicts = checkThemeConflicts(units);
  const orphans = checkOrphanedDeps(units);
  const terminology = checkTerminology(units, skills);
  const tone = checkTone(units, skills);

  // Coherence score is now the Narrative Coherence Index
  const coherenceScore = Math.round(metrics.narrativeCoherenceIndex * 100);

  return {
    timestamp: new Date().toISOString(),
    trigger,
    totalUnits: units.length,
    coherenceScore,
    // Algebra metrics
    nci: metrics.narrativeCoherenceIndex,
    coverageRatio: metrics.coverageRatio,
    layerHealth: metrics.layerHealth,
    totalEdges: metrics.totalEdges,
    driftRate: driftResult.driftRate,
    driftedUnits: driftResult.driftedUnits.map(u => u.id),
    coverageByLayer: coverResult.byLayer,
    gaps: coverResult.gaps.map(u => u.id),
    orphanUnits: coverResult.orphans.map(u => u.id),
    // Skill-based checks (backward compatible)
    driftAlerts: themeConflicts,
    terminologyViolations: terminology,
    toneViolations: tone,
    orphanedDependencies: orphans,
  };
}

/** Check theme/tone conflicts between units and their dependencies */
function checkThemeConflicts(units) {
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

    for (const term of forbidden) {
      if (text.includes(term.toLowerCase())) {
        violations.push({
          unitId: unit.id, severity: 'warning',
          message: `Forbidden term: "${term}"`,
        });
      }
    }

    for (const wrong of brandWrong) {
      if (unit.assertion.includes(wrong)) {
        violations.push({
          unitId: unit.id, severity: 'error',
          message: `Wrong brand name: "${wrong}" → use "${brandCorrect}"`,
        });
      }
    }

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

/** Review arbitrary text against narrative graph + skills */
function reviewContent(text, skills, units) {
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

  // Algebra-powered resonance (if units provided)
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

    // If resonance is very low, flag it
    if (res.resonance === 0 && text.length > 100) {
      violations.push({ severity: 'warning', message: 'Content has no resonance with narrative graph — may not align with organizational narrative' });
    }
  }

  return { violations, resonance };
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

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(body); }
    });
    req.on('error', reject);
  });
}

/**
 * Validate that a resolved file path is within the project directory.
 * Prevents path traversal attacks via ?file=../../etc/passwd
 */
function isInsideProject(filePath) {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(PROJECT_DIR + path.sep) || resolved === PROJECT_DIR;
}

const server = http.createServer(async (req, res) => {
  // CORS — restrict to localhost origins only
  const origin = req.headers.origin || '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
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
    let body;
    try { body = await readBody(req); } catch (err) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
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
    let body;
    try { body = await readBody(req); } catch (err) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
    const canon = parseCanon();
    const result = reviewContent(body?.text || '', canon.skills, canon.units);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // ---- Content check: scan actual files ----

  if (url.pathname === '/api/check' && req.method === 'GET') {
    const canon = parseCanon();
    const target = url.searchParams.get('file');
    const targets = target ? [target] : [];

    // Find files relative to PROJECT_DIR (with path traversal guard)
    let filePaths;
    if (targets.length > 0) {
      filePaths = targets
        .map(t => path.resolve(PROJECT_DIR, t))
        .filter(f => isInsideProject(f) && fs.existsSync(f));
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
    let body;
    try { body = await readBody(req); } catch (err) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
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

  // ---- Algebra endpoints ----

  if (url.pathname === '/api/metrics' && req.method === 'GET') {
    const canon = parseCanon();
    const { algebra } = createAlgebra(canon.units);
    const metrics = algebra.computeMetrics();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics));
    return;
  }

  if (url.pathname === '/api/compose' && req.method === 'GET') {
    const canon = parseCanon();
    const { algebra } = createAlgebra(canon.units);
    const stakeholder = url.searchParams.get('stakeholder');
    if (!stakeholder || !STAKEHOLDER_PRESETS[stakeholder]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Invalid stakeholder. Available: ${Object.keys(STAKEHOLDER_PRESETS).join(', ')}` }));
      return;
    }
    const subgraph = algebra.composeForStakeholder(stakeholder);
    // Serialize units to avoid circular refs
    const result = {
      stakeholder,
      unitCount: subgraph.units.length,
      edgeCount: subgraph.edges.length,
      units: subgraph.units.map(u => ({ id: u.id, type: u.type, assertion: u.assertion, validationState: u.validationState, confidence: u.confidence })),
      edges: subgraph.edges,
      provenance: subgraph.provenance,
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (url.pathname === '/api/propagate' && req.method === 'GET') {
    const canon = parseCanon();
    const { algebra } = createAlgebra(canon.units);
    const unitId = url.searchParams.get('unit');
    if (!unitId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing ?unit= parameter' }));
      return;
    }
    try {
      const result = algebra.propagate(unitId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        changedUnit: { id: result.changedUnit.id, type: result.changedUnit.type, assertion: result.changedUnit.assertion },
        affectedCount: result.affectedUnits.length,
        scope: result.scope,
        affectedUnits: result.affectedUnits.map(u => ({ id: u.id, type: u.type, assertion: u.assertion })),
        byLayer: Object.fromEntries(Object.entries(result.byLayer).map(([k, v]) => [k, v.length])),
      }));
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/api/drift' && req.method === 'GET') {
    const canon = parseCanon();
    const { algebra } = createAlgebra(canon.units);
    const result = algebra.drift();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      driftRate: result.driftRate,
      driftedUnits: result.driftedUnits.map(u => ({ id: u.id, type: u.type, assertion: u.assertion })),
      byLayer: result.byLayer,
    }));
    return;
  }

  if (url.pathname === '/api/cover' && req.method === 'GET') {
    const canon = parseCanon();
    const { algebra } = createAlgebra(canon.units);
    const result = algebra.cover();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      coverage: result.coverage,
      byLayer: result.byLayer,
      gaps: result.gaps.map(u => ({ id: u.id, type: u.type })),
      orphans: result.orphans.map(u => ({ id: u.id, type: u.type })),
    }));
    return;
  }

  if (url.pathname === '/api/validate' && req.method === 'POST') {
    const canon = parseCanon();
    const { algebra } = createAlgebra(canon.units);
    // validateAll already ran in createAlgebra; re-run for fresh results
    const results = algebra.validateAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ results }));
    return;
  }

  if (url.pathname === '/api/resonate' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch (err) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
    const signal = body?.signal || body?.text || '';
    if (!signal) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing signal or text in request body' }));
      return;
    }
    const canon = parseCanon();
    const { algebra } = createAlgebra(canon.units);
    const result = algebra.resonate(signal);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      resonance: result.resonance,
      relevance: result.relevance,
      scope: result.scope,
      urgency: result.urgency,
      matchedUnits: result.matchedUnits.map(m => ({
        id: m.unit.id,
        type: m.unit.type,
        assertion: m.unit.assertion,
        similarity: m.similarity,
      })),
    }));
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
    // Look for dashboard: 1) sibling file (npm install), 2) monorepo path (dev)
    const candidates = [
      path.join(__dirname, 'dashboard.html'),
      path.join(__dirname, '..', '..', 'clarion-dashboard', 'index.html'),
    ];
    const dashboardPath = candidates.find(p => fs.existsSync(p));
    if (dashboardPath) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(dashboardPath, 'utf-8'));
    } else {
      res.writeHead(404);
      res.end('Dashboard not found. Run from the narrative-agent repo or reinstall the package.');
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', routes: [
    '/api/canon', '/api/clarion-call', '/api/review', '/api/check', '/api/history',
    '/api/metrics', '/api/compose?stakeholder=', '/api/propagate?unit=',
    '/api/drift', '/api/cover', '/api/validate', '/api/resonate',
    '/api/events', '/'
  ] }));
});

// ============================================================================
// Start
// ============================================================================

server.listen(PORT, '127.0.0.1', () => {
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
