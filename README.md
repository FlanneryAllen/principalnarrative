# Narrative Intelligence

**Making organizational narrative machine-readable for autonomous AI agents**

> "In the agentic era, the bottleneck isn't AI capability—it's translating organizational narrative into machine-actionable constraints." — Julie Allen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)]()

---

## ⚡ Quick Start

**New here? Get started in 5 minutes:**

```bash
./install.sh    # Install + seed database with examples
./narrative     # Launch interactive CLI
# Select "🔍 Query Intent" → Try: "writing authentication code"
```

📖 **[Complete 5-Minute Tutorial →](QUICKSTART.md)**

📋 **[Full CLI Guide →](CLI_GUIDE.md)**

🐕 **[Dogfooding Case Study →](DOGFOODING.md)** - Using Narrative Intelligence on itself

✅ **[Validation Integration →](VALIDATION_INTEGRATION.md)** - End-to-end proof it works

---

## What Is This?

Narrative Intelligence is the **missing operating system for AI agents**—a complete platform that bridges the gap between human organizational narrative and autonomous agent execution.

Think of it as:
- **A database for organizational narrative** (like Postgres is for data)
- **Git-native knowledge management** (like a codebase, but for strategy)
- **Runtime governance for AI agents** (query narrative, validate actions)

---

## The Problem

AI agents can write code, generate content, and automate workflows. But they operate from **vague system prompts**, not **organizational narrative**.

**Current State:**
```typescript
// Agent system prompt (vague, inconsistent)
"You are a helpful coding assistant. Write secure code."
```

**What We Need:**
```typescript
// Agent queries structured narrative
const narrative = await client.queryNarrative({
  operation: 'writing authentication code'
});

// Returns:
// - Required patterns: ['audit_logging', 'mfa', 'oauth2']
// - Forbidden patterns: ['localStorage', 'basic_auth']
// - Required libraries: ['jsonwebtoken']
// - Evidence required: ['test_coverage_90_percent']
```

---

## The Solution: One System, Two Layers

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Applied Narrative (Human-Editable Source)         │
│  Git-native markdown files in .principalnarrative/          │
│                                                              │
│  vision.md         brand-voice.md       priorities.md       │
│  ├─ Mission        ├─ Tone guidelines   ├─ Q2 2026 goals   │
│  ├─ Values         ├─ Messaging         ├─ Success metrics │
│  └─ Strategy       └─ Do's/Don'ts       └─ Dependencies    │
└─────────────────────────────────────────────────────────────┘
                             ↓
                    narrative-sync (automatic)
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: Narrative Intelligence (Machine-Queryable Cache)      │
│  SQLite database in .narrative/narrative.db                    │
│                                                              │
│  Intent Units → DAG Storage → Fast Queries                  │
│  ├─ Narrative Graph (dependency engine)                     │
│  ├─ Intent Client (query interface)                         │
│  ├─ Validator (pre-commit enforcement)                      │
│  └─ Story Signal (capture new intent)                       │
└─────────────────────────────────────────────────────────────┘
```

### How They Work Together

1. **Humans edit markdown** (familiar, version-controlled)
2. **Sync converts** markdown → narrative units (automatic)
3. **Agents query** the database (fast, structured)
4. **Validators enforce** intent at commit time (automatic)

**Benefits:**
- ✅ **Best of both worlds**: Human-friendly authoring + machine-queryable runtime
- ✅ **Git-native**: All changes tracked, reviewable, rollback-able
- ✅ **One source of truth**: Markdown is canonical, database is cache
- ✅ **Automatic sync**: Changes flow seamlessly between layers

---

## Quick Start

### Installation

```bash
# Clone or navigate to repository
cd narrative-agentv2

# Run unified installer (sets up both systems)
./install.sh

# This will:
# - Create .narrative/ directory (Narrative Intelligence)
# - Create .principalnarrative/ directory (Applied Narrative)
# - Initialize intent database
# - Set up pre-commit hooks
# - Sync markdown → database
```

### 1. Edit Your Organizational Context (Markdown)

```bash
# Edit vision & mission
vim .principalnarrative/applied-narrative/vision.md

# Edit brand voice & communication guidelines
vim .principalnarrative/applied-narrative/brand-voice.md

# Edit current priorities
vim .principalnarrative/applied-narrative/priorities.md
```

### 2. Sync to Database

```bash
# Sync markdown files → narrative units
node packages/integrations/dist/sync-cli.js sync

# Output:
# 🔄 Syncing Applied Narrative → Narrative Intelligence
# 📊 Sync Results:
#    Created: 3
#    Updated: 2
#    Unchanged: 0
# ✅ Sync complete!
```

### 3. Query Intent (Agents)

**TypeScript/JavaScript:**

```typescript
import { IntentClient } from '@narrative/sdk';

const client = new IntentClient('.narrative/narrative.db');

// Agent queries intent before acting
const intent = await client.queryNarrative({
  operation: 'writing authentication code',
  context: { tags: ['security'] }
});

