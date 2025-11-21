---
documentType: specification
title: Principal Narrative System Specification
version: 1.0.0
lastUpdated: 2025-11-21
author: Principal AI Team
status: draft
tags:
  - principalnarrative
  - specification
  - architecture
  - ai-agents
relatedDocuments:
  - ../applied-narrative/README.md
  - ../applied-narrative/vision.md
changelog:
  - date: 2025-11-21
    change: Initial specification
    author: Principal AI Team
---

# Principal Narrative System Specification

## Executive Summary

The Principal Narrative is an AI system that maintains organizational context by capturing, structuring, and evolving institutional knowledge from unstructured sources. Unlike coding agents that generate code, the Principal Narrative preserves the "why" behind decisions, ensuring all AI agents operate with consistent understanding of company vision, priorities, and technical context.

**Core Value Proposition:**
- Transforms scattered tribal knowledge into structured, version-controlled context
- Enables autonomous agents to make decisions aligned with organizational intent
- Detects and prevents semantic drift across teams and systems
- Coordinates multiple agents around a shared understanding

---

## 1. System Overview

### 1.1 What is a Principal Narrative?

The Principal Narrative is a **context preservation and coordination system** that:

1. **Captures** organizational knowledge from unstructured sources (Slack, meetings, docs)
2. **Structures** that knowledge into the Applied Narrative format
3. **Maintains** context through Git-versioned markdown documents
4. **Coordinates** other AI agents by providing canonical organizational context
5. **Detects** when reality drifts from documented intent

**Analogy:** If coding agents are the hands building the product, the Principal Narrative is the institutional memory ensuring those hands know what they're building and why.

### 1.2 Core Responsibilities

| Responsibility | Description | Example |
|---------------|-------------|---------|
| **Context Capture** | Extract structured context from unstructured sources | Slack thread about feature decision → ADR |
| **Coherence Maintenance** | Ensure consistency across organizational narratives | Detect when priorities conflict with vision |
| **Agent Coordination** | Provide canonical context to other agents | Coding agent queries brand voice before naming |
| **Drift Detection** | Identify when reality diverges from intent | Marketing copy doesn't match documented voice |
| **Evolution Tracking** | Record how organizational context changes | Track how vision evolves quarter over quarter |

### 1.3 How It Differs from Coding Agents

| Dimension | Coding Agent | Principal Narrative |
|-----------|--------------|-----------------|
| **Primary Output** | Source code | Structured context (markdown) |
| **Focus** | "What" and "how" | "Why" and "for whom" |
| **Validation** | Tests pass, code runs | Context coherence, semantic consistency |
| **Update Frequency** | Continuous (per feature) | Episodic (per decision/insight) |
| **Scope** | Single codebase | Entire organization |
| **Memory** | Code comments, docs | Applied Narrative knowledge base |

**Key Insight:** The Principal Narrative doesn't compete with coding agents—it *enables* them by providing the organizational context they need to make aligned decisions.

---

## 2. Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     INPUT SOURCES                            │
├─────────────────────────────────────────────────────────────┤
│  Slack  │  GitHub  │  Manual  │  Meetings  │  Documents    │
└────┬────────┬──────────┬──────────┬──────────┬──────────────┘
     │        │          │          │          │
     └────────┴──────────┴──────────┴──────────┘
                         │
                    ┌────▼─────┐
                    │  INTAKE  │
                    │  ROUTER  │
                    └────┬─────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐    ┌─────▼──────┐   ┌────▼─────┐
   │  NLP    │    │ CLASSIFIER │   │ EXTRACTOR│
   │ PARSER  │    │            │   │          │
   └────┬────┘    └─────┬──────┘   └────┬─────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                  ┌──────▼────────┐
                  │  CLAUDE API   │
                  │  (Intelligence)│
                  └──────┬────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼─────┐   ┌─────▼──────┐   ┌────▼──────┐
   │ COHERENCE│   │  CONTEXT   │   │ EMBEDDING │
   │ VALIDATOR│   │ SYNTHESIZER│   │ GENERATOR │
   └────┬─────┘   └─────┬──────┘   └────┬──────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                  ┌──────▼────────┐
                  │  GIT MANAGER  │
                  └──────┬────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼─────┐   ┌─────▼──────┐   ┌────▼──────┐
   │ APPLIED  │   │  VECTOR    │   │   CACHE   │
   │NARRATIVE │   │    DB      │   │           │
   │  (.md)   │   │ (ChromaDB) │   │  (Redis)  │
   └────┬─────┘   └─────┬──────┘   └────┬──────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                  ┌──────▼────────┐
                  │  QUERY API    │
                  └──────┬────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼─────┐   ┌─────▼──────┐   ┌────▼──────┐
   │  CODING  │   │  COMMS     │   │  PLANNING │
   │  AGENTS  │   │  AGENTS    │   │  AGENTS   │
   └──────────┘   └────────────┘   └───────────┘
