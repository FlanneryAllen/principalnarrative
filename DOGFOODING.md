# Dogfooding Narrative Intelligence

**Using Narrative Intelligence Infrastructure on itself**

Date: April 11, 2026

---

## Overview

This document details our experience using Narrative Intelligence Infrastructure to manage its own development - a practice known as "dogfooding" (eating your own dog food).

**TL;DR**: It works. The same infrastructure that guides a healthcare SaaS company successfully guides the development of Narrative Intelligence itself.

---

## What We Did

### 1. Created Intent Units for This Project

We created **14 narrative units** that capture how we build Narrative Intelligence:

**Core Stories (3)**:
- `core_story_infrastructure_not_application` - Build primitives, not applications
- `core_story_simplicity_through_structure` - Manage complexity through composition
- `core_story_developer_experience` - Prioritize DX (5-minute onboarding, clear errors)

**Operational (6)**:
- `operational_typescript_strict_mode` - Strict TypeScript, no implicit any
- `operational_zero_dependencies_core` - Minimize dependencies, document rationale
- `operational_sqlite_as_storage` - SQLite only, no external databases
- `operational_comprehensive_examples` - Every feature needs working examples
- `operational_git_native` - All source of truth in Git (markdown, JSON)
- `operational_multi_language_sdks` - TypeScript + Python minimum

**Communication (2)**:
- `communication_technical_but_accessible` - Rigorous but clear documentation
- `communication_show_dont_tell` - Lead with examples, not theory

**Evidence (3)**:
- `evidence_typescript_build_passes` - All packages compile without errors
- `evidence_python_tests_pass` - Python SDK has comprehensive tests
- `evidence_quickstart_works` - 5-minute onboarding validated

### 2. Seeded the Database

```bash
node scripts/seed-database.js narrative-agentv2 --force
```

Result: **27 total units** (13 for narrative-agentv2, 14 for healthcare-saas example)

### 3. Tested Real Development Queries

We queried intent for actual development tasks:

#### Query 1: "Creating new TypeScript package"

**Intent Chain**: 9 units
**Required Patterns**:
- `strict_mode`, `explicit_types`, `type_safety`
- `single_responsibility`, `small_functions`, `documented`
- `example_code`, `documented_usage`
- `dependency_justification`

**Forbidden Patterns**:
- `any_type`, `ts_ignore`, `god_object`
- `circular_dependencies`, `global_state`
- `unnecessary_dependencies`, `undocumented_features`

**Evidence Required**:
- `npm_run_build_succeeds`, `tsc_no_errors`
- `low_cyclomatic_complexity`, `no_circular_dependencies`
- `typescript_sdk_complete`, `python_sdk_complete`

#### Query 2: "Writing documentation"

**Intent Chain**: 5 units
**Required Themes**:
- `clear_explanations`, `technical_accuracy`, `practical_examples`
- `code_examples`, `demos`, `walkthroughs`
- `why_explanation`, `api_reference_links`

**Forbidden Themes**:
- `jargon_without_explanation`, `marketing_fluff`
- `theory_only`, `abstract_concepts_first`
- `vague_descriptions`

**Tone**: Technical

#### Query 3: "Adding npm dependency"

**Intent Chain**: 2 units
**Required**:
- `dependency_justification` - Must document WHY

**Forbidden**:
- `unnecessary_dependencies`, `bloated_packages`

#### Query 4: "Writing authentication code" (context comparison)

**Healthcare context** (tags: security, authentication):
- 12 units in chain
- Focus: `oauth2`, `mfa_support`, `audit_logging`, `HIPAA_compliance`

**Infrastructure context** (tags: infrastructure, typescript):
- 12 units in chain
- Focus: `type_safety`, `strict_mode`, `composable`, `git_friendly`

**Same query, different constraints based on context!**

---

## Key Findings

### ✅ What Worked Well

#### 1. **Composability Proven**

The same infrastructure serves BOTH:
- Healthcare SaaS (operational product)
- Narrative Intelligence (infrastructure project)

No modifications needed. Same query engine, same storage, same workflow.

