# narrative

A coherence engine for organizational narrative. Declare your story once in YAML.
Every downstream claim gets checked against it.

## Why

At any company with more than one person writing copy, the story drifts.
Marketing says one thing, the README says another, the pitch deck says a third.
Nobody notices until an investor or customer points it out.

`narrative` makes drift visible.

## Install

```bash
npm install
npx narrative help
```

## Quick Start

```bash
# 1. Scaffold .narrative/ directory with starter YAML
narrative init

# 2. Edit your canon
#    .narrative/canon/core-story.yml  — your root assertion
#    .narrative/skills/terminology.yml — brand names, forbidden terms

# 3. Check your content
narrative check

# 4. Get a quick score
narrative status

# 5. Start the live dashboard
narrative serve
```

## CLI

```
narrative <command> [options]

Commands:
  init                Scaffold .narrative/ for a new project
  serve               Start dashboard + API server
  check [files...]    Scan .md files against canon + skills
  status              Quick coherence score with history trend
  watch               Re-run check on every file save
  help                Show help

Options:
  --dir <path>        Project root (default: .)
  --port <num>        Server port (default: 3333)
  --json              JSON output for check/status
  --threshold <n>     Fail if any file scores below n
  --defaults          Non-interactive init
  --version           Show version
```

## How It Works

Your narrative lives in `.narrative/` in your repo:

```
.narrative/
├── canon/              ← What you're saying (PR-protected)
│   ├── core-story.yml
│   └── positioning.yml
├── skills/             ← How you say it (evaluation rules)
│   ├── tone-of-voice.yml
│   └── terminology.yml
└── history/            ← Score snapshots (git-ignored)
```

**Canon** is the declared truth. Only the narrative owner changes it (via PR).
**Skills** are evaluation rules — forbidden terms, brand names, tone patterns.

A **clarion call** runs whenever canon changes:

1. Parse all narrative units
2. Walk the dependency graph
3. Check theme alignment, terminology, tone, and brand
4. Score coherence (0–100)
5. Surface drift alerts

## GitHub Action

A clarion call runs on every PR that touches `.narrative/` or `.md` files.
It comments on the PR with a combined coherence score and per-file breakdown.
See `.github/workflows/clarion-call.yml`.

## Docs

See [NARRATIVE_AGENT.md](NARRATIVE_AGENT.md) for full documentation:
architecture, API reference, narrative unit format, and skill definitions.

## License

MIT