```

### 2.2 Component Descriptions

#### Input Layer

**Intake Router**
- Monitors configured input sources
- Identifies candidate context (decision discussions, vision statements, etc.)
- Routes to appropriate processing pipeline
- Implements rate limiting and deduplication

**Input Sources:**
- **Slack Integration**: Monitors channels for decision threads, strategy discussions
- **GitHub Integration**: Tracks PR discussions, issue comments, code review conversations
- **Manual Input**: CLI/API for direct context submission
- **Meeting Transcripts**: Processes recordings from strategic meetings
- **Documents**: Ingests existing docs, wikis, notion pages

#### Processing Layer

**NLP Parser**
- Tokenizes and structures natural language input
- Identifies entities (people, projects, technologies)
- Extracts temporal information (dates, timelines)
- Performs sentiment analysis on discussions

**Classifier**
- Determines document type (vision, priority, ADR, technical context, etc.)
- Identifies relationships to existing documents
- Assigns tags and categories
- Determines urgency/importance

**Extractor**
- Pulls structured information from unstructured text
- Identifies decisions, rationales, alternatives considered
- Extracts key quotes and attributions
- Finds metrics and success criteria

**Claude API (Intelligence)**
- Core reasoning engine for the Principal Narrative
- Synthesizes information across multiple sources
- Generates structured documents from conversations
- Validates coherence and consistency
- Answers queries about organizational context
- Detects semantic drift

**Coherence Validator**
- Checks new context against existing Applied Narrative
- Identifies conflicts (e.g., priority that contradicts vision)
- Scores semantic consistency
- Flags potential drift before committing

**Context Synthesizer**
- Combines multiple sources into cohesive narratives
- Generates draft ADRs from decision discussions
- Updates existing documents with new information
- Maintains changelog and version history

**Embedding Generator**
- Creates vector embeddings of all context documents
- Enables semantic search across organizational knowledge
- Powers similarity detection for drift analysis
- Supports contextual agent queries

#### Storage Layer

**Git Manager**
- Commits context changes to `.principalnarrative/applied-narrative/`
- Manages branches, merges, conflicts
- Generates meaningful commit messages
- Tags significant context updates
- Creates PRs for major changes requiring review

**Applied Narrative Storage**
- Primary source of truth: Markdown files in Git
- Human-readable and editable
- Full version history via Git
- Schema validation via frontmatter

**Vector Database (ChromaDB)**
- Stores embeddings of all documents
- Enables fast semantic search
- Powers similarity queries
- Supports multi-dimensional context queries

**Cache (Redis)**
- Caches frequently accessed context
- Stores recent query results
- Maintains session state for conversations
- Improves response time for agent queries

#### Query Layer

**Query API**
- RESTful and gRPC interfaces for context access
- Supports semantic search, tag filtering, relationship traversal
- Provides coherence scoring for new content
- Offers context validation endpoints
- Real-time subscription to context updates

### 2.3 Integration Points

#### With Coding Agents
```python
# Coding agent checks brand voice before naming
context = principal_narrative.query(
    doc_type="brandVoice",
    topic="naming_conventions"
)
# Returns: preferred terminology, avoid words, examples
```

#### With Planning Agents
```python
# Planning agent validates feature against priorities
coherence_score = principal_narrative.validate_coherence(
    proposed_feature="Real-time collaboration",
    against=["priorities", "customerPainPoints"]
)
# Returns: alignment score, conflicts, supporting context
```

#### With Communication Agents
```python
# Comms agent gets brand voice for email
voice_guide = principal_narrative.get_context(
    document="brandVoice",
    section="email_tone"
)
# Returns: tone attributes, examples, do's and don'ts
```

---

## 3. Core Functions

### 3.1 Context Capture from Unstructured Sources

**Function:** `capture_context(source, content, metadata)`

**Process:**
1. **Ingestion**: Receive raw input (Slack thread, meeting transcript, etc.)
2. **Analysis**: Use Claude to identify:
   - Decision points
   - Rationales and tradeoffs
   - Key stakeholders
   - Related context
3. **Classification**: Determine document type and structure
4. **Extraction**: Pull out structured elements
5. **Synthesis**: Generate draft markdown with frontmatter
6. **Review**: Present to human for approval/editing
7. **Commit**: Store in Applied Narrative with Git

**Example Input:**
```
Slack Thread:
Alice: "Should we use PostgreSQL or MongoDB for user profiles?"
Bob: "Postgres. We need strong consistency for billing."
Charlie: "Agreed. Plus our team knows SQL better."
Alice: "Decision made. I'll update the tech stack."
```

**Example Output:**
```markdown
---
documentType: adr
adrNumber: 12
title: Use PostgreSQL for User Profile Storage
date: 2025-11-21
status: accepted
deciders: [Alice, Bob, Charlie]
---

