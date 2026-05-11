---
name: huddle-harvest
version: 0.1.0
type: harvest
description: Pulls Slack huddle recordings, transcribes them, and harvests verbatim quotes + extracted ideas as canon units.
requires:
  connectors: [slack, transcription]
  scopes:
    - calls:read
    - files:read
    - users:read
capabilities:
  - harvest.huddles
  - harvest.verbatim_quotes
  - harvest.extracted_ideas
author: Principal AI
---

# Huddle Harvest

The premise: **every huddle is a canon contribution waiting to be indexed.** Right now they evaporate. After this skill runs, every meaningful thing your team says becomes a citable narrative unit — quotable in a blog post, referenceable in a board deck, traceable when canon drifts.

## What it produces

Each huddle generates **two layers of units**:

### Layer 1 — Verbatim quote units (`source.derivation: "verbatim"`)

Every salient utterance becomes a citable quote, attributed to the speaker, with a deep link back to the audio timestamp:

```js
{
  id: 'huddle-2026-05-09-am-q14',
  type: 'tactical',
  assertion: 'We are not building a developer tool — we are building organizational infrastructure.',
  author: 'Julie Allen',
  authoredAt: '2026-05-09T14:23:00Z',
  scope: 'positioning',
  confidence: 0.95,
  dependencies: [],
  source: {
    platform: 'slack-huddle',
    huddle_id: 'huddle-2026-05-09-am',
    timestamp_in_recording: '00:14:23',
    speaker_id: 'U_JULIE',
    speaker_name: 'Julie Allen',
    verbatim_text: 'We are not building a developer tool — we are building organizational infrastructure.',
    transcript_url: 'https://acme.slack.com/files/.../transcript.txt',
    permalink: 'https://acme.slack.com/archives/.../huddle?ts=00:14:23',
    derivation: 'verbatim',
  },
  intent: {
    promotable_to_blog: true,
    needs_review: false,
  },
}
```

### Layer 2 — Extracted idea units (`source.derivation: "paraphrase"`)

For each huddle, an LLM pass extracts the *ideas* (not the words). These units capture what was said semantically and link back to the verbatim units they were derived from:

```js
{
  id: 'huddle-2026-05-09-am-idea3',
  type: 'tactical',
  assertion: 'Positioning shift: infrastructure language replaces tooling language.',
  author: 'Julie Allen',
  authoredAt: '2026-05-09T14:23:00Z',
  scope: 'positioning',
  confidence: 0.75,
  dependencies: ['huddle-2026-05-09-am-q14'],  // ← the verbatim source
  source: {
    platform: 'slack-huddle',
    huddle_id: 'huddle-2026-05-09-am',
    derivation: 'paraphrase',
    source_unit_ids: ['huddle-2026-05-09-am-q14'],
  },
  intent: {
    promotable_to_blog: true,
    needs_review: true,  // paraphrases default to review
  },
}
```

## Salience filtering

Not every utterance becomes a unit. The skill filters by:

| Signal | Effect |
|---|---|
| **Length** | < 8 words → discarded (filler) |
| **Speaker** | configurable whitelist (e.g. founders only, or include guests) |
| **Topic markers** | Phrases like "the thing is", "what I keep saying", "the key insight" boost salience |
| **Reaction context** | If the team reacted to a moment (Slack reactions on huddle recording), boost |
| **Repetition** | Concepts said multiple times in the huddle get a single consolidated idea unit |

A typical 30-minute huddle yields **~5-15 verbatim units + ~3-7 idea units**. Not 200. The goal is signal, not transcript dump.

## Configuration

```yaml
huddle-harvest:
  schedule:
    cron: '0 9 * * *'                 # daily 9am
    timezone: America/Chicago
  speakers:
    whitelist: [U_JULIE, U_FERNANDO, U_MICHAEL]  # founders
    include_guests: false
  transcription:
    provider: whisper                 # whisper | assemblyai | deepgram
    diarize: true                     # speaker separation
  salience:
    min_length_words: 8
    topic_boost_phrases:
      - "what I keep saying"
      - "the key thing is"
      - "the thing is"
    require_topic_boost: false        # if true, only boosted utterances become units
  layers:
    verbatim: true
    ideas: true
    ideas_max_per_huddle: 7
  default_scope: 'positioning'        # overridable per-huddle via /canon tag
```

## Privacy & consent

This is the most sensitive harvest skill. Defaults are strict:

- **Explicit opt-in per huddle**. The skill only harvests huddles where someone ran `/canon huddle-on` or where the workspace setting `harvest_all_huddles: true` is set.
- **Speaker consent**. Speakers in the whitelist must have agreed via a one-time consent screen in the dashboard.
- **Redaction**. Speakers can issue `/canon forget last-huddle` or `/canon redact "exact phrase"` to remove units. Redacted units are tombstoned, not deleted (audit trail).
- **Sensitive-content scrubber**. Before unit creation, transcripts run through a PII/financial-data filter. Anything matching gets `intent.needs_review: true` and is excluded from auto-promotion.
- **No customer huddles harvested by default**. External-facing huddles require a separate per-huddle opt-in.

## Output

Returns `{ units: [...], huddles: [...metadata...] }`. Units enter the workspace as candidates with `intent.needs_review` set per layer policy.

## Failure modes

- **No recording**: Huddle ended without recording → skipped, logged
- **Transcription fails**: Audio retrieved but transcription provider errors → unit `huddle-{id}-failed` created with `intent.needs_review: true` and error context
- **Speaker not whitelisted**: Utterance dropped, counted in skipped metric (so we can tune the whitelist later)
- **PII detected**: Unit not created, redacted span hash logged for compliance

## Why this matters

Blogs, board decks, fundraising memos, customer emails — they all should sound like the team that actually wrote them, not like a marketing voice grafted on top. The huddles are where the team's actual voice lives. This skill turns that voice from ephemeral chatter into queryable canon, which the `blog-authoring-harness` skill then enforces against.
