# Narrative Agent Skills

Skills are modular extensions that let the Narrative Agent reach into new content sources, generate new stakeholder views, and deliver insight in new formats — all without touching the core algebra engine.

## What is a skill

A skill is a directory containing:

- **`SKILL.md`** — frontmatter (name, version, type, capabilities) + instructions
- **Optional handler code** (`index.js`) — exports the skill's runtime hooks
- **Optional templates** — canon templates, view templates, prompt templates

The Narrative Agent loads skills on demand. The user (or an authoring tool) selects which skills are active for their workspace.

## Skill types

| Type | Purpose | Hooks |
|---|---|---|
| `harvest` | Pull narrative units from a new source | `harvest(ctx) → units[]` |
| `view` | Generate a stakeholder-specific composition | `compose(canon, ctx) → view` |
| `validation` | Run domain-specific checks during Ω Validate | `validate(unit, ctx) → issues[]` |
| `clarion` | Define trigger conditions + response workflows | `onTrigger(event, ctx) → workflow` |
| `delivery` | Deliver insight outside the dashboard | `deliver(metrics, ctx) → result` |

A single skill may declare multiple types (e.g. a harvest skill that also provides a default view).

## Skill manifest (SKILL.md frontmatter)

```yaml
---
name: slack-harvest
version: 0.1.0
type: harvest
description: Pulls candidate narrative units from Slack channels and threads.
requires:
  connectors: [slack]
  scopes: [channels:history, users:read]
capabilities:
  - harvest.channels
  - harvest.threads
  - harvest.dms (opt-in)
author: Principal AI
---
```

## Skill dependencies

Skills can depend on other skills. Dependencies are declared in `package.json` using standard npm syntax with semver version constraints.

### Adding dependencies to a skill

Create a `package.json` in your skill directory:

```json
{
  "name": "@principal-skills/blog-authoring-harness",
  "version": "0.1.0",
  "description": "Authoring workflow with live scoring",
  "main": "index.js",
  "private": true,
  "dependencies": {
    "@principal-skills/provenance-scoring": "^0.1.0",
    "@principal-skills/huddle-harvest": "^0.1.0"
  },
  "author": "Principal AI",
  "license": "UNLICENSED"
}
```

### Dependency resolution

The skill loader validates dependencies **before** loading any skill (fail-fast). If a dependency is missing or version doesn't match, you'll get a clear 4-part error:

```
[1/4] Skill failed: blog-authoring-harness
[2/4] Dependency issue: provenance-scoring
[3/4] Version mismatch: expected ^0.1.0, found 0.0.9
[4/4] How to fix: Run 'npm install' in skills/blog-authoring-harness/ to resolve dependencies
```

### Supported version constraints

- **Exact**: `"0.1.0"` — must match exactly
- **Caret**: `"^0.1.0"` — allows patch and minor updates (0.1.x, 0.2.0, but not 1.0.0)
- **Tilde**: `"~0.1.0"` — allows patch updates only (0.1.x)
- **Greater than**: `">=0.1.0"` — any version >= 0.1.0
- **Wildcard**: `"*"` — any version

### Circular dependencies

The loader detects circular dependencies and fails with a clear error:

```
Circular dependency detected: skill-a -> skill-b -> skill-a
```

### Validation during CI

Run the validation script to check all skills before deploy:

```bash
npm run validate:skills
```

This script loads every skill and validates its dependency graph. Use it in your CI pipeline to catch dependency issues before they reach production.

## Loading skills

```js
const { loadSkill } = require('./skills/loader');
const slackSkill = loadSkill('slack-harvest');
const units = await slackSkill.harvest({ workspaceId, channels: ['#general'] });

// Dependencies are automatically loaded and available
const harness = loadSkill('blog-authoring-harness');
// harness.dependencies = { 'provenance-scoring': {...}, 'huddle-harvest': {...} }
```

## Bundled skills

| Skill | Type | Description |
|---|---|---|
| `slack-harvest` | harvest | Pull narrative units from Slack |
| `weekly-coherence-digest` | delivery | Scheduled email summary of NCI trend + top actions |
| `board-deck-view` | view | Compose canon into board-meeting narrative |

## Authoring your own

Drop a directory into `skills/` with a `SKILL.md` and `index.js`. The agent picks it up on next workspace load. See any bundled skill as a reference.