# ADR 12: Use PostgreSQL for User Profile Storage

## Context
Need to choose database for user profile storage...

## Decision
Use PostgreSQL...

## Rationale
- Strong consistency required for billing integration
- Team expertise in SQL
- [etc.]
```

**Technologies:**
- Claude API for intelligence
- GitPython for version control
- sentence-transformers for embeddings

### 3.2 Semantic Drift Detection

**Function:** `detect_drift(new_content, threshold=0.7)`

**What is Semantic Drift?**
When actual behavior, communication, or decisions diverge from documented organizational context. Examples:
- Marketing copy uses tone that conflicts with brand voice guidelines
- New feature doesn't align with documented priorities
- Technical decision violates architectural principles

**Detection Process:**
1. **Embedding Comparison**: Generate embeddings for new content and related context
2. **Similarity Scoring**: Calculate cosine similarity
3. **Threshold Check**: Flag if similarity falls below threshold
4. **Conflict Analysis**: Identify specific points of divergence
5. **Root Cause**: Determine if drift is intentional evolution or unintended inconsistency
6. **Notification**: Alert relevant stakeholders

**Implementation:**
```python
class DriftDetector:
    def detect(self, new_content: str, context_type: str) -> DriftReport:
        # Get relevant context documents
        context_docs = self.get_context(context_type)

        # Generate embeddings
        new_embedding = self.embed(new_content)
        context_embeddings = [self.embed(doc) for doc in context_docs]

        # Calculate similarity
        similarities = [
            cosine_similarity(new_embedding, ctx_emb)
            for ctx_emb in context_embeddings
        ]

        # Detect drift
        if min(similarities) < self.threshold:
            return DriftReport(
                detected=True,
                severity=self._calculate_severity(similarities),
                conflicts=self._identify_conflicts(new_content, context_docs),
                recommendation=self._suggest_resolution()
            )

        return DriftReport(detected=False)
```

**Output:**
```json
{
  "drift_detected": true,
  "severity": "medium",
  "type": "brand_voice_violation",
  "conflicts": [
    {
      "new_content": "Revolutionary AI that disrupts everything",
      "conflicts_with": "brand-voice.md#tone",
      "context": "Brand voice guideline: 'Confident without arrogance'",
      "similarity_score": 0.45
    }
  ],
  "recommendation": "Revise to align with documented brand voice",
  "suggest_context_update": false
}
```

### 3.3 Agent Coordination

**Function:** `coordinate_agents(task, required_context)`

**Purpose:** Ensure multiple agents work from the same organizational understanding.

**Coordination Scenarios:**

#### Scenario 1: Feature Development
```
Task: Build new analytics dashboard

Principal Narrative coordinates:
1. Planning Agent: Validates against priorities
2. Coding Agent: Provides technical context and patterns
3. Design Agent: Supplies brand voice and UX principles
4. QA Agent: Shares customer pain points for testing focus
```

**Implementation:**
```python
class AgentCoordinator:
    def coordinate_feature_development(self, feature_spec):
        # Gather relevant context
        context_bundle = {
            'priorities': self.principal_narrative.get('priorities'),
            'technical_context': self.principal_narrative.get('technical-context/architecture'),
            'brand_voice': self.principal_narrative.get('brand-voice'),
            'customer_pain_points': self.principal_narrative.get('customer-pain-points')
        }

        # Validate alignment
        alignment = self.principal_narrative.validate_coherence(
            feature_spec,
            against=['priorities', 'customerPainPoints']
        )

        if alignment.score < 0.8:
            return CoordinationResult(
                approved=False,
                reason=alignment.conflicts,
                suggested_changes=alignment.recommendations
            )

        # Distribute context to agents
        self.planning_agent.set_context(context_bundle)
        self.coding_agent.set_context(context_bundle)
        self.design_agent.set_context(context_bundle)

        return CoordinationResult(approved=True, context=context_bundle)
```

#### Scenario 2: Architecture Decision
```
Task: Choose message queue technology

