#!/usr/bin/env node
/**
 * narrative — Unified CLI for the Narrative Agent
 *
 * Usage:
 *   narrative init              Scaffold .narrative/ for a new project
 *   narrative serve             Start dashboard + API server
 *   narrative check             Scan all .md files against canon
 *   narrative check <file>      Scan specific files or directories
 *   narrative status            Quick coherence score (no server needed)
 *   narrative watch             Re-run check on every file save
 *   narrative metrics           NCI, coverage, drift, layer health
 *   narrative compose <preset>  Stakeholder subgraph (board, investor, ...)
 *   narrative propagate <id>    Impact analysis for a unit change
 *   narrative drift             Drift analysis across layers
 *   narrative cover             Coverage analysis with gaps/orphans
 *   narrative validate          Full graph validation
 *   narrative help              Show this help
 *
 * Options:
 *   --dir <path>      Project root (default: current directory)
 *   --port <num>      Server port for serve (default: 3333)
 *   --json            JSON output for check/status
 *   --threshold <n>   Fail check if any file scores below n
 *   --defaults        Non-interactive mode for init
 *   --version         Show version
 */

const path = require('path');
const fs = require('fs');

// ============================================================================
// Version
// ============================================================================

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
const VERSION = pkg.version || '0.1.0';

// ============================================================================
// Parse args
// ============================================================================

const rawArgs = process.argv.slice(2);
const command = rawArgs.find(a => !a.startsWith('-')) || 'help';
const restArgs = rawArgs.filter(a => a !== command);

function hasFlag(name) {
  return rawArgs.includes(name);
}

if (hasFlag('--version') || hasFlag('-v')) {
  console.log(`narrative ${VERSION}`);
  process.exit(0);
}

// ============================================================================
// Branding
// ============================================================================

const BRAND = `
  ┌──────────────────────────────────────┐
  │                                      │
  │   narrative v${VERSION.padEnd(23)}│
  │   Coherence engine for narrative     │
  │                                      │
  └──────────────────────────────────────┘
`;

// ============================================================================
// Commands
// ============================================================================

async function main() {
  switch (command) {
    case 'init':
      return runInit();
    case 'serve':
    case 'start':
    case 'dashboard':
      return runServe();
    case 'check':
    case 'scan':
    case 'lint':
      return runCheck();
    case 'status':
      return runStatus();
    case 'watch':
      return runWatch();
    case 'metrics':
      return runMetrics();
    case 'compose':
      return runCompose();
    case 'propagate':
      return runPropagate();
    case 'drift':
      return runDrift();
    case 'cover':
      return runCover();
    case 'validate':
      return runValidate();
    case 'help':
    case '--help':
    case '-h':
      return showHelp();
    default:
      console.error(`\n  Unknown command: "${command}"\n`);
      showHelp();
      process.exit(1);
  }
}

// ── init ──────────────────────────────────────────────────────────────────────

function runInit() {
  // Forward to init.js with all remaining args
  process.argv = ['node', path.join(__dirname, 'init.js'), ...restArgs];
  require('./init');
}

// ── serve ─────────────────────────────────────────────────────────────────────

function runServe() {
  // Forward to server.js with all remaining args
  process.argv = ['node', path.join(__dirname, 'server.js'), ...restArgs];
  require('./server');
}

// ── check ─────────────────────────────────────────────────────────────────────

function runCheck() {
  // Forward to check.js with all remaining args
  process.argv = ['node', path.join(__dirname, 'check.js'), ...restArgs];
  const { main: checkMain } = require('./check');
  checkMain();
}

// ── status ────────────────────────────────────────────────────────────────────

