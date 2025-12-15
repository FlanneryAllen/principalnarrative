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
- `POST /coherence/scan` - Run drift detection (pattern-based + semantic)
- `POST /coherence/resolve` - 🤖 AI-powered drift resolution ⭐ New!

### Drift Alerts ⭐ New!
- `GET /alerts/rules` - Get configured alert rules
- `POST /alerts/rules` - Create new alert rule
- `PUT /alerts/rules/{id}` - Update alert rule
- `DELETE /alerts/rules/{id}` - Delete alert rule
- `POST /alerts/test` - Send test alert
- `POST /alerts/send` - Manually trigger drift alerts
- `GET /alerts/history` - Get alert history

### Drift Analytics ⭐ New!
- `GET /drift/analytics/summary` - Dashboard overview metrics
- `GET /drift/analytics/trends?period=30d` - Trend analysis (7d/30d/90d)
- `GET /drift/analytics/timeseries?days=30` - Time-series chart data
- `GET /drift/analytics/heatmap` - Document-level drift heatmap
- `GET /drift/analytics/severity` - Severity breakdown with history
- `GET /drift/analytics/types` - Drift type distribution
- `GET /drift-dashboard` - Interactive drift visualization dashboard

### Multi-Repository Support ⭐ New!
- `POST /multi-repo/register` - Register a repository
- `GET /multi-repo/repositories` - List all registered repositories
- `GET /multi-repo/repositories/{name}` - Get repository details
- `POST /multi-repo/scan` - Scan all repositories for drift
- `GET /multi-repo/organization/summary` - Get organization-wide summary
- `GET /multi-repo/organization/top-drift` - Get top drift repositories
- `POST /multi-repo/sync-central` - Sync central Applied Narrative
- `GET /multi-repo/sync-status` - Get sync status
- `GET /multi-repo/conflicts` - Check for narrative conflicts
- `POST /multi-repo/heartbeat/{repo_name}` - Record repository heartbeat
- `GET /multi-repo-dashboard` - Organization dashboard

### Proof & Metrics
- `GET /proof/metrics` - Get verified proof metrics
- `GET /features` - Get feature registry

### Website Analysis
- `POST /website/analyze` - Analyze website narrative structure
- `POST /website/analyze-ai` - AI-enhanced narrative analysis
- `POST /website/compare` - Competitive analysis (2-5 sites)
- `POST /website/export-pdf` - Export standard analysis as PDF
- `POST /website/export-ai-pdf` - Export AI analysis as PDF
- `POST /website/export-competitive-pdf` - Export competitive analysis as PDF

### Batch & Historical Analysis ⭐ New!
- `POST /website/batch/analyze` - Batch analyze 2-100 URLs
- `GET /website/batch/status/{job_id}` - Get batch job status
- `GET /website/batch/results/{job_id}` - Get batch results
- `GET /website/batch/export-csv/{job_id}` - Export batch results as CSV
- `GET /website/history/recent` - List recently analyzed URLs
- `GET /website/history/snapshots/{url}` - Get historical snapshots
- `GET /website/history/trends/{url}` - Get trend analysis

### Dashboards
- `GET /dashboard` - Interactive visual dashboard
- `GET /competitive` - Competitive analysis dashboard
- `GET /batch` - Batch URL analysis dashboard ⭐ New!
- `GET /trends` - Historical trends dashboard ⭐ New!
- `GET /drift-dashboard` - Drift analytics visualization ⭐ New!
- `GET /multi-repo-dashboard` - Organization multi-repo dashboard ⭐ New!
- `GET /website/health` - Website analysis service health check

See http://localhost:8000/docs for interactive API documentation.

## Architecture

### Components
- **API Layer**: FastAPI with REST endpoints
- **Services**: Narrative reading, validation, coherence, drift detection
- **Storage**: Git-native Applied Narrative + ChromaDB for vectors
- **Integrations**: Slack, GitHub webhooks
- **Monitoring**: Structured logging with file and console output

### Key Features
- ✅ Complete API with 50+ endpoints
- ✅ Structured logging and monitoring
- ✅ Docker containerization
- ✅ CI/CD with GitHub Actions
- ✅ Real-time drift detection
- ✅ Proof-backed claim validation
- ✅ Semantic search (requires Anthropic API key)
- ✅ Website narrative analysis
- ✅ **AI-Enhanced Analysis** with Claude API
  - Smart claim extraction with strength scoring
  - Narrative gap detection
  - Tone & voice analysis
  - Value proposition scoring
  - Automated recommendations
