#!/usr/bin/env node
/**
 * narrative check — Content scanner
 *
 * Reads actual files in the repo (README, docs, marketing copy, any .md)
 * and scores each against the .narrative/ canon and skills.
 *
 * Usage:
 *   node packages/serve/check.js                    # scan all markdown files
 *   node packages/serve/check.js README.md docs/    # scan specific files/dirs
 *   node packages/serve/check.js --json             # output JSON instead of table
 *   node packages/serve/check.js --dir /path/to/repo
 *   node packages/serve/check.js --threshold 70     # exit 1 if any file below this
 *
 * How scoring works:
 *   Each file is checked against 5 lenses from .narrative/skills/:
 *     1. Terminology — forbidden words, wrong brand names, wrong product names
 *     2. Tone — marketing-speak patterns
 *     3. Theme alignment — does the content touch core narrative themes?
 *     4. Preferred terms — uses the discouraged variant instead of preferred
 *     5. Voice principles — specific pattern matches from bad examples
 *
 *   Score = 100 - penalty points. Each violation deducts points based on severity.
 *   Scores are per-file. Overall score is the weighted average by word count.
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

// ============================================================================
// Config
// ============================================================================

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(name);
}

function getArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const JSON_OUTPUT = hasFlag('--json');
const PROJECT_DIR = path.resolve(getArg('--dir', '.'));
const NARRATIVE_DIR = path.join(PROJECT_DIR, '.narrative');
const THRESHOLD = parseInt(getArg('--threshold', '0'), 10);

// File args (everything that isn't a flag)
const fileArgs = args.filter(a => !a.startsWith('--') && (args.indexOf(a) === 0 || !args[args.indexOf(a) - 1]?.startsWith('--')));

// ============================================================================
// Canon Parser (shared with server.js)
// ============================================================================

function parseCanon() {
  const result = { units: [], skills: {}, errors: [] };

  const canonDir = path.join(NARRATIVE_DIR, 'canon');
  if (fs.existsSync(canonDir)) {
    for (const file of fs.readdirSync(canonDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
      try {
        const parsed = YAML.parse(fs.readFileSync(path.join(canonDir, file), 'utf-8'));
        if (parsed?.units) {
          for (const u of parsed.units) {
            result.units.push({
              id: u.id,
              type: u.type,
              assertion: (u.assertion || '').trim(),
              intent: u.intent || {},
              dependencies: u.dependencies || [],
            });
          }
        }
      } catch (err) {
        result.errors.push({ file, error: err.message });
      }
    }
  }

  const skillsDir = path.join(NARRATIVE_DIR, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const file of fs.readdirSync(skillsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
      try {
        const parsed = YAML.parse(fs.readFileSync(path.join(skillsDir, file), 'utf-8'));
        if (parsed?.voice) result.skills.voice = parsed.voice;
        if (parsed?.terminology) result.skills.terminology = parsed.terminology;
        if (parsed?.brand) result.skills.brand = parsed.brand;
        if (parsed?.products) result.skills.products = parsed.products;
      } catch (err) {
        result.errors.push({ file, error: err.message });
      }
    }
  }

  return result;
}

// ============================================================================
// File Discovery
// ============================================================================

function findFiles(targets, projectDir) {
  const baseDir = projectDir || PROJECT_DIR;
  const files = [];

  // Default ignore patterns
  const ignore = [
    'node_modules', '.git', '.narrative', 'dist', 'build', 'coverage',
    'package-lock.json', '.env', '.DS_Store',
  ];

  function shouldIgnore(p) {
    const parts = p.split(path.sep);
    return parts.some(part => ignore.includes(part));
  }

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(baseDir, full);
      if (shouldIgnore(rel)) continue;

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && /\.(md|mdx|txt|rst)$/i.test(entry.name)) {
        files.push(full);
      }
    }
  }

  if (targets.length === 0) {
    // Scan the whole project
    walk(baseDir);
  } else {
    for (const target of targets) {
      const resolved = path.resolve(baseDir, target);
      if (!fs.existsSync(resolved)) {
        console.error(`  Warning: ${target} not found, skipping`);
        continue;
      }
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        walk(resolved);
      } else {
        files.push(resolved);
      }
    }
  }

  return files;
}

// ============================================================================
// Content Checker — scores a single file against skills
// ============================================================================

/**
 * @param {string} content — raw file content
 * @param {object} skills — parsed skills from .narrative/skills/
 * @param {string} filePath — for context in violations
 * @returns {{ score: number, violations: Array, wordCount: number, themeHits: string[] }}
 */