#### 2. **Context-Aware Constraints**

Same query ("writing authentication code") returns different constraints based on tags:
- Healthcare tags → HIPAA, audit logging, encryption
- Infrastructure tags → TypeScript, composability, Git-native

The system adapts to context automatically.

#### 3. **Enforces Philosophy**

Our core values are now machine-readable:
- "Infrastructure, not application" → Forbids `hardcoded_use_case`, `application_logic`
- "Simplicity through structure" → Forbids `god_object`, `circular_dependencies`
- "Developer experience" → Requires `clear_error_messages`, `helpful_defaults`

An AI agent building a feature for this project would receive these constraints automatically.

#### 4. **Dependency Chains Work**

Evidence units depend on operational units:
```
evidence_typescript_build_passes
  ↓ depends on
operational_typescript_strict_mode
  ↓ depends on
core_story_simplicity_through_structure
```

Querying for "TypeScript" returns the full chain, merged constraints.

#### 5. **Multi-Project Database**

27 units from 2 different projects coexist peacefully:
- Healthcare SaaS units don't interfere with infrastructure units
- Queries filter by tags/keywords correctly
- No namespace collision or confusion

### 🤔 What We Learned

#### 1. **Keyword Matching Has Limitations**

Current implementation uses simple keyword extraction:
```javascript
keywords = ['adding', 'npm', 'dependency']
```

This works for direct matches but misses semantic similarity:
- "adding npm dependency" ✅ matches `operational_zero_dependencies_core`
- "installing package" ❌ doesn't match (but should!)

**Future**: Implement semantic search with embeddings.

#### 2. **Context Tags Are Critical**

Without tags, queries return too many units:
- "writing code" → 20+ units from both projects

With tags, queries are precise:
- "writing code" + `[healthcare, security]` → 5 healthcare units
- "writing code" + `[infrastructure, typescript]` → 4 infrastructure units

**Learning**: Always include context tags for accurate results.

#### 3. **Evidence Units Need Automation**

Evidence units like `evidence_typescript_build_passes` state WHAT to check, but don't CHECK it:

```json
{
  "evidence_required": [
    "npm_run_build_succeeds",
    "tsc_no_errors"
  ]
}
```

**Gap**: No automation to verify these assertions.

**Future**: Build evidence checkers that run `npm run build` and update validation state.

#### 4. **Validation Rules Underutilized**

We defined validation rules:
```json
{
  "type": "regex",
  "check": "\"strict\":\\s*true",
  "error_message": "tsconfig.json must have strict: true"
}
```

But the validator (`packages/validator`) doesn't use them yet.

**Future**: Connect validation rules to pre-commit hook.

#### 5. **Human-Readable ≠ Machine-Readable**

Narrative units are JSON (machine-readable), but:
- Hard for non-technical users to create
- No visual editor
- CLI helps but still requires understanding structure

**Future**: Build web dashboard with drag-and-drop graph editor.

---

## Validation Against Core Values

Let's validate that our narrative units actually reflect our stated values:

### Value 1: "Infrastructure, Not Application"

**Stated** (from `.principalnarrative/applied-narrative/vision.md`):
> We build the foundations that enable infinite applications

**Intent Unit** (`core_story_infrastructure_not_application`):
```json
{
  "constraints": {
    "code": {
      "required_patterns": ["composable", "extensible", "primitive"],
      "forbidden_patterns": ["hardcoded_use_case", "application_logic"]
    }
  }
}
```

✅ **Aligned** - Machine-readable version of human statement

### Value 2: "Simplicity Through Structure"

**Stated**:
> We manage complexity not by adding features, but through composable primitives

**Intent Unit** (`core_story_simplicity_through_structure`):
```json
{
  "constraints": {
    "code": {
      "required_patterns": ["single_responsibility", "small_functions"],
      "forbidden_patterns": ["god_object", "circular_dependencies", "global_state"]
    }
  }
}
```

✅ **Aligned** - Enforceable code constraints

### Value 3: "Human Intent, Machine Action"

**Stated**:
> Narrative Intelligence makes organizational narrative machine-readable

