# Intent Engineering Infrastructure - MVP

**Making organizational intent machine-readable for autonomous AI agents**

## What We Built

A complete infrastructure layer that bridges the gap between organizational intent and agent execution. This is the missing operating system for the agentic era.

### Core Components

#### 1. **@narrative/core** - Narrative Graph Engine
SQLite-based storage and dependency engine for intent units.

**Key Features:**
- Intent unit CRUD operations
- DAG (directed acyclic graph) validation prevents circular dependencies
- Graph traversal for dependency chains and propagation analysis
- Validation state management (ALIGNED, DRIFTED, BROKEN, UNKNOWN)

**Key Methods:**
```typescript
const graph = new NarrativeGraph('.narrative/intent.db');

// Create units
graph.createUnit(intentUnit);

// Query and retrieve
graph.getUnit(id);
graph.query({ type: 'operational', validationState: 'ALIGNED' });

// Graph operations
graph.getDependencyChain(id);     // Get full chain from core_story → unit
graph.getPropagationImpact(id);   // Get all downstream affected units
graph.getDependents(id);          // Direct dependents
graph.getDependencies(id);        // Direct dependencies
```

**Location:** `packages/core/`

#### 2. **@narrative/sdk** - Intent Client SDK
Agent-friendly interface for querying organizational intent.

**Key Features:**
- Natural language intent matching (keyword-based MVP)
- Dependency chain traversal
- Constraint merging from entire chain
- Validation rule collection
- Evidence requirement aggregation

**Usage Example:**
```typescript
const client = new IntentClient();

const intent = await client.queryIntent({
  operation: "writing authentication code",
  context: {
    file_path: "src/auth/login.ts",
    tags: ["authentication"]
  }
});

// Returns:
// - intentChain: full dependency chain
// - constraints: merged code + content constraints
// - validationRules: all applicable rules
// - evidenceRequired: what proves this works
```

**The Critical Pattern:**
```
Agent Query → Intent Matching → Chain Building → Constraint Extraction → Agent Action
```

**Location:** `packages/sdk/`

#### 3. **@narrative/signal** - Story Signal Miner
Converts organizational stories into intent units using the 5 R's framework.

**Key Features:**
- 5 R's scoring system (Resonance, Relevance, Rarity, Relatability, Risk/Reward)
- Auto-conversion for high-value signals (score ≥ 85)
- Manual conversion with custom constraints
- Signal statistics and tracking
- Batch processing

**The 5 R's Framework:**
- **Resonance** (0-20): How emotionally compelling is this?
- **Relevance** (0-20): How relevant to our strategic direction?
- **Rarity** (0-20): How unique or novel is this insight?
- **Relatability** (0-20): Can stakeholders relate to this?
- **Risk/Reward** (0-20): What's the potential impact?

**Usage Example:**
```typescript
const miner = new StorySignalMiner();

const result = await miner.processSignal({
  story: "We must be the most trusted healthcare provider",
  source: "slack://leadership",
  dimensions: {
    resonance: 18,
    relevance: 20,
    rarity: 15,
    relatability: 17,
    riskReward: 19
  },
  tags: ["healthcare", "security"]
});

// If score >= 85, auto-converts to intent unit
// result.intentUnit contains the created unit
```

**Location:** `packages/signal/`

**Web UI:** `static/story-signal.html` - Interactive tool for capturing and scoring stories

---

## The Complete Flow

```
1. STORY SIGNAL (Input Layer)
   └─> Story Signal UI or API
       └─> Score using 5 R's (0-100)
           └─> Convert to Intent Unit (if score >= 85)

2. NARRATIVE GRAPH (Storage Layer)
   └─> Intent units stored with dependencies
       └─> DAG validation ensures no cycles
           └─> Propagation rules define cascade behavior

3. INTENT CLIENT (Query Layer)
   └─> Agent queries: "what does the org want?"
       └─> Match relevant intent units
           └─> Build dependency chain
               └─> Merge constraints
                   └─> Return actionable constraints

4. AGENT EXECUTION (Application Layer)
   └─> Agent checks constraints before acting
       └─> Generates code/content that aligns
           └─> Validator checks compliance (coming next)
```

