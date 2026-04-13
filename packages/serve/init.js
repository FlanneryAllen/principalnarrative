#!/usr/bin/env node
/**
 * narrative init — Scaffold a .narrative/ directory for any project
 *
 * Asks a few questions, generates canon + skill YAML files,
 * runs the first clarion call, and optionally opens the dashboard.
 *
 * Usage: node packages/serve/init.js [--dir .]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================================================
// Config
// ============================================================================

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const PROJECT_DIR = path.resolve(getArg('--dir', '.'));
const NARRATIVE_DIR = path.join(PROJECT_DIR, '.narrative');
const USE_DEFAULTS = args.includes('--defaults');

// ============================================================================
// Prompts
// ============================================================================

function ask(rl, question, fallback) {
  return new Promise(resolve => {
    const prompt = fallback ? `${question} [${fallback}]: ` : `${question}: `;
    rl.question(prompt, answer => {
      resolve(answer.trim() || fallback || '');
    });
    // Handle closed stdin (piped/non-interactive)
    rl.once('close', () => resolve(fallback || ''));
  });
}

async function gather() {
  // Non-interactive mode for CI/testing
  if (USE_DEFAULTS) {
    const company = getArg('--company', 'My Company');
    const tagline = getArg('--tagline', `${company} builds great products.`);
    const audience = getArg('--audience', 'developers');
    const productsRaw = getArg('--products', '');
    const products = productsRaw ? productsRaw.split(',').map(p => p.trim()).filter(Boolean) : [];
    const owner = getArg('--owner', '');
    return {
      company, tagline, audience, products, owner,
      forbidden: ['leverage', 'cutting-edge', 'unlock', 'empower', 'revolutionize',
                  'game-changing', 'best-in-class', 'synergy', 'holistic', 'paradigm', 'disrupt'],
    };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log('  │                                               │');
  console.log('  │   narrative init                              │');
  console.log('  │   Set up your narrative source of truth       │');
  console.log('  │                                               │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log('');

  if (fs.existsSync(NARRATIVE_DIR)) {
    console.log(`  .narrative/ already exists in ${PROJECT_DIR}`);
    const overwrite = await ask(rl, '  Overwrite? (y/n)', 'n');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('  Aborted.');
      rl.close();
      process.exit(0);
    }
  }

  console.log('  Answer a few questions to scaffold your narrative.\n');

  const company = await ask(rl, '  Company name', '');
  const tagline = await ask(rl, '  One sentence — what does your company do?', '');
  const audience = await ask(rl, '  Who is your primary audience?', 'developers');

  console.log('');
  console.log('  Products (comma-separated, or press enter to skip):');
  const productsRaw = await ask(rl, '  Product names', '');
  const products = productsRaw
    ? productsRaw.split(',').map(p => p.trim()).filter(Boolean)
    : [];

  console.log('');
  const owner = await ask(rl, '  Narrative owner email', '');

  console.log('');
  console.log('  Any words or phrases your brand should never use?');
  console.log('  (comma-separated, or press enter for sensible defaults)');
  const forbiddenRaw = await ask(rl, '  Forbidden terms', '');
  const forbidden = forbiddenRaw
    ? forbiddenRaw.split(',').map(w => w.trim()).filter(Boolean)
    : ['leverage', 'cutting-edge', 'unlock', 'empower', 'revolutionize',
       'game-changing', 'best-in-class', 'synergy', 'holistic', 'paradigm', 'disrupt'];

  rl.close();
  return { company, tagline, audience, products, owner, forbidden };
}

// ============================================================================
// Generators
// ============================================================================

function generateCoreStory(data) {
  const today = new Date().toISOString().split('T')[0];
  const ownerLine = data.owner ? `\nowner: "${data.owner}"` : '';

  let coreAssertion = data.tagline || `${data.company} does something important.`;
  // Clean up — ensure it's a proper sentence
  if (!coreAssertion.endsWith('.')) coreAssertion += '.';

  return `# Core Story — the root narrative that everything else must align with
# Only the narrative owner should merge changes to this file.
# Changes here trigger a clarion call — a full coherence check across all downstream units.

version: "1.0"
last_updated: "${today}"${ownerLine}

units:
  - id: core_mission
    type: core_story
    assertion: >
      ${coreAssertion}
    intent:
      objective: Define the core purpose of ${data.company || 'the organization'}
      constraints:
        content:
          required_themes: []
          forbidden_themes: []
          tone: professional
    evidence_required:
      - website_reflects_this_mission
      - team_can_articulate_this
    dependencies: []
    confidence: 1.0
`;
}

function generatePositioning(data) {
  const today = new Date().toISOString().split('T')[0];
  const ownerLine = data.owner ? `\nowner: "${data.owner}"` : '';

  let productUnits = '';
  if (data.products.length > 0) {
    for (const product of data.products) {
      const id = product.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
      productUnits += `
  - id: pos_${id}
    type: positioning
    assertion: >
      ${product} — [describe what this product does for ${data.audience || 'your audience'}].
    intent:
      objective: Position ${product} for ${data.audience || 'the target audience'}
      constraints:
        content:
          required_themes: []
          forbidden_themes: []
          tone: professional
    evidence_required:
      - product_page_reflects_this
    dependencies: [core_mission]
    confidence: 0.8
`;
    }
  } else {
    productUnits = `
  - id: pos_primary
    type: positioning
    assertion: >
      [Describe your primary market position for ${data.audience || 'your audience'}].
    intent:
      objective: Define market positioning
      constraints:
        content:
          required_themes: []
          forbidden_themes: []
          tone: professional
    evidence_required:
      - website_reflects_positioning
    dependencies: [core_mission]
    confidence: 0.8
`;
  }

  return `# Positioning — market-facing claims that must stay aligned with core story
# Changes here trigger a clarion call against core-story.yml

version: "1.0"
last_updated: "${today}"${ownerLine}

units:${productUnits}`;
}

function generateToneOfVoice(data) {
  return `# Tone of Voice — how ${data.company || 'the organization'} communicates
# These are evaluation lenses the agent applies when reviewing content.

version: "1.0"
last_updated: "${new Date().toISOString().split('T')[0]}"

voice:
  name: "${data.company || 'Brand'} Voice"
  summary: >
    [Describe your brand voice here. How do you sound?
    What's the personality? What's the feel?]

  principles:
    - id: sound_human
      rule: "Write like a person, not a brand"
      examples:
        good:
          - "[Add an example of good copy here]"
        bad:
          - "Our cutting-edge platform leverages AI to maximize efficiency."

    - id: be_specific
      rule: "Short sentences. Concrete nouns. Say the thing."
      examples:
        good:
          - "[Add a specific example here]"
        bad:
          - "Our comprehensive solution enables organizations to effectively manage their workflows."

terminology:
  preferred: []
  # Example:
  # - term: "your preferred term"
  #   context: "When to use this term"
  #   avoid: ["term to avoid", "another term to avoid"]

  forbidden:
${data.forbidden.map(t => `    - "${t}"`).join('\n')}
`;
}

function generateTerminology(data) {
  let brandSection = '';
  if (data.company) {
    brandSection = `brand:
  company_name: "${data.company}"
  never: []
  # Add common misspellings or wrong versions of your brand name:
  # never: ["WrongName", "Wrong Name Inc", "wrong-name"]

`;
  }

  let productsSection = '';
  if (data.products.length > 0) {
    productsSection = `products:\n`;
    for (const product of data.products) {
      productsSection += `  - name: "${product}"
    description: "[What this product does]"
    never: []
    # Add wrong versions of this product name:
    # never: ["WrongProductName", "wrong product"]

`;
    }
  }

  return `# Terminology — canonical names and usage rules
# The agent checks all content against this list.

version: "1.0"
last_updated: "${new Date().toISOString().split('T')[0]}"

${brandSection}${productsSection}concepts: []
# Example:
# - name: "your concept"
#   definition: "What this means"
#   usage: "How to use it in writing"
#   never: ["wrong version", "other wrong version"]
`;
}

function generateReadme(data) {
  return `# .narrative — Canonical Narrative Source

This directory is the single source of truth for ${data.company ? data.company + "'s" : 'organizational'} narrative.
The narrative agent watches this directory and runs coherence checks
whenever it changes.

## Structure

\`\`\`
.narrative/
├── canon/              ← The declared narrative (PR-protected)
│   ├── core-story.yml  ← Root narrative — everything traces back here
│   └── positioning.yml ← Market-facing claims
├── skills/             ← How the agent evaluates content
│   ├── tone-of-voice.yml
│   └── terminology.yml
└── README.md
\`\`\`

## Trust Levels

| Source | Trust | Who Changes It | What Happens |
|--------|-------|---------------|-------------|
| \`canon/\` | Highest | Narrative owner via PR | Triggers a **clarion call** — full coherence check |
| \`skills/\` | High | Narrative owner via PR | Updates evaluation lenses |

## Quick Start

\`\`\`bash
# Start the dashboard (reads from these files)
node packages/serve/server.js

# Open http://localhost:3333
\`\`\`

## Editing Canon

Changes to \`canon/\` should go through a PR. This is intentional —
narrative changes are organizational decisions, not casual edits.
The PR diff shows exactly what changed in the declared story.

## Clarion Call

When a file in \`canon/\` changes, the agent runs a clarion call:

1. Parse all narrative units
2. Check dependencies and theme alignment
3. Check terminology and brand names
4. Check tone of voice
5. Surface drift alerts for anything misaligned
6. Calculate coherence score (0-100)
`;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const data = await gather();

  // Create directories
  const canonDir = path.join(NARRATIVE_DIR, 'canon');
  const skillsDir = path.join(NARRATIVE_DIR, 'skills');

  fs.mkdirSync(canonDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  // Write files
  const files = [
    [path.join(canonDir, 'core-story.yml'), generateCoreStory(data)],
    [path.join(canonDir, 'positioning.yml'), generatePositioning(data)],
    [path.join(skillsDir, 'tone-of-voice.yml'), generateToneOfVoice(data)],
    [path.join(skillsDir, 'terminology.yml'), generateTerminology(data)],
    [path.join(NARRATIVE_DIR, 'README.md'), generateReadme(data)],
  ];

  console.log('');
  console.log('  Creating .narrative/ directory...\n');

  for (const [filePath, content] of files) {
    fs.writeFileSync(filePath, content);
    const rel = path.relative(PROJECT_DIR, filePath);
    console.log(`    ✓ ${rel}`);
  }

  console.log('');
  console.log('  ────────────────────────────────────────────');
  console.log('');
  console.log('  Your narrative is scaffolded. Next steps:');
  console.log('');
  console.log('  1. Edit .narrative/canon/core-story.yml');
  console.log('     — Fill in your core assertion (the one thing everyone should say)');
  console.log('');
  console.log('  2. Edit .narrative/canon/positioning.yml');
  console.log('     — Fill in positioning for each product');
  console.log('');
  console.log('  3. Edit .narrative/skills/tone-of-voice.yml');
  console.log('     — Add examples of good and bad copy');
  console.log('');
  console.log('  4. Start the dashboard:');
  console.log(`     node packages/serve/server.js --dir ${PROJECT_DIR}`);
  console.log('     → http://localhost:3333');
  console.log('');
  console.log('  The dashboard reads from these files. Edit a YAML file');
  console.log('  and the dashboard updates live — no refresh needed.');
  console.log('');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
