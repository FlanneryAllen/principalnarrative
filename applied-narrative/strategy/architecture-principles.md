---
type: strategy
subtype: architecture-principles
version: 1.0.0
created: 2024-01-15
updated: 2024-10-01
status: active
owners: [marcus.johnson@codepilot.io, engineering@codepilot.io]
tags: [architecture, principles, technical-strategy]
---

# Architecture Principles

## Foundational Principles

### Principle 1: Code Never Leaves Customer Environment (Enterprise)
- **Statement**: For enterprise deployments, customer code must never transit through CodePilot infrastructure. All analysis happens within the customer's security boundary.
- **Rationale**: Enterprise security requirements; competitive differentiation; trust.
- **Implications**: Self-hosted runners, on-prem deployment option, edge analysis.
- **Exceptions**: Cloud-hosted tier (with explicit customer consent).

### Principle 2: Explainable AI Only
- **Statement**: Every AI suggestion must include human-readable reasoning. No black-box recommendations.
- **Rationale**: Core value (Trust Through Transparency); developer adoption; debugging.
- **Implications**: All models must output explanation chains; UI must display reasoning.
- **Exceptions**: None. This is non-negotiable.

### Principle 3: Sub-60-Second Review Time
- **Statement**: Time from PR open to first CodePilot comment must be under 60 seconds for 95th percentile.
- **Rationale**: Real-time feedback; competitive advantage; developer workflow integration.
- **Implications**: Edge caching, incremental analysis, async processing.
- **Exceptions**: Initial repository analysis (first-time setup).

### Principle 4: Graceful Degradation
- **Statement**: CodePilot must never block a merge. If analysis fails, PR proceeds with warning.
- **Rationale**: Developer trust; workflow continuity; reliability perception.
- **Implications**: Timeout handling, fallback modes, clear status communication.
- **Exceptions**: Customer-configured "required review" rules.

## Technical Philosophy
We build for developer trust. Speed matters, but reliability matters more. Every outage erodes the trust we need for adoption. We'd rather be slightly slower and always available than blazing fast but occasionally broken.

## Quality Attributes

| Attribute | Priority | Target | Current |
|-----------|----------|--------|---------|
| Availability | Critical | 99.95% | 99.92% |
| Latency (p95) | High | <60s | 47s |
| Security | Critical | SOC 2 Type II | In Progress |
| Accuracy | High | <5% false positive | 4.8% |
| Scalability | Medium | 10K concurrent PRs | 3K tested |

## Technology Choices

- **Languages**: Python (ML), Go (services), TypeScript (frontend)
- **Frameworks**: FastAPI, React, TailwindCSS
- **Infrastructure**: AWS (primary), customer cloud (enterprise)
- **Data Storage**: PostgreSQL, Redis, S3, Pinecone (vectors)
- **ML**: PyTorch, custom fine-tuned models, RAG architecture

## Anti-Patterns

1. **Synchronous ML inference in request path**: Causes timeout failures. Always async.
2. **Storing customer code in our database**: Security violation. Stream only.
3. **Silent failures**: Every error must be visible to user and logged.
4. **Feature flags without cleanup**: Max 30 days, then decide.

---

## Narrative Constraints
- Agents must not propose synchronous ML calls
- All code storage proposals trigger security review
- Performance claims must cite p95, not average
- Self-hosted architecture must be validated before enterprise claims
