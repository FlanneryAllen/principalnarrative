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

## Quick Start

### 1. Initialize

```bash
node packages/serve/init.js
```

Answers a few questions, scaffolds `.narrative/` with starter YAML files.

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
node packages/serve/server.js
```

Open [http://localhost:3333](http://localhost:3333). You'll see:

- **D3 graph** of your narrative units and their dependencies
- **Coherence score** — 0 to 100
- **Live alerts** when something drifts
- **Test assertion** — type bad copy, watch the score drop
- **Content review** — paste a draft, get it scored against your canon

Edit a YAML file. The dashboard updates instantly via SSE. No refresh.

### 4. Add the GitHub Action

Copy `.github/workflows/clarion-call.yml` to your repo. It runs the clarion
call on every PR that touches `.narrative/`, README files, or docs.

The action:
- Parses your canon and skill files
- Runs all coherence checks
- Comments on the PR with the score and any violations
- Fails the check if the score drops below 60

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
| GET | `/api/events` | SSE stream — pushes live updates on file change |
| GET | `/` | Serves the dashboard |

### Example: Score a test assertion

```bash
curl -X POST http://localhost:3333/api/clarion-call \
  -H 'Content-Type: application/json' \
  -d '{"testAssertion": "We leverage AI to disrupt the paradigm"}'
```

### Example: Review content

```bash
curl -X POST http://localhost:3333/api/review \
  -H 'Content-Type: application/json' \
  -d '{"text": "PrincipalAI enables organizations to streamline workflows"}'
```

## Architecture

```
.narrative/          ← YAML source of truth (Git-controlled)
     │
     ├── canon-parser    ← Reads YAML, produces NarrativeUnit objects
     ├── clarion-call    ← Engine: drift, terminology, tone, orphan checks
     ├── watcher         ← fs.watch triggers clarion calls on change
     └── server          ← HTTP API + SSE + dashboard
           │
           ├── /api/canon         ← Read
           ├── /api/clarion-call  ← Check
           ├── /api/review        ← Score content
           ├── /api/events        ← Live push
           └── /                  ← Dashboard (auto-detects API)
```

The dashboard works in two modes:
- **Live** — connected to the server, reads real YAML, updates via SSE
- **Standalone** — no server, uses built-in fallback data (for demos)

## Directory

| Package | What |
|---------|------|
| `packages/agent/` | Canon parser, clarion call engine, file watcher |
| `packages/serve/` | HTTP server, init command, dashboard serving |
| `packages/cli/` | CLI with interactive commands |
| `packages/core/` | Narrative algebra, graph operations |
| `clarion-dashboard/` | Single-page dashboard (HTML + D3) |
| `.github/workflows/` | GitHub Action for PR checks |
| `.narrative/` | Your narrative source files |
