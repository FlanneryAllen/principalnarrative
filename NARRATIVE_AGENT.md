# Narrative Agent

A coherence engine for organizational narrative. Declare your story once in YAML.
Every downstream claim, product page, and marketing asset gets checked against it.

## The Problem

At any company with more than one person writing copy, the story drifts.
Marketing says one thing, the README says another, the pitch deck says a third.
Nobody notices until an investor or customer points it out.

The narrative agent makes drift visible. It reads your declared narrative,
checks everything against it, and tells you where you've gone off-script.

## How It Works

Your narrative lives in a `.narrative/` directory in your repo:

```
.narrative/
├── canon/              ← What you're saying (PR-protected)
│   ├── core-story.yml  ← Root narrative — the one thing
│   └── positioning.yml ← Product-level claims
├── skills/             ← How you say it (evaluation rules)
│   ├── tone-of-voice.yml
│   └── terminology.yml
└── README.md
```

**Canon** is the declared truth. Only the narrative owner changes it (via PR).
**Skills** are the rules the agent uses to evaluate content — forbidden terms,
brand names, tone patterns.

A **clarion call** runs whenever canon changes:

1. Parse all narrative units
2. Walk the dependency graph
3. Check theme alignment, terminology, tone, and brand
4. Score coherence (0–100)
5. Surface drift alerts

## Install

```bash
npm install            # from the repo root
npx narrative help     # verify it works
```

Or link globally for development:

```bash
npm link
narrative help
```

## Quick Start

### 1. Initialize

```bash
narrative init
```

Answers a few questions, scaffolds `.narrative/` with starter YAML files.
For CI or scripting, use `narrative init --defaults` to skip prompts.

### 2. Edit Your Canon

Open `.narrative/canon/core-story.yml` and write your core assertion:

```yaml
units:
  - id: core_mission
    type: core_story
    assertion: >
      We make software development visible. The best builders
      don't want to code less — they want to see more.
    intent:
      objective: Define why we exist
      constraints:
        content:
          required_themes: [visibility, builders]
          forbidden_themes: [surveillance, productivity_tracking]
    dependencies: []
    confidence: 1.0
```

### 3. Start the Dashboard

```bash
narrative serve
```

