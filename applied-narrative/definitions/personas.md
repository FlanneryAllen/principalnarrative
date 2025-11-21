---
type: definitions
subtype: personas
version: 1.0.0
created: 2024-01-15
updated: 2024-11-01
status: active
owners: [marketing@codepilot.io, product@codepilot.io]
tags: [definitions, personas, audience, users]
---

# User Personas

## Primary Personas

### Persona: Engineering Manager Emma
- **Role/Title**: Engineering Manager
- **Company Type**: Mid-size to Enterprise SaaS
- **Company Size**: 50-500 engineers
- **Demographics**:
  - Age Range: 32-45
  - Experience Level: 8-15 years in software
  - Technical Proficiency: Strong technical background, less hands-on now

#### Goals
- Primary: Ship features faster without sacrificing quality
- Secondary: Develop junior engineers, reduce senior burnout

#### Pain Points
1. Senior devs spend 6+ hours/week reviewing code instead of building
2. PR queues create sprint velocity bottlenecks
3. Inconsistent review quality - some thorough, some rubber-stamps
4. Junior developers blocked waiting for feedback, losing context
5. Difficult to measure code review effectiveness

#### Jobs to Be Done
- **When** a sprint is at risk because PRs are stuck in review, **I want to** accelerate the review process, **so I can** hit our delivery commitments
- **When** my senior engineers complain about review burden, **I want to** reduce their review load, **so I can** keep them engaged and productive
- **When** onboarding new team members, **I want to** ensure they get consistent, helpful feedback, **so I can** ramp them up quickly

#### Objections
| Objection | Response | Proof |
|-----------|----------|-------|
| "AI can't understand our codebase" | CodePilot learns your team's patterns over time | quote-003 |
| "My seniors won't trust it" | They stay in control - approve, modify, or dismiss | Pillar 2 |
| "We can't afford another tool" | ROI positive in ~2 months from time savings | roi-003 |

#### Preferred Channels
- LinkedIn, engineering blogs, peer recommendations, Slack communities

#### Messaging Focus
- Lead with: Team productivity and velocity improvements
- Emphasize: Senior developer time savings, consistent quality
- Avoid: Replacing humans, cost-cutting through headcount

---

### Persona: Senior Developer Sam
- **Role/Title**: Senior Software Engineer / Staff Engineer
- **Company Type**: Any tech company
- **Company Size**: 20-1000 engineers
- **Demographics**:
  - Age Range: 28-40
  - Experience Level: 5-12 years
  - Technical Proficiency: Expert

#### Goals
- Primary: Write impactful code, solve hard problems
- Secondary: Mentor juniors, influence architecture

#### Pain Points
1. Constant interruptions for review requests break flow state
2. Reviewing the same basic mistakes repeatedly (boring, frustrating)
3. Context switching between own work and reviews is exhausting
4. Feel like a bottleneck - team waits on them
5. Review quality suffers when overloaded

#### Jobs to Be Done
- **When** I'm deep in complex work and get pinged for review, **I want to** defer routine reviews, **so I can** maintain focus on high-value work
- **When** reviewing code from junior devs, **I want to** focus on architecture and design, **so I can** mentor effectively, not just catch typos
- **When** my code patterns get repeated questions, **I want to** document and automate that knowledge, **so I can** stop repeating myself

#### Objections
| Objection | Response | Proof |
|-----------|----------|-------|
| "AI review tools are just linters" | We analyze logic, architecture, and patterns - not just style | quote-003 |
| "I don't trust black-box AI" | Every suggestion includes reasoning you can evaluate | Pillar 2, Principle 2 |
| "It'll slow down my workflow" | 47-second reviews, async - no waiting | perf-001 |

#### Preferred Channels
- Hacker News, Reddit (r/programming), Twitter/X, GitHub, technical blogs

#### Messaging Focus
- Lead with: Getting time back for meaningful work
- Emphasize: Explainability, staying in control, pattern capture
- Avoid: Dumbing down reviews, surveillance implications

---

### Persona: Security Lead Casey
- **Role/Title**: Security Engineer / CISO / Compliance Officer
- **Company Type**: Enterprise, regulated industries
- **Company Size**: 200+ engineers
- **Demographics**:
  - Age Range: 35-50
  - Experience Level: 10+ years, security focus
  - Technical Proficiency: Strong, security-specialized

#### Goals
- Primary: Protect company from security breaches and compliance failures
- Secondary: Enable development velocity without compromising security

#### Pain Points
1. Cloud-based tools send code outside security perimeter
2. Security review coverage is inconsistent
3. Audit trails have gaps
4. Developers route around slow security processes
5. Hard to prove compliance to auditors

#### Jobs to Be Done
- **When** evaluating a new dev tool, **I want to** verify code never leaves our environment, **so I can** maintain our security posture
- **When** auditors ask about code review processes, **I want to** show complete audit trails, **so I can** demonstrate compliance
- **When** developers want to move fast, **I want to** enable secure velocity, **so I can** be a partner, not a blocker

#### Objections
| Objection | Response | Proof |
|-----------|----------|-------|
| "AI tools are security risks" | Self-hosted option - code never leaves your environment | Principle 1 |
| "What about compliance?" | SOC 2 Type II certified, complete audit logs | quote-002 |
| "How do I know code isn't stored?" | Stream-only analysis, no persistence, architecture docs available | Architecture |

#### Preferred Channels
- Security conferences, compliance vendor networks, CISO peer groups

#### Messaging Focus
- Lead with: Zero code exfiltration, self-hosted option
- Emphasize: SOC 2, audit trails, enterprise controls
- Avoid: Cloud-first messaging, moving fast and breaking things

---

## Anti-Personas

### Anti-Persona: Solo Developer Steve
- **Description**: Individual developer or very small team (1-3 people) building side projects or early-stage startups
- **Why Not a Fit**:
  - Low PR volume doesn't justify cost
  - No review bottleneck problem to solve
  - Free tools (GitHub Copilot, basic linters) meet their needs
- **How to Identify**: Team size < 5, low PR frequency, price sensitivity focus

### Anti-Persona: Non-Technical Buyer Nadia
- **Description**: Business stakeholder with no technical background trying to "improve engineering"
- **Why Not a Fit**:
  - Can't evaluate tool effectively
  - Engineering team will reject top-down tooling mandates
  - Misaligned expectations about what AI can do
- **How to Identify**: No technical role, shopping for "AI solutions", no developer buy-in

---

## Narrative Constraints
- Messaging must target defined primary personas
- Feature prioritization weighted by primary persona needs (Emma > Sam > Casey)
- Anti-persona targeting triggers strategic drift warning
- New personas require full documentation before messaging development
