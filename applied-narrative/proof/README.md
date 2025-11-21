---
type: proof
subtype: index
version: 1.0.0
created: 2024-01-01
updated: 2024-01-01
---

# Statistics & Proof Library

This directory contains validated evidence used to support marketing claims, documentation assertions, and agent-generated content. The Narrative Agent uses this library to:

1. **Validate claims** - Check that assertions have supporting evidence
2. **Detect proof drift** - Flag when claims diverge from available proof
3. **Identify opportunities** - Surface when strong proof exists but isn't communicated
4. **Prevent hallucination** - Ensure agents don't generate unsupported statistics

## Directory Structure

```
proof/
├── metrics/
│   └── performance.json     # Latency, throughput, benchmarks
├── performance/             # Detailed performance reports
├── customer-quotes/
│   └── quotes.md           # Approved testimonials
├── case-studies/
│   └── template.md         # Case study template
├── adoption-stats/
│   └── adoption.json       # User/customer counts
├── roi-stats/
│   └── roi.json           # ROI calculations
└── README.md              # This file
```

## Proof Categories

| Category | Location | Description |
|----------|----------|-------------|
| Performance Metrics | `metrics/performance.json` | Latency, throughput, benchmarks |
| Adoption Statistics | `adoption-stats/adoption.json` | User counts, growth rates |
| ROI Data | `roi-stats/roi.json` | Cost savings, time savings, value |
| Customer Quotes | `customer-quotes/quotes.md` | Approved testimonials |
| Case Studies | `case-studies/` | Full customer stories |

## Validation Status

Each proof item has a verification status:

- **Verified**: Confirmed accurate, safe for external use
- **Pending**: Awaiting verification, internal use only
- **Expired**: Needs re-verification
- **Retracted**: No longer accurate, do not use

## Usage by Agents

Agents querying the Shared Context API can:

```
/context/query?type=proof&category=performance
/context/validate?claim="2x faster"&proof_required=true
```

## Drift Types

The proof layer enables detection of:

1. **Proof Drift**: Claims exceed available evidence
2. **Underclaim (Opportunity-Silence)**: Strong proof not reflected in messaging
3. **Stale Proof**: Evidence outdated, claims may be inaccurate

## Maintenance

- Performance metrics: Re-verify quarterly
- Adoption stats: Update monthly
- Customer quotes: Check approval status annually
- Case studies: Review relevance annually

---

*All claims require proof. All proof requires verification.*
