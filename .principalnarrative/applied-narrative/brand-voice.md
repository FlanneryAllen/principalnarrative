---
documentType: brandVoice
version: 1.0.0
lastUpdated: 2026-04-11
author: Julie Allen
status: approved
tags:
  - brand
  - voice
  - tone
  - messaging
  - communication
relatedDocuments:
  - vision.md
  - customer-pain-points.md
changelog:
  - date: 2026-04-11
    change: Initial brand voice for Intent Engineering
    author: Julie Allen
---

# Brand Voice & Communication Guidelines

## Brand Voice Attributes

### Attribute 1: Technical but Accessible
**What it means:** We speak to developers and technical leaders, but avoid unnecessary jargon. We explain complex systems clearly without dumbing them down.

**Why it matters:** Our audience is technical, but they're also busy. Clarity wins over cleverness.

**How it sounds:** Like a senior engineer explaining a system to a colleague—precise but conversational.

**Examples:**
- **Good:** "Intent Units form a directed acyclic graph (DAG), which means dependencies flow one way—like a family tree, not a tangled web."
- **Bad:** "Our patented graph-theoretic approach leverages advanced algorithmic primitives to ensure topological consistency across the narrative lattice."

---

### Attribute 2: Confident without Arrogance
**What it means:** We're building foundational infrastructure and we know it's important. But we're humble about what we don't know and open to feedback.

**Why it matters:** Developers respect confidence backed by competence, but hate arrogance. We need to inspire trust, not alienation.

**How it sounds:** "This solves a real problem" not "We're geniuses and you're lucky to use this."

**Examples:**
- **Good:** "We built this because we kept seeing the same problem: agents lack access to organizational intent. This is our answer."
- **Bad:** "Finally, a solution worthy of the agentic era. Other approaches are fundamentally broken—only Intent Engineering gets it right."

---

### Attribute 3: Human-Centric
**What it means:** AI agents are tools that should serve human purpose. Our messaging always centers human intent, never fetishizes the technology.

**Why it matters:** In an era of AI hype, we differentiate by focusing on human agency and control.

**How it sounds:** "Help agents understand what humans want" not "Build more powerful agents."

**Examples:**
- **Good:** "Intent Engineering ensures your AI agents operate from your organizational values, not vague system prompts."
- **Bad:** "Supercharge your agents with unlimited autonomous capabilities using our revolutionary AI governance platform."

---

### Attribute 4: Infrastructure Mindset
**What it means:** We think like database engineers, not app developers. We build foundations, not features.

**Why it matters:** This positions us correctly in the stack and sets expectations about stability, composability, and longevity.

**How it sounds:** Like Postgres documentation, not a SaaS marketing page.

**Examples:**
- **Good:** "Intent Engineering is infrastructure—like a database for organizational intent. It's boring, reliable, and foundational."
- **Bad:** "Try our amazing AI governance platform with 50+ features! Sign up for free trial today! 🚀"

---

## Tone Variations by Context

### Marketing Website
**Tone:** Clear, benefit-focused, confident
**Target Audience:** Engineering leaders evaluating solutions
**Goals:** Communicate value proposition clearly, inspire confidence
**Example:** "Stop worrying about rogue AI agents. Intent Engineering gives you programmatic control over what agents can and cannot do."

### Documentation
**Tone:** Precise, helpful, thorough
**Target Audience:** Developers implementing the system
**Goals:** Enable successful integration with minimal friction
**Example:** "The `queryIntent()` method returns merged constraints from the entire dependency chain. Pass an operation string and optional context tags."

### Technical Blog Posts
**Tone:** Educational, insightful, conversational
**Target Audience:** Engineers interested in the architecture
**Goals:** Share knowledge, build thought leadership, attract contributors
**Example:** "We chose SQLite because it's battle-tested infrastructure that can handle millions of intent queries per second. Sometimes boring is beautiful."

### Social Media / Twitter
**Tone:** Punchy, clear, occasionally provocative
**Target Audience:** Developers, AI researchers, tech leaders
**Goals:** Drive awareness, spark discussion, share insights
**Example:** "Your AI agents are operating from vibes, not values. Intent Engineering fixes this."

### Customer Support
**Tone:** Helpful, patient, solution-oriented
**Target Audience:** Users encountering issues
**Goals:** Solve problems quickly, maintain trust
**Example:** "That error happens when the dependency graph has a cycle. Here's how to identify and fix it..."

