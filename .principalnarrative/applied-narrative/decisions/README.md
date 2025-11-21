# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records documenting significant decisions made throughout the project lifecycle.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences. ADRs help teams:

- Understand why decisions were made
- Avoid relitigating past decisions
- Onboard new team members faster
- Track the evolution of the system
- Learn from both good and bad decisions

## When to Write an ADR

Create an ADR when you make a decision that:

- **Affects system structure**: Component organization, data flow, system boundaries
- **Has long-term implications**: Hard to reverse, impacts future development
- **Involves tradeoffs**: Multiple valid options with pros/cons
- **Is contentious**: Team has different opinions or needs alignment
- **Establishes patterns**: Sets precedent for future similar decisions
- **Significant cost**: Time, money, or technical debt implications

## ADR Format

Each ADR should be a separate markdown file following this naming convention:
```
YYYYMMDD-short-descriptive-title.md
```

Example: `20251121-use-postgresql-for-primary-database.md`

### ADR Template

```markdown
---
documentType: adr
adrNumber: [Sequential number]
title: [Decision title]
date: YYYY-MM-DD
status: [Proposed / Accepted / Deprecated / Superseded]
deciders: [Names of decision makers]
tags:
  - [category]
  - [technology]
supersededBy: [ADR number if superseded]
relatedTo:
  - [Related ADR numbers]
changelog:
  - date: YYYY-MM-DD
    change: Initial creation
    author: [Name]
---

# [ADR Number]: [Decision Title]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

**Date:** YYYY-MM-DD
**Deciders:** [List people involved in decision]

## Context

What is the issue we're facing that motivates this decision?

- What is the background?
- What factors are we considering?
- What are the requirements?
- What constraints exist?

## Decision

What is the change we're proposing/making?

Be specific and concrete. State the decision clearly.

## Rationale

Why did we choose this option?

- What are the main arguments for this decision?
- What alternatives did we consider?
- What were the key factors that led to this choice?

## Alternatives Considered

### Alternative 1: [Name]
**Description:** [What it is]
**Pros:**
- [Advantage]
- [Advantage]

**Cons:**
- [Disadvantage]
- [Disadvantage]

**Why not chosen:** [Reason]

### Alternative 2: [Name]
**Description:** [What it is]
**Pros:**
- [Advantage]

**Cons:**
- [Disadvantage]

**Why not chosen:** [Reason]

## Consequences

What becomes easier or harder as a result of this decision?

### Positive Consequences
- [Benefit]
- [Benefit]

### Negative Consequences
- [Cost or tradeoff]
- [Cost or tradeoff]

### Risks
- [Risk and mitigation]
- [Risk and mitigation]

## Implementation Notes

- [Specific technical details]
- [Migration path if applicable]
- [Timeline or phases]

## References

- [Link to research]
- [Link to related documentation]
- [Link to prototypes or examples]

## Follow-up

- [ ] [Action item with owner]
- [ ] [Action item with owner]

## Review Date

[When should we revisit this decision?]
```

## ADR Lifecycle

### Proposed
- Decision is being considered
- Gathering feedback and input
- Not yet implemented

### Accepted
- Decision has been approved
- Implementation may be in progress or complete
- This is the current state

### Deprecated
- Decision is no longer relevant
- Context has changed significantly
- Not replaced by a specific alternative

### Superseded
- Replaced by a newer decision
- Link to the ADR that supersedes this one
- Keep for historical context

## Best Practices

1. **Write ADRs early**: Document decisions when they're made, not retrospectively
2. **Be concise**: Focus on the essential information
3. **Include context**: Future readers won't have your current context
4. **List alternatives**: Show what was considered and why it was rejected
5. **Update status**: Change status when decisions evolve
6. **Link related ADRs**: Create a web of connected decisions
7. **Use consistent numbering**: Sequential numbers in filename and frontmatter
8. **Tag appropriately**: Makes searching and filtering easier

## Categories

Common ADR categories (use as tags):

- **Architecture**: System design, patterns, structure
- **Data**: Database, schemas, data flow
- **Infrastructure**: Hosting, deployment, DevOps
- **Security**: Authentication, authorization, compliance
- **Performance**: Optimization, scaling, caching
- **UI/UX**: Interface design, user experience
- **Process**: Development workflow, testing strategy
- **Integration**: Third-party services, APIs

## Searching ADRs

Use tags and grep to find related decisions:

```bash
# Find all database-related decisions
grep -r "tags:" . | grep "database"

# Find decisions by a specific person
grep -r "deciders:" . | grep "JohnDoe"

# Find accepted decisions
grep -r "status: Accepted" .
```

## Examples

See example ADRs in this directory:
- [Add examples as they're created]

## Tools

The Principal Narrative can:
- Create new ADRs from discussions
- Update ADR status
- Find related decisions
- Generate decision summaries
- Flag when decisions need review

---

*For more on ADRs, see: https://adr.github.io/*
