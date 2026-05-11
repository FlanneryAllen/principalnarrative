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

## Loading skills

```js
const { loadSkill } = require('./skills/loader');
const slackSkill = await loadSkill('slack-harvest');
const units = await slackSkill.harvest({ workspaceId, channels: ['#general'] });
```

## Bundled skills

| Skill | Type | Description |
|---|---|---|
| `slack-harvest` | harvest | Pull narrative units from Slack |
| `weekly-coherence-digest` | delivery | Scheduled email summary of NCI trend + top actions |
| `board-deck-view` | view | Compose canon into board-meeting narrative |

## Authoring your own

Drop a directory into `skills/` with a `SKILL.md` and `index.js`. The agent picks it up on next workspace load. See any bundled skill as a reference.
