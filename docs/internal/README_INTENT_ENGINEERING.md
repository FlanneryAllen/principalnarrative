# Intent Engineering Infrastructure

**Making organizational intent machine-readable for autonomous AI agents**

> "In the agentic era, the bottleneck isn't AI capability—it's translating organizational intent into machine-actionable constraints that agents can operate from." - Julie Allen

## The Problem

AI agents can write code, generate content, and automate workflows. But they lack access to **organizational intent**—the strategic decisions, compliance requirements, brand voice, and operational constraints that guide human work.

Currently, agents operate with vague system prompts. They don't know:
- What the company actually wants
- What patterns are forbidden (and why)
- What evidence proves the work is correct
- How changes cascade through the organization

## The Solution

**Intent Engineering Infrastructure** - A complete system that makes organizational intent queryable by autonomous agents.

Think of it as **the operating system for the agentic era**—analogous to what relational databases did for data management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              STORY SIGNAL (Input Layer)                  │
│   Capture organizational stories using 5 R's framework   │
│   High-value signals (score ≥85) auto-convert           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         NARRATIVE GRAPH (Storage + DAG Engine)           │
│   SQLite storage with dependency validation              │
│   Intent units form directed acyclic graph               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            INTENT CLIENT (Query Interface)               │
│   Agents query: "what does the org want?"                │
│   Returns: intent chain + merged constraints             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│     APPLICATIONS (Agents, Validators, CI/CD)             │
│   • Code generation agents                               │
│   • Pre-commit validators                                │
│   • Content creation agents                              │
│   • Documentation sync                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Installation

```bash
# Clone this repository
git clone <repo-url>
cd narrative-agentv2

# Run installation script
./install.sh

# This will:
# - Create .narrative/ directory
# - Initialize intent database
# - Set up pre-commit hooks
# - Create sample configuration
```

### 1. Capture a Story (Story Signal)

Open `static/story-signal.html` in your browser:

1. Enter an organizational story or strategic insight
2. Score it using the 5 R's framework (Resonance, Relevance, Rarity, Relatability, Risk/Reward)
3. If score ≥ 85, it auto-converts to an intent unit
4. Otherwise, save it for manual review

**Example:**
```
Story: "We must be the most trusted healthcare infrastructure provider"

Scores:
- Resonance: 18/20 (highly compelling)
- Relevance: 20/20 (core to strategy)
- Rarity: 15/20 (unique positioning)
- Relatability: 17/20 (stakeholders understand)
- Risk/Reward: 19/20 (high impact)

Total: 89/100 → Auto-converts to core_story intent unit
```

### 2. Create Intent Units Programmatically

```typescript
import { IntentClient } from '@narrative/sdk';

const client = new IntentClient('.narrative/intent.db');

// Create a core story (strategic intent)
await client.createUnit({
  id: 'core_story_healthcare_security',
  type: 'core_story',
  assertion: 'We build the most secure healthcare infrastructure',
  intent: {
    objective: 'Become the most trusted healthcare provider',
    constraints: {
      code: {
        required_patterns: ['audit_logging', 'encryption_at_rest'],
        forbidden_patterns: ['console.log', 'localStorage'],
      },
      content: {
        required_themes: ['security', 'compliance', 'trust'],
        tone: 'professional',
        target_audience: 'healthcare_decision_makers'
      }
    },
    evidence_required: ['SOC2_certification', 'HIPAA_compliance_audit']
  },
  dependencies: [],
  validationState: 'ALIGNED',
  confidence: 1.0
});

// Create operational intent that depends on core story
await client.createUnit({
  id: 'operational_auth_oauth',
  type: 'operational',
  assertion: 'All authentication must use OAuth 2.0 with MFA',
  intent: {
    objective: 'Implement secure, modern authentication',
    constraints: {
      code: {
        required_libraries: ['jsonwebtoken', '@auth0/auth0-react'],
        required_patterns: ['mfa', 'oauth2'],
        forbidden_patterns: ['basic_auth', 'password_storage']
      }
    }
  },
  dependencies: ['core_story_healthcare_security'],
  validationState: 'ALIGNED',
  confidence: 0.95
});
```

