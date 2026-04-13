# Show HN: Narrative Intelligence – Making Organizational Narrative Machine-Readable for AI Agents

**TL;DR**: Built an open-source database for organizational narrative that AI agents can query before they act. Think "Postgres for company values" or "Git for strategic intent."

---

## The Problem

We're deploying AI coding agents that can write entire features, but they operate from vague system prompts:

```typescript
// Current state: vague prompt
"You are a helpful coding assistant. Write secure code."
```

Meanwhile, your organization has specific requirements:
- "We're HIPAA-compliant, never use localStorage for auth tokens"
- "All patient data access must be audited"
- "We use OAuth 2.0 with MFA, not basic auth"

**There's no structured way for agents to access this context.**

---

## The Solution: Narrative Intelligence

A Git-native database that stores organizational narrative as **narrative units** – composable primitives that agents can query.

### How It Works

**1. Define organizational narrative** (human-editable markdown):

```markdown
# vision.md
We build HIPAA-compliant healthcare infrastructure.
Security and patient privacy are non-negotiable.

# priorities.md
Q2 2026: All authentication must use OAuth 2.0 with MFA.
No exceptions.
```

**2. Sync to machine-readable database** (automatic):

```bash
$ narrative-sync
✅ Created 3 narrative units
```

**3. AI agents query before acting**:

```typescript
// Agent queries organizational narrative
const narrative = await client.queryNarrative({
  operation: 'writing authentication code',
  context: { tags: ['security', 'patient-data'] }
});

// Returns:
// {
//   narrativeChain: [
//     "We build HIPAA-compliant healthcare infrastructure",
//     "All authentication must use OAuth 2.0 with MFA"
//   ],
//   constraints: {
//     code: {
//       required_patterns: ['oauth2', 'mfa', 'audit_logging'],
//       forbidden_patterns: ['localStorage', 'basic_auth', 'console.log'],
//       required_libraries: ['passport', 'jsonwebtoken']
//     }
//   }
// }
```

**4. Validation enforces alignment** (pre-commit hook):

```typescript
// Developer writes code
function login(user, pass) {
  localStorage.setItem('token', btoa(user + ':' + pass)); // ❌
}

git commit -m "Add login"
```

```bash
🔍 Validating code against organizational narrative...

❌ Forbidden pattern "localStorage" detected (src/auth.ts:11)
   💡 Use httpOnly cookies or secure session storage instead

❌ Forbidden pattern "basic_auth" detected (src/auth.ts:11)
   💡 Use OAuth 2.0 with MFA as per organizational narrative

❌ Validation failed. Fix violations before committing.
```

---

## Why This Matters

### For AI Coding Agents