**Implementation**:
- Human writes: "We prioritize developer experience"
- Machine reads: `{ required: ['clear_error_messages'], forbidden: ['cryptic_errors'] }`
- AI agent generates: Code with helpful error messages

✅ **Aligned** - The product demonstrates the value

### Value 4: "Open Innovation"

**Stated**:
> Open source, extensible, community-driven

**Implementation**:
- All code on GitHub (MIT license)
- Extensible architecture (custom validators, multiple SDKs)
- No vendor lock-in (SQLite, not cloud service)

✅ **Aligned** - But no narrative units enforce this yet

**Action Item**: Create narrative units for open source practices.

---

## Metrics

### Before Dogfooding

- Narrative units: 14 (all healthcare SaaS examples)
- Projects using system: 0 (mock data only)
- Real-world validation: ❌

### After Dogfooding

- Narrative units: 27 (14 healthcare, 13 narrative-agentv2)
- Projects using system: 2 (1 real, 1 example)
- Real-world validation: ✅
- Queries tested: 4 different development scenarios
- Evidence: System works for multiple domains

---

## AI Agent Scenario: Real-World Usage

**Scenario**: An AI coding agent needs to add a new package to Narrative Intelligence.

### 1. Agent Receives Task

```
User: "Add a REST API package that exposes intent queries over HTTP"
```

### 2. Agent Queries Intent

```typescript
const result = await client.queryIntent({
  operation: 'creating new typescript package',
  context: { tags: ['typescript', 'infrastructure', 'api'] }
});
```

### 3. Agent Receives Constraints

```javascript
{
  intentChain: [
    "We build infrastructure, not applications",
    "We manage complexity through simple, composable primitives",
    "All TypeScript code must use strict mode",
    "Core packages should minimize dependencies",
    // ... 5 more
  ],
  constraints: {
    code: {
      required_patterns: [
        'strict_mode', 'explicit_types', 'type_safety',
        'single_responsibility', 'small_functions',
        'dependency_justification', 'documented'
      ],
      forbidden_patterns: [
        'any_type', 'ts_ignore', 'god_object',
        'circular_dependencies', 'unnecessary_dependencies'
      ]
    }
  },
  evidenceRequired: [
    'npm_run_build_succeeds',
    'typescript_sdk_complete',
    'example_for_every_feature'
  ]
}
```

### 4. Agent Generates Aligned Code

```typescript
// packages/rest-api/src/server.ts
// ✅ Strict mode (required by operational_typescript_strict_mode)
import { IntentClient } from '@narrative/sdk';  // ✅ Existing dependency
import express from 'express';  // ✅ Minimal, justified dependency

// ✅ Small function, single responsibility
export async function createServer(dbPath: string): Promise<express.Application> {
  const app = express();
  const client = new IntentClient(dbPath);  // ✅ Composable (uses existing SDK)

  // ✅ Documented (required by operational_comprehensive_examples)
  /**
   * Query organizational narrative
   * POST /query
   * Body: { operation: string, context?: object }
   */
  app.post('/query', async (req, res) => {
    try {
      const result = await client.queryIntent(req.body);
      res.json(result);
    } catch (error) {
      // ✅ Clear error message (required by core_story_developer_experience)
      res.status(400).json({
        error: 'Query failed',
        message: error.message,
        // ✅ No stack trace in production (forbidden)
      });
    }
  });

  return app;
}
```

### 5. Agent Creates Example

```typescript
// packages/rest-api/examples/basic-usage.ts
// ✅ Required by operational_comprehensive_examples

import { createServer } from '../src/server';

async function main() {
  const app = await createServer('.narrative/narrative.db');
  app.listen(3000, () => {
    console.log('Intent API running on http://localhost:3000');
  });
}

main();
```

### 6. Agent Validates

```bash
npm run build  # ✅ Passes (evidence_typescript_build_passes)
npm test       # ✅ Passes (if tests exist)
./narrative    # ✅ CLI still works (no breaking changes)
```

**Result**: New package aligns with organizational narrative automatically!

---

## Comparison: Healthcare vs Infrastructure