function checkContent(content, skills, filePath) {
  const violations = [];
  const lower = content.toLowerCase();
  const words = content.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Skip very short files
  if (wordCount < 10) {
    return { score: 100, violations: [], wordCount, themeHits: [] };
  }

  // ── 1. Forbidden terms ──────────────────────────────────────────────────
  const forbidden = skills.terminology?.forbidden || [];
  for (const term of forbidden) {
    const termLower = term.toLowerCase();
    let idx = lower.indexOf(termLower);
    while (idx !== -1) {
      // Get line number
      const lineNum = content.substring(0, idx).split('\n').length;
      // Get surrounding context
      const start = Math.max(0, idx - 30);
      const end = Math.min(content.length, idx + term.length + 30);
      const context = content.substring(start, end).replace(/\n/g, ' ').trim();

      violations.push({
        type: 'terminology',
        severity: 'warning',
        message: `Forbidden term: "${term}"`,
        line: lineNum,
        context: `...${context}...`,
        penalty: 3,
      });

      idx = lower.indexOf(termLower, idx + termLower.length);
    }
  }

  // ── 2. Brand name violations ────────────────────────────────────────────
  const brandWrong = skills.brand?.never || [];
  const brandCorrect = skills.brand?.company_name || 'Principal AI';
  for (const wrong of brandWrong) {
    let idx = content.indexOf(wrong);
    while (idx !== -1) {
      const lineNum = content.substring(0, idx).split('\n').length;
      violations.push({
        type: 'brand',
        severity: 'error',
        message: `Wrong brand name: "${wrong}" → use "${brandCorrect}"`,
        line: lineNum,
        context: content.substring(Math.max(0, idx - 20), idx + wrong.length + 20).replace(/\n/g, ' ').trim(),
        penalty: 8,
      });
      idx = content.indexOf(wrong, idx + wrong.length);
    }
  }

  // ── 3. Product name violations ──────────────────────────────────────────
  for (const product of (skills.products || [])) {
    for (const wrong of (product.never || [])) {
      // Skip short generic terms that would false-positive everywhere
      if (wrong.length < 4) continue;
      let idx = content.indexOf(wrong);
      while (idx !== -1) {
        const lineNum = content.substring(0, idx).split('\n').length;
        violations.push({
          type: 'product',
          severity: 'error',
          message: `Wrong product name: "${wrong}" → use "${product.name}"`,
          line: lineNum,
          context: content.substring(Math.max(0, idx - 20), idx + wrong.length + 20).replace(/\n/g, ' ').trim(),
          penalty: 5,
        });
        idx = content.indexOf(wrong, idx + wrong.length);
      }
    }
  }

  // ── 4. Tone — marketing-speak patterns ──────────────────────────────────
  const badPatterns = [
    'cutting-edge', 'ai-powered', 'leverage', 'unlock',
    'unprecedented', 'maximize', 'revolutionize', 'game-changing',
    'best-in-class', 'synergy', 'holistic', 'paradigm',
    'comprehensive solution', 'enables organizations',
    'take back control', 'empower', 'disrupt',
    'streamline', 'optimize', 'accelerate', 'drive value',
    'next-generation', 'world-class', 'seamless', 'end-to-end',
    'thought leader', 'robust', 'scalable solution', 'actionable insights',
  ];

  for (const pattern of badPatterns) {
    let idx = lower.indexOf(pattern);
    while (idx !== -1) {
      // Don't flag if it's inside a code block (``` ... ```)
      const beforeText = content.substring(0, idx);
      const codeBlockCount = (beforeText.match(/```/g) || []).length;
      const inCodeBlock = codeBlockCount % 2 === 1;

      if (!inCodeBlock) {
        const lineNum = content.substring(0, idx).split('\n').length;
        violations.push({
          type: 'tone',
          severity: 'warning',
          message: `Marketing-speak: "${pattern}"`,
          line: lineNum,
          context: content.substring(Math.max(0, idx - 20), idx + pattern.length + 20).replace(/\n/g, ' ').trim(),
          penalty: 2,
        });
      }

      idx = lower.indexOf(pattern, idx + pattern.length);
    }
  }

  // ── 5. Preferred terms — flag discouraged variants ──────────────────────
  const preferred = skills.terminology?.preferred || [];
  for (const pref of preferred) {
    const avoidList = pref.avoid || [];
    for (const avoid of avoidList) {
      // Skip terms marked as internal-only context
      if (avoid.includes('(')) continue; // e.g. "intent-first telemetry (public)"

      const avoidLower = avoid.toLowerCase();
      let idx = lower.indexOf(avoidLower);
      while (idx !== -1) {
        const lineNum = content.substring(0, idx).split('\n').length;
        violations.push({
          type: 'preferred',
          severity: 'warning',
          message: `Use "${pref.term}" instead of "${avoid}"`,
          line: lineNum,
          context: content.substring(Math.max(0, idx - 20), idx + avoid.length + 20).replace(/\n/g, ' ').trim(),
          penalty: 2,
        });
        idx = lower.indexOf(avoidLower, idx + avoidLower.length);
      }
    }
  }

  // ── 6. Theme alignment — does the content touch core themes? ────────────
  const coreThemes = [
    'visibility', 'builder', 'building', 'software', 'see', 'seeing',
    'structure', 'motion', 'meaning', 'intent', 'narrative', 'story',
    'monitoring', 'codebase', 'code', 'map', 'principal',
  ];
  const themeHits = coreThemes.filter(t => lower.includes(t));

  // Only penalize theme misalignment for substantial content (> 200 words)
  // that has zero theme overlap
  if (wordCount > 200 && themeHits.length === 0) {
    violations.push({
      type: 'theme',
      severity: 'info',
      message: 'Content may not align with core narrative themes',
      line: 0,
      context: '(no core theme keywords found in file)',
      penalty: 5,
    });
  }

  // ── Calculate score ─────────────────────────────────────────────────────
  const totalPenalty = violations.reduce((sum, v) => sum + v.penalty, 0);
  // Normalize: a file with many words can tolerate more violations
  // Penalty cap is proportional to content length, baseline 30 points
  const penaltyCap = Math.max(30, Math.ceil(wordCount / 10));
  const normalizedPenalty = Math.min(totalPenalty, penaltyCap);
  const score = Math.max(0, Math.round(100 - (normalizedPenalty / penaltyCap * 100)));

  return { score, violations, wordCount, themeHits };
}

// ============================================================================
// Main
// ============================================================================

function main() {
  // Parse canon
  if (!fs.existsSync(NARRATIVE_DIR)) {
    console.error('  No .narrative/ directory found. Run `narrative init` first.');
    process.exit(1);
  }

  const canon = parseCanon();
  if (canon.errors.length > 0) {
    console.error('  Errors parsing canon:');
    for (const e of canon.errors) {
      console.error(`    ${e.file}: ${e.error}`);
    }
  }

  // Find files
  const files = findFiles(fileArgs.length > 0 ? fileArgs : []);

  if (files.length === 0) {
    console.log('  No files found to check.');
    process.exit(0);
  }

  // Check each file
  const results = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rel = path.relative(PROJECT_DIR, filePath);
    const result = checkContent(content, canon.skills, rel);
    results.push({
      file: rel,
      ...result,
    });
  }

  // Sort: lowest score first
  results.sort((a, b) => a.score - b.score);

  // Overall score: weighted average by word count
  const totalWords = results.reduce((s, r) => s + r.wordCount, 0);
  const weightedScore = totalWords > 0
    ? Math.round(results.reduce((s, r) => s + r.score * r.wordCount, 0) / totalWords)
    : 100;

  const totalViolations = results.reduce((s, r) => s + r.violations.length, 0);
  const errors = results.reduce((s, r) => s + r.violations.filter(v => v.severity === 'error').length, 0);
  const warnings = results.reduce((s, r) => s + r.violations.filter(v => v.severity === 'warning').length, 0);

  // ── Output ──────────────────────────────────────────────────────────────

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      overallScore: weightedScore,
      filesChecked: results.length,
      totalViolations,
      errors,
      warnings,
      files: results,
    }, null, 2));
  } else {
    console.log('');
    console.log('  ┌───────────────────────────────────────────────┐');
    console.log('  │                                               │');
    console.log('  │   Clarion Call — Content Check                 │');
    console.log('  │                                               │');
    console.log('  └───────────────────────────────────────────────┘');
    console.log('');

    // File table
    const maxFileLen = Math.min(50, Math.max(...results.map(r => r.file.length)));

    console.log(`  ${'File'.padEnd(maxFileLen + 2)} Score   Words  Violations`);
    console.log(`  ${'─'.repeat(maxFileLen + 2)} ─────   ─────  ──────────`);

    for (const r of results) {
      const icon = r.score >= 80 ? '✓' : r.score >= 60 ? '~' : '✗';
      const fileDisplay = r.file.length > maxFileLen
        ? '...' + r.file.slice(-(maxFileLen - 3))
        : r.file.padEnd(maxFileLen);

      const violationSummary = r.violations.length === 0
        ? '—'
        : `${r.violations.filter(v => v.severity === 'error').length}E ${r.violations.filter(v => v.severity === 'warning').length}W`;

      console.log(`  ${icon} ${fileDisplay}  ${String(r.score).padStart(3)}/100  ${String(r.wordCount).padStart(5)}  ${violationSummary}`);
    }

    console.log('');
    console.log(`  Overall: ${weightedScore}/100 — ${results.length} files, ${totalWords} words, ${totalViolations} violations (${errors} errors, ${warnings} warnings)`);

    // Show top violations for low-scoring files
    const problemFiles = results.filter(r => r.score < 80 && r.violations.length > 0);
    if (problemFiles.length > 0) {
      console.log('');
      console.log('  ── Issues ──────────────────────────────────────');
      for (const r of problemFiles.slice(0, 5)) {
        console.log(`\n  ${r.file} (${r.score}/100):`);
        for (const v of r.violations.slice(0, 8)) {
          const icon = v.severity === 'error' ? '✗' : '~';
          const lineRef = v.line > 0 ? `:${v.line}` : '';
          console.log(`    ${icon} ${v.message}${lineRef}`);
          if (v.context && v.context !== '(no core theme keywords found in file)') {
            console.log(`      ${v.context}`);
          }
        }
        if (r.violations.length > 8) {
          console.log(`    ... and ${r.violations.length - 8} more`);
        }
      }
    }

    console.log('');
  }

  // Exit code based on threshold
  if (THRESHOLD > 0) {
    const belowThreshold = results.filter(r => r.score < THRESHOLD);
    if (belowThreshold.length > 0) {
      if (!JSON_OUTPUT) {
        console.log(`  ✗ ${belowThreshold.length} file(s) below threshold of ${THRESHOLD}/100`);
        console.log('');
      }
      process.exit(1);
    }
  }
}

// Also export for use as a module (server.js, GitHub Action)
module.exports = { checkContent, findFiles, parseCanon };

// Run if called directly
if (require.main === module) {
  main();
}