Principal Narrative coordinates:
1. Retrieves existing technical context
2. Identifies related past decisions (ADRs)
3. Provides to architecture agent
4. Validates proposed decision against priorities
5. Generates ADR from discussion
6. Updates technical context
```

### 3.4 Coherence Scoring

**Function:** `score_coherence(content, context_documents)`

**What is Coherence?**
The degree to which new content aligns with existing organizational narrative. High coherence means decisions, communication, and code all point in the same direction.

**Scoring Dimensions:**

| Dimension | Weight | Description | Example |
|-----------|--------|-------------|---------|
| **Semantic Alignment** | 40% | Meaning consistency with context | Feature aligns with customer pain points |
| **Strategic Alignment** | 30% | Fits priorities and vision | Feature supports Q4 goals |
| **Tone Consistency** | 15% | Matches brand voice | Language follows communication guidelines |
| **Technical Consistency** | 15% | Follows established patterns | Architecture aligns with ADRs |

**Scoring Algorithm:**
```python
class CoherenceScorer:
    def score(self, content: str, context_refs: List[str]) -> CoherenceScore:
        scores = {}

        # Semantic alignment (embedding similarity)
        scores['semantic'] = self._semantic_similarity(content, context_refs)

        # Strategic alignment (keyword/concept matching)
        scores['strategic'] = self._strategic_alignment(content, 'priorities')

        # Tone consistency (style analysis)
        scores['tone'] = self._tone_consistency(content, 'brand-voice')

        # Technical consistency (pattern matching)
        scores['technical'] = self._technical_alignment(content, 'technical-context')

        # Weighted average
        total_score = (
            scores['semantic'] * 0.40 +
            scores['strategic'] * 0.30 +
            scores['tone'] * 0.15 +
            scores['technical'] * 0.15
        )

        return CoherenceScore(
            overall=total_score,
            dimensions=scores,
            threshold_met=total_score >= 0.75,
            issues=self._identify_issues(scores),
            recommendations=self._generate_recommendations(scores)
        )
```

**Output:**
```json
{
  "overall_score": 0.82,
  "threshold_met": true,
  "dimensions": {
    "semantic": 0.88,
    "strategic": 0.79,
    "tone": 0.85,
    "technical": 0.75
  },
  "issues": [
    {
      "dimension": "technical",
      "severity": "low",
      "description": "Proposes new pattern not documented in technical-context",
      "recommendation": "Create ADR for new pattern or align with existing"
    }
  ],
  "approval": "approved_with_notes"
}
```

---

## 4. Data Flow

### 4.1 Context Capture Flow

```
1. INPUT
   ↓
   Slack thread: "Let's build real-time collaboration"
   ↓
2. INTAKE ROUTER
   ↓
   Identifies: Feature discussion
   Tags: #feature #realtime #collaboration
   ↓
3. CLASSIFIER
   ↓
   Type: Priority candidate
   Related: customer-pain-points.md, priorities.md
   ↓
4. CLAUDE ANALYSIS
   ↓
   - Extracts rationale
   - Identifies stakeholders
   - Determines priority level
   - Checks alignment with vision
   ↓
5. COHERENCE CHECK
   ↓
   Score: 0.85 (aligned with vision & customer pain points)
   ↓
6. SYNTHESIZER
   ↓
   Generates draft priority update:
   ---
   documentType: priorities
   ...
   Priority 4: Real-time Collaboration
   - Rationale: Addresses top customer pain point
   - Owner: Alice
   - Timeline: Q1 2026
   ↓
7. HUMAN REVIEW
   ↓
   Alice approves with minor edits
   ↓
8. GIT COMMIT
   ↓
   Commits to .principalnarrative/applied-narrative/priorities.md
   Message: "Add real-time collaboration as Q1 2026 priority"
   ↓
9. EMBEDDING UPDATE
   ↓
   Generates new embeddings for updated priorities
   Stores in ChromaDB
   ↓
10. CACHE INVALIDATION
    ↓
    Clears cached queries related to priorities
    ↓
11. NOTIFICATION
    ↓
    Alerts dependent agents: "Priorities updated"
```

### 4.2 Agent Query Flow

```
1. AGENT REQUEST
   ↓
   Coding Agent: "What's our brand voice for error messages?"
   ↓
2. QUERY API
   ↓
   POST /query
   {
     "document": "brandVoice",
     "section": "error_messages",
     "format": "guidelines"
   }
   ↓
3. CACHE CHECK
   ↓
   Check Redis for cached result
   ↓
4. [Cache Miss] DOCUMENT RETRIEVAL
   ↓
   Read .principalnarrative/applied-narrative/brand-voice.md
   Parse frontmatter and content
   ↓