| Aspect | Healthcare SaaS | Narrative Intelligence |
|--------|----------------|-------------------|
| **Domain** | HIPAA-regulated healthcare data | Developer infrastructure |
| **Focus** | Security, compliance, patient privacy | Simplicity, composability, DX |
| **Required Patterns** | `oauth2`, `mfa_support`, `audit_logging`, `aes_256` | `type_safety`, `strict_mode`, `composable`, `documented` |
| **Forbidden Patterns** | `localStorage`, `basic_auth`, `plaintext_storage` | `god_object`, `any_type`, `circular_dependencies` |
| **Evidence** | SOC2, HIPAA certification, penetration tests | Build passes, tests pass, 5-min onboarding |
| **Tone** | Professional, trust-focused | Technical, clear |
| **Intent Units** | 14 units | 13 units |

**Key Insight**: Completely different domains, completely different constraints, **same infrastructure**.

---

## ROI: Was Dogfooding Worth It?

### Time Invested

- Creating 14 narrative units: ~2 hours
- Building dogfooding test: ~30 minutes
- Documentation: ~1 hour

**Total: ~3.5 hours**

### Value Gained

✅ **Proof of Concept**: System works for real projects, not just examples

✅ **Identified Gaps**:
- Semantic search needed (keyword matching insufficient)
- Evidence automation needed (assertions without checkers)
- Validation rules not connected to pre-commit hook
- No visual editor for non-technical users

✅ **Dogfooding Example**: New users can see real usage, not just mock data

✅ **Development Guidance**: Actual constraints for building this project:
```typescript
// Before adding dependency
const intent = await client.queryIntent('adding npm dependency');
// Returns: Must justify why, avoid bloat
```

✅ **Marketing Material**: "We use it ourselves" is powerful social proof

### ROI Verdict

**Worth it.** 3.5 hours → Multiple high-value outcomes.

---

## Next Steps

### Immediate (based on dogfooding findings)

1. ✅ **Create narrative-agentv2 narrative units** - DONE
2. ✅ **Test queries for development tasks** - DONE
3. ✅ **Document findings** - This document

### Short-term (address gaps found)

4. **Connect validation rules to pre-commit hook**
   - Currently: Rules defined but not used
   - Future: `git commit` → Check tsconfig.json for strict mode

5. **Build evidence automation**
   - Currently: Evidence stated but not verified
   - Future: Cron job runs `npm run build`, updates validation state

6. **Add semantic search**
   - Currently: Keyword matching only
   - Future: Embedding-based similarity search

### Medium-term (improve DX)

7. **Web dashboard for graph editing**
   - Currently: JSON editing only
   - Future: Drag-and-drop visual editor

8. **VS Code extension**
   - Currently: Validation in pre-commit only
   - Future: Real-time squiggly lines in editor

9. **GitHub Action**
   - Currently: Local validation only
   - Future: CI/CD integration

---

## Conclusion

**Dogfooding proves Narrative Intelligence works.**

We created 13 narrative units for this project, queried them for real development tasks, and received meaningful, actionable constraints. The same infrastructure that guides healthcare SaaS development successfully guides infrastructure development.

**Key Takeaway**: Narrative Intelligence is domain-agnostic infrastructure. Healthcare SaaS and developer tooling have nothing in common—except the need to align AI agents with organizational values.

**What's Next**: Use the gaps we found (semantic search, evidence automation, visual editor) to improve the product. Then dogfood again. Iterate.

---

## Appendix: Raw Test Output

```bash
$ node scripts/test-dogfooding.js
```

See full output in test run above. Highlights:

- **27 total units** (13 narrative-agentv2, 14 healthcare-saas)
- **9-unit chain** for "creating TypeScript package"
- **5-unit chain** for "writing documentation"
- **2-unit chain** for "adding npm dependency"
- **12-unit chain** for "writing authentication code" (both contexts)

**Status**: All queries successful, constraints returned, no errors.

---

**Document Status**: ✅ Complete

**Last Updated**: April 11, 2026

**Next Review**: After implementing semantic search
