/**
 * Narrative Agent Tests
 *
 * Tests the full loop: canon parsing → clarion call → drift detection
 * Uses the actual .narrative/ directory in the repo as test data.
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

// We test against the actual .narrative/ directory
const NARRATIVE_DIR = path.resolve(__dirname, '../../.narrative');
const CANON_DIR = path.join(NARRATIVE_DIR, 'canon');
const SKILLS_DIR = path.join(NARRATIVE_DIR, 'skills');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

// ============================================================================
// Test 1: Canon directory exists and has valid structure
// ============================================================================

console.log('\n1️⃣  Canon Directory Structure\n');

assert(fs.existsSync(NARRATIVE_DIR), '.narrative/ directory exists');
assert(fs.existsSync(CANON_DIR), '.narrative/canon/ directory exists');
assert(fs.existsSync(SKILLS_DIR), '.narrative/skills/ directory exists');
assert(fs.existsSync(path.join(CANON_DIR, 'core-story.yml')), 'core-story.yml exists');
assert(fs.existsSync(path.join(CANON_DIR, 'positioning.yml')), 'positioning.yml exists');
assert(fs.existsSync(path.join(SKILLS_DIR, 'tone-of-voice.yml')), 'tone-of-voice.yml exists');
assert(fs.existsSync(path.join(SKILLS_DIR, 'terminology.yml')), 'terminology.yml exists');

// ============================================================================
// Test 2: Canon files parse as valid YAML with correct schema
// ============================================================================

console.log('\n2️⃣  Canon File Parsing\n');

const coreStory = YAML.parse(fs.readFileSync(path.join(CANON_DIR, 'core-story.yml'), 'utf-8'));
assert(coreStory.version === '1.0', 'core-story.yml has version');
assert(coreStory.owner === 'julie@principal-ade.com', 'core-story.yml has correct owner');
assert(Array.isArray(coreStory.units), 'core-story.yml has units array');
assert(coreStory.units.length >= 3, 'core-story.yml has at least 3 units');

const positioning = YAML.parse(fs.readFileSync(path.join(CANON_DIR, 'positioning.yml'), 'utf-8'));
assert(positioning.units.length >= 4, 'positioning.yml has at least 4 units');

// Check unit schema
const unit = coreStory.units[0];
assert(unit.id && typeof unit.id === 'string', 'Unit has id (string)');
assert(unit.type && typeof unit.type === 'string', 'Unit has type (string)');
assert(unit.assertion && typeof unit.assertion === 'string', 'Unit has assertion (string)');
assert(unit.intent && unit.intent.objective, 'Unit has intent with objective');
assert(Array.isArray(unit.dependencies), 'Unit has dependencies array');
assert(typeof unit.confidence === 'number', 'Unit has confidence (number)');

// ============================================================================
// Test 3: Skill files parse correctly
// ============================================================================

console.log('\n3️⃣  Skill File Parsing\n');

const tone = YAML.parse(fs.readFileSync(path.join(SKILLS_DIR, 'tone-of-voice.yml'), 'utf-8'));
assert(tone.voice && tone.voice.name, 'tone-of-voice.yml has voice name');
assert(Array.isArray(tone.voice.principles), 'Has tone principles');
assert(tone.voice.principles.length >= 4, 'Has at least 4 tone principles');
assert(tone.terminology && Array.isArray(tone.terminology.forbidden), 'Has forbidden terms list');

const terms = YAML.parse(fs.readFileSync(path.join(SKILLS_DIR, 'terminology.yml'), 'utf-8'));
assert(terms.brand && terms.brand.company_name === 'Principal AI', 'Brand name is Principal AI');
assert(Array.isArray(terms.products), 'Has products list');
assert(terms.products.length >= 3, 'Has at least 3 products');

// ============================================================================
// Test 4: Dependency graph is valid (no orphaned references)
// ============================================================================

console.log('\n4️⃣  Dependency Graph Integrity\n');

const allUnits = [...coreStory.units, ...positioning.units];
const allIds = new Set(allUnits.map(u => u.id));

let orphanCount = 0;
for (const u of allUnits) {
  for (const dep of u.dependencies) {
    if (!allIds.has(dep)) {
      console.log(`  ✗ "${u.id}" depends on "${dep}" which doesn't exist`);
      orphanCount++;
      failed++;
    }
  }
}
assert(orphanCount === 0, 'No orphaned dependencies');

// Check that core_story units have no dependencies (they're roots)
const coreRoots = coreStory.units.filter(u => u.dependencies.length === 0);
assert(coreRoots.length >= 1, 'At least one root unit with no dependencies');

// Check that positioning units depend on core_story units
const positioningDeps = positioning.units.flatMap(u => u.dependencies);
const dependsOnCore = positioningDeps.some(d => coreStory.units.some(u => u.id === d));
assert(dependsOnCore, 'Positioning units depend on core story units');

// ============================================================================
// Test 5: Three dimensions framework is represented
// ============================================================================

console.log('\n5️⃣  Three Dimensions Framework\n');

const posUnits = positioning.units;
const hasStructure = posUnits.some(u =>
  u.assertion.toLowerCase().includes('codebase') ||
  u.intent.constraints?.content?.required_themes?.includes('structure')
);
const hasMotion = posUnits.some(u =>
  u.assertion.toLowerCase().includes('evolves') ||
  u.intent.constraints?.content?.required_themes?.includes('motion')
);
const hasMeaning = posUnits.some(u =>
  u.assertion.toLowerCase().includes('worked') ||
  u.intent.constraints?.content?.required_themes?.includes('meaning')
);

assert(hasStructure, 'Structure dimension (File City) is represented');
assert(hasMotion, 'Motion dimension (Feed) is represented');
assert(hasMeaning, 'Meaning dimension (Story-Based Monitoring) is represented');

// ============================================================================
// Test 6: Forbidden terms are not in any assertions
// ============================================================================

console.log('\n6️⃣  Terminology Compliance\n');

const forbidden = tone.terminology.forbidden;
let termViolations = 0;
for (const u of allUnits) {
  const text = u.assertion.toLowerCase();
  for (const word of forbidden) {
    if (text.includes(word.toLowerCase())) {
      console.log(`  ✗ Unit "${u.id}" contains forbidden term "${word}"`);
      termViolations++;
      failed++;
    }
  }
}
assert(termViolations === 0, 'No forbidden terms in canon assertions');

// Check brand name compliance
const brandNever = terms.brand.never;
let brandViolations = 0;
for (const u of allUnits) {
  for (const wrong of brandNever) {
    if (u.assertion.includes(wrong)) {
      console.log(`  ✗ Unit "${u.id}" uses wrong brand name "${wrong}"`);
      brandViolations++;
      failed++;
    }
  }
}
assert(brandViolations === 0, 'No wrong brand names in canon assertions');

// ============================================================================
// Test 7: ClarionCall engine (inline test without TypeScript compilation)
// ============================================================================

console.log('\n7️⃣  ClarionCall Engine (Inline)\n');

// Simulate what the engine does — parse canon, check coherence
function simulateClarionCall() {
  const units = [];

  // Parse all canon files
  const canonFiles = fs.readdirSync(CANON_DIR).filter(f => f.endsWith('.yml'));
  for (const file of canonFiles) {
    const content = fs.readFileSync(path.join(CANON_DIR, file), 'utf-8');
    const parsed = YAML.parse(content);
    if (parsed?.units) {
      units.push(...parsed.units.map(u => ({
        ...u,
        source: file,
      })));
    }
  }

  // Parse skills
  const skills = {};
  const skillFiles = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.yml'));
  for (const file of skillFiles) {
    const content = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8');
    const parsed = YAML.parse(content);
    Object.assign(skills, parsed);
  }

  // Check 1: Orphaned dependencies
  const ids = new Set(units.map(u => u.id));
  const orphans = [];
  for (const u of units) {
    for (const dep of u.dependencies) {
      if (!ids.has(dep)) orphans.push({ unitId: u.id, missingDep: dep });
    }
  }

  // Check 2: Theme conflicts
  const unitMap = new Map(units.map(u => [u.id, u]));
  const conflicts = [];
  for (const u of units) {
    for (const depId of u.dependencies) {
      const dep = unitMap.get(depId);
      if (!dep) continue;
      const uThemes = u.intent?.constraints?.content?.required_themes || [];
      const depForbidden = dep.intent?.constraints?.content?.forbidden_themes || [];
      const c = uThemes.filter(t => depForbidden.includes(t));
      if (c.length > 0) conflicts.push({ unit: u.id, dep: dep.id, themes: c });
    }
  }

  // Check 3: Terminology violations
  const termViolations = [];
  const forbiddenTerms = skills.terminology?.forbidden || [];
  for (const u of units) {
    const text = u.assertion.toLowerCase();
    for (const word of forbiddenTerms) {
      if (text.includes(word.toLowerCase())) {
        termViolations.push({ unit: u.id, term: word });
      }
    }
  }

  // Calculate score
  const totalIssues = orphans.length + conflicts.length + termViolations.length;
  const maxIssues = units.length * 3;
  const score = Math.round(Math.max(0, 100 - (totalIssues / maxIssues * 100)));

  return { units: units.length, orphans, conflicts, termViolations, score };
}

const clarionResult = simulateClarionCall();
assert(clarionResult.units >= 7, `Found ${clarionResult.units} narrative units across all canon files`);
assert(clarionResult.orphans.length === 0, 'No orphaned dependencies detected');
assert(clarionResult.conflicts.length === 0, 'No theme conflicts between parent/child units');
assert(clarionResult.termViolations.length === 0, 'No terminology violations in assertions');
assert(clarionResult.score >= 80, `Coherence score: ${clarionResult.score}/100`);

// ============================================================================
// Test 8: Downstream propagation
// ============================================================================

console.log('\n8️⃣  Downstream Propagation\n');

// If core_visibility changes, what's affected?
function findDownstream(changedId) {
  const affected = new Set();
  let frontier = new Set([changedId]);

  while (frontier.size > 0) {
    const next = new Set();
    for (const u of allUnits) {
      if (affected.has(u.id) || u.id === changedId) continue;
      if (u.dependencies.some(d => frontier.has(d) || affected.has(d))) {
        affected.add(u.id);
        next.add(u.id);
      }
    }
    frontier = next;
  }

  return affected;
}

const downstream = findDownstream('core_visibility');
assert(downstream.size > 0, `Changing core_visibility affects ${downstream.size} downstream units`);

// core_three_dimensions depends on core_visibility
assert(downstream.has('core_three_dimensions'),
  'core_three_dimensions is downstream of core_visibility');

// Positioning units should be downstream of core story
const posDownstream = findDownstream('core_three_dimensions');
const posAffected = [...posDownstream].filter(id =>
  positioning.units.some(u => u.id === id)
);
assert(posAffected.length > 0,
  `Changing core_three_dimensions affects ${posAffected.length} positioning units`);

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '═'.repeat(50));
console.log(`\n  Tests: ${passed + failed} total, ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