5. SECTION EXTRACTION
   ↓
   Extract relevant section on error messages
   ↓
6. RESPONSE FORMATTING
   ↓
   {
     "tone": "Empathetic, solution-oriented",
     "examples": [...],
     "avoid": ["Jargon", "Blame"],
     "template": "We encountered [issue]. [Solution]."
   }
   ↓
7. CACHE UPDATE
   ↓
   Store result in Redis (TTL: 1 hour)
   ↓
8. RETURN TO AGENT
   ↓
   Coding agent uses guidelines to generate error message
```

### 4.3 Drift Detection Flow

```
1. TRIGGER
   ↓
   Marketing agent drafts homepage copy
   ↓
2. PRE-COMMIT VALIDATION
   ↓
   Before finalizing, check coherence
   ↓
3. EMBEDDING GENERATION
   ↓
   Generate embedding for new copy
   ↓
4. SIMILARITY SEARCH
   ↓
   Query ChromaDB for similar content in brand-voice.md
   ↓
5. COMPARISON
   ↓
   Compare embeddings
   Similarity: 0.62 (below 0.75 threshold)
   ↓
6. CONFLICT ANALYSIS
   ↓
   Claude analyzes specific conflicts:
   - "Revolutionary AI" → conflicts with "avoid hype"
   - Exclamation points → conflicts with "use sparingly"
   ↓
7. DRIFT REPORT
   ↓
   {
     "drift_detected": true,
     "conflicts": [...],
     "recommendations": [...]
   }
   ↓
8. HUMAN NOTIFICATION
   ↓
   "Draft copy conflicts with brand voice guidelines"
   ↓
9. RESOLUTION
   ↓
   Options:
   a) Revise copy to align with guidelines
   b) Update brand voice (intentional evolution)
   c) Override (with justification)
   ↓
10. OUTCOME
    ↓
    If (a): Re-validate until coherent
    If (b): Update brand-voice.md, commit to Git
    If (c): Log exception in metadata
```

### 4.4 Storage Locations

```
PRIMARY STORAGE (Source of Truth)
├── .principalnarrative/applied-narrative/
│   ├── vision.md                    # Vision, mission, values
│   ├── priorities.md                # Current priorities & OKRs
│   ├── brand-voice.md              # Communication guidelines
│   ├── customer-pain-points.md     # Customer context
│   ├── decisions/
│   │   └── *.md                    # Architecture Decision Records
│   └── technical-context/
│       └── *.md                    # Technical documentation

VECTOR STORAGE (Semantic Search)
├── ChromaDB
│   ├── collections/
│   │   ├── vision_embeddings
│   │   ├── priority_embeddings
│   │   ├── adr_embeddings
│   │   └── technical_embeddings
│   └── metadata/
│       └── document_index

CACHE (Performance)
├── Redis
│   ├── query_results/          # Cached query responses
│   ├── embeddings/             # Recently used embeddings
│   └── sessions/               # Active conversation state

