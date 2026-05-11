# Narrative Agent — Google Docs Add-on

A Google Workspace add-on that runs the blog-authoring-harness directly inside Google Docs. As you write, the sidebar shows your provenance score, highlights matched spans, and suggests huddle quotes for unmatched paragraphs.

## What this directory contains

| File | Purpose |
|---|---|
| `appsscript.json` | Manifest declaring scopes, runtime version, and add-on entry points |
| `Code.gs` | Main Apps Script: menu, document scan, sidebar lifecycle |
| `HarnessClient.gs` | Thin client that calls the Narrative Agent harness HTTP API |
| `Sidebar.html` | The sidebar UI — live score, span list, suggestions, publish button |
| `Highlighter.gs` | Applies background colors to matched spans in the document body |
| `Properties.gs` | Per-user settings storage (workspace ID, API token, threshold) |

## Architecture

```
Google Docs Editor
       │
       ▼  user types
[Code.gs.onDocumentEdit] ─ debounce 800ms ─▶ [HarnessClient.scoreDraft]
       │                                                │
       │                                                ▼
       │                              POST https://your-agent/api/harness/score
       │                                                │
       │                                  ┌─────────────┘
       │                                  ▼
       ▼                       { score, spans, suggestions }
[Highlighter.applySpans] ◀────────────┘
       │
       ▼
[Sidebar.html] ◀── score, suggestions, layer breakdown
```

The add-on never holds canon or runs scoring itself — everything goes through the Narrative Agent's HTTP API. This keeps the add-on small (manifest + ~400 lines of Apps Script), keeps secrets server-side, and means improvements to the scoring algorithm don't require a re-publish to the Google Marketplace.

## Setup (developer / local)

1. Clone the principalnarrative repo
2. Install `clasp`: `npm i -g @google/clasp`
3. `cd integrations/google-docs-addon && clasp login && clasp create --type docs`
4. `clasp push` to upload the add-on
5. Open any Google Doc → Extensions → Apps Script → Run `onInstall`
6. The add-on appears under Extensions → Narrative Agent

## Setup (user installation, post-Marketplace publish)

1. Open Google Docs
2. Extensions → Add-ons → Get add-ons → search "Narrative Agent"
3. Install + grant permissions
4. Open the sidebar via Extensions → Narrative Agent → Open harness
5. First-run dialog asks for: workspace URL + API token (one-time setup)
6. The sidebar lights up; start writing

## Permissions explained

| Scope | Why we need it |
|---|---|
| `docs.currentonly` | Read + highlight the current document |
| `script.external_request` | Call the Narrative Agent API |
| `script.scriptapp` | Manage the sidebar |
| `script.container.ui` | Show menus and dialogs |

We deliberately use `docs.currentonly` (not the broader `documents`) — the add-on can only touch the document the user has explicitly opened it in. Other docs are invisible to it.

## API contract

The add-on assumes the Narrative Agent exposes:

```
POST /api/harness/session
  body: { workspaceId, docId, authoredBy }
  → { sessionId, canonUnitCount, threshold, liveScoreDebounceMs }

POST /api/harness/score
  body: { sessionId, draft }
  → { score, spans: [{ start, end, layer, weight, sourceUnitId, sourceAuthor, ... }],
      layerBreakdown, unmatchedRanges: [{ start, end, suggestions: [...] }] }

POST /api/harness/publish/attempt
  body: { sessionId, draft, title }
  → { ok: true, publishId } | { ok: false, requires_override: true, prompt, minReasonLength }

POST /api/harness/publish/override
  body: { sessionId, draft, title, reason }
  → { ok: true, publishId, override: true }
```

These map 1:1 to the `blog-authoring-harness` skill's public functions.

## Span-to-document mapping

Provenance spans are character offsets into the plain-text draft. The add-on:

1. Calls `body.getText()` to get the plain text and remembers the offset map
2. Sends the plain text to the API
3. Receives spans back as `{start, end}` character ranges
4. Uses `findText()` or per-paragraph offset arithmetic to locate the matching `Range` in the document
5. Calls `setBackgroundColor()` on each matched range with layer-specific colors:
   - verbatim: `#fef3c7` (warm yellow — "their actual words")
   - near_verbatim: `#fde68a` (slightly deeper)
   - paraphrase_verified: `#dbeafe` (light blue — "faithful restatement")
   - concept_only: `#e0e7ff` (light indigo)
   - unmatched: no highlight

## Known limitations

- **Plain text only.** The first version ignores formatting, comments, images. Spans are computed against plain text — applying highlights to formatted text can occasionally land on the wrong range when there are inline images. Future version will use Docs API's proper offset model.
- **No collaborative real-time scoring.** If two authors edit simultaneously, each gets their own session and score. The publish event is the single source of truth.
- **Offline mode.** Without network, the sidebar shows a "reconnecting" state and disables Publish.

## Local testing

The Apps Script itself is hard to unit-test, but the `HarnessClient.gs` is structured so its core URL builder + payload builder are pure functions. See `integrations/google-docs-addon/test/test-harness-client.js` for tests run via plain Node.
