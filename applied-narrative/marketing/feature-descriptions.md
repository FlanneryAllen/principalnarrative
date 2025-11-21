---
type: marketing
subtype: feature-descriptions
version: 1.0.0
created: 2024-01-15
updated: 2024-11-15
status: active
owners: [product@codepilot.io, marketing@codepilot.io]
tags: [marketing, features, capabilities]
---

# Feature Descriptions

## Feature Registry

### Instant Review
- **Internal ID**: review-engine
- **Status**: Shipped
- **Ship Date**: 2024-01-15
- **Marketing Status**: Active
- **Short Description**: AI-powered code review delivered in under 60 seconds for every pull request.
- **Long Description**: CodePilot's Instant Review analyzes your pull requests the moment they're opened, delivering comprehensive feedback in under 60 seconds (p95). Our AI examines code quality, potential bugs, security vulnerabilities, performance issues, and style consistency - all before a human reviewer even sees the PR.
- **Key Benefits**:
  1. No more waiting in review queues
  2. Catch issues before they become problems
- **Use Cases**:
  - First-pass review on all PRs
  - After-hours coverage when reviewers are unavailable
  - High-volume PR environments
- **Proof Points**: [perf-001, quote-004]
- **Screenshots/Assets**: /assets/instant-review-screenshot.png
- **Related Features**: Quick Fix, Team Rules

### Explainable AI
- **Internal ID**: explainer
- **Status**: Shipped
- **Ship Date**: 2024-03-01
- **Marketing Status**: Active
- **Short Description**: Every suggestion comes with human-readable reasoning - understand the "why", not just the "what".
- **Long Description**: Unlike black-box AI tools, CodePilot shows its work. Every suggestion includes a reasoning chain explaining why the change is recommended, what problem it solves, and relevant context from your codebase. Developers can agree, disagree, or learn - but they always understand.
- **Key Benefits**:
  1. Build trust through transparency
  2. Turn reviews into learning opportunities
- **Use Cases**:
  - Training junior developers
  - Evaluating complex suggestions
  - Understanding unfamiliar codebases
- **Proof Points**: [quote-003]
- **Screenshots/Assets**: /assets/explainable-ai-example.png
- **Related Features**: Team Learning

### Quick Fix
- **Internal ID**: autofix
- **Status**: Shipped
- **Ship Date**: 2024-04-15
- **Marketing Status**: Active
- **Short Description**: One-click fixes for common issues. Accept a suggestion and CodePilot applies the change automatically.
- **Long Description**: When CodePilot identifies an issue with a clear fix, it offers a one-click solution. Accept the suggestion and the fix is applied directly to your PR - no copy-paste, no manual editing. You stay in control: review the change in the diff before committing.
- **Key Benefits**:
  1. Fix issues without context switching
  2. Reduce friction in the review cycle
- **Use Cases**:
  - Style and formatting fixes
  - Simple bug corrections
  - Security vulnerability patches
- **Proof Points**: [perf-004 - 42% acceptance rate]
- **Related Features**: Instant Review, Team Rules

### Self-Hosted Deployment
- **Internal ID**: on-prem
- **Status**: Beta
- **Ship Date**: 2024-12-01 (planned)
- **Marketing Status**: Active (for enterprise pipeline)
- **Short Description**: Run CodePilot entirely within your infrastructure. Your code never leaves your environment.
- **Long Description**: For organizations with strict security requirements, CodePilot Self-Hosted runs entirely within your cloud or on-premises infrastructure. All code analysis happens inside your security boundary - nothing is transmitted to CodePilot servers. Full functionality, complete control.
- **Key Benefits**:
  1. Zero code exfiltration
  2. Meet compliance requirements
  3. Air-gapped environment support
- **Use Cases**:
  - Financial services
  - Healthcare / HIPAA
  - Government contractors
  - Any security-sensitive environment
- **Proof Points**: [quote-002]
- **Related Features**: Audit Logs, SSO

### Team Learning
- **Internal ID**: team-ml
- **Status**: Shipped
- **Ship Date**: 2024-06-01
- **Marketing Status**: Active
- **Short Description**: CodePilot learns your team's patterns, preferences, and best practices over time.
- **Long Description**: Every review teaches CodePilot about your team. Accepted suggestions reinforce patterns; dismissed ones adjust its understanding. Over time, CodePilot's suggestions align with your team's coding standards, architectural preferences, and domain-specific knowledge.
- **Key Benefits**:
  1. Increasingly relevant suggestions
  2. Institutional knowledge captured
  3. Consistent standards across team
- **Use Cases**:
  - Enforcing team conventions
  - Onboarding new developers
  - Preserving knowledge when team members leave
- **Proof Points**: [quote-001]
- **Related Features**: Team Rules, Insights Dashboard

### Team Rules
- **Internal ID**: custom-rules
- **Status**: Shipped
- **Ship Date**: 2024-07-15
- **Marketing Status**: Active
- **Short Description**: Define custom review rules specific to your codebase and standards.
- **Long Description**: Supplement CodePilot's AI with explicit rules for your team. Define patterns to flag, conventions to enforce, or anti-patterns to catch. Team Rules integrate with AI suggestions, giving you precise control over what CodePilot looks for.
- **Key Benefits**:
  1. Enforce team-specific standards
  2. Catch domain-specific issues
  3. Customize without code
- **Use Cases**:
  - API naming conventions
  - Security patterns
  - Deprecated API usage
- **Proof Points**: []
- **Related Features**: Team Learning

### Security Review
- **Internal ID**: sec-scan
- **Status**: Shipped
- **Ship Date**: 2024-02-15
- **Marketing Status**: Active
- **Short Description**: Automated security vulnerability detection in every code review.
- **Long Description**: CodePilot scans for common security vulnerabilities including SQL injection, XSS, authentication flaws, secrets in code, and dependency vulnerabilities. Security issues are flagged with severity levels and remediation guidance.
- **Key Benefits**:
  1. Catch vulnerabilities before merge
  2. Consistent security coverage
  3. Developer-friendly remediation
- **Use Cases**:
  - Shift-left security
  - Compliance requirements
  - Security team augmentation
- **Proof Points**: []
- **Related Features**: Self-Hosted, Audit Logs

### GitLab Integration
- **Internal ID**: gitlab-integration
- **Status**: Planned
- **Ship Date**: Q1 2025 (planned)
- **Marketing Status**: Not Active
- **Short Description**: Full CodePilot functionality for GitLab repositories.
- **Long Description**: [TBD - not yet developed]
- **Key Benefits**: [TBD]
- **Use Cases**: [TBD]
- **Proof Points**: []
- **Related Features**: []

## Coming Soon Features

| Feature | Expected Date | Safe to Mention |
|---------|---------------|-----------------|
| Self-Hosted | Dec 1, 2024 | Yes - "Coming soon" |
| GitLab Integration | Q1 2025 | No - not until Q1 |
| Bitbucket Integration | Q2 2025 | No |
| Advanced Analytics | Q2 2025 | No |

---

## Narrative Constraints
- Only "Shipped" features can have "Active" marketing status
- "Beta" features can be marketed to enterprise pipeline only
- "Planned" features must not appear in public marketing
- All feature claims must match actual implementation
- GitLab/Bitbucket: DO NOT MENTION until Q1 2025 (see priorities.md)