LOGS & ANALYTICS
├── .principalnarrative/logs/
│   ├── captures.log            # Context capture events
│   ├── queries.log             # Agent queries
│   ├── drift_events.log        # Detected drift
│   └── coherence_scores.log    # Validation results
```

---

## 5. Technical Stack

### 5.1 Core Technologies

#### Language & Runtime
- **Python 3.11+**
  - Rich NLP ecosystem
  - Excellent AI/ML library support
  - Strong async capabilities for agent coordination

#### AI & NLP
- **Anthropic Claude API** (Primary Intelligence)
  - Text analysis and synthesis
  - Decision extraction
  - Coherence validation
  - Query understanding
  - Context summarization

- **sentence-transformers** (Embeddings)
  - Model: `all-MiniLM-L6-v2` for speed
  - Or: `all-mpnet-base-v2` for accuracy
  - Generate embeddings for semantic search

- **spaCy** (NLP Processing)
  - Entity extraction
  - Dependency parsing
  - Text normalization

#### Storage
- **GitPython**
  - Git operations for Applied Narrative
  - Commit management
  - Branch operations
  - Diff generation

- **ChromaDB** (Vector Database)
  - Embedding storage and retrieval
  - Semantic search
  - Similarity queries
  - Lightweight, embedded option

- **Redis** (Cache)
  - Query result caching
  - Session state
  - Rate limiting
  - Pub/sub for agent notifications

#### API & Integration
- **FastAPI** (REST API)
  - High performance async
  - Auto-generated OpenAPI docs
  - Type hints and validation with Pydantic

- **gRPC** (Agent-to-Agent Communication)
  - Low latency for agent coordination
  - Strongly typed interfaces
  - Bi-directional streaming

- **Slack SDK** (Input Integration)
  - Message monitoring
  - Event handling
  - Rich formatting for responses

- **PyGithub** (GitHub Integration)
  - PR/Issue monitoring
  - Comment processing
  - Webhook handling

#### Infrastructure
- **Docker** (Containerization)
  - Consistent deployment
  - Service isolation
  - Easy scaling

- **Docker Compose** (Development)
  - Multi-service orchestration
  - Local development environment

- **GitHub Actions** (CI/CD)
  - Automated testing
  - Deployment pipelines
  - Context validation on commits

### 5.2 Architecture Stack

```
┌─────────────────────────────────────────────────┐
│               CLIENT LAYER                       │
├─────────────────────────────────────────────────┤
│  CLI Tool  │  Web UI  │  Slack Bot  │  API     │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│               API LAYER (FastAPI)                │
├─────────────────────────────────────────────────┤
│  REST Endpoints  │  gRPC Services  │ WebSockets │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│            BUSINESS LOGIC LAYER                  │
├─────────────────────────────────────────────────┤
│  Context Capture  │  Drift Detection            │
│  Coherence Scoring │  Agent Coordination        │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│              AI/NLP LAYER                        │
├─────────────────────────────────────────────────┤
│  Claude API  │  Embeddings  │  NLP Processing  │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│              DATA LAYER                          │
├─────────────────────────────────────────────────┤
│  Git (Applied Narrative)  │  ChromaDB  │ Redis  │
└─────────────────────────────────────────────────┘
```

### 5.3 Key Dependencies

```toml
# pyproject.toml

[tool.poetry.dependencies]
python = "^3.11"

# AI & NLP
anthropic = "^0.18.0"              # Claude API
sentence-transformers = "^2.2.2"   # Embeddings
spacy = "^3.7.0"                   # NLP processing

# Storage & Data
gitpython = "^3.1.40"              # Git operations
chromadb = "^0.4.20"               # Vector database
redis = "^5.0.1"                   # Caching
pydantic = "^2.5.0"                # Data validation

# API & Integration
fastapi = "^0.109.0"               # REST API
grpcio = "^1.60.0"                 # gRPC
slack-sdk = "^3.26.0"              # Slack integration
pygithub = "^2.1.1"                # GitHub integration

# Utilities
pyyaml = "^6.0.1"                  # YAML parsing (frontmatter)
python-frontmatter = "^1.0.0"      # Frontmatter handling
httpx = "^0.26.0"                  # Async HTTP
tenacity = "^8.2.3"                # Retry logic
```

### 5.4 Development Tools

```toml
[tool.poetry.group.dev.dependencies]
pytest = "^7.4.3"
pytest-asyncio = "^0.21.1"
black = "^23.12.0"
ruff = "^0.1.9"
mypy = "^1.8.0"
```

---

## 6. API Interface

### 6.1 REST API

#### Base URL
```
http://localhost:8000/api/v1
```

#### Authentication
```
Authorization: Bearer <api_token>
```

### 6.2 Core Endpoints

#### Query Context
```http
POST /query
Content-Type: application/json

{
  "document": "brandVoice",
  "section": "error_messages",
  "format": "structured"
}

Response 200:
{
  "document": "brandVoice",
  "section": "error_messages",
  "content": {
    "tone": "empathetic, solution-oriented",
    "examples": [...],
    "guidelines": [...]
  },
  "metadata": {
    "last_updated": "2025-11-21",
    "version": "1.0.0"
  }
}
```

#### Semantic Search
```http
POST /search
Content-Type: application/json

{
  "query": "How should we handle user authentication?",
  "types": ["adr", "technicalContext"],
  "limit": 5
}

Response 200:
{
  "results": [
    {
      "document": "decisions/20251120-oauth2-authentication.md",
      "type": "adr",
      "relevance": 0.92,
      "excerpt": "We chose OAuth2 for authentication...",
      "metadata": {...}
    },
    ...
  ]
}
```

#### Validate Coherence
```http
POST /validate
Content-Type: application/json

{
  "content": "New feature proposal...",
  "against": ["priorities", "customerPainPoints"],
  "threshold": 0.75
}

Response 200:
{
  "coherence_score": 0.82,
  "threshold_met": true,
  "dimensions": {
    "semantic": 0.88,
    "strategic": 0.79,
    "tone": 0.85,
    "technical": 0.75
  },
  "conflicts": [],
  "recommendations": []
}
```

#### Detect Drift
```http
POST /drift/detect
Content-Type: application/json