---

## Messaging Pillars

### Pillar 1: The Agentic Era Needs Infrastructure
**Message:** AI capability is advancing faster than organizational governance. Intent Engineering provides the missing infrastructure layer.

**Key Points:**
- Agents can write code, but don't know company security policies
- Current solutions are ad-hoc (system prompts, RAG, fine-tuning)
- Infrastructure approach scales better than application approach

**Use When:** Explaining why Intent Engineering exists

---

### Pillar 2: Intent Units Are the Primitive
**Message:** Just as relational databases gave us tables/rows, Intent Engineering gives us intent units—composable primitives for organizational governance.

**Key Points:**
- Simple data structure: assertion + constraints + dependencies
- Composable via dependency chains
- Domain-agnostic (works for any organization)

**Use When:** Explaining the core technical concept

---

### Pillar 3: Human Intent, Machine Action
**Message:** AI should amplify human purpose, not replace human judgment. We make intent explicit and queryable.

**Key Points:**
- Humans define intent (via Story Signal or markdown)
- Agents query intent before acting
- Validators enforce alignment automatically

**Use When:** Explaining the value proposition

---

### Pillar 4: Open Infrastructure
**Message:** The best infrastructure is open, extensible, and community-driven. We're building in public.

**Key Points:**
- Open source core
- Extensible architecture
- Published research and patents
- Community governance

**Use When:** Positioning against proprietary competitors

---

## Do's and Don'ts

### Do's
- **Do** use analogies to databases, Git, or other infrastructure developers know
- **Do** show code examples in documentation
- **Do** acknowledge limitations and tradeoffs honestly
- **Do** use "we" when talking about the team, "you" when addressing users
- **Do** link to the patent when discussing novel technical approaches
- **Do** emphasize control, alignment, and governance

### Don'ts
- **Don't** use buzzwords like "revolutionary," "disruptive," "game-changing"
- **Don't** over-promise capabilities we haven't built yet
- **Don't** compare directly to competitors (let them come to us)
- **Don't** use AI hype language ("AGI," "superintelligence," etc.)
- **Don't** bury the value proposition in jargon
- **Don't** use emojis in technical documentation (casual contexts are fine)

---

## Style Guidelines

### Grammar & Formatting
- Use American English spelling
- Oxford comma always
- Code snippets in backticks: `queryIntent()`
- File paths in backticks: `.narrative/intent.db`
- Acronyms spelled out on first use: "Directed Acyclic Graph (DAG)"

### Terminology
- "Intent Engineering" (capitalized when referring to the field/system)
- "intent units" (lowercase when referring to the data structure)
- "agents" not "AI agents" (unless context requires it)
- "organizational intent" not "company goals"
- "constraints" not "rules" or "policies"

### Code Examples
- Always include imports at the top
- Use TypeScript for examples (clearest types)
- Show error handling when relevant
- Keep examples under 20 lines when possible
- Include comments explaining non-obvious behavior

### Links & References
- Link to relevant docs liberally
- Include line numbers when referencing code: `narrative-graph.ts:212`
- Cite the patent when discussing core innovations
- Link to examples in the examples/ directory

---

## Examples by Content Type

### README Introduction
**Good:**
```markdown
# Intent Engineering Infrastructure

Making organizational intent machine-readable for autonomous AI agents.

## The Problem
AI agents can write code, generate content, and automate workflows.
But they lack access to organizational intent—the strategic decisions,
compliance requirements, and operational constraints that guide human work.
```

**Bad:**
```markdown
# 🚀 Intent Engineering - The Future of AI Governance! 🚀

Revolutionize your AI workflow with our groundbreaking patented technology!
Unlock unlimited agent capabilities while maintaining complete control!
```

---

### API Documentation
**Good:**
```typescript
/**
 * Query organizational intent for a given operation
 *
 * @param params.operation - What the agent is trying to do
 * @param params.context - Additional context (file path, tags, etc.)
 * @returns Intent chain with merged constraints
 *
 * @example
 * const intent = await client.queryIntent({
 *   operation: 'writing authentication code',
 *   context: { tags: ['security'] }
 * });
 */
async queryIntent(params: QueryIntentParams): Promise<IntentResponse>
```

**Bad:**
```typescript
// Queries the intent (super powerful!)
queryIntent(params)
```

---

*Apply these guidelines consistently across all customer touchpoints.*
