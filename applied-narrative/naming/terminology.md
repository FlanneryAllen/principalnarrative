---
type: naming
subtype: terminology
version: 1.0.0
created: 2024-01-15
updated: 2024-10-15
status: active
owners: [marketing@codepilot.io, engineering@codepilot.io]
tags: [naming, terminology, glossary]
---

# Canonical Terminology

## Product Terms

| Canonical Term | Definition | Context | Variants Allowed |
|----------------|------------|---------|------------------|
| CodePilot | The product name. Always capitalized as one word. | All contexts | None |
| Review | An AI analysis of a pull request or code change | Product, docs | "code review" (lowercase) |
| Suggestion | A specific recommendation from CodePilot | Product UI | "recommendation" in formal docs |
| Insight | A non-actionable observation about code patterns | Analytics | None |
| Pilot (noun) | A CodePilot user or team member | Internal only | Not for external use |

## Feature Names

| Feature | Canonical Name | Internal Name | Marketing Name |
|---------|----------------|---------------|----------------|
| AI review engine | Review Engine | review-engine | "Instant Review" |
| Explanation system | Reasoning Chain | explainer | "Explainable AI" |
| Team pattern learning | Team Intelligence | team-ml | "Team Learning" |
| Self-hosted deployment | Self-Hosted | on-prem | "Self-Hosted" |
| Auto-fix capability | Quick Fix | autofix | "One-Click Fix" |
| Security scanning | Security Review | sec-scan | "Security Shield" |
| Custom rules | Team Rules | custom-rules | "Team Rules" |
| Analytics dashboard | Insights Dashboard | analytics | "Team Insights" |

## Technical Terms

| Term | Definition | Usage Context |
|------|------------|---------------|
| PR | Pull Request - a code change proposed for review | All contexts, no need to expand |
| AST | Abstract Syntax Tree - code structure representation | Technical docs only |
| False Positive | A suggestion that isn't actually an issue | Metrics, accuracy discussions |
| p95 | 95th percentile - our standard latency measure | Performance claims |
| Reasoning Chain | The explanation attached to each suggestion | Product, trust discussions |

## Forbidden Terms

| Forbidden Term | Reason | Use Instead |
|----------------|--------|-------------|
| Code Pilot (two words) | Incorrect branding | CodePilot |
| CP | Ambiguous abbreviation | CodePilot |
| AI reviewer | Implies replacement of humans | "AI-assisted review" |
| Bot | Sounds impersonal/robotic | "CodePilot" or "Review Engine" |
| Autopilot | Trademark concerns | "Automated review" |
| Bugs | Too negative | "Issues" or "concerns" |
| Errors | Judgmental | "Suggestions" or "recommendations" |
| Fail/failure | Negative framing | "Identified issue" |

## Acronyms & Abbreviations

| Acronym | Expansion | When to Use |
|---------|-----------|-------------|
| PR | Pull Request | Always acceptable |
| CI/CD | Continuous Integration/Continuous Deployment | Technical contexts |
| SSO | Single Sign-On | Enterprise features |
| SOC 2 | Service Organization Control Type 2 | Security/compliance |
| API | Application Programming Interface | Technical contexts |
| SDK | Software Development Kit | Developer docs |

## Capitalization Rules

- **Product Name**: Always "CodePilot" (capital C, capital P, one word)
- **Features**: Capitalize in marketing ("Quick Fix"), lowercase in UI ("quick fix")
- **Generic Terms**: Lowercase ("code review", "pull request")
- **Category**: Capitalize our category ("Intelligent Code Collaboration")

---

## Narrative Constraints
- "CodePilot" is never written as "Code Pilot" or "Codepilot"
- Forbidden terms trigger naming drift warning
- New feature names require addition to this document
- External communications use Marketing Names, not Internal Names
