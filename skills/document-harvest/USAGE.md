# Document Harvest Usage Guide

## Quick Start

The document-harvest skill extracts narrative units from PDF files. Upload a board deck, strategy memo, or product roadmap and get structured narrative units ready for canon validation.

## API Usage

### Endpoint

```
POST /api/workspaces/:workspaceId/harvest/document
```

### Request Format

```json
{
  "document": "<base64-encoded-pdf>",
  "filename": "Q2-2026-Board-Deck.pdf",
  "author": "Julie Allen",
  "config": {
    "minLengthWords": 20,
    "positioningBoostPhrases": [
      "our vision",
      "we believe",
      "the opportunity"
    ],
    "requireBoostForShortParagraphs": true
  }
}
```

### Fields

- **document** (required): Base64-encoded PDF file
- **filename** (required): Must end with `.pdf`
- **author** (optional): Document author (falls back to PDF metadata)
- **config** (optional): Harvest configuration overrides

### Response

```json
{
  "units": [
    {
      "id": "doc-q2-2026-board-deck-meta",
      "type": "document_metadata",
      "assertion": "Q2 2026 Board Deck — 22 pages, uploaded 2026-05-14",
      "author": "Julie Allen",
      "confidence": 1.0,
      "source": {
        "platform": "pdf-upload",
        "filename": "Q2-2026-Board-Deck.pdf",
        "pageCount": 22
      }
    },
    {
      "id": "doc-q2-2026-board-deck-title",
      "type": "positioning",
      "assertion": "Q2 2026 Strategic Update",
      "confidence": 0.95,
      "intent": {
        "promotable_to_blog": true,
        "needs_review": false
      }
    }
  ],
  "metadata": {
    "filename": "Q2-2026-Board-Deck.pdf",
    "pageCount": 22,
    "title": "Q2 2026 Strategic Update",
    "author": "Julie Allen",
    "createdDate": "2026-05-14"
  },
  "algebra": {
    "nci": 0.87,
    "layerHealth": {
      "core_story": 1.0,
      "positioning": 0.92,
      "tactical": 0.81
    },
    "totalEdges": 15
  },
  "totalUnits": 28
}
```

## Example: Upload with cURL

```bash
# 1. Encode PDF to base64
PDF_BASE64=$(base64 -i "Q2-Board-Deck.pdf")

# 2. Create request JSON
cat > request.json <<EOF
{
  "document": "${PDF_BASE64}",
  "filename": "Q2-Board-Deck.pdf",
  "author": "Julie Allen"
}
EOF

# 3. Upload
curl -X POST http://localhost:3333/api/workspaces/default/harvest/document \
  -H "Content-Type: application/json" \
  -d @request.json
```

## Example: JavaScript/Node.js

```javascript
const fs = require('fs');
const fetch = require('node-fetch');

async function harvestPDF(pdfPath, filename, author) {
  // Read PDF and encode to base64
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  // Upload to harvest API
  const response = await fetch('http://localhost:3333/api/workspaces/default/harvest/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document: pdfBase64,
      filename,
      author,
    }),
  });

  const result = await response.json();

  console.log(`Harvested ${result.totalUnits} units from ${filename}`);
  console.log(`NCI: ${result.algebra.nci}`);

  return result;
}

// Usage
harvestPDF('./Q2-Board-Deck.pdf', 'Q2-Board-Deck.pdf', 'Julie Allen');
```

## Example: Python

```python
import base64
import requests
import json

def harvest_pdf(pdf_path, filename, author):
    # Read PDF and encode to base64
    with open(pdf_path, 'rb') as f:
        pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

    # Upload to harvest API
    response = requests.post(
        'http://localhost:3333/api/workspaces/default/harvest/document',
        json={
            'document': pdf_base64,
            'filename': filename,
            'author': author,
        }
    )

    result = response.json()

    print(f"Harvested {result['totalUnits']} units from {filename}")
    print(f"NCI: {result['algebra']['nci']}")

    return result

# Usage
harvest_pdf('./Q2-Board-Deck.pdf', 'Q2-Board-Deck.pdf', 'Julie Allen')
```

