# narrative starter

Add narrative alignment checking to any project. Declare your story once in YAML,
then every piece of content gets checked against it.

## Setup

1. Copy the `.narrative/` directory and `.github/workflows/clarion-call.yml` into your repo.

2. Edit your canon:
   - `.narrative/canon/core-story.yml` — your root narrative assertion
   - `.narrative/canon/positioning.yml` — product-level claims

3. Edit your skills:
   - `.narrative/skills/terminology.yml` — brand names, forbidden terms, preferred terms
   - `.narrative/skills/tone-of-voice.yml` — voice principles with good/bad examples

4. Install and run:

```bash
npm install yaml
npx narrative check
```

## What gets checked

Every `.md` file in your repo is scored against 5 lenses:

- **Terminology** — forbidden words, wrong brand names
- **Brand** — correct company name and product names
- **Tone** — marketing-speak patterns
- **Preferred terms** — using discouraged variants
- **Theme alignment** — does content touch core narrative themes?

## GitHub Action

The included workflow runs on every PR that touches `.narrative/` or `.md` files.
It comments with a coherence score and per-file breakdown.

## Commands

```
narrative init              Scaffold .narrative/ (interactive)
narrative check             Scan all .md files
narrative check --json      Machine-readable output
narrative status            Quick score with trend
narrative watch             Re-run on every file save
narrative serve             Live dashboard + API
```

## Learn more

See the [full documentation](https://github.com/FlanneryAllen/principalnarrative/blob/main/NARRATIVE_AGENT.md).