- ✅ **Competitive Analysis**
  - Side-by-side comparison of 2-5 websites
  - Gap identification (what you're missing)
  - Strengths analysis
  - Visual charts and rankings
  - Actionable opportunities
- ✅ **PDF Report Export**
  - Professional branded PDF reports
  - Charts and visualizations embedded
  - One-click download from dashboards
  - Shareable with stakeholders
- ✅ **Result Caching & Historical Tracking** ⭐ New!
  - 24-hour automatic caching (reduces API costs)
  - Unlimited historical snapshots
  - Automatic trend detection (increasing/decreasing/stable)
  - Narrative drift alerts
  - Visual trend dashboards
- ✅ **Batch URL Analysis** ⭐ New!
  - Analyze 2-100 websites simultaneously
  - Parallel processing (5-10 concurrent)
  - Real-time progress tracking
  - CSV export for external analysis
  - Intelligent cache integration
- ✅ **Semantic Drift Detection** ⭐ New!
  - Embedding-based contradiction detection
  - Documentation-to-codebase alignment checking
  - Technology stack misalignment detection
  - Cross-document inconsistency analysis
- ✅ **AI-Powered Conflict Resolution** ⭐ New!
  - Claude AI analyzes drift and generates specific fixes
  - Exact code/doc changes with before/after snippets
  - Priority ranking by business impact
  - Effort estimates (5 min, 1 hour, 1 day)
  - Quick wins identification
  - Exportable resolution plans (JSON/Markdown)
- ✅ **Drift Alert System** ⭐ New!
  - Automated Slack notifications when drift is detected
  - HTML email alerts with color-coded severity
  - Custom webhook support (Teams, Discord, etc.)
  - Configurable rules (thresholds, channels, cooldowns)
  - Alert history tracking
  - Test mode for verification
- ✅ **Drift Analytics Dashboard** ⭐ New!
  - Historical drift tracking with automatic snapshots
  - Trend analysis (7-day, 30-day, 90-day)
  - Interactive charts (trend lines, severity breakdown, type distribution)
  - Document heatmap showing problem areas
  - Resolution rate tracking
  - Auto-refresh dashboard with real-time metrics
- ✅ **Multi-Repository Support** ⭐ New!
  - Central Applied Narrative shared across repos
  - Repository registry for org-wide tracking
  - Cross-repo drift detection and coherence monitoring
  - Organization dashboard with aggregated metrics
  - Flexible modes (standalone, central, hybrid)
  - Automatic syncing from central narrative
  - Conflict detection and resolution policies
- ✅ Live URL scraping
- ✅ JavaScript rendering for SPAs (React, Vue, Angular)

## Website Narrative Analysis

Analyze any website's narrative structure - from local files or live URLs.

### Features
- **Claims & Proof Extraction**: Identify value propositions and supporting evidence
- **AI-Enhanced Analysis**: Deep narrative intelligence with Claude API
  - Smart claim extraction with 0-100 strength scoring
  - Narrative gap identification (what's missing or weak)
  - Automated recommendations
  - Tone & voice consistency analysis
  - Value proposition scoring
- **Competitive Analysis**: Compare against competitors side-by-side
  - Analyze 2-5 websites simultaneously
  - Identify gaps, strengths, and opportunities
  - Visual comparison charts
  - Priority-ranked recommendations
- **PDF Report Export**: Professional, shareable reports ⭐ New!
  - One-click download from dashboards
  - Branded PDF templates with charts
  - Standard, AI, and competitive analysis reports
  - Email-ready format for stakeholders
- **Persona Detection**: Extract customer testimonials and personas
- **Consistency Scoring**: 0-100 score analyzing messaging alignment
- **Live URL Analysis**: Download and analyze any public website
- **JavaScript Rendering**: Support for React, Vue, Angular SPAs via Playwright
- **Visual Dashboard**: Interactive UI with charts, gauges, and insights

### Quick Start

1. **Start the dashboard**:
   ```bash
   ./run_dashboard.sh
   ```

2. **Open**: http://localhost:8000/dashboard

3. **Analyze a website**:
   - Toggle between "📁 Local Path" or "🌐 URL" mode
   - For SPAs, check "🎭 Render JavaScript"
   - For deep insights, check "🤖 AI-Enhanced Analysis"
   - Click "🔍 Analyze Website"

### Setup AI-Enhanced Analysis

For deep narrative intelligence with Claude:

```bash
# Get API key from: https://console.anthropic.com
export ANTHROPIC_API_KEY="sk-ant-..."
# Or add to .env file
```

### Setup JavaScript Rendering

For modern SPAs (React, Vue, Angular):

```bash
pip install -r requirements.txt
./setup_playwright.sh  # Installs Chromium (~300MB)
```

### Documentation
- **Caching & Historical Tracking**: [CACHING_AND_HISTORY.md](CACHING_AND_HISTORY.md)
- **Semantic Drift Detection**: [SEMANTIC_DRIFT.md](SEMANTIC_DRIFT.md) ⭐ New!
- **AI-Powered Conflict Resolution**: [AI_CONFLICT_RESOLUTION.md](AI_CONFLICT_RESOLUTION.md) ⭐ New!
- **Drift Alert System**: [DRIFT_ALERTS.md](DRIFT_ALERTS.md) ⭐ New!
- **Drift Analytics Dashboard**: [DRIFT_DASHBOARD.md](DRIFT_DASHBOARD.md) ⭐ New!
- **Multi-Repository Support**: [MULTI_REPO.md](MULTI_REPO.md) ⭐ New!
- **Competitive Analysis**: [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md)
- **AI-Enhanced Analysis**: [AI_ANALYSIS.md](AI_ANALYSIS.md)
- **Dashboard Guide**: [DASHBOARD.md](DASHBOARD.md)
- **Live URL Analysis**: [URL_ANALYSIS.md](URL_ANALYSIS.md)
- **JavaScript Rendering**: [JS_RENDERING.md](JS_RENDERING.md)

## Philosophy

**"Context is everything."**

Software teams lose institutional knowledge every time someone leaves, every decision is made in Slack without documentation, every architectural choice lacks recorded rationale. The Principal Narrative ensures that the "why" behind decisions is preserved, version-controlled, and accessible to both humans and AI agents.

## Contributing

See `.principalnarrative/applied-narrative/README.md` for guidelines on maintaining organizational context documents.

## License

[To be determined]

---

*Preserving organizational memory, one commit at a time.*