function runStatus() {
  const { checkContent, findFiles, parseCanon: parseCanonFromCheck } = require('./check');

  function getArg(name, fallback) {
    const i = restArgs.indexOf(name);
    return i !== -1 && restArgs[i + 1] ? restArgs[i + 1] : fallback;
  }
  const jsonOutput = hasFlag('--json');
  const projectDir = path.resolve(getArg('--dir', '.'));
  const narrativeDir = path.join(projectDir, '.narrative');

  if (!fs.existsSync(narrativeDir)) {
    console.error('\n  No .narrative/ directory found. Run `narrative init` first.\n');
    process.exit(1);
  }

  // Parse canon
  const YAML = require('yaml');
  const units = [];
  const skills = {};

  const canonDir = path.join(narrativeDir, 'canon');
  if (fs.existsSync(canonDir)) {
    for (const file of fs.readdirSync(canonDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
      try {
        const parsed = YAML.parse(fs.readFileSync(path.join(canonDir, file), 'utf-8'));
        if (parsed?.units) {
          for (const u of parsed.units) {
            units.push({
              id: u.id, type: u.type,
              assertion: (u.assertion || '').trim(),
              intent: u.intent || {},
              dependencies: u.dependencies || [],
            });
          }
        }
      } catch {}
    }
  }

  const skillsDir = path.join(narrativeDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const file of fs.readdirSync(skillsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
      try {
        const parsed = YAML.parse(fs.readFileSync(path.join(skillsDir, file), 'utf-8'));
        if (parsed?.voice) skills.voice = parsed.voice;
        if (parsed?.terminology) skills.terminology = parsed.terminology;
        if (parsed?.brand) skills.brand = parsed.brand;
        if (parsed?.products) skills.products = parsed.products;
      } catch {}
    }
  }

  // Canon coherence (quick inline check)
  let canonIssues = 0;
  const unitIds = new Set(units.map(u => u.id));
  for (const u of units) {
    for (const dep of u.dependencies) {
      if (!unitIds.has(dep)) canonIssues++;
    }
  }

  // Content check
  const files = findFiles([], projectDir);
  let totalWords = 0;
  let weightedScore = 0;
  let fileCount = files.length;
  let totalViolations = 0;

  for (const fp of files) {
    const content = fs.readFileSync(fp, 'utf-8');
    const result = checkContent(content, skills, path.relative(projectDir, fp));
    totalWords += result.wordCount;
    weightedScore += result.score * result.wordCount;
    totalViolations += result.violations.length;
  }

  const contentScore = totalWords > 0 ? Math.round(weightedScore / totalWords) : 100;
  const canonScore = units.length > 0 ? Math.round(Math.max(0, 100 - (canonIssues / (units.length * 4) * 100))) : 100;
  const combined = Math.round((canonScore + contentScore) / 2);

  // Read last history entry if available
  const historyDir = path.join(narrativeDir, 'history');
  let lastScore = null;
  let lastTimestamp = null;
  if (fs.existsSync(historyDir)) {
    const entries = fs.readdirSync(historyDir).filter(f => f.endsWith('.json')).sort();
    if (entries.length > 0) {
      try {
        const last = JSON.parse(fs.readFileSync(path.join(historyDir, entries[entries.length - 1]), 'utf-8'));
        lastScore = last.combined ?? last.contentScore ?? null;
        lastTimestamp = last.timestamp || entries[entries.length - 1].replace('.json', '');
      } catch {}
    }
  }

  // Save to history
  saveHistory(narrativeDir, {
    timestamp: new Date().toISOString(),
    command: 'status',
    combined, canonScore, contentScore,
    units: units.length,
    files: fileCount,
    violations: totalViolations,
  });

  if (jsonOutput) {
    console.log(JSON.stringify({
      combined, canonScore, contentScore,
      units: units.length, files: fileCount,
      violations: totalViolations, canonIssues,
      previous: lastScore,
    }, null, 2));
  } else {
    const icon = combined >= 80 ? '✓' : combined >= 60 ? '~' : '✗';
    const trend = lastScore !== null
      ? (combined > lastScore ? ` ↑ from ${lastScore}` : combined < lastScore ? ` ↓ from ${lastScore}` : ' (unchanged)')
      : '';

    console.log('');
    console.log(`  narrative status`);
    console.log(`  ────────────────`);
    console.log(`  ${icon} Combined:  ${combined}/100${trend}`);
    console.log(`    Canon:    ${canonScore}/100 (${units.length} units, ${canonIssues} issues)`);
    console.log(`    Content:  ${contentScore}/100 (${fileCount} files, ${totalViolations} violations)`);
    console.log('');
  }
}

// ── algebra commands ──────────────────────────────────────────────────────────

function loadCanonUnits(projectDir) {
  const YAML = require('yaml');
  const narrativeDir = path.join(projectDir, '.narrative');
  if (!fs.existsSync(narrativeDir)) {
    console.error('\n  No .narrative/ directory found. Run `narrative init` first.\n');
    process.exit(1);
  }
  const units = [];
  const canonDir = path.join(narrativeDir, 'canon');
  if (fs.existsSync(canonDir)) {
    for (const file of fs.readdirSync(canonDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
      try {
        const parsed = YAML.parse(fs.readFileSync(path.join(canonDir, file), 'utf-8'));
        if (parsed?.units) {
          for (const u of parsed.units) {
            units.push({
              id: u.id, type: u.type,
              assertion: (u.assertion || '').trim(),
              intent: u.intent || {},
              dependencies: u.dependencies || [],
              confidence: u.confidence ?? 1.0,
            });
          }
        }
      } catch {}
    }
  }
  return units;
}

function getProjectDir() {
  function getArg(name, fallback) {
    const i = restArgs.indexOf(name);
    return i !== -1 && restArgs[i + 1] ? restArgs[i + 1] : fallback;
  }
  return path.resolve(getArg('--dir', '.'));
}

function runMetrics() {
  const { createAlgebra, ALL_LAYERS } = require('./algebra');
  const projectDir = getProjectDir();
  const units = loadCanonUnits(projectDir);

  if (units.length === 0) {
    console.log('\n  No narrative units found in .narrative/canon/\n');
    return;
  }

  const { algebra } = createAlgebra(units);
  const metrics = algebra.computeMetrics();
  const driftResult = algebra.drift();

  if (hasFlag('--json')) {
    console.log(JSON.stringify({ ...metrics, driftRate: driftResult.driftRate }, null, 2));
    return;
  }

  const nciPct = Math.round(metrics.narrativeCoherenceIndex * 100);
  const covPct = Math.round(metrics.coverageRatio * 100);
  const driftPct = Math.round(driftResult.driftRate * 100);
  const nciIcon = nciPct >= 80 ? '✓' : nciPct >= 60 ? '~' : '✗';

  console.log('');
  console.log('  Narrative Algebra — Metrics');
  console.log('  ══════════════════════════════════════════');
  console.log(`  ${nciIcon} NCI (Narrative Coherence Index):  ${nciPct}%`);
  console.log(`    Coverage:                        ${covPct}%`);
  console.log(`    Drift rate:                      ${driftPct}%`);
  console.log(`    Units: ${metrics.totalUnits}    Edges: ${metrics.totalEdges}`);
  console.log('');
  console.log('  Layer Health');
  console.log('  ──────────────────────────────────────────');
  for (const layer of ALL_LAYERS) {
    const h = metrics.layerHealth[layer];
    if (h.unitCount === 0) continue;
    const pct = Math.round(h.nci * 100);
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    console.log(`  ${layer.padEnd(20)} ${bar} ${pct}%  (${h.alignedCount}/${h.unitCount} aligned${h.driftedCount ? `, ${h.driftedCount} drifted` : ''}${h.brokenCount ? `, ${h.brokenCount} broken` : ''})`);
  }
  console.log('');
}

function runCompose() {
  const { createAlgebra, STAKEHOLDER_PRESETS } = require('./algebra');
  const projectDir = getProjectDir();
  const units = loadCanonUnits(projectDir);
  const preset = restArgs.find(a => !a.startsWith('-') && a !== command);

  if (!preset || !STAKEHOLDER_PRESETS[preset]) {
    console.log(`\n  Usage: narrative compose <stakeholder>`);
    console.log(`  Available: ${Object.keys(STAKEHOLDER_PRESETS).join(', ')}\n`);
    return;
  }

  const { algebra } = createAlgebra(units);
  const subgraph = algebra.composeForStakeholder(preset);

  if (hasFlag('--json')) {
    console.log(JSON.stringify({
      stakeholder: preset,
      units: subgraph.units.map(u => ({ id: u.id, type: u.type, assertion: u.assertion, validationState: u.validationState })),
      edges: subgraph.edges,
    }, null, 2));
    return;
  }

  console.log('');
  console.log(`  Σ Compose — ${preset} stakeholder view`);
  console.log('  ══════════════════════════════════════════');
  console.log(`  Units: ${subgraph.units.length}    Edges: ${subgraph.edges.length}`);
  console.log('');
  for (const u of subgraph.units) {
    const stateIcon = u.validationState === 'ALIGNED' ? '✓' : u.validationState === 'DRIFTED' ? '~' : '?';
    console.log(`  ${stateIcon} [${u.type}] ${u.id}`);
    console.log(`    ${u.assertion.substring(0, 100)}${u.assertion.length > 100 ? '...' : ''}`);
  }
  console.log('');
}

function runPropagate() {
  const { createAlgebra } = require('./algebra');
  const projectDir = getProjectDir();
  const units = loadCanonUnits(projectDir);
  const unitId = restArgs.find(a => !a.startsWith('-') && a !== command);

  if (!unitId) {
    console.log('\n  Usage: narrative propagate <unit-id>');
    console.log(`  Available units: ${units.map(u => u.id).join(', ')}\n`);
    return;
  }

  const { algebra } = createAlgebra(units);

  try {
    const result = algebra.propagate(unitId);

    if (hasFlag('--json')) {
      console.log(JSON.stringify({
        changedUnit: result.changedUnit.id,
        scope: result.scope,
        affectedUnits: result.affectedUnits.map(u => ({ id: u.id, type: u.type })),
      }, null, 2));
      return;
    }

    console.log('');
    console.log(`  Δ Propagate — impact of changing "${unitId}"`);
    console.log('  ══════════════════════════════════════════');
    console.log(`  Scope: ${Math.round(result.scope * 100)}% of graph affected`);
    console.log(`  Affected units: ${result.affectedUnits.length}`);
    console.log('');
    if (result.affectedUnits.length > 0) {
      for (const u of result.affectedUnits) {
        console.log(`    → [${u.type}] ${u.id}`);
      }
    } else {
      console.log('    No downstream units affected.');
    }
    console.log('');
  } catch (err) {
    console.error(`\n  Error: ${err.message}\n`);
    process.exit(1);
  }
}

function runDrift() {
  const { createAlgebra, ALL_LAYERS } = require('./algebra');
  const projectDir = getProjectDir();
  const units = loadCanonUnits(projectDir);
  const { algebra } = createAlgebra(units);
  const result = algebra.drift();

  if (hasFlag('--json')) {
    console.log(JSON.stringify({
      driftRate: result.driftRate,
      driftedUnits: result.driftedUnits.map(u => ({ id: u.id, type: u.type })),
      byLayer: result.byLayer,
    }, null, 2));
    return;
  }

  const pct = Math.round(result.driftRate * 100);
  console.log('');
  console.log('  δ Drift — coherence decay analysis');
  console.log('  ══════════════════════════════════════════');
  console.log(`  Overall drift rate: ${pct}%`);
  console.log('');

  for (const layer of ALL_LAYERS) {
    const l = result.byLayer[layer];
    if (l.total === 0) continue;
    const rate = Math.round(l.rate * 100);
    console.log(`  ${layer.padEnd(20)} ${l.drifted}/${l.total} drifted (${rate}%)`);
  }

  if (result.driftedUnits.length > 0) {
    console.log('');
    console.log('  Drifted units:');
    for (const u of result.driftedUnits) {
      console.log(`    ~ [${u.type}] ${u.id}`);
    }
  } else {
    console.log('');
    console.log('  ✓ No drift detected. Narrative is coherent.');
  }
  console.log('');
}

function runCover() {
  const { createAlgebra, ALL_LAYERS } = require('./algebra');
  const projectDir = getProjectDir();
  const units = loadCanonUnits(projectDir);
  const { algebra } = createAlgebra(units);
  const result = algebra.cover();

  if (hasFlag('--json')) {
    console.log(JSON.stringify({
      coverage: result.coverage,
      byLayer: result.byLayer,
      gaps: result.gaps.map(u => ({ id: u.id, type: u.type })),
      orphans: result.orphans.map(u => ({ id: u.id, type: u.type })),
    }, null, 2));
    return;
  }

  const pct = Math.round(result.coverage * 100);
  console.log('');
  console.log('  κ Cover — narrative completeness');
  console.log('  ══════════════════════════════════════════');
  console.log(`  Overall coverage: ${pct}%`);
  console.log('');

  for (const layer of ALL_LAYERS) {
    const l = result.byLayer[layer];
    if (l.total === 0) continue;
    const cov = Math.round(l.coverage * 100);
    console.log(`  ${layer.padEnd(20)} ${l.aligned}/${l.total} covered (${cov}%)`);
  }

  if (result.gaps.length > 0) {
    console.log('');
    console.log('  Gaps (no evidence backing):');
    for (const u of result.gaps) {
      console.log(`    ○ [${u.type}] ${u.id}`);
    }
  }

  if (result.orphans.length > 0) {
    console.log('');
    console.log('  Orphans (no connections):');
    for (const u of result.orphans) {
      console.log(`    ○ [${u.type}] ${u.id}`);
    }
  }
  console.log('');
}

function runValidate() {
  const { createAlgebra } = require('./algebra');
  const projectDir = getProjectDir();
  const units = loadCanonUnits(projectDir);
  const { algebra } = createAlgebra(units);
  const results = algebra.validateAll();

  if (hasFlag('--json')) {
    console.log(JSON.stringify({ results }, null, 2));
    return;
  }

  console.log('');
  console.log('  Ω Validate — full graph validation');
  console.log('  ══════════════════════════════════════════');
  console.log(`  Units validated: ${results.length}`);
  console.log('');

  for (const r of results) {
    const icon = r.newState === 'ALIGNED' ? '✓' : r.newState === 'DRIFTED' ? '~' : r.newState === 'BROKEN' ? '✗' : '?';
    const confPct = Math.round(r.confidence * 100);
    console.log(`  ${icon} ${r.unitId}  ${r.newState} (${confPct}% confidence)`);
    for (const reason of r.reasons) {
      console.log(`    ${reason}`);
    }
  }
  console.log('');
}

// ── watch ─────────────────────────────────────────────────────────────────────

function runWatch() {
  const { main: checkMain } = require('./check');

  function getArg(name, fallback) {
    const i = restArgs.indexOf(name);
    return i !== -1 && restArgs[i + 1] ? restArgs[i + 1] : fallback;
  }
  const projectDir = path.resolve(getArg('--dir', '.'));
  const narrativeDir = path.join(projectDir, '.narrative');

  if (!fs.existsSync(narrativeDir)) {
    console.error('\n  No .narrative/ directory found. Run `narrative init` first.\n');
    process.exit(1);
  }

  // Extensions to watch
  const watchExts = new Set(['.md', '.mdx', '.txt', '.yml', '.yaml']);

  // Debounce
  let timer = null;
  let lastRun = 0;
  const DEBOUNCE_MS = 500;

  function runCheckQuiet() {
    const now = Date.now();
    if (now - lastRun < DEBOUNCE_MS) return;
    lastRun = now;

    // Clear and re-run
    const ts = new Date().toLocaleTimeString();
    console.log(`\n  ── ${ts} ──────────────────────────────────────`);

    // Re-run check by spawning fresh — avoids require cache issues
    const { execSync } = require('child_process');
    try {
      const out = execSync(
        `node ${JSON.stringify(path.join(__dirname, 'check.js'))} --dir ${JSON.stringify(projectDir)}`,
        { cwd: projectDir, encoding: 'utf-8', timeout: 30000 }
      );
      process.stdout.write(out);
    } catch (err) {
      // check.js exits 1 if threshold fails, still show output
      if (err.stdout) process.stdout.write(err.stdout);
      if (err.stderr) process.stderr.write(err.stderr);
    }
  }

  console.log(BRAND);
  console.log('  Watching for changes... (Ctrl+C to stop)');
  console.log(`  Dir: ${projectDir}`);
  console.log('');

  // Initial run
  runCheckQuiet();

  // Watch project directory recursively
  const watchers = [];

  function watchDir(dir) {
    try {
      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const ext = path.extname(filename).toLowerCase();
        if (!watchExts.has(ext)) return;

        // Skip history files
        if (filename.includes('history')) return;

        if (timer) clearTimeout(timer);
        timer = setTimeout(runCheckQuiet, DEBOUNCE_MS);
      });
      watchers.push(watcher);
    } catch (err) {
      // recursive watch not supported on all platforms, fall back
      console.error(`  Warning: recursive watch not available, watching top-level only`);
    }
  }

  watchDir(projectDir);

  // Keep alive
  process.on('SIGINT', () => {
    console.log('\n  Stopped watching.\n');
    for (const w of watchers) w.close();
    process.exit(0);
  });
}