Open [http://localhost:3333](http://localhost:3333). You'll see:

- **D3 graph** of your narrative units and their dependencies
- **Coherence score** — 0 to 100
- **Live alerts** when something drifts
- **Test assertion** — type bad copy, watch the score drop
- **Content check** — scan repo files against your canon, with per-file drill-down
- **Content review** — paste a draft, get it scored

Edit a YAML file. The dashboard updates instantly via SSE. No refresh.

Use `--port` to change the default port:

```bash
narrative serve --port 4000
```

### 4. Check Your Content

Scan all markdown files in the repo against your canon and skills:

```bash
narrative check
```

Score a specific file or directory:

```bash
narrative check README.md docs/
```

Get JSON output (for CI pipelines):

```bash
narrative check --json --threshold 70
```

Each file is scored against 5 lenses: terminology, tone, brand names,
product names, and theme alignment. The output shows per-file scores
with line-level violations. The `--threshold` flag fails if any file
scores below the given number.

The dashboard also has a **Content Check** tab that runs this scan
via the API and shows clickable file results.

### 5. Quick Status

Get a one-line coherence summary without starting the server:

```bash
narrative status
```

Output:

```
  narrative status
  ────────────────
  ✓ Combined:  98/100 ↑ from 96
    Canon:    100/100 (7 units, 0 issues)
    Content:  96/100 (62 files, 78 violations)
```

The `↑`/`↓` trend compares to the last recorded score. Use `--json`
for machine-readable output.

### 6. Add the GitHub Action

Copy `.github/workflows/clarion-call.yml` to your repo. It runs the clarion
call on every PR that touches `.narrative/`, README files, or docs.

The action:
- Parses your canon and skill files
- Runs all coherence checks on narrative units
- Scans changed `.md` files for content violations
- Comments on the PR with both canon score and content score
- Includes a per-file score table for changed files
- Fails the check if the combined score drops below 60

## CLI Reference

```
narrative <command> [options]

Commands:
  init                Scaffold .narrative/ for a new project
  serve               Start dashboard + API server
  check [files...]    Scan .md files against canon + skills
  status              Quick coherence score (canon + content)
  help                Show help

Options:
  --dir <path>        Project root (default: .)
  --port <num>        Server port (default: 3333)
  --json              JSON output for check/status
  --threshold <n>     Fail if any file scores below n
  --defaults          Non-interactive mode for init
  --version           Show version
```

All commands default to the current directory. Use `--dir` to point
at a different project root.

## Score History

Every `check` and `status` run saves a timestamped JSON snapshot to
`.narrative/history/`. This directory is git-ignored by default.

History powers:
- The `↑`/`↓` trend indicator in `narrative status`
- Future: dashboard score-over-time chart

To inspect history:

```bash
ls .narrative/history/
cat .narrative/history/2026-04-13T16-30-00.json
```

## Narrative Units

A narrative unit is an assertion with declared intent and dependencies:

```yaml
- id: pos_file_city
  type: positioning
  assertion: >
    For the love of seeing the whole thing. Your entire codebase,
    rendered as a living map.
  intent:
    objective: Position File City as the Structure dimension
    constraints:
      content:
        required_themes: [structure, visualization]
        forbidden_themes: [code_quality_scoring]
  dependencies: [core_three_dimensions, core_builder_love]
  confidence: 1.0
```

Units form a directed graph. Core story sits at the root. Positioning
depends on core story. Marketing assets depend on positioning. The
clarion call walks this graph to find where alignment breaks.

## Skills

Skills are evaluation lenses — not content, but rules about content.

**tone-of-voice.yml** — voice principles with good/bad examples:

```yaml
voice:
  principles:
    - id: sound_human
      rule: "Write like a person, not a brand"
      examples:
        good: ["Your entire codebase, rendered as a living map."]
        bad: ["Leverage our cutting-edge platform to maximize velocity."]
```

**terminology.yml** — canonical names and forbidden terms:

```yaml
brand:
  company_name: "Principal AI"
  never: ["Principal ADE", "PrincipalAI"]

products:
  - name: "File City"
    never: ["FileCity", "filecity"]

terminology:
  forbidden:
    - "leverage"
    - "cutting-edge"
    - "synergy"
```

## API

When running `narrative serve`, these endpoints are available:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/canon` | Returns all parsed units + skills from disk |
| POST | `/api/clarion-call` | Runs the engine, returns score + alerts |
| POST | `/api/review` | Scores arbitrary text against canon + skills |
| GET | `/api/check` | Scans all .md files, returns per-file scores |
| GET | `/api/check?file=README.md` | Scan a specific file |
| POST | `/api/check` | Score inline content: `{"content": "..."}` |
| GET | `/api/events` | SSE stream — pushes live updates on file change |
| GET | `/` | Serves the dashboard |

### Example: Score a test assertion

```bash
curl -s -X POST http://localhost:3333/api/clarion-call \
  -H 'Content-Type: application/json' \
  -d '{"testAssertion": "We leverage AI to disrupt the paradigm"}'
```

### Example: Review content

```bash
curl -s -X POST http://localhost:3333/api/review \
  -H 'Content-Type: application/json' \
  -d '{"text": "PrincipalAI enables organizations to streamline workflows"}'
```

### Example: Check all files

```bash
curl -s http://localhost:3333/api/check | jq '.summary'
```

## Architecture

```
narrative              ← Unified CLI entry point
  │
  ├── init             ← Scaffold .narrative/ with starter YAML
  ├── check            ← Content scanner: reads .md files, scores against skills
  ├── status           ← Quick score with history trend
  └── serve            ← HTTP API + SSE + dashboard
        │
        ├── canon-parser     ← Reads YAML, produces NarrativeUnit objects
        ├── clarion-call     ← Engine: drift, terminology, tone, orphan checks
        ├── watcher          ← fs.watch triggers clarion calls on change
        │
        ├── /api/canon         ← Read
        ├── /api/clarion-call  ← Check
        ├── /api/review        ← Score content
        ├── /api/check         ← Scan files
        ├── /api/events        ← Live push
        └── /                  ← Dashboard (auto-detects API)

.narrative/            ← YAML source of truth (Git-controlled)
  ├── canon/           ← Declared narrative units
  ├── skills/          ← Evaluation rules (tone, terminology)
  └── history/         ← Score snapshots (git-ignored)
```

The dashboard works in two modes:
- **Live** — connected to the server, reads real YAML, updates via SSE
- **Standalone** — no server, uses built-in fallback data (for demos)

## Directory

| Package | What |
|---------|------|
| `packages/agent/` | Canon parser, clarion call engine, file watcher |
| `packages/serve/` | Unified CLI (`cli.js`), HTTP server, content checker, init scaffolding |
| `packages/core/` | Narrative algebra, graph operations |
| `clarion-dashboard/` | Single-page dashboard (HTML + D3) |
| `.github/workflows/` | GitHub Action for PR checks |
| `.narrative/` | Your narrative source files |
| `.narrative/history/` | Auto-generated score snapshots (git-ignored) |
