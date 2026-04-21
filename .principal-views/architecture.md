# Narrative Agent Architecture

## Overview

Narrative Agent is an organizational alignment platform that helps teams maintain narrative coherence across all content and communications. The system provides tools for extracting, analyzing, and validating narrative units from various sources.

## Core Components

### Web Application
The main SaaS application (`web-app.js`) serves as the primary interface for users. It provides:
- OAuth authentication via GitHub
- Repository scanning and validation
- Narrative unit management
- Skills configuration (terminology, tone)
- Algebra metrics computation

### Integration Framework
The new Harvest Integrations extend data collection beyond URLs to organizational systems:
- **Airtable**: Extract from databases and project management
- **CRM Systems**: Mine narratives from sales and customer data
- **Webex**: Capture insights from meetings and communications

### StoryMining Engine
The core extraction engine with two modes:
- **Rule-based**: Pattern matching and heuristic extraction
- **LLM-enhanced**: AI-powered narrative understanding

### Narrative Algebra
Mathematical framework for measuring:
- Narrative Coherence Index (NCI)
- Layer health and coverage
- Drift detection
- Gap analysis

## Data Flow

1. **Collection**: Data is harvested from various sources (URLs, APIs, databases)
2. **Extraction**: StoryMining processes text to identify narrative units
3. **Classification**: Units are categorized into layers (core_story, positioning, etc.)
4. **Storage**: Narrative canon is persisted to GitHub or memory stores
5. **Analysis**: Algebra metrics evaluate coherence and alignment
6. **Action**: Prescriptive recommendations guide content creation

## Deployment Architecture

- **Production**: Vercel serverless functions
- **Staging**: GitHub Pages static hosting
- **Containers**: Docker images via GitHub Container Registry
- **CI/CD**: GitHub Actions automated pipeline

## Security Model

- GitHub OAuth for authentication
- Session-based CSRF protection
- Rate limiting on API endpoints
- Environment variable configuration
- Non-root container execution

## Integration Points

The system integrates with:
- GitHub (repository storage)
- OpenAI/Anthropic (LLM enhancement)
- Airtable (project data)
- Salesforce/HubSpot/Pipedrive (CRM data)
- Webex (communication data)

## Scalability

- Serverless architecture for automatic scaling
- Stateless request handling
- Distributed caching strategy
- Batch processing for large datasets
- Rate-limited external API calls