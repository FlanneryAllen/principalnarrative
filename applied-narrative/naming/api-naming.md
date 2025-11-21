---
type: naming
subtype: api-naming
version: 1.0.0
created: 2024-01-01
updated: 2024-01-01
status: draft
owners: []
tags: [naming, api, conventions, code]
---

# API & Code Naming Conventions

## General Principles

1. **Consistency**: [Description]
2. **Clarity**: [Description]
3. **Brevity**: [Description]

## Endpoint Naming

### REST API Patterns

| Pattern | Example | Usage |
|---------|---------|-------|
| Resource collection | `/users` | List/create |
| Resource instance | `/users/{id}` | Get/update/delete |
| Nested resource | `/users/{id}/orders` | Related resources |
| Action | `/users/{id}/activate` | Non-CRUD operations |

### Naming Rules
- Use lowercase with hyphens: `kebab-case`
- Use plural nouns for collections
- Use verbs only for actions
- Version prefix: `/v1/`

## Variable & Function Naming

| Language | Convention | Example |
|----------|------------|---------|
| Python | snake_case | `user_name` |
| JavaScript | camelCase | `userName` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES` |
| Classes | PascalCase | `UserService` |

## Component Naming (UI)

| Type | Pattern | Example |
|------|---------|---------|
| Page | `[Name]Page` | `DashboardPage` |
| Component | `[Name]` | `UserCard` |
| Hook | `use[Name]` | `useAuth` |
| Context | `[Name]Context` | `ThemeContext` |

## Database Naming

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `user_accounts` |
| Columns | snake_case | `created_at` |
| Indexes | `idx_[table]_[columns]` | `idx_users_email` |

---

## Narrative Constraints
<!-- Code generation must follow these patterns -->

- API endpoints must follow REST patterns
- Variable names must match language convention
- Component names must follow UI patterns
- Violations trigger naming drift warning
