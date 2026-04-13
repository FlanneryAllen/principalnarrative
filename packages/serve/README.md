# narrative-agent

A coherence engine for organizational narrative. Declare your story once in YAML.
Every downstream claim, product page, and marketing asset gets checked against it.

## Why

At any company with more than one person writing copy, the story drifts.
Marketing says one thing, the README says another, the pitch deck says a third.
Nobody notices until an investor or customer points it out.

`narrative-agent` makes drift visible.

## Install

```bash
npm install -g narrative-agent
```

## Quick Start

```bash
# 1. Scaffold .narrative/ with starter YAML
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

Add a clarion call to every PR. It comments with a coherence score and per-file breakdown.
See the [docs](https://github.com/FlanneryAllen/principalnarrative) for the workflow file.

## Dashboard

`narrative serve` starts a local dashboard at http://localhost:3333 with:

- D3 graph of narrative units and dependencies
- Coherence score (0–100)
- Live updates via SSE when you edit YAML files
- Content check tab — scan repo files with per-file drill-down
- Content review — paste a draft, get it scored
- Score history sparkline

## API

When running `narrative serve`, these endpoints are available:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/canon` | All parsed units + skills |
| POST | `/api/clarion-call` | Run the engine, get score + alerts |
| POST | `/api/review` | Score arbitrary text |
| GET | `/api/check` | Scan all .md files |
| GET | `/api/history` | Score history (last 50 entries) |
| GET | `/api/events` | SSE stream for live updates |

## License

MIT