{
  "content": "Marketing copy text...",
  "context_type": "brandVoice",
  "threshold": 0.70
}

Response 200:
{
  "drift_detected": true,
  "severity": "medium",
  "conflicts": [
    {
      "text": "Revolutionary AI that disrupts",
      "conflicts_with": "brand-voice.md#tone",
      "similarity": 0.45,
      "recommendation": "Align with 'confident without arrogance'"
    }
  ]
}
```

#### Capture Context
```http
POST /capture
Content-Type: application/json

{
  "source": "slack",
  "source_id": "C1234567890/p1234567890",
  "content": "Thread discussing database choice...",
  "suggested_type": "adr",
  "metadata": {
    "participants": ["alice", "bob"],
    "timestamp": "2025-11-21T10:30:00Z"
  }
}

Response 202:
{
  "capture_id": "cap_abc123",
  "status": "processing",
  "estimated_completion": "2025-11-21T10:31:00Z"
}
```

#### Update Context
```http
PATCH /documents/{document_type}/{document_id}
Content-Type: application/json

{
  "section": "Priority 3",
  "updates": {
    "status": "completed",
    "completion": 100
  },
  "changelog_entry": {
    "date": "2025-11-21",
    "change": "Marked priority as completed",
    "author": "alice"
  }
}

Response 200:
{
  "document_id": "priorities",
  "updated": true,
  "commit_sha": "abc123...",
  "git_url": "https://github.com/org/repo/commit/abc123"
}
```

#### List Documents
```http
GET /documents?type=adr&status=accepted&limit=10

Response 200:
{
  "documents": [
    {
      "id": "decisions/20251120-oauth2-authentication",
      "type": "adr",
      "title": "Use OAuth2 for Authentication",
      "status": "accepted",
      "last_updated": "2025-11-20",
      "tags": ["security", "authentication"]
    },
    ...
  ],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 0
  }
}
```

### 6.3 gRPC Services

```protobuf
syntax = "proto3";

package principal_narrative;

service NarrativeAgent {
  // Query organizational context
  rpc QueryContext(ContextQuery) returns (ContextResponse);

  // Validate content coherence
  rpc ValidateCoherence(CoherenceRequest) returns (CoherenceScore);

  // Detect semantic drift
  rpc DetectDrift(DriftRequest) returns (DriftReport);

  // Stream context updates
  rpc StreamUpdates(UpdateSubscription) returns (stream ContextUpdate);

  // Coordinate multiple agents
  rpc CoordinateAgents(CoordinationRequest) returns (CoordinationPlan);
}

message ContextQuery {
  string document = 1;
  string section = 2;
  repeated string tags = 3;
  string format = 4;
}

message ContextResponse {
  string content = 1;
  map<string, string> metadata = 2;
  repeated RelatedDocument related = 3;
}

message CoherenceRequest {
  string content = 1;
  repeated string against = 2;
  float threshold = 3;
}

message CoherenceScore {
  float overall = 1;
  map<string, float> dimensions = 2;
  bool threshold_met = 3;
  repeated Issue issues = 4;
  repeated string recommendations = 5;
}

message DriftRequest {
  string content = 1;
  string context_type = 2;
  float threshold = 3;
}

message DriftReport {
  bool detected = 1;
  string severity = 2;
  repeated Conflict conflicts = 3;
  string recommendation = 4;
}
```

### 6.4 WebSocket Interface

For real-time updates and streaming responses:

```javascript
// Client connection
const ws = new WebSocket('ws://localhost:8000/ws/updates');

// Subscribe to context updates
ws.send(JSON.stringify({
  type: 'subscribe',
  documents: ['priorities', 'brandVoice'],
  event_types: ['update', 'drift_detected']
}));

// Receive updates
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  /*
  {
    type: 'context_updated',
    document: 'priorities',
    change_summary: 'Added Q1 2026 priority',
    commit_sha: 'abc123',
    timestamp: '2025-11-21T10:35:00Z'
  }
  */
};
```

### 6.5 Python SDK

```python
from principal_narrative import NarrativeAgent

# Initialize client
agent = NarrativeAgent(
    api_key="your_api_key",
    base_url="http://localhost:8000"
)

# Query context
brand_voice = agent.query(
    document="brandVoice",
    section="error_messages"
)

# Validate coherence
score = agent.validate_coherence(
    content="New feature proposal...",
    against=["priorities", "customerPainPoints"],
    threshold=0.75
)

if score.threshold_met:
    print("Content is coherent!")