---

## Example: Healthcare Auth Flow

### 1. CEO shares story (Story Signal)
```
Story: "We must be the most trusted healthcare infrastructure provider"
Score: 89/100 (auto-converts)
→ Creates: core_story_healthcare_focus
```

### 2. CTO adds operational intent
```typescript
{
  id: "operational_auth_oauth",
  type: "operational",
  assertion: "All authentication must use OAuth 2.0 with MFA",
  dependencies: ["core_story_healthcare_focus"],
  intent: {
    objective: "Implement secure authentication",
    constraints: {
      code: {
        required_patterns: ["audit_logging", "mfa"],
        forbidden_patterns: ["localStorage", "basic_auth"],
        required_libraries: ["jsonwebtoken"]
      }
    }
  }
}
```

### 3. Coding agent queries intent
```typescript
const intent = await client.queryIntent({
  operation: "writing authentication code",
  context: { tags: ["authentication"] }
});

// Returns merged constraints from entire chain:
// - core_story constraints (audit_logging, encryption)
// - operational constraints (mfa, oauth2, forbidden: basic_auth)
```

### 4. Agent generates compliant code
```typescript
// Agent checks constraints
if (intent.constraints.code?.forbidden_patterns?.includes('localStorage')) {
  // Use httpOnly cookies instead
}

if (intent.constraints.code?.required_patterns?.includes('audit_logging')) {
  // Add audit logging
}
```

---

## Data Model

### Intent Unit Structure
```typescript
{
  // Core fields (from patent)
  id: string;                    // Unique identifier
  type: IntentType;              // core_story | positioning | product_narrative | operational | evidence | communication
  assertion: string;             // The claim/requirement
  dependencies: string[];        // IDs of units this depends on
  validationState: ValidationState;  // ALIGNED | DRIFTED | BROKEN | UNKNOWN
  confidence: number;            // 0.0 - 1.0

  // Intent (machine-actionable)
  intent: {
    objective: string;           // What the org wants
    constraints?: {
      code?: {
        required_patterns?: string[];
        forbidden_patterns?: string[];
        required_libraries?: string[];
      },
      content?: {
        required_themes?: string[];
        forbidden_themes?: string[];
        tone?: 'professional' | 'casual' | 'technical' | 'empathetic';
        target_audience?: string;
      },
      validation_rules?: ValidationRule[];
    },
    evidence_required?: string[];  // What proves this works
  },

  // Story Signal metadata (optional)
  signal?: {
    score: number;               // 0-100 from 5 R's
    source: string;              // Where it came from
    timestamp: string;
    dimensions?: {
      resonance: number;         // 0-20
      relevance: number;         // 0-20
      rarity: number;            // 0-20
      relatability: number;      // 0-20
      riskReward: number;        // 0-20
    }
  },

  // Propagation rules
  propagation?: {
    scope?: 'all_dependents' | 'direct_only' | 'filtered';
    urgency?: 'immediate' | 'batched' | 'manual';
    mode?: 'auto_update' | 'notification' | 'silent';
  },

  // Metadata
  metadata?: {
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    tags?: string[];
  }
}
```

---

## Files Created

### Schema & Types
- `schema/intent-unit.schema.json` - JSON Schema specification
- `packages/core/types.ts` - TypeScript type definitions

### Core Package
- `packages/core/narrative-graph.ts` - Main storage engine (~375 lines)
- `packages/core/index.ts` - Package entry point
- `packages/core/package.json`
- `packages/core/tsconfig.json`

### SDK Package
- `packages/sdk/intent-client.ts` - Agent query interface (~330 lines)
- `packages/sdk/index.ts` - Package entry point
- `packages/sdk/package.json`
- `packages/sdk/tsconfig.json`