// Returns merged constraints from vision.md, brand-voice.md, etc.
console.log(intent.constraints);
// {
//   code: {
//     required_patterns: ['audit_logging', 'mfa'],
//     forbidden_patterns: ['localStorage', 'basic_auth']
//   },
//   content: {
//     tone: 'professional',
//     required_themes: ['security', 'trust']
//   }
// }
```

**Python (for AI agents):**

```python
from narrative_sdk import IntentClient

client = IntentClient('.narrative/narrative.db')

# AI agent queries intent before generating code
result = client.query_intent(
    operation='writing authentication code',
    context={'tags': ['security', 'authentication']}
)

# Use constraints to guide code generation
code_constraints = result['constraints']['code']
required = code_constraints['required_patterns']  # ['oauth2', 'mfa_support', 'audit_logging']
forbidden = code_constraints['forbidden_patterns']  # ['localStorage', 'basic_auth']

# Generate code that aligns with organizational narrative
```

📦 **Python SDK**: See `packages/python-sdk/` for full documentation and examples

### 4. Validate Code (Pre-commit)

```bash
# Validation runs automatically on commit
git add .
git commit -m "Add authentication"

# Output:
# 🔍 Validating code against organizational narrative...
# ❌ Forbidden pattern "localStorage" detected in src/auth.ts:15
#    💡 Use httpOnly cookies or secure session storage instead
# ❌ Validation failed.
```

---

## Architecture

### Unified Directory Structure

```
narrative-agentv2/                    # One unified codebase
│
├── .principalnarrative/              # Layer 1: Human-Editable
│   └── applied-narrative/
│       ├── vision.md                 # Mission, vision, values
│       ├── brand-voice.md            # Communication guidelines
│       ├── priorities.md             # Current strategic priorities
│       ├── customer-pain-points.md   # Target audience & problems
│       ├── decisions/                # Architecture Decision Records
│       └── technical-context/        # Technical architecture
│
├── .narrative/                       # Layer 2: Machine-Queryable
│   ├── narrative.db                     # SQLite narrative units
│   ├── config.json                   # Configuration
│   └── README.md                     # Documentation
│
├── packages/                         # Core Infrastructure
│   ├── core/                         # Narrative Graph (storage + DAG)
│   ├── sdk/                          # TypeScript SDK (query + create)
│   ├── python-sdk/                   # Python SDK (for AI agents)
│   ├── cli/                          # Interactive CLI (no code required)
│   ├── signal/                       # Story Signal (5 R's framework)
│   ├── validator/                    # Pre-commit validator
│   └── integrations/                 # Markdown ↔ Database sync
│
├── static/
│   └── story-signal.html             # Web UI for capturing stories
│
├── examples/
│   └── healthcare-saas-intent-units.json  # Example intent dataset
│
├── scripts/
│   ├── seed-database.js              # Seed database with examples
│   └── verify-database.js            # Verify database integrity
│
├── install.sh                        # Unified installer
├── narrative                         # CLI entry point (chmod +x)
├── README.md                         # This file
├── QUICKSTART.md                     # 5-minute tutorial
└── CLI_GUIDE.md                      # Complete CLI guide
```

---

## Vision & Mission

From `.principalnarrative/applied-narrative/vision.md`:

> **Mission**: Narrative Intelligence makes organizational narrative machine-readable for autonomous AI agents, bridging the gap between human purpose and agent execution.

> **Vision**: A world where every AI agent system has access to organizational DNA—the structured intent that ensures autonomous systems serve human purpose.

**Core Values:**
1. **Human Intent, Machine Action** - AI amplifies human purpose
2. **Infrastructure, Not Application** - Build foundations, not features
3. **Simplicity Through Structure** - Manage complexity via primitives
4. **Open Innovation** - Open source, extensible, community-driven

---

## Commands

### Sync Commands

```bash
# Incremental sync (only changed files)
node packages/integrations/dist/sync-cli.js sync

# Full import (all files)
node packages/integrations/dist/sync-cli.js import
```

### Validation Commands

```bash
# Validate all files
npx narrative-validate

# Validate with verbose output
npx narrative-validate --verbose

# Fail on warnings
npx narrative-validate --fail-on-warning
```

---

## Documentation

- **README_INTENT_ENGINEERING.md** - Complete technical guide (detailed API docs, examples)
- **INTENT_ENGINEERING_README.md** - Architecture deep dive (data model, database schema)
- **.principalnarrative/applied-narrative/README.md** - Applied Narrative guide
- **.narrative/README.md** - Quick reference

---

## Patent

Based on **Narrative Intelligence Patent v6 (SPEC)** by Julie Allen.

**Key innovations:**
- Narrative units as composable primitives: `N = (id, τ, α, D, V, c, P)`
- Narrative algebra operations: Propagate, Validate, Compose, Resonate, Cover, Drift
- Layer taxonomy for organizational structure
- Domain-agnostic design

---

## Status

**Alpha v0.1.0** - Released April 11, 2026

All core packages tested and working. Ready for early adopters and pilot customers.

---

## License

MIT

---

**"The future of AI isn't just about capability—it's about alignment. Narrative Intelligence is the bridge."**