else:
    print(f"Issues found: {score.issues}")

# Detect drift
drift = agent.detect_drift(
    content="Marketing copy...",
    context_type="brandVoice"
)

if drift.detected:
    print(f"Drift detected: {drift.conflicts}")

# Capture context from Slack
capture = agent.capture_from_slack(
    channel_id="C1234567890",
    thread_ts="1234567890.123456"
)
```

### 6.6 CLI Interface

```bash
# Query context
narrative query --doc brandVoice --section error_messages

# Validate content
narrative validate --content "feature.md" --against priorities

# Detect drift
narrative drift --content "homepage-copy.md" --type brandVoice

# Capture from Slack
narrative capture slack --channel general --thread 1234567890

# List ADRs
narrative list --type adr --status accepted

# Update document
narrative update priorities --section "Priority 3" --field status --value completed

# Sync applied narrative to vector DB
narrative sync
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Python project structure
- [ ] Implement Git integration (read/write Applied Narrative)
- [ ] Build basic CLI for manual context capture
- [ ] Create document parser (frontmatter + markdown)
- [ ] Integrate Claude API for basic text processing

### Phase 2: Core Intelligence (Weeks 3-4)
- [ ] Implement embedding generation
- [ ] Set up ChromaDB for vector storage
- [ ] Build semantic search
- [ ] Create coherence scoring algorithm
- [ ] Develop drift detection logic

### Phase 3: API Layer (Weeks 5-6)
- [ ] Build FastAPI REST endpoints
- [ ] Implement gRPC services
- [ ] Add authentication and authorization
- [ ] Create Python SDK
- [ ] Write API documentation

### Phase 4: Integrations (Weeks 7-8)
- [ ] Slack integration for context capture
- [ ] GitHub integration for PR/issue monitoring
- [ ] WebSocket for real-time updates
- [ ] Agent coordination protocols
- [ ] Notification system

### Phase 5: Advanced Features (Weeks 9-10)
- [ ] Automated context capture workflows
- [ ] Advanced drift detection
- [ ] Context evolution tracking
- [ ] Analytics and insights dashboard
- [ ] Multi-repository support

### Phase 6: Production Readiness (Weeks 11-12)
- [ ] Comprehensive testing suite
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Deployment automation
- [ ] Monitoring and observability
- [ ] Documentation and examples

---

## 8. Success Metrics

### System Performance
- **Query Latency**: < 200ms for context queries
- **Coherence Validation**: < 2s for full coherence check
- **Capture Processing**: < 30s from Slack thread to Git commit
- **Embedding Generation**: < 5s per document

### Accuracy Metrics
- **Drift Detection Precision**: > 90% (true positives)
- **Drift Detection Recall**: > 85% (catch most drift)
- **Coherence Score Correlation**: > 0.8 with human judgment
- **Context Classification**: > 95% correct document type

### Adoption Metrics
- **Agent Query Rate**: Growing queries from other agents
- **Human Edits**: < 20% of auto-generated context needs revision
- **Context Coverage**: > 80% of decisions captured as ADRs
- **Drift Prevention**: > 70% of conflicts caught pre-commit

---

## 9. Open Questions & Future Considerations

### Open Questions
1. **Human-in-the-loop**: When should the agent require human approval?
2. **Conflict Resolution**: How to handle intentional vs unintentional drift?
3. **Multi-tenant**: Support for multiple organizations/projects?
4. **Privacy**: How to handle sensitive context (security decisions, customer data)?
5. **Versioning**: How to handle major context evolution vs minor updates?

### Future Enhancements
- **Visual Context Mapping**: Graph visualization of context relationships
- **Predictive Drift**: Predict potential drift before it happens
- **Cross-repo Context**: Share context across multiple repositories
- **Context Templates**: Pre-built templates for common document types
- **Automated Onboarding**: Generate initial Applied Narrative from existing docs
- **Context Quality Scoring**: Rate quality and completeness of context

---

## 10. References

### Internal Documentation
- Applied Narrative Structure: `.principalnarrative/applied-narrative/README.md`
- Schema Definition: `.principalnarrative/applied-narrative/.meta/schema.json`

### External Resources
- [Anthropic Claude API Docs](https://docs.anthropic.com/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Architecture Decision Records (ADRs)](https://adr.github.io/)
- [Sentence Transformers](https://www.sbert.net/)

### Related Concepts
- Institutional Memory Systems
- Knowledge Graphs
- Semantic Versioning
- Context-Aware Computing
- Multi-Agent Coordination

---

*This specification is a living document. Update as the system evolves.*