### 3. Query Intent (for agents)

```typescript
// Agent about to write authentication code
const intent = await client.queryIntent({
  operation: 'writing authentication code',
  context: {
    file_path: 'src/auth/login.ts',
    tags: ['authentication', 'security']
  }
});

// Returns:
{
  intentChain: [
    { type: 'core_story', assertion: 'We build the most secure healthcare infrastructure' },
    { type: 'operational', assertion: 'All authentication must use OAuth 2.0 with MFA' }
  ],
  constraints: {
    code: {
      required_patterns: ['audit_logging', 'encryption_at_rest', 'mfa', 'oauth2'],
      forbidden_patterns: ['console.log', 'localStorage', 'basic_auth'],
      required_libraries: ['jsonwebtoken', '@auth0/auth0-react']
    }
  },
  validationRules: [...],
  evidenceRequired: ['SOC2_certification', 'HIPAA_compliance_audit']
}

// Agent uses constraints to guide code generation
if (intent.constraints.code?.forbidden_patterns?.includes('localStorage')) {
  // Use httpOnly cookies instead
}

if (intent.constraints.code?.required_patterns?.includes('mfa')) {
  // Add multi-factor authentication
}
```

### 4. Validate Code (Pre-commit)

```bash
# Manual validation
npx narrative-validate

# Output:
🔍 Narrative Intent Validator

📊 Validation Results:
   Files checked: 42
   Violations: 3
   Errors: 2
   Warnings: 1

❌ Intent Violations:

📄 src/auth/login.ts
   ❌ Forbidden pattern "localStorage" detected :15
      💡 Suggestion: Use httpOnly cookies or secure session storage instead
      🎯 Intent: Code constraints
      🔍 Pattern: localStorage

   ⚠️ Required library "jsonwebtoken" not imported
      💡 Suggestion: Import jsonwebtoken as required by organizational intent

❌ Validation failed! Fix violations before committing.
```

### 5. Automatic Validation on Commit

The install script sets up a pre-commit hook that automatically validates code:

```bash
git add .
git commit -m "Add authentication"

# Output:
🔍 Validating code against organizational intent...
❌ Validation failed. Fix violations before committing.
   Run 'npx narrative-validate --verbose' for details.
```

---

## Core Concepts

### Intent Unit

The fundamental primitive. Think of it as a "row" in a database, but for organizational intent.

```typescript
{
  // Core fields (from patent)
  id: string;                           // Unique identifier
  type: IntentType;                     // Layer taxonomy
  assertion: string;                    // The claim/requirement
  dependencies: string[];               // Forms DAG
  validationState: ValidationState;     // ALIGNED | DRIFTED | BROKEN | UNKNOWN
  confidence: number;                   // 0.0 - 1.0

  // Intent (machine-actionable)
  intent: {
    objective: string;                  // What the org wants
    constraints?: {
      code?: {...},                     // Code patterns, libraries
      content?: {...},                  // Themes, tone, audience
      validation_rules?: [...]          // Custom validation
    },
    evidence_required?: string[]        // What proves it works
  },

  // Story Signal (optional)
  signal?: {
    score: number,                      // 0-100 from 5 R's
    source: string,                     // Where it came from
    dimensions: {...}                   // 5 R's breakdown
  }
}
```

### Layer Taxonomy

Intent units are organized into 6 layers:

1. **core_story** - Strategic intent (CEO-level decisions)
2. **positioning** - Market-facing claims
3. **product_narrative** - Product capabilities and features
4. **operational** - How we execute
5. **evidence** - Validation data (KPIs, metrics)
6. **communication** - External messaging

Dependencies flow downward: operational depends on core_story, communication depends on positioning, etc.

### The 5 R's Framework

Stories are scored on 5 dimensions (0-20 each, max 100 total):

- **Resonance** - How emotionally compelling?
- **Relevance** - How relevant to strategy?
- **Rarity** - How unique/novel?
- **Relatability** - Can stakeholders relate?
- **Risk/Reward** - What's the potential impact?

High-scoring signals (≥85) become intent units automatically.

### Dependency Chain

When an agent queries intent, it gets the **full chain** from core_story down to the specific operation:

```
core_story_healthcare_security
  ↓ (dependencies)
operational_auth_oauth
  ↓ (dependencies)
[your specific operation]

→ Constraints are MERGED from entire chain
→ More specific units inherit and extend constraints
```

### Propagation

When a core_story changes, all dependent units are affected. The system tracks this cascade:

```typescript
const impact = await client.getPropagationImpact('core_story_healthcare_security');
// Returns: all operational, communication, evidence units that depend on it
```

---

## Packages

### @narrative/core

Storage and dependency engine.

**Key Classes:**
- `NarrativeGraph` - SQLite storage with DAG validation

**Key Methods:**
```typescript
createUnit(unit)                    // Create intent unit
getUnit(id)                         // Retrieve by ID
query(filters)                      // Query with filters
getDependencyChain(id)              // Get full chain
getPropagationImpact(id)            // Get affected units
updateValidationState(id, state)    // Update validation
```

**Location:** `packages/core/`

### @narrative/sdk

Agent-friendly query interface.

**Key Classes:**
- `IntentClient` - Main SDK for agents

**Key Methods:**
```typescript
queryIntent(params)      // Query intent for operation
getDependencyChain(id)   // Get full chain
getPropagationImpact(id) // Get affected units
createUnit(unit)         // Create new unit
getStats()               // Graph statistics
```

**Location:** `packages/sdk/`

### @narrative/signal

Story Signal mining and conversion.

**Key Classes:**
- `StorySignalMiner` - Converts stories to intent units

**Key Methods:**
```typescript
processSignal(capture)              // Process and maybe auto-convert
convertToIntentUnit(capture, opts)  // Manual conversion
getConvertedSignals()               // Get all converted
getSignalStats()                    // Conversion statistics
```

**Location:** `packages/signal/`

### @narrative/validator

Pre-commit code validation.

**Key Classes:**
- `IntentValidator` - Validates code against intent

**Key Methods:**
```typescript
validate(options)  // Validate files
```

**CLI:**
```bash
npx narrative-validate [options]
```

**Location:** `packages/validator/`

---

## Use Cases

### 1. Coding Agents with Constraints

**Problem:** Agent generates code that violates security policy.

**Solution:**
```typescript
// Agent queries intent before generating code
const intent = await client.queryIntent({
  operation: 'writing API endpoint',
  context: { tags: ['api', 'data-access'] }
});

// Check constraints
if (intent.constraints.code?.required_patterns?.includes('rate_limiting')) {
  // Add rate limiting to generated code
}

if (intent.constraints.code?.forbidden_patterns?.includes('raw_sql')) {
  // Use ORM instead of raw SQL
}
```

### 2. Pre-commit Intent Validation

**Problem:** Developers accidentally commit code that violates organizational standards.

**Solution:**
```bash
# Pre-commit hook runs automatically
git commit -m "Add feature"

🔍 Validating code against organizational intent...
❌ Forbidden pattern "localStorage" detected in src/auth.ts
💡 Use httpOnly cookies per security policy
```

### 3. Content Creation Alignment

**Problem:** Marketing content drifts from product reality.

**Solution:**
```typescript
const intent = await client.queryIntent({
  operation: 'writing blog post',
  context: { tags: ['marketing', 'product'] }
});

// Check content constraints
if (intent.constraints.content?.tone === 'professional') {
  // Generate professional content
}

if (intent.constraints.content?.required_themes?.includes('security')) {
  // Ensure security themes are present
}
```

### 4. Multi-Agent Coordination

**Problem:** Multiple agents make conflicting changes.

**Solution:**
```typescript
// All agents query the same intent graph
const agent1Intent = await client.queryIntent({ operation: 'updating API docs' });
const agent2Intent = await client.queryIntent({ operation: 'updating SDK' });

// Both get merged constraints from core_story
// Ensures consistent behavior across agents
```

---

## Testing

All packages have been tested:

```bash
# Core package
cd packages/core && npm run build
node test-basic.js
# ✅ All tests passed

# SDK package
cd packages/sdk
node test-basic.js
# ✅ Intent chain traversal works
# ✅ Constraint merging works
# ✅ Propagation analysis works

# Signal package
cd packages/signal
node test-signal.js
# ✅ 5 R's scoring works
# ✅ Auto-conversion works (score >= 85)
# ✅ Manual conversion works

# Validator package
cd packages/validator
node test-validator.js
# ✅ Detects forbidden patterns
# ✅ Detects missing required patterns
# ✅ Detects missing libraries
# ✅ Provides helpful suggestions
```

---

## Configuration

### .narrative/config.json

```json
{
  "version": "0.1.0",
  "dbPath": ".narrative/intent.db",
  "validation": {
    "enabled": true,
    "failOnWarning": false,
    "patterns": {
      "include": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
      "exclude": ["node_modules/**", "dist/**", "**/*.test.*"]
    }
  },
  "signal": {
    "autoConvertThreshold": 85,
    "defaultIntentType": "core_story"
  }
}
```

---

## CLI Commands

```bash
# Query intent
narrative query "writing authentication code"

# Validate code
narrative validate

# Show statistics
narrative stats

# Create intent unit (interactive)
narrative create

# Help
narrative help
```

---

## Files and Structure

```
narrative-agentv2/
├── .narrative/
│   ├── intent.db              # SQLite database
│   ├── config.json            # Configuration
│   ├── README.md              # Local documentation
│   └── sample-intents.json    # Example intent units
│
├── packages/
│   ├── core/                  # @narrative/core
│   │   ├── narrative-graph.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── sdk/                   # @narrative/sdk
│   │   ├── intent-client.ts
│   │   └── index.ts
│   │
│   ├── signal/                # @narrative/signal
│   │   ├── story-signal.ts
│   │   └── index.ts
│   │
│   └── validator/             # @narrative/validator
│       ├── intent-validator.ts
│       ├── cli.ts
│       └── index.ts
│
├── static/
│   └── story-signal.html      # Web UI for story capture
│
├── examples/
│   └── basic-usage.ts         # Complete usage example
│
├── schema/
│   └── intent-unit.schema.json # JSON Schema
│
├── install.sh                 # Installation script
├── cli.ts                     # Main CLI
└── README_INTENT_ENGINEERING.md  # This file
```

---

## Patent Background

Based on **Narrative Intelligence Patent v6 (SPEC)** by Julie Allen.

**Key innovations:**
- Narrative units as composable primitives: `N = (id, τ, α, D, V, c, P)`
- Narrative algebra operations: Propagate, Validate, Compose, Resonate, Cover, Drift
- Layer taxonomy for organizational structure
- Domain-agnostic design works for any industry

---

## What's Next

### Immediate Enhancements

1. **Semantic Search** - Replace keyword matching with embeddings
2. **LLM Integration** - Auto-extract constraints from natural language
3. **Visual Graph Editor** - See and edit intent graph visually
4. **API Server** - REST/GraphQL API for remote agents
5. **Multi-tenancy** - Support multiple organizations

### Future Vision

This is **foundational infrastructure** for the agentic era. As AI agents become more capable, the bottleneck shifts from "can agents do X" to "do agents know what the organization actually wants."

Intent Engineering solves this by making organizational intent:
- **Queryable** - Agents ask "what does the org want?"
- **Composable** - Intent units form dependency chains
- **Propagating** - Changes cascade correctly
- **Validatable** - Code/content can be checked for alignment

Think of it as **organizational DNA**—the genetic code that all agents operate from.

---

## Contributing

This is an alpha release. Feedback and contributions welcome!

**Areas needing work:**
- More validation rules (AST patterns, semantic checks)
- Better UI/UX for Story Signal
- Integration with popular AI agent frameworks
- Examples for different industries (healthcare, finance, SaaS)

---

## License

MIT

---

## Contact

Julie Allen
Patent: Narrative Intelligence v6 (SPEC)
Date: 2026-04-11

---

## Acknowledgments

Built with:
- TypeScript for type safety
- SQLite (better-sqlite3) for storage
- @typescript-eslint for AST parsing
- Patent-driven design principles

---

**"The future of AI isn't just about capability—it's about alignment. Intent Engineering is the bridge."**
