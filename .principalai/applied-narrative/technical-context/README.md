# Technical Context

This directory contains technical architecture documentation and context that the Narrative Agent uses to understand the system.

## Purpose

Technical context documents provide:
- **System Architecture**: How components fit together
- **Technical Patterns**: Established conventions and approaches
- **Technology Stack**: Tools, frameworks, and libraries in use
- **Development Practices**: How the team builds and ships code
- **Infrastructure**: Hosting, deployment, and operations

## Structure

Create documents in this directory for different aspects of technical context:

```
technical-context/
├── README.md                    # This file
├── architecture-overview.md     # High-level system design
├── tech-stack.md               # Technologies in use
├── design-patterns.md          # Established patterns
├── development-workflow.md     # How we build
├── deployment.md               # How we ship
├── monitoring.md               # How we observe
└── api-design.md              # API conventions
```

## Document Template

Each technical context document should follow this format:

```markdown
---
documentType: technicalContext
category: [architecture / infrastructure / patterns / stack]
version: 1.0.0
lastUpdated: YYYY-MM-DD
author: [Name]
status: [Current / Outdated / Deprecated]
tags:
  - [technology]
  - [category]
relatedDocuments:
  - [Related files]
relatedADRs:
  - [ADR numbers]
changelog:
  - date: YYYY-MM-DD
    change: Initial creation
    author: [Name]
---

# [Document Title]

## Overview
[Brief description of what this document covers]

## Current State
[Describe the current implementation/architecture/pattern]

### Key Components
- **[Component Name]**: [Description and purpose]
- **[Component Name]**: [Description and purpose]

### Diagrams
[Include architecture diagrams, flow charts, etc.]

## Conventions & Patterns
[Established practices and patterns]

### Pattern 1: [Name]
**When to use:** [Situations]
**How to implement:** [Steps]
**Example:** [Code or reference]

## Best Practices
- [Practice with rationale]
- [Practice with rationale]

## Common Pitfalls
- [Pitfall and how to avoid]
- [Pitfall and how to avoid]

## References
- [Internal documentation]
- [External resources]
- [Related ADRs]

## Questions & Answers
Common questions developers have:

**Q: [Question]**
A: [Answer]

**Q: [Question]**
A: [Answer]

---
*Last reviewed: [Date]*
```

## Document Types

### Architecture Overview
**Purpose:** High-level system design
**Contains:**
- System components and relationships
- Data flow diagrams
- Integration points
- Scaling approach

**Example File:** `architecture-overview.md`

---

### Tech Stack
**Purpose:** Catalog of technologies
**Contains:**
- Frontend technologies
- Backend technologies
- Infrastructure tools
- Development tools
- Rationale for each choice

**Example File:** `tech-stack.md`

---

### Design Patterns
**Purpose:** Established code patterns
**Contains:**
- Common patterns in use
- When to apply each pattern
- Code examples
- Anti-patterns to avoid

**Example File:** `design-patterns.md`

---

### Development Workflow
**Purpose:** How we build software
**Contains:**
- Git workflow
- Branch strategy
- Code review process
- Testing approach
- CI/CD pipeline

**Example File:** `development-workflow.md`

---

### API Design
**Purpose:** API conventions
**Contains:**
- REST/GraphQL standards
- Naming conventions
- Error handling
- Versioning strategy
- Authentication/authorization

**Example File:** `api-design.md`

---

### Deployment
**Purpose:** How we ship code
**Contains:**
- Deployment process
- Environment setup
- Release strategy
- Rollback procedures

**Example File:** `deployment.md`

---

### Monitoring & Observability
**Purpose:** How we observe the system
**Contains:**
- Logging strategy
- Metrics and dashboards
- Alerting rules
- Debugging techniques

**Example File:** `monitoring.md`

---

## Relationship to ADRs

Technical context documents describe **current state** while ADRs explain **why decisions were made**.

- **Technical Context**: "We use PostgreSQL with this schema design"
- **ADR**: "We chose PostgreSQL over MongoDB because [rationale]"

Always link technical context documents to relevant ADRs in the `relatedADRs` frontmatter field.

## Keeping Context Current

Technical context should be treated as **living documentation**:

1. **Update when changing**: Modify docs as part of implementation
2. **Review regularly**: Schedule quarterly reviews
3. **Tag status**: Mark outdated sections clearly
4. **Version control**: Use Git history to track evolution
5. **Link to code**: Reference actual implementations

## For the Narrative Agent

The Narrative Agent uses technical context to:
- Understand system constraints when making suggestions
- Ensure new code follows established patterns
- Identify when patterns are violated
- Generate consistent code across the codebase
- Onboard new developers with accurate context

## Best Practices

1. **Be specific**: Include actual code examples, not just theory
2. **Show the "why"**: Explain rationale, not just the "what"
3. **Link liberally**: Connect to ADRs, code, and related docs
4. **Keep it current**: Outdated docs are worse than no docs
5. **Include diagrams**: Visual representations clarify complex concepts
6. **Answer real questions**: Document answers to common developer questions

## Maintenance Schedule

- **Weekly**: Update docs for significant changes
- **Monthly**: Review for accuracy and completeness
- **Quarterly**: Comprehensive review and cleanup
- **Annually**: Major revision and restructuring if needed

## Starting Your First Document

Use this checklist when creating a new technical context document:

- [ ] Choose appropriate category
- [ ] Add frontmatter with metadata
- [ ] Include overview section
- [ ] Document current state accurately
- [ ] Add diagrams or examples
- [ ] Link to related ADRs
- [ ] Reference actual code
- [ ] Add Q&A section for common questions
- [ ] Commit with descriptive message

## Examples

Common topics to document:

- Database schema and migrations
- Authentication flow
- State management approach
- Component structure
- Testing strategy
- Error handling patterns
- Performance optimization techniques
- Security practices

---

*Technical context is the institutional memory of your system. Keep it accurate, accessible, and actionable.*
