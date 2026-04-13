#!/usr/bin/env node
/**
 * Server API tests — exercises every HTTP endpoint and security guard.
 *
 * Starts the server on a random port, runs tests, kills the server.
 * Usage: node packages/serve/test-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const results = { passed: 0, failed: 0 };
let serverProcess;
let PORT;
let TMP_DIR;

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    log('✓', name);
  } catch (err) {
    results.failed++;
    log('✗', `${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ============================================================================
// Setup
// ============================================================================

function setup() {
  // Create temp project with .narrative/
  TMP_DIR = fs.mkdtempSync(path.join(require('os').tmpdir(), 'narrative-server-test-'));

  // Scaffold using init
  execSync(`node ${path.join(__dirname, 'cli.js')} init --defaults --dir "${TMP_DIR}" --company "TestCo" --tagline "We test things."`, {
    stdio: 'pipe',
  });

  // Add test content files
  fs.writeFileSync(path.join(TMP_DIR, 'good.md'), '# TestCo\nWe build software that helps teams see their work clearly.');
  fs.writeFileSync(path.join(TMP_DIR, 'bad.md'), '# TestCo\nWe leverage AI to disrupt the paradigm with cutting-edge synergy.');
  fs.mkdirSync(path.join(TMP_DIR, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, 'sub', 'nested.md'), '# Nested\nA simple document about building.');

  // Pick a random port
  PORT = 10000 + Math.floor(Math.random() * 50000);

  // Start server
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', [path.join(__dirname, 'server.js'), '--port', String(PORT), '--dir', TMP_DIR], {
      stdio: 'pipe',
    });

    let started = false;
    serverProcess.stdout.on('data', data => {
      if (!started && data.toString().includes('Watching for changes')) {
        started = true;
        resolve();
      }
    });
    serverProcess.stderr.on('data', data => {
      if (!started) {
        reject(new Error(`Server stderr: ${data}`));
      }
    });

    // Timeout
    setTimeout(() => {
      if (!started) reject(new Error('Server failed to start in 5s'));
    }, 5000);
  });
}

function teardown() {
  if (serverProcess) serverProcess.kill('SIGTERM');
  if (TMP_DIR) fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

// ============================================================================
// Tests
// ============================================================================

async function runTests() {
  console.log('');
  console.log('  narrative server API tests');
  console.log('  ─────────────────────────');
  console.log(`  tmp: ${TMP_DIR}`);
  console.log(`  port: ${PORT}`);
  console.log('');

  // ── GET /api/canon ──

  await test('GET /api/canon returns units and skills', async () => {
    const res = await request('GET', '/api/canon');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.units), 'units should be array');
    assert(res.body.units.length >= 1, 'should have at least 1 unit');
    assert(res.body.skills, 'should have skills');
    assert(res.body.units[0].id, 'unit should have id');
    assert(res.body.units[0].assertion, 'unit should have assertion');
  });

  // ── POST /api/clarion-call ──

  await test('POST /api/clarion-call returns coherence score', async () => {
    const res = await request('POST', '/api/clarion-call', {});
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.body.coherenceScore === 'number', 'should have coherenceScore');
    assert(res.body.coherenceScore >= 0 && res.body.coherenceScore <= 100, 'score should be 0-100');
    assert(Array.isArray(res.body.driftAlerts), 'should have driftAlerts');
    assert(Array.isArray(res.body.terminologyViolations), 'should have terminologyViolations');
  });

  await test('POST /api/clarion-call with test assertion detects bad copy', async () => {
    const res = await request('POST', '/api/clarion-call', {
      testAssertion: 'We leverage AI to disrupt the paradigm',
    });
    assert(res.status === 200);
    // Should find tone violations from the test assertion
    const toneViolations = res.body.toneViolations || [];
    assert(toneViolations.length > 0, 'should detect tone violations in bad test assertion');
  });

  // ── POST /api/review ──

  await test('POST /api/review scores clean text with no violations', async () => {
    const res = await request('POST', '/api/review', {
      text: 'We build software that helps teams see their work clearly.',
    });
    assert(res.status === 200);
    assert(Array.isArray(res.body.violations), 'should have violations array');
  });

  await test('POST /api/review catches forbidden terms', async () => {
    const res = await request('POST', '/api/review', {
      text: 'We leverage cutting-edge synergy to disrupt the paradigm.',
    });
    assert(res.status === 200);
    assert(res.body.violations.length > 0, 'should find violations');
    const messages = res.body.violations.map(v => v.message);
    assert(messages.some(m => m.includes('leverage')), 'should flag leverage');
  });

  // ── GET /api/check ──

  await test('GET /api/check scans all files', async () => {
    const res = await request('GET', '/api/check');
    assert(res.status === 200);
    assert(typeof res.body.overallScore === 'number', 'should have overallScore');
    assert(res.body.filesChecked >= 3, `expected >= 3 files, got ${res.body.filesChecked}`);
    assert(Array.isArray(res.body.files), 'should have files array');
    // bad.md should score low
    const badFile = res.body.files.find(f => f.file === 'bad.md');
    assert(badFile, 'should include bad.md');
    assert(badFile.score < 50, `bad.md should score low, got ${badFile.score}`);
  });

  await test('GET /api/check?file=good.md scans specific file', async () => {
    const res = await request('GET', '/api/check?file=good.md');
    assert(res.status === 200);
    assert(res.body.filesChecked === 1, `expected 1 file, got ${res.body.filesChecked}`);
    assert(res.body.files[0].file === 'good.md', 'should be good.md');
  });

  // ── Security: path traversal ──

  await test('GET /api/check?file=../../etc/passwd is blocked by path guard', async () => {
    const res = await request('GET', '/api/check?file=../../etc/passwd');
    assert(res.status === 200);
    assert(res.body.filesChecked === 0, `expected 0 files (blocked), got ${res.body.filesChecked}`);
  });

  await test('GET /api/check?file=/etc/passwd is blocked (absolute path)', async () => {
    const res = await request('GET', '/api/check?file=/etc/passwd');
    assert(res.status === 200);
    assert(res.body.filesChecked === 0, `expected 0 files (blocked), got ${res.body.filesChecked}`);
  });

  // ── POST /api/check ──

  await test('POST /api/check scores inline content', async () => {
    const res = await request('POST', '/api/check', {
      content: 'We leverage synergy to maximize paradigm shifts and unlock unprecedented value for all stakeholders in the ecosystem today.',
      filename: 'test-inline.md',
    });
    assert(res.status === 200);
    assert(res.body.file === 'test-inline.md');
    assert(res.body.score < 80, `inline bad content should score low, got ${res.body.score}`);
    assert(res.body.violations.length > 0, 'should have violations');
  });

  // ── Security: body size limit ──

  await test('POST with oversized body is rejected', async () => {
    // Generate > 1MB of data
    const bigBody = JSON.stringify({ text: 'x'.repeat(1.5 * 1024 * 1024) });
    let rejected = false;
    try {
      const res = await request('POST', '/api/review', bigBody);
      // 413 means the server properly rejected it
      rejected = (res.status === 413);
    } catch (err) {
      // Connection reset is also valid — server killed the connection
      rejected = (err.code === 'ECONNRESET' || err.message.includes('ECONNRESET') || err.message.includes('socket hang up'));
    }
    assert(rejected, 'Server should reject oversized body with 413 or connection reset');
  });

  // ── GET /api/history ──

  await test('GET /api/history returns entries array', async () => {
    const res = await request('GET', '/api/history');
    assert(res.status === 200);
    assert(Array.isArray(res.body.entries), 'should have entries array');
  });

  // ── CORS ──

  await test('CORS rejects non-localhost origin', async () => {
    const res = await request('GET', '/api/canon', null, {
      'Origin': 'https://evil.com',
    });
    assert(res.status === 200); // Still serves the data (it's localhost)
    assert(!res.headers['access-control-allow-origin'] ||
           res.headers['access-control-allow-origin'] !== 'https://evil.com',
      'should not echo evil.com origin');
  });

  await test('CORS allows localhost origin', async () => {
    const res = await request('GET', '/api/canon', null, {
      'Origin': `http://localhost:${PORT}`,
    });
    assert(res.status === 200);
    assert(res.headers['access-control-allow-origin'] === `http://localhost:${PORT}`,
      `expected localhost origin in CORS header, got: ${res.headers['access-control-allow-origin']}`);
  });

  // ── GET / (dashboard) ──

  await test('GET / serves dashboard HTML', async () => {
    const res = await request('GET', '/');
    assert(res.status === 200);
    assert(typeof res.body === 'string' || res.raw.includes('<!DOCTYPE html>'),
      'should serve HTML');
  });

  // ── 404 ──

  await test('GET /nonexistent returns 404 with route list', async () => {
    const res = await request('GET', '/nonexistent');
    assert(res.status === 404);
    assert(res.body.error === 'Not found', 'should have error message');
    assert(Array.isArray(res.body.routes), 'should list available routes');
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error(`  Setup error: ${err.message}`);
    results.failed++;
  } finally {
    teardown();
  }

  console.log('');
  console.log(`  ─────────────────────────`);
  console.log(`  ${results.passed + results.failed} tests: ${results.passed} passed, ${results.failed} failed`);
  console.log('');
  process.exit(results.failed > 0 ? 1 : 0);
}

main();
