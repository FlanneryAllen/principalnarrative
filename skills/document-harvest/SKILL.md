---
name: document-harvest
version: 0.1.0
type: harvest
description: Extracts narrative units from uploaded PDF documents (board decks, strategy docs, pitch materials).
requires:
  dependencies: [pdf-parse]
capabilities:
  - harvest.pdf
  - harvest.structured_extraction
  - harvest.metadata_attribution
author: Principal AI
---

# Document Harvest

The premise: **every strategic document is a snapshot of canon at a moment in time.** Board decks, investor pitch materials, strategy memos, product roadmaps—they all contain high-confidence positioning and tactical narrative that should be indexed, not lost in Drive folders.

## What it produces

Each PDF generates **structured narrative units** organized by document sections:

### Unit Types

**Heading units (`type: 'positioning'`)**
- Document title and major section headings
- High confidence (0.9) — these are deliberately structured statements
- Good for understanding narrative hierarchy

**Content units (`type: 'tactical'`)**
- Paragraph-level assertions from body text
- Salience-filtered (skip boilerplate, footers, page numbers)
- Confidence 0.7-0.8 depending on document metadata

**Metadata unit (`type: 'document_metadata'`)**
- Single unit capturing document-level context
- Author, creation date, title, page count
- Links to all content units as dependencies

## Document structure extraction

PDFs are parsed to identify:

| Element | Detection | Treatment |
|---------|-----------|-----------|
| **Title** | First large-font text block or PDF metadata title | Becomes document metadata unit |
| **Headings** | Font size changes, bold text, numbering patterns | Each becomes a positioning unit |
| **Body text** | Regular paragraphs between headings | Filtered by salience, becomes tactical units |
| **Footers/Headers** | Repeated text across pages (page numbers, company name) | Stripped during extraction |
| **Bullet points** | Indentation patterns, bullet characters | Preserved in assertion text |

## Salience filtering

Not every paragraph becomes a unit. The skill filters by:

| Signal | Effect |
|---|---|
| **Length** | < 20 words → discarded (likely captions, footers) |
| **Repetition** | Appears on multiple pages → footer/header, discarded |
| **Boilerplate** | Matches common patterns ("©", "Confidential", page numbers) → discarded |
| **Positioning markers** | Phrases like "our vision", "we believe", "the opportunity" → boost salience |
| **Structure** | First paragraph after a heading → higher confidence |

A typical 20-page board deck yields **~15-30 narrative units** (not 200). Signal over noise.

## Example output

For a board deck titled "Q2 2026 Strategic Update":

```js
// Document metadata unit
{
  id: 'doc-q2-2026-strategic-update-meta',
  type: 'document_metadata',
  assertion: 'Q2 2026 Strategic Update — Board deck presented May 14, 2026',
  author: 'Julie Allen',
  authoredAt: '2026-05-14T00:00:00Z',
  scope: 'company',
  confidence: 1.0,
  source: {
    platform: 'pdf-upload',
    filename: 'Q2-2026-Strategic-Update.pdf',
    pageCount: 22,
    createdDate: '2026-05-14',
  },
  intent: {
    promotable_to_blog: false,  // metadata units aren't promotable
    needs_review: false,
  },
}

// Title unit
{
  id: 'doc-q2-2026-strategic-update-title',
  type: 'positioning',
  assertion: 'Q2 2026 Strategic Update',
  author: 'Julie Allen',
  authoredAt: '2026-05-14T00:00:00Z',
  scope: 'company',
  confidence: 0.95,
  dependencies: ['doc-q2-2026-strategic-update-meta'],
  source: {
    platform: 'pdf-upload',
    filename: 'Q2-2026-Strategic-Update.pdf',
    pageNumber: 1,
    extractionMethod: 'title',
  },
  intent: {
    promotable_to_blog: true,
    needs_review: false,
  },
}

// Section heading unit
{
  id: 'doc-q2-2026-strategic-update-section-2',
  type: 'positioning',
  assertion: 'Product Vision: Building Organizational Infrastructure',
  author: 'Julie Allen',
  authoredAt: '2026-05-14T00:00:00Z',
  scope: 'positioning',
  confidence: 0.9,
  dependencies: ['doc-q2-2026-strategic-update-meta'],
  source: {
    platform: 'pdf-upload',
    filename: 'Q2-2026-Strategic-Update.pdf',
    pageNumber: 5,
    extractionMethod: 'heading',
  },
  intent: {
    promotable_to_blog: true,
    needs_review: false,
  },
}

// Content unit
{
  id: 'doc-q2-2026-strategic-update-p7',
  type: 'tactical',
  assertion: 'We are not building a developer tool — we are building organizational infrastructure. The difference matters because infrastructure requires different reliability guarantees, different pricing models, and different go-to-market motion.',
  author: 'Julie Allen',
  authoredAt: '2026-05-14T00:00:00Z',
  scope: 'positioning',
  confidence: 0.8,
  dependencies: ['doc-q2-2026-strategic-update-section-2'],
  source: {
    platform: 'pdf-upload',
    filename: 'Q2-2026-Strategic-Update.pdf',
    pageNumber: 5,
    extractionMethod: 'paragraph',
    salienceScore: 1.4,
  },
  intent: {
    promotable_to_blog: true,
    needs_review: true,  // content units default to review
  },
}
```

## Configuration

```yaml
document-harvest:
  salience:
    min_length_words: 20
    positioning_boost_phrases:
      - "our vision"
      - "we believe"
      - "the opportunity"
      - "we are building"
      - "we are not"
    require_boost_for_short_paragraphs: true  # < 30 words must have boost
  extraction:
    skip_footers: true
    skip_headers: true
    detect_headings_by_font: true
    heading_font_size_threshold: 1.3  # text 1.3x larger than body = heading
  default_scope: 'positioning'
  default_author: null  # will try to extract from PDF metadata
```

## Privacy & consent

Strategic documents often contain sensitive information:

- **Explicit upload only**. No automatic harvesting from Drive/Dropbox without user initiation.
- **Confidential marking respected**. PDFs marked "Confidential" or "Internal Only" get `intent.needs_review: true` and are excluded from auto-promotion.
- **PII scrubbing**. Email addresses, phone numbers, SSNs are redacted before unit creation.
- **Redaction support**. After harvest, users can issue "forget section" commands to tombstone specific units.

## Output

Returns `{ units: [...], metadata: { filename, pageCount, author, createdDate } }`. Units enter the workspace as candidates with `intent.needs_review` set per policy.

## Failure modes

- **PDF encrypted**: Password-protected PDFs → extraction fails, clear error message
- **Scanned PDF (images)**: No text layer → OCR not included in v1, error message suggests exporting with text layer
- **Malformed PDF**: Corrupted file → graceful error, no units created
- **No extractable text**: Charts/diagrams-only slides → only metadata unit created

## Why this matters

Board decks and strategy memos are the highest-confidence narrative documents in an organization—they go through multiple review cycles and executive approval. Harvesting them into canon means:

1. **Provenance scoring can enforce alignment** between what you promised the board and what you ship in product messaging.
2. **Drift detection works across stakeholders** — if the board deck says one thing and the website says another, the clarion call surfaces it.
3. **Historical narrative tracking** — compare Q1 vs Q2 board decks to see how positioning evolved.

This skill turns "we should be consistent" into "we can measure consistency."