// ── history ───────────────────────────────────────────────────────────────────

function saveHistory(narrativeDir, data) {
  const historyDir = path.join(narrativeDir, 'history');
  try {
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.writeFileSync(
      path.join(historyDir, `${ts}.json`),
      JSON.stringify(data, null, 2) + '\n'
    );
  } catch {}
}

// ── help ──────────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(BRAND);
  console.log(`  Usage: narrative <command> [options]

  Commands:
    init                Scaffold .narrative/ for a new project
    serve               Start dashboard + API server
    check [files...]    Scan .md files against canon + skills
    status              Quick coherence score (canon + content)
    watch               Re-run check on every file save
    help                Show this help

  Algebra:
    metrics             NCI, coverage, drift, layer health
    compose <preset>    Stakeholder subgraph (board, investor, ...)
    propagate <id>      Impact of changing a unit
    drift               Drift analysis across layers
    cover               Coverage analysis with gaps/orphans
    validate            Full graph validation

  Options:
    --dir <path>        Project root (default: .)
    --port <num>        Server port (default: 3333)
    --json              JSON output for check/status
    --threshold <n>     Fail if any file scores below n
    --defaults          Non-interactive mode for init
    --version           Show version

  Examples:
    narrative init
    narrative serve --port 4000
    narrative check
    narrative check README.md docs/
    narrative check --json --threshold 70
    narrative status
    narrative watch
`);
}

// ============================================================================
// Run
// ============================================================================

main().catch(err => {
  console.error(err);
  process.exit(1);
});
