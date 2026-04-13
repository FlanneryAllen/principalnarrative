# .narrative — Canonical Narrative Source

This directory is the single source of truth for organizational narrative.
The Narrative Agent watches this directory and runs coherence checks
whenever it changes.

## Structure

```
.narrative/
├── canon/              ← The declared narrative (PR-protected)
│   ├── core-story.yml  ← Root narrative — everything traces back here
│   └── positioning.yml ← Market-facing claims
├── skills/             ← How the agent evaluates content
│   ├── tone-of-voice.yml
│   └── terminology.yml
├── signals/            ← External inputs (agent-managed, not canonical)
│   └── (competitor moves, press, analyst coverage)
└── README.md
```

## Trust Levels

| Source | Trust | Who Changes It | What Happens |
|--------|-------|---------------|-------------|
| `canon/` | Highest | Narrative owner via PR | Triggers a **clarion call** — full coherence check |
| `skills/` | High | Narrative owner via PR | Updates evaluation lenses |
| `signals/` | Medium | Agent or anyone | Scored against canon, never modifies it |

## Clarion Call

When a file in `canon/` changes, the agent runs a clarion call:

1. Parse the changed narrative units
2. Find all downstream units that depend on them
3. Run coherence checks (Compare, Validate)
4. Surface drift alerts for anything misaligned
5. Propose updates where needed

Trigger manually: `npx narrative clarion-call`

## Editing Canon

Changes to `canon/` should go through a PR. This is intentional —
narrative changes are organizational decisions, not casual edits.
The PR diff shows exactly what changed in the declared story.
