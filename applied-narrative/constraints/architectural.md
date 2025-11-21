---
type: constraints
subtype: architectural
version: 1.0.0
created: 2024-01-01
updated: 2024-01-01
status: draft
owners: []
tags: [constraints, architecture, technical, rules]
---

# Architectural Constraints

## Hard Constraints
<!-- These cannot be violated under any circumstances -->

### Constraint: [Name]
- **Rule**:
- **Rationale**:
- **Enforcement**: How this is checked
- **Violation Response**: Block | Warn | Log

### Constraint: [Name]
- **Rule**:
- **Rationale**:
- **Enforcement**:
- **Violation Response**:

## Soft Constraints
<!-- These should be followed but can be overridden with justification -->

### Constraint: [Name]
- **Guideline**:
- **Rationale**:
- **Override Process**: How to request exception

## Technology Constraints

| Category | Allowed | Forbidden | Rationale |
|----------|---------|-----------|-----------|
| Languages | | | |
| Frameworks | | | |
| Databases | | | |
| Cloud Services | | | |

## Security Constraints

1. **[Constraint]**: Description
2. **[Constraint]**: Description

## Performance Constraints

| Metric | Target | Hard Limit |
|--------|--------|------------|
| Response Time | | |
| Memory Usage | | |
| CPU Usage | | |

## Dependency Constraints

- **Approved Dependencies**:
- **Forbidden Dependencies**:
- **Review Required**:

---

## Narrative Constraints (Meta)
<!-- How agents interact with constraints -->

- Agents must validate proposals against all hard constraints
- Soft constraint violations require documented justification
- New constraints require this document update
- Constraint violations trigger strategic drift warning
