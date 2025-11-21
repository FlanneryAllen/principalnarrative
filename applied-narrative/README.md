# Applied Narrative Intelligence Layer

This directory contains the **Applied Narrative Intelligence Layer** - a structured, version-controlled narrative system that stores strategy, messaging, naming, product marketing, statistical proof, customer evidence, story logic, and architectural reasoning.

Each component is represented as machine-readable **narrative units**, enabling autonomous agents to align behavior with human intent, product truth, and messaging accuracy.

## Directory Structure

```
applied-narrative/
├── strategy/                    # Strategic intent & architecture
│   ├── vision.md               # Vision, mission, values
│   ├── priorities.md           # OKRs, roadmap themes
│   └── architecture-principles.md
│
├── messaging/                   # External communication framework
│   ├── pillars.md              # Core messaging pillars
│   ├── voice.md                # Brand voice & tone
│   └── value-propositions.md   # Persona-specific value props
│
├── naming/                      # Terminology & conventions
│   ├── terminology.md          # Canonical terms, forbidden words
│   ├── api-naming.md           # Code naming conventions
│   └── ui-patterns.md          # UI/UX text patterns
│
├── marketing/                   # Product marketing content
│   ├── product-copy.md         # Website, landing page copy
│   ├── feature-descriptions.md # Feature registry
│   ├── release-notes.md        # Changelog template
│   └── competitive.md          # Competitive positioning
│
├── proof/                       # Statistics & Proof Library
│   ├── README.md               # Proof library guide
│   ├── metrics/                # Performance benchmarks
│   ├── adoption-stats/         # User/customer metrics
│   ├── roi-stats/              # ROI calculations
│   ├── customer-quotes/        # Approved testimonials
│   └── case-studies/           # Customer success stories
│
├── story/                       # Explanatory & narrative content
│   ├── explanatory-models.md   # Metaphors, analogies
│   └── product-narrative.md    # Origin story, hero's journey
│
├── constraints/                 # Hard & soft rules
│   ├── architectural.md        # Technical constraints
│   └── business.md             # Legal, compliance, brand rules
│
├── definitions/                 # Canonical definitions
│   ├── glossary.md             # Term definitions
│   └── personas.md             # User personas
│
├── coherence/                   # Alignment tracking
│   ├── current.json            # Current coherence state
│   └── history.json            # Historical scores & drift
│
└── .meta/                       # Schema & index
    ├── schema.json             # JSON Schema for validation
    └── index.json              # Master index of all units
```

## Drift Detection

The Principal Narrative monitors for seven types of drift:

| Drift Type | Description |
|------------|-------------|
| **Semantic** | Documentation contradicts code or changes |
| **Strategic** | Implementations violate strategic intent |
| **Messaging** | Generated text contradicts messaging pillars |
| **Naming** | Terminology diverges from canonical system |
| **Proof** | Claims diverge from verified statistics |
| **Promise-Delivery** | Marketing claims features that don't exist |
| **Opportunity-Silence** | Capabilities exist but aren't communicated |

## Coherence Scoring

Alignment is measured on a 0-1 scale across dimensions:

- **Semantic alignment** (code ↔ docs)
- **Strategic alignment** (features ↔ roadmap)
- **Messaging alignment** (copy ↔ pillars)
- **Naming alignment** (terms ↔ conventions)
- **Proof alignment** (claims ↔ evidence)

**Thresholds:**
- `> 0.7`: Healthy
- `0.5 - 0.7`: Warning - review recommended
- `< 0.5`: Critical - immediate attention required

## Shared Context API

Autonomous agents access narrative context through:

```
GET  /context/query     # Retrieve narrative units
POST /context/validate  # Validate proposed actions
POST /context/update    # Update narrative truth
```

### Example: Agent Validation

```python
# Before generating marketing copy
response = narrative_api.validate({
    "type": "marketing_claim",
    "claim": "2x faster than competitors",
    "requires_proof": True
})

if response.valid:
    # Proceed with claim
else:
    # Use suggested alternative or request proof
```

## Narrative Unit Format

All markdown files use YAML frontmatter:

```yaml
---
type: messaging
subtype: pillars
version: 1.0.0
created: 2024-01-01
updated: 2024-01-01
status: draft | active | deprecated | archived
owners: []
tags: []
---
```

## Getting Started

1. **Populate templates**: Fill in organizational context in each layer
2. **Start with strategy**: Vision and priorities inform everything else
3. **Add proof**: Validate claims with metrics and evidence
4. **Enable drift detection**: Run coherence checks regularly
5. **Connect agents**: Point autonomous agents to the Shared Context API

## Maintenance

| Layer | Review Frequency | Owner |
|-------|------------------|-------|
| Strategy | Quarterly | Leadership |
| Messaging | Quarterly | Marketing |
| Naming | As needed | Engineering |
| Marketing | Monthly | PMM |
| Proof | Monthly | Analytics |
| Story | Annually | Marketing |
| Constraints | As needed | Legal/Eng |
| Definitions | As needed | All |

---

*The Applied Narrative ensures all agents - human and AI - operate from a single source of truth.*
