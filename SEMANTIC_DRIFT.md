# Semantic Drift Detection

Advanced drift detection using **embedding-based semantic analysis** to identify contradictions, inconsistencies, and documentation-to-code misalignment.

## Overview

While traditional drift detection uses pattern matching (e.g., forbidden terms, missing proof), **Semantic Drift Detection** uses AI embeddings to understand meaning and detect deeper issues:

- **Cross-Document Contradictions**: Documents that discuss similar topics but contradict each other
- **Documentation-to-Codebase Drift**: Technical docs that don't match actual code
- **Technology Stack Misalignment**: Documented technologies that aren't used (or vice versa)

## How It Works

### 1. Cross-Document Contradiction Detection

Uses semantic embeddings to find documents with:
- Similar content (high embedding similarity)
- But contradictory statements (negation patterns, opposing claims)

**Example:**
```
Doc A: "We use PostgreSQL for all data storage"
Doc B: "Our MongoDB collections store user data"
→ CONTRADICTION DETECTED (both discuss data storage, different technologies)
```

### 2. Documentation-to-Codebase Drift

Analyzes actual code to extract:
- Technologies used (from imports, requirements.txt)
- Frameworks and libraries
- Architecture patterns

Then compares against technical documentation.

**Example:**
```
Architecture.md: "We use Redis for caching"
Codebase: No Redis imports found
→ DRIFT DETECTED (documented but not implemented)
```

### 3. Technology Stack Misalignment

Cross-references:
- `requirements.txt` / `package.json` dependencies
- Python imports in `src/**/*.py`
- Technical documentation mentions

**Example:**
```
Code uses: FastAPI, Anthropic, ChromaDB
Docs mention: Flask, OpenAI, PostgreSQL
→ MISALIGNMENT DETECTED
```

## Usage

### API Endpoint

```bash
# Run drift scan with semantic detection (default)
curl -X POST "http://localhost:8000/coherence/scan?include_semantic=true"

# Skip semantic detection (faster, pattern-based only)
curl -X POST "http://localhost:8000/coherence/scan?include_semantic=false"

# Filter by severity
curl -X POST "http://localhost:8000/coherence/scan?min_severity=high&include_semantic=true"
```

### Python API

```python
from services.semantic_drift_detector import SemanticDriftDetector

# Initialize
detector = SemanticDriftDetector()

# Run semantic scan
drift_events = detector.run_semantic_scan()

# Get summary
summary = detector.get_summary()
print(f"Found {summary['total_conflicts']} conflicts")
print(f"Codebase entities: {summary['codebase_entities_found']}")
```

### CLI Test Script

```bash
# Run semantic drift test
python test_semantic_drift.py
```

Output:
```
======================================================================
SEMANTIC DRIFT DETECTION TEST
======================================================================

[INFO] Running semantic drift detection scan...
[INFO] Scanning for cross-document contradictions...
[INFO] Scanning for documentation-to-code drift...
[INFO] Scanning for technology stack misalignment...

======================================================================
RESULTS
======================================================================

Found 5 semantic drift events:

🟠 HIGH: 2
🟡 MEDIUM: 2
🔵 LOW: 1

----------------------------------------------------------------------

HIGH SEVERITY EVENTS (2):

1. [semantic] technical-context/architecture.md
   Documentation mentions database 'postgresql' but it's not found in codebase
   Target: src/
   💡 Resolution: Remove 'postgresql' from documentation or implement it in code

2. [semantic] src/
   Code uses framework 'fastapi' but it's not documented
   Target: technical-context/architecture.md
   💡 Resolution: Add 'fastapi' to architecture documentation

...
```

## Configuration

### Similarity Thresholds

Adjust in `semantic_drift_detector.py`:

```python
# Minimum similarity to consider documents related
min_score = 0.6  # 60% similarity

# High similarity threshold for contradictions
contradiction_threshold = 0.8  # 80% similarity
```

### Contradiction Patterns

Extend negation patterns:

```python
contradiction_patterns = [
    (r'\bnot\b', r'\bis\b'),
    (r'\bdoes not\b', r'\bdoes\b'),
    (r'\bavoid\b', r'\buse\b'),
    # Add more patterns...
]
```

### Technology Tracking

Add technologies to track:

```python
tech_mapping = {
    'fastapi': 'framework',
    'django': 'framework',
    'anthropic': 'ai-service',
    'your-framework': 'framework',
    # Add more technologies...
}
```

## Performance

### Indexing

