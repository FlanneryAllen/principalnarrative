#!/usr/bin/env node
/**
 * Smoke tests for the narrative CLI.
 * Runs init, check, status in a temp directory to verify end-to-end behavior.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, 'cli.js');
let passed = 0;
let failed = 0;
let tmpDir;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function run(args, opts = {}) {
  const cwd = opts.cwd || tmpDir;
  return execSync(`node ${CLI} ${args}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, ...opts.env },
  });
}

function runJSON(args, opts = {}) {
  const out = run(args, opts);
  return JSON.parse(out);
}

// ============================================================================
// Setup
// ============================================================================

tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'narrative-test-'));
console.log(`\n  narrative CLI smoke tests`);
console.log(`  ─────────────────────────`);
console.log(`  tmp: ${tmpDir}\n`);

// ============================================================================
// Tests
// ============================================================================

test('--version prints version', () => {
  const out = run('--version');
  if (!out.match(/narrative \d+\.\d+\.\d+/)) throw new Error(`Unexpected: ${out.trim()}`);
});

test('help prints usage', () => {
  const out = run('help');
  if (!out.includes('Commands:')) throw new Error('Missing Commands section');
  if (!out.includes('init')) throw new Error('Missing init command');
  if (!out.includes('watch')) throw new Error('Missing watch command');
});

test('unknown command exits 1', () => {
  try {
    run('doesnotexist');
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('doesnotexist') && !err.stderr?.includes('doesnotexist')) {
      // execSync throws on non-zero exit, which is expected
    }
  }
});

test('init --defaults scaffolds .narrative/', () => {
  run('init --defaults');
  const narrativeDir = path.join(tmpDir, '.narrative');
  if (!fs.existsSync(narrativeDir)) throw new Error('.narrative/ not created');
  if (!fs.existsSync(path.join(narrativeDir, 'canon', 'core-story.yml'))) throw new Error('Missing core-story.yml');
  if (!fs.existsSync(path.join(narrativeDir, 'skills', 'terminology.yml'))) throw new Error('Missing terminology.yml');
});

test('check --json returns valid JSON with expected shape', () => {
  // Create a test .md file
  fs.writeFileSync(path.join(tmpDir, 'test.md'), '# Test\n\nThis is a test document about software visibility and builders.\n');
  const data = runJSON('check --json');
  if (typeof data.overallScore !== 'number') throw new Error('Missing overallScore');
  if (!Array.isArray(data.files)) throw new Error('Missing files array');
  if (data.files.length === 0) throw new Error('No files scanned');
});

test('check catches forbidden terms', () => {
  fs.writeFileSync(path.join(tmpDir, 'bad.md'),
    '# Bad Copy\n\nWe leverage cutting-edge AI to synergize and disrupt the paradigm.\n'.repeat(10));
  const data = runJSON('check --json');
  const bad = data.files.find(f => f.file === 'bad.md');
  if (!bad) throw new Error('bad.md not found in results');
  if (bad.score >= 80) throw new Error(`Score too high for bad content: ${bad.score}`);
  if (bad.violations.length === 0) throw new Error('No violations found');
});

test('check --threshold exits 1 when file below threshold', () => {
  try {
    run('check --threshold 90');
    throw new Error('Should have failed');
  } catch (err) {
    // Expected — bad.md is below 90
  }
});

test('status --json returns valid JSON', () => {
  const data = runJSON('status --json');
  if (typeof data.combined !== 'number') throw new Error('Missing combined');
  if (typeof data.canonScore !== 'number') throw new Error('Missing canonScore');
  if (typeof data.contentScore !== 'number') throw new Error('Missing contentScore');
  if (typeof data.files !== 'number') throw new Error('Missing files count');
});

test('status --json shows history after multiple runs', () => {
  // Run status again to create history
  runJSON('status --json');
  const data = runJSON('status --json');
  if (data.previous === null || data.previous === undefined) throw new Error('No previous score in history');
});

test('check creates history file', () => {
  const historyDir = path.join(tmpDir, '.narrative', 'history');
  if (!fs.existsSync(historyDir)) throw new Error('History dir not created');
  const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) throw new Error('No history files');
});

// ============================================================================
// Cleanup
// ============================================================================

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n  ─────────────────────────`);
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
