# Principal Narrative

An AI system that maintains organizational context by capturing, structuring, and evolving institutional knowledge from unstructured sources.

## What is the Principal Narrative?

The Principal Narrative is a **context preservation and coordination system** that:

- **Captures** organizational knowledge from unstructured sources (Slack, meetings, docs)
- **Structures** that knowledge into version-controlled markdown documents
- **Maintains** context through Git-versioned Applied Narrative format
- **Coordinates** other AI agents by providing canonical organizational context
- **Detects** when reality drifts from documented intent

Unlike coding agents that generate code, the Principal Narrative preserves the "why" behind decisions, ensuring all AI agents operate with consistent understanding of company vision, priorities, and technical context.

## Project Structure

```
principalnarrative/
├── .principalnarrative/
│   ├── applied-narrative/      # Git-native organizational context
│   │   ├── README.md
│   │   ├── vision.md           # Vision, mission, values
│   │   ├── priorities.md       # Strategic priorities & OKRs
│   │   ├── brand-voice.md      # Communication guidelines
│   │   ├── customer-pain-points.md
│   │   ├── decisions/          # Architecture Decision Records
│   │   ├── technical-context/  # Technical documentation
│   │   └── .meta/
│   │       ├── schema.json     # JSON Schema for documents
│   │       └── index.json      # Document index & relationships
│   └── specs/
│       └── principalnarrative-spec.md  # Full system specification
└── README.md                   # This file
```

## Applied Narrative

The **Applied Narrative** is a Git-native knowledge base that stores:

- **Vision & Mission**: Long-term direction and core values
- **Strategic Priorities**: Current OKRs and goals with progress tracking
- **Brand Voice**: Communication guidelines and tone for all channels
- **Customer Pain Points**: Target segments, problems we solve, jobs-to-be-done
- **Architecture Decisions**: ADRs documenting significant technical choices
- **Technical Context**: System architecture, patterns, and development practices

All documents use:
- YAML frontmatter for metadata
- Markdown for human readability
- Git for version control
- JSON Schema for validation

## Documentation

- **Applied Narrative Guide**: `.principalnarrative/applied-narrative/README.md`
- **System Specification**: `.principalnarrative/specs/principalnarrative-spec.md`
- **Schema Definition**: `.principalnarrative/applied-narrative/.meta/schema.json`

## Core Capabilities (Planned)

### 1. Context Capture
Transform unstructured discussions into structured knowledge:
```
Slack thread about feature decision
  ↓ [NLP + Claude API]
  ↓ [Synthesis]
  ↓
ADR with rationale, alternatives, consequences
```

### 2. Semantic Drift Detection
Catch when reality diverges from documented intent:
- Embedding-based similarity scoring
- Automatic conflict identification
- Actionable recommendations

### 3. Agent Coordination
Provide canonical context to other AI agents:
```python
# Coding agent queries brand voice before naming
context = principal_narrative.query(
    doc_type="brandVoice",
    topic="naming_conventions"
)
```

### 4. Coherence Scoring
Multi-dimensional alignment measurement:
- Semantic alignment (40%)
- Strategic alignment (30%)
- Tone consistency (15%)
- Technical consistency (15%)

## Technical Stack

- **Language**: Python 3.11+
- **AI/NLP**: Anthropic Claude API, sentence-transformers, spaCy
- **Storage**: Git (Applied Narrative), ChromaDB (vectors), Redis (cache)
- **API**: FastAPI (REST), gRPC (agent-to-agent)
- **Integrations**: Slack SDK, PyGithub

## Getting Started

### Current Status
This repository contains the foundational data structure and specification for the Principal Narrative system. Implementation is planned in phases:

- **Phase 1-2**: Foundation (Git integration, CLI, Claude API)
- **Phase 3-4**: Core intelligence (embeddings, drift detection)
- **Phase 5-6**: API layer (REST, gRPC, SDK)
- **Phase 7-8**: Integrations (Slack, GitHub)
- **Phase 9-10**: Advanced features
- **Phase 11-12**: Production readiness

### Next Steps

1. Review the specification: `.principalnarrative/specs/principalnarrative-spec.md`
2. Populate Applied Narrative templates with actual organizational context
3. Begin implementation following the phased plan

## Quick Start

### Local Development

1. **Clone the repository**:
```bash
git clone https://github.com/FlanneryAllen/principalnarrative.git
cd principalnarrative
```

2. **Set up environment**:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

4. **Run the API**:
```bash
./run.sh
# Or manually:
uvicorn src.main:app --reload
```

5. **Access the API**:
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### Docker Deployment

1. **Build and run with Docker Compose**:
```bash
docker-compose up -d
```

2. **Check logs**:
```bash
docker-compose logs -f narrative-api
```

3. **Stop the service**:
```bash
docker-compose down
```

### Production Deployment

See [PRODUCTION.md](PRODUCTION.md) for detailed production deployment guide including:
- Structured logging and monitoring
- Error handling and recovery
- Performance optimization
- Security best practices

## API Endpoints

### Core Endpoints
- `GET /health` - Health check
- `GET /` - API information

### Context Management
- `GET /context/query` - Query narrative units
- `POST /context/validate` - Validate claims against proof

### Coherence & Drift
- `GET /coherence/score` - Get coherence scores
- `GET /coherence/drift` - Get drift events
- `POST /coherence/scan` - Run drift detection

### Proof & Metrics
- `GET /proof/metrics` - Get verified proof metrics
- `GET /features` - Get feature registry

See http://localhost:8000/docs for interactive API documentation.

## Architecture

### Components
- **API Layer**: FastAPI with REST endpoints
- **Services**: Narrative reading, validation, coherence, drift detection
- **Storage**: Git-native Applied Narrative + ChromaDB for vectors
- **Integrations**: Slack, GitHub webhooks
- **Monitoring**: Structured logging with file and console output

### Key Features
- ✅ Complete API with 40+ endpoints
- ✅ Structured logging and monitoring
- ✅ Docker containerization
- ✅ CI/CD with GitHub Actions
- ✅ Real-time drift detection
- ✅ Proof-backed claim validation
- ✅ Semantic search (requires Anthropic API key)

## Philosophy

**"Context is everything."**

Software teams lose institutional knowledge every time someone leaves, every decision is made in Slack without documentation, every architectural choice lacks recorded rationale. The Principal Narrative ensures that the "why" behind decisions is preserved, version-controlled, and accessible to both humans and AI agents.

## Contributing

See `.principalnarrative/applied-narrative/README.md` for guidelines on maintaining organizational context documents.

## License

[To be determined]

---

*Preserving organizational memory, one commit at a time.*