Vector store is automatically indexed on first run:
- Scans `applied-narrative/` for all `.md` and `.json` files
- Generates embeddings using ChromaDB's default model
- Persists to `.chroma/` directory

```
Indexed 42 documents → ~5-10 seconds
```

### Scan Speed

- **Pattern-based drift**: ~1-2 seconds
- **Semantic drift**: ~5-15 seconds (depends on doc count)
- **Full scan**: ~7-17 seconds

### Optimization

For faster scans:
```python
# Limit documents analyzed per scan
claim_units = claim_units[:20]  # Top 20 docs

# Reduce similarity results
similar = vector_store.search(query, n_results=5)  # Only 5 matches
```

## Drift Event Types

Semantic drift events are tagged as `DriftType.SEMANTIC`:

```python
{
    "id": "semantic-drift-abc123",
    "type": "semantic",
    "severity": "high",
    "source_unit": "technical-context/architecture.md",
    "target_unit": "src/main.py",
    "description": "Documentation says PostgreSQL, code uses SQLite",
    "suggested_resolution": "Update architecture.md to reflect SQLite usage",
    "status": "open"
}
```

## Integration with Existing Drift Detection

Semantic drift detection is **additive**:

- **Pattern-based detectors** still run (naming, proof, messaging, etc.)
- **Semantic detector** adds embedding-based analysis
- All results are merged into a single drift report

Disable semantic detection for faster pattern-only scans:

```bash
POST /coherence/scan?include_semantic=false
```

## Requirements

### Vector Store (ChromaDB)

```bash
pip install chromadb
```

ChromaDB provides:
- Automatic embedding generation
- Similarity search
- Persistent storage

### Storage

Vector database is stored in `.chroma/` (gitignored):
```
.chroma/
├── chroma.sqlite3       # Document metadata
└── [embedding files]    # Vector embeddings
```

## Troubleshooting

### "Vector store not available"

Ensure ChromaDB is installed:
```bash
pip install chromadb
```

### "No documents indexed"

Manually index:
```python
from services.vector_store import VectorStore
store = VectorStore()
count = store.index_narrative_layer()
print(f"Indexed {count} documents")
```

### Slow performance

Reduce scan scope:
```python
# Edit semantic_drift_detector.py
claim_units = claim_units[:10]  # Fewer docs
similar = vector_store.search(query, n_results=3)  # Fewer matches
```

## Roadmap

Future enhancements:

- ✅ Cross-document contradiction detection
- ✅ Documentation-to-code drift
- ✅ Technology stack misalignment
- 🔄 AI-powered conflict resolution (suggest specific fixes)
- 🔄 Historical drift tracking (trend analysis)
- 🔄 Drift alerts (Slack/email notifications)
- 🔄 Visual drift dashboard
- 🔄 Git integration (detect drift on PR)

## Examples

### Detecting Documentation Contradictions

**Applied Narrative Structure:**
```
applied-narrative/
├── strategy/vision.md       "We are developer-first"
├── messaging/voice.md       "We target business users"
└── marketing/website.md     "Built for non-technical teams"
```

**Semantic Drift Detection:**
```
CONTRADICTION: strategy/vision.md vs marketing/website.md
  Vision: "developer-first" (technical audience)
  Marketing: "non-technical teams" (business audience)
  Similarity: 0.82 (highly related)
  → RESOLVE: Clarify target audience consistently
```

### Detecting Code Drift

**Technical Documentation:**
```markdown
# Architecture

We use PostgreSQL for data persistence and Redis for caching.
All API endpoints are built with Flask.
```

**Actual Code:**
```python
# src/main.py
from fastapi import FastAPI  # ← Using FastAPI, not Flask
import sqlite3               # ← Using SQLite, not PostgreSQL
# No Redis imports
```

**Drift Detected:**
```
1. [HIGH] Documentation mentions 'postgresql' but code uses 'sqlite3'
2. [HIGH] Documentation mentions 'flask' but code uses 'fastapi'
3. [MEDIUM] Documentation mentions 'redis' but not found in codebase
```

## Best Practices

1. **Run regularly**: Include in CI/CD pipeline
2. **Fix high-severity first**: Contradictions in strategy/vision docs
3. **Update as you code**: When changing tech stack, update docs
4. **Review false positives**: Not all "contradictions" are real issues
5. **Use with pattern-based**: Semantic + patterns = comprehensive coverage

---

**Related Documentation:**
- [Drift Detection](docs/drift-detection.md) - Pattern-based drift
- [Vector Store](docs/vector-store.md) - Embedding infrastructure
- [Coherence Scoring](docs/coherence.md) - Overall alignment metrics