Current AI agents are context-blind. They might generate:
- Insecure authentication (because they don't know your security requirements)
- Wrong API patterns (because they don't know your conventions)
- Code that violates compliance (because they don't understand HIPAA/SOC2)

**With Narrative Intelligence**, agents query organizational narrative first, then generate aligned code.

### For Organizations

You already have organizational narrative scattered across:
- Confluence pages
- Slack threads
- Architecture Decision Records (ADRs)
- Leadership retreat notes

**But none of it is machine-readable.**

This makes it Git-native, version-controlled, and queryable.

---

## Architecture: Two Layers, One System

```
┌─────────────────────────────────────────┐
│  Layer 1: Applied Narrative             │
│  Git-native markdown (.principalnarrative/) │
│  - Human-editable                       │
│  - Version controlled                   │
│  - Familiar format                      │
└──────────────┬──────────────────────────┘
               │
               │ narrative-sync (automatic)
               ↓
┌─────────────────────────────────────────┐
│  Layer 2: Narrative Intelligence           │
│  SQLite database (.narrative/narrative.db) │
│  - Machine-queryable                    │
│  - Fast lookups                         │
│  - DAG structure                        │
└─────────────────────────────────────────┘
```

**Best of both worlds:**
- Humans edit markdown (familiar, Git-friendly)
- Agents query database (fast, structured)

---

## Real-World Example: Dogfooding

We used it on itself. Here's what happened:

**Created narrative units for this project:**
- "We build infrastructure, not applications"
- "All TypeScript must use strict mode"
- "Core packages should minimize dependencies"

**Then queried**: "creating new TypeScript package"

**Got back**:
```typescript
{
  constraints: {
    code: {
      required_patterns: [
        'strict_mode', 'explicit_types',
        'single_responsibility', 'documented'
      ],
      forbidden_patterns: [
        'any_type', 'god_object',
        'circular_dependencies'
      ]
    }
  }
}
```

An AI agent building a feature would automatically:
- ✅ Enable TypeScript strict mode
- ✅ Avoid `any` types
- ✅ Document all public APIs
- ❌ Never create god objects

**Same query, different context tags, different constraints.** Healthcare vs infrastructure returns completely different patterns.

---

## Technical Details

### Narrative Units

The fundamental primitive. Analogous to rows in a database:

```typescript
interface NarrativeUnit {
  id: string;                    // unique identifier
  type: 'core_story' | 'operational' | 'communication';
  assertion: string;              // the claim
  dependencies: string[];         // DAG structure

  intent: {
    objective: string;
    constraints: {
      code?: {
        required_patterns: string[];
        forbidden_patterns: string[];
        required_libraries: string[];
      };
      content?: {
        tone: 'professional' | 'technical';
        required_themes: string[];
      };
      validation_rules?: ValidationRule[];
    };
    evidence_required?: string[];
  };
}
```

### Dependency Chains

Narrative units form a DAG:

```
core_story_security
  ↓
operational_auth_oauth
  ↓
operational_mfa_required
```

When you query for "auth", you get **merged constraints from the entire chain**.

### Validation Rules

Beyond pattern matching, you can define custom rules:

```typescript
{
  type: 'ast_pattern',
  check: 'jwt\\.sign.*expiresIn',
  error_message: 'JWT tokens must have expiration times',
  suggestion: 'Add expiresIn option to jwt.sign()'
}
```

Pre-commit hook runs these automatically.

---

## What We Built

**Core Infrastructure** (all TypeScript + SQLite):
- `@narrative/core` - Narrative graph (storage + DAG engine)
- `@narrative/sdk` - TypeScript client for querying
- `@narrative/validator` - Pre-commit validation
- `@narrative/integrations` - Markdown ↔ Database sync

**Developer Experience**:
- Interactive CLI (no code required)
- Python SDK (for AI agents)
- Pre-commit hooks
- Web UI for visualization

**Tested & Working**:
- ✅ End-to-end validation (100% violation detection)
- ✅ Dogfooding on itself (27 narrative units)
- ✅ Multi-project database (healthcare + infrastructure coexist)
- ✅ Context-aware queries (same query, different results based on tags)

---

## Example: Healthcare SaaS

We built 14 narrative units for a fictional healthcare company:

**Core Story:**
- "We build trusted healthcare data infrastructure"
- "Security and compliance are non-negotiable"

**Operational:**
- "All authentication must use OAuth 2.0 with MFA"
- "All patient data must be encrypted at rest (AES-256)"
- "All data access must be audited"

**Query**: `"writing authentication code"` + `['patient-data', 'security']`

**Returns**: OAuth 2.0 required, localStorage forbidden, audit logging required, MFA support required.

**Validation catches**:
- ❌ `localStorage.setItem('token', ...)`
- ❌ `console.log('Patient data:', patient)`
- ❌ `eval(userInput)`
- ❌ Missing JWT expiration times

---

## Why Open Source This?

This is **infrastructure, not an application.** The value is in:
1. The architecture (DAG-based narrative storage)
2. The workflow (markdown → database → agent queries)
3. The validation pattern (pre-commit enforcement)

**We want this to be a standard.** Like how Git became the standard for version control, or Postgres for relational data.

Every AI-native company will need something like this. Better to build it together.

---

## Current Status

**Alpha v0.1.0** (April 11, 2026)

- All core packages working
- CLI ready for use
- Pre-commit validation working
- Documentation complete
- 100% test coverage on validation

**Limitations**:
- Keyword-based matching (semantic search coming)
- No evidence automation yet (manual verification)
- No visual editor (CLI only for now)

**Roadmap**:
- Semantic search with embeddings
- VS Code extension (real-time validation)
- GitHub Action (CI/CD integration)
- Evidence automation (auto-verify compliance)
- LLM-based semantic validation

---

## Try It

**5-minute quickstart**:

```bash
git clone https://github.com/yourusername/narrative-intelligence
cd narrative-intelligence
./install.sh
./narrative

# Select "🔍 Query Narrative"
# Enter: "writing authentication code"
# See what an agent would receive
```

**Or just read the docs**:
- README.md - Overview & philosophy
- QUICKSTART.md - 5-minute tutorial
- VALIDATION_INTEGRATION.md - Proof it works
- DOGFOODING.md - Using it on itself

---

## Open Questions for HN

1. **Is this solving a real problem?** Are you worried about AI agents not understanding your org's constraints?

2. **Alternative approaches?** We went with DAG + SQLite. What would you use?

3. **Semantic search**: Should we use embeddings for matching, or is keyword-based good enough?

4. **Scope creep**: Is this trying to do too much? Should it be more focused?

5. **Naming**: "Narrative Intelligence" vs "Intent Engineering" vs something else?

6. **Business model**: Open-source infrastructure or SaaS product?

---

## Technical Deep Dives Available

Happy to discuss:
- DAG implementation (detecting cycles, propagation)
- SQLite schema design (JSON columns vs normalized tables)
- Query algorithm (keyword extraction, chain building, constraint merging)
- Validation rules engine (regex vs AST vs semantic)
- Python SDK architecture (matching TypeScript API)
- CLI implementation (interactive prompts, graph visualization)

---

## Links

- **GitHub**: [link to repo]
- **Demo**: `./narrative` (interactive CLI)
- **Docs**: See QUICKSTART.md
- **Example Dataset**: 14 healthcare narrative units included

---

## License

MIT - Use it, fork it, build on it.

---

**Built by**: Julie Allen ([@yourusername](https://twitter.com/yourusername))

**Based on**: Narrative Intelligence Patent v6 (SPEC)

**Stack**: TypeScript, SQLite, Node.js, better-sqlite3

**Why?**: Because AI agents shouldn't have to guess what your organization cares about.

---

*This is alpha software. Feedback, issues, and PRs welcome. Let's build the standard for organizational narrative together.*