## Configuration Options

### Salience Filtering

Control which paragraphs become narrative units:

```json
{
  "config": {
    "minLengthWords": 20,
    "positioningBoostPhrases": [
      "our vision",
      "we believe",
      "the opportunity",
      "we are building",
      "the key insight"
    ],
    "requireBoostForShortParagraphs": true,
    "skipFooters": true,
    "skipHeaders": true
  }
}
```

- **minLengthWords** (default: 20): Minimum paragraph length
- **positioningBoostPhrases**: Phrases that boost salience
- **requireBoostForShortParagraphs** (default: true): Short paragraphs (< 30 words) must contain boost phrases
- **skipFooters** (default: true): Remove footers, page numbers, copyright
- **skipHeaders** (default: true): Remove repeated headers

## Unit Types Generated

### 1. Document Metadata Unit

- **Type**: `document_metadata`
- **Confidence**: 1.0
- **Promotable**: No
- Contains: filename, page count, author, date

### 2. Title Unit

- **Type**: `positioning`
- **Confidence**: 0.95
- **Promotable**: Yes
- **Needs Review**: No
- Contains: document title

### 3. Section Heading Units

- **Type**: `positioning`
- **Confidence**: 0.9
- **Promotable**: Yes
- **Needs Review**: No
- Contains: major section headings

### 4. Content Units

- **Type**: `tactical`
- **Confidence**: 0.8
- **Promotable**: Yes
- **Needs Review**: Yes
- Contains: paragraph text filtered by salience

## Typical Output

| Document Type | Pages | Units Generated |
|---|---|---|
| Board deck | 15-25 | 15-30 units |
| Strategy memo | 5-10 | 10-20 units |
| Product roadmap | 10-15 | 12-25 units |
| Pitch deck | 10-20 | 10-25 units |

## Error Handling

### Common Errors

**400 Bad Request - Missing document**
```json
{ "error": "Missing or invalid document field (expected base64)" }
```
→ Ensure PDF is base64-encoded

**400 Bad Request - Invalid filename**
```json
{ "error": "Invalid filename. Only PDF files are supported." }
```
→ Filename must end with `.pdf`

**403 Forbidden - CSRF**
```json
{ "error": "Invalid CSRF token. Please refresh and try again." }
```
→ Include valid CSRF token in request

**429 Too Many Requests**
```json
{
  "error": "Harvest rate limit exceeded. Maximum 3 harvests per minute.",
  "retryAfter": 60
}
```
→ Wait 60 seconds before retrying

**500 Internal Server Error - Parse failed**
```json
{ "error": "Document harvest failed: PDF parse failed: encrypted" }
```
→ PDF is password-protected or corrupted

## Integration with Provenance Scoring

Harvested units with `intent.promotable_to_blog: true` can be used as canon for blog provenance scoring:

```javascript
// 1. Harvest board deck
const harvestResult = await harvestPDF('Q2-Board-Deck.pdf', ...);

// 2. Filter promotable units
const canonUnits = harvestResult.units.filter(u =>
  u.intent?.promotable_to_blog === true
);

// 3. Score blog draft against board deck canon
const score = await provenanceScore({
  draft: blogPostText,
  canon: canonUnits,
  embedder,
  llm,
});

console.log(`Blog post P(draft): ${score.score}`);
// → Ensures blog aligns with what was promised to the board
```

## Next Steps

After harvesting:

1. **Review units** in the dashboard Content Check tab
2. **Validate canon** using the Clarion Call engine
3. **Promote to canon** by moving units to `.narrative/canon/`
4. **Use for provenance scoring** with blog-authoring-harness

## Security Notes

- Maximum file size: 10MB (enforced by `readBody` limit)
- Rate limit: 3 uploads per minute per session
- CSRF token required for all uploads
- PII scrubbing (if configured) removes sensitive data
- No automatic promotion to canon (all units default to `needs_review: true`)