### Signal Package
- `packages/signal/story-signal.ts` - Story mining engine (~280 lines)
- `packages/signal/index.ts` - Package entry point
- `packages/signal/package.json`
- `packages/signal/tsconfig.json`

### Web UI
- `static/story-signal.html` - Interactive story capture tool

### Tests & Examples
- `packages/sdk/test-basic.js` - Integration test for core + SDK
- `packages/signal/test-signal.js` - Story Signal conversion test
- `examples/basic-usage.ts` - Complete usage example

### Configuration
- `package.json` - Workspace configuration

---

## Testing

All packages have been built and tested:

```bash
# Core package
cd packages/core && npm run build
✅ Built successfully

# SDK package
cd packages/sdk && npm run build && node test-basic.js
✅ All tests passed
✅ Intent chain traversal works
✅ Constraint merging works
✅ Propagation impact analysis works

# Signal package
cd packages/signal && npm run build && node test-signal.js
✅ All tests passed
✅ 5 R's scoring works
✅ Auto-conversion works (score >= 85)
✅ Manual conversion with constraints works
✅ Signal statistics tracking works
```

---

## Next Steps (In Progress)

### 5. Pre-commit Validator
AST parsing + intent checking to validate code before commit.

**Will detect:**
- Forbidden patterns (e.g., `localStorage` for tokens)
- Missing required patterns (e.g., `audit_logging`)
- Missing required libraries
- Intent violations with specific fixes

### 6. Install Script & CLI
One-command installation and setup.

### 7. Demo Video & Alpha Release
Record walkthrough and ship to early adopters.

---

## The Vision

This infrastructure makes organizational intent queryable by autonomous agents. Instead of agents operating with vague system prompts, they can ask "what does the org want me to do?" and get back:

1. **Full Intent Chain** - From core story → positioning → operational
2. **Merged Constraints** - All applicable code/content rules
3. **Validation Rules** - What to check before committing
4. **Evidence Requirements** - How to prove it works

This is **foundational infrastructure** for the agentic era - analogous to what relational databases did for data management.

---

## Patent Reference

Based on **Narrative Intelligence Patent v6 (SPEC)**:
- Narrative units as composable primitives: N = (id, τ, α, D, V, c, P)
- Narrative algebra operations: Propagate, Validate, Compose, Resonate, Cover, Drift
- Layer taxonomy: 6 organizational layers from core_story → communication
- Domain-agnostic design: works for any organization, any industry

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   STORY SIGNAL                           │
│  (Input Layer - Story Mining with 5 R's)                │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│               NARRATIVE GRAPH                            │
│  (Storage Layer - SQLite + DAG Validation)               │
│                                                           │
│  Intent Units stored with dependencies                   │
│  Propagation rules | Validation state                    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│               INTENT CLIENT                              │
│  (Query Layer - Agent SDK)                               │
│                                                           │
│  queryIntent() → intentChain + constraints               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│         APPLICATIONS                                     │
│  (Agents, Pre-commit hooks, CI/CD, etc.)                │
│                                                           │
│  • Code generation agents                                │
│  • Content creation agents                               │
│  • Pre-commit validators                                 │
│  • CI/CD intent checks                                   │
│  • Documentation sync                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Intent units table
CREATE TABLE intent_units (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  assertion TEXT NOT NULL,
  intent JSON NOT NULL,
  dependencies JSON NOT NULL,
  validation_state TEXT DEFAULT 'ALIGNED',
  confidence REAL DEFAULT 1.0,
  signal JSON,
  propagation JSON,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dependency edges (for efficient graph traversal)
CREATE TABLE dependencies (
  dependent_id TEXT NOT NULL,
  dependency_id TEXT NOT NULL,
  PRIMARY KEY (dependent_id, dependency_id),
  FOREIGN KEY (dependent_id) REFERENCES intent_units(id),
  FOREIGN KEY (dependency_id) REFERENCES intent_units(id)
);
```

---

**Built by:** Julie Allen
**Date:** 2026-04-11
**Status:** Core infrastructure complete, validator in progress
