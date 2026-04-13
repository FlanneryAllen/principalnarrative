# Multi-Repository Support

Scale the Principal Narrative system across your entire organization. Share a central Applied Narrative across multiple repositories, track cross-repo drift, and maintain organizational coherence.

## Overview

The multi-repository system enables:
- **Central Narrative**: One source of truth for org-wide context (vision, brand voice, priorities)
- **Repository Registry**: Track all repos using the narrative system
- **Cross-Repo Drift Detection**: Detect when repos diverge from central narrative
- **Organization Dashboard**: Unified view of coherence across all repositories
- **Flexible Modes**: Standalone, central, or hybrid narrative configurations

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Central Applied Narrative Repository            │
│  (Organization-wide truth: vision, brand, tech standards)   │
└────────────────────┬─────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┬──────────────┐
         │           │           │              │
    ┌────▼────┐ ┌───▼────┐ ┌───▼────┐ ┌──────▼──────┐
    │ Repo A  │ │ Repo B │ │ Repo C │ │   Repo D    │
    │(Frontend)│ │(Backend)│ │(Mobile)│ │(Docs)      │
    └─────────┘ └────────┘ └────────┘ └─────────────┘
     Each references central + extends with local docs
```

## Quick Start

### 1. Create Central Narrative Repository

First, create a repository to hold your organization's Applied Narrative:

```bash
# Create central narrative repo
mkdir applied-narrative && cd applied-narrative
git init

# Create narrative structure
mkdir -p .principalnarrative/applied-narrative
cd .principalnarrative/applied-narrative

# Add org-wide documents
touch vision.md brand-voice.md priorities.md
touch technical-context/stack.md
touch technical-context/patterns.md

# Commit and push
git add .
git commit -m "Initial org narrative"
git remote add origin https://github.com/YourOrg/applied-narrative.git
git push -u origin main
```

### 2. Configure Local Repositories

In each repository, create `.narrative-config.json`:

```json
{
  "version": "1.0.0",
  "repository": {
    "name": "my-service",
    "type": "service",
    "description": "User authentication service",
    "owner": {
      "team": "platform",
      "contact": "platform@example.com"
    }
  },
  "narrative": {
    "mode": "central",
    "central_repository": {
      "url": "https://github.com/YourOrg/applied-narrative.git",
      "branch": "main",
      "path": ".principalnarrative/applied-narrative",
      "sync_interval": "daily",
      "auto_pull": true
    },
    "local_narrative": {
      "enabled": true,
      "path": ".principalnarrative/applied-narrative",
      "extends_central": true,
      "allow_overrides": true
    },
    "override_policy": "local_wins"
  },
  "drift_detection": {
    "enabled": true,
    "check_against_central": true,
    "report_to_org": true
  },
  "tags": ["backend", "auth", "python"]
}
```

### 3. Register Repositories

Register each repository with the central narrative API:

```bash
curl -X POST "http://narrative-api.example.com/multi-repo/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-service",
    "type": "service",
    "mode": "central",
    "description": "User authentication service",
    "owner_team": "platform",
    "owner_contact": "platform@example.com",
    "central_repo_url": "https://github.com/YourOrg/applied-narrative.git",
    "tags": ["backend", "auth", "python"]
  }'
```

### 4. View Organization Dashboard

Open the org-wide dashboard:
```bash
open http://narrative-api.example.com/multi-repo-dashboard
```

## Narrative Modes

### Standalone Mode
Repository has its own narrative, no central reference.

**Use Case:** Open source projects, single-repo companies

```json
{
  "narrative": {
    "mode": "standalone",
    "local_narrative": {
      "enabled": true,
      "path": ".principalnarrative/applied-narrative"
    }
  }
}
```

### Central Mode
Repository references central narrative only.

**Use Case:** Strictly controlled environments, documentation repos

```json
{
  "narrative": {
    "mode": "central",
    "central_repository": {
      "url": "https://github.com/YourOrg/applied-narrative.git"
    },
    "local_narrative": {
      "enabled": false
    }
  }
}
```

### Hybrid Mode (Recommended)
Repository references central AND has local extensions.

**Use Case:** Most organizations

```json
{
  "narrative": {
    "mode": "hybrid",
    "central_repository": {
      "url": "https://github.com/YourOrg/applied-narrative.git"
    },
    "local_narrative": {
      "enabled": true,
      "extends_central": true,
      "allow_overrides": true
    },
    "override_policy": "local_wins"
  }
}
```

## Override Policies

When both central and local have the same document:

| Policy | Behavior |
|--------|----------|
| `local_wins` | Use local version (recommended for flexibility) |
| `central_wins` | Use central version (strict compliance) |
| `merge` | Combine both (automatic merge) |
| `error` | Fail and require manual resolution |

## API Reference

### POST /multi-repo/register
Register a new repository.

**Request:**
```json
{
  "name": "my-service",
  "type": "service",
  "mode": "central",
  "central_repo_url": "https://github.com/org/narrative.git",
  "tags": ["backend"]
}
```

### GET /multi-repo/repositories
List all registered repositories.

**Query Parameters:**
- `type`: Filter by type (service, library, frontend, etc.)
- `mode`: Filter by mode (standalone, central, hybrid)
- `tags`: Comma-separated tags
- `status`: Filter by status (active, inactive)

**Response:**
```json
{
  "total": 15,
  "repositories": [
    {
      "name": "auth-service",
      "type": "service",
      "mode": "central",
      "owner_team": "platform",
      "metrics": {
        "total_drift": 5,
        "coherence_score": 87
      }
    }
  ]
}
```

### GET /multi-repo/repositories/{repo_name}
Get details for specific repository.

### POST /multi-repo/scan
Scan all repositories for drift.

**Response:**
```json
{
  "total_repositories": 15,
  "repositories": {
    "auth-service": [
      {
        "type": "semantic",
        "severity": "medium",
        "description": "Documentation differs from central"
      }
    ]
  },
  "summary": {
    "total_drift_events": 23,
    "repositories_with_drift": 8
  }
}
```

### GET /multi-repo/organization/summary
Get organization-wide summary.

**Response:**
```json
{
  "total_repositories": 15,
  "active_repositories": 14,
  "total_drift_events": 23,
  "drift_by_severity": {
    "critical": 2,
    "high": 5,
    "medium": 10,
    "low": 6
  },
  "average_coherence_score": 84,
  "repositories_by_type": {
    "service": 8,
    "library": 4,
    "frontend": 2,
    "mobile": 1
  }
}
```

### GET /multi-repo/organization/top-drift
Get repositories with most drift.

### POST /multi-repo/sync-central
Sync central narrative from Git.

### GET /multi-repo/sync-status
Get sync status of central narrative.

### GET /multi-repo/conflicts
Check for conflicts between central and local.

### POST /multi-repo/heartbeat/{repo_name}
Record repository heartbeat (for activity tracking).

## Configuration Reference

### .narrative-config.json Schema

```json
{
  "version": "1.0.0",
  "repository": {
    "name": "string",
    "type": "service|library|frontend|mobile|docs|monorepo|other",
    "description": "string",
    "owner": {
      "team": "string",
      "contact": "email"
    }
  },
  "narrative": {
    "mode": "standalone|central|hybrid",
    "central_repository": {
      "url": "string (git URL)",
      "branch": "string (default: main)",
      "path": "string (default: .principalnarrative/applied-narrative)",
      "sync_interval": "manual|hourly|daily|weekly",
      "auto_pull": "boolean (default: true)"
    },
    "local_narrative": {
      "enabled": "boolean",
      "path": "string",
      "extends_central": "boolean",
      "allow_overrides": "boolean"
    },
    "override_policy": "local_wins|central_wins|merge|error"
  },
  "drift_detection": {
    "enabled": "boolean",
    "check_against_central": "boolean",
    "report_to_org": "boolean",
    "scan_schedule": "string (cron expression)",
    "severity_threshold": "low|medium|high|critical"
  },
  "integrations": {
    "central_api": {
      "enabled": "boolean",
      "url": "string",
      "api_key_env": "string",
      "report_drift": "boolean"
    }
  },
  "tags": ["string"]
}
```

## Workflows

### Initial Setup (One-Time)

1. **Create Central Narrative Repo:**
   ```bash
   mkdir applied-narrative
   cd applied-narrative
   git init
   # Add narrative docs
   git commit -m "Initial narrative"
   git push
   ```

2. **Configure All Repositories:**
   - Add `.narrative-config.json` to each repo
   - Point to central narrative URL
   - Set appropriate mode and policies

3. **Register Repositories:**
   ```bash
   # Via API or dashboard
   curl -X POST /multi-repo/register -d {...}
   ```

### Daily Operations

1. **Monitor Organization Dashboard:**
   - Check drift trends
   - Review problematic repos
   - Track coherence scores

2. **Sync Central Narrative:**
   ```bash
   # Automatic (if configured)
   # Or manual
   curl -X POST /multi-repo/sync-central
   ```

3. **Scan for Drift:**
   ```bash
   # Manual scan
   curl -X POST /multi-repo/scan

   # Or scheduled (cron)
   0 9 * * * curl -X POST /multi-repo/scan
   ```

4. **Resolve Drift:**
   ```bash
   # Get AI recommendations
   curl -X POST /coherence/resolve
   ```

### Updating Central Narrative

1. **Make Changes in Central Repo:**
   ```bash
   cd applied-narrative
   vim .principalnarrative/applied-narrative/vision.md
   git commit -m "Update company vision"
   git push
   ```

2. **Repositories Auto-Sync:**
   - Based on `sync_interval`
   - Or manual: `POST /multi-repo/sync-central`

3. **Detect Drift:**
   - Run org-wide scan
   - Identify repos that haven't synced
   - Review conflicts

## Best Practices

### 1. Central Narrative Structure

Organize your central narrative clearly:

```
.principalnarrative/applied-narrative/
├── README.md                    # Overview
├── vision.md                    # Company vision
├── priorities.md                # Strategic priorities
├── brand-voice.md               # Communication guidelines
├── customer-pain-points.md      # Target customers
├── decisions/                   # ADRs (organization-wide)
│   ├── 001-tech-stack.md
│   └── 002-microservices.md
└── technical-context/           # Tech standards
    ├── stack.md                 # Approved technologies
    ├── patterns.md              # Design patterns
    └── security.md              # Security guidelines
```

### 2. Local Narrative Extensions

Each repo can extend with local docs:

```
local-repo/.principalnarrative/applied-narrative/
├── technical-context/
│   └── architecture.md          # Repo-specific architecture
├── decisions/
│   └── 003-local-decision.md   # Local ADRs
└── README.md                    # Repo-specific overview
```

### 3. Tags for Organization

Use consistent tags:
- **Tech**: `python`, `typescript`, `react`, `fastapi`
- **Domain**: `auth`, `payments`, `analytics`
- **Team**: `platform`, `product`, `mobile`

### 4. Heartbeat Monitoring

Have repos send heartbeats:

```bash
# In CI/CD pipeline
curl -X POST /multi-repo/heartbeat/my-service
```

### 5. Gradual Rollout

Don't migrate all repos at once:

**Week 1:** Pilot team (2-3 repos)
**Week 2:** Expand to department
**Week 3:** Add more teams
**Month 2:** Organization-wide

## Examples

### Example 1: Microservices Organization

15 services, shared central narrative:

```
Central Narrative (applied-narrative repo)
├── vision.md (company vision)
├── brand-voice.md (communication standards)
└── technical-context/
    ├── stack.md (Node.js, PostgreSQL, Redis)
    ├── patterns.md (Event sourcing, CQRS)
    └── api-standards.md (REST, GraphQL guidelines)

Service A (auth-service)
- Mode: central
- Local: auth-specific architecture

Service B (payment-service)
- Mode: central
- Local: payment flow diagrams

Service C (analytics-service)
- Mode: central
- Local: data pipeline docs
```

### Example 2: Frontend + Backend + Mobile

Different tech stacks, shared brand:

```
Central Narrative
├── brand-voice.md (shared)
├── vision.md (shared)
└── customer-pain-points.md (shared)

Frontend Repo (React)
- Mode: hybrid
- Extends: UI/UX patterns

Backend Repo (Python)
- Mode: hybrid
- Extends: API architecture

Mobile Repo (React Native)
- Mode: hybrid
- Extends: Mobile-specific patterns
```

### Example 3: Open Source Project

Single repo, standalone:

```
my-oss-project/
└── .narrative-config.json (mode: standalone)
```

## Troubleshooting

### "Repository not found"

**Cause:** Repository not registered

**Fix:**
```bash
curl -X POST /multi-repo/register -d {...}
```

### "Failed to sync central narrative"

**Cause:** Git credentials or network issue

**Fix:**
1. Check central repo URL is accessible
2. Verify Git credentials
3. Check network connectivity

### "Conflicts detected"

**Cause:** Central and local have diverged

**Fix:**
1. Check conflicts: `GET /multi-repo/conflicts`
2. Choose resolution strategy:
   - Update `override_policy` in config
   - Manually resolve and commit

### "No metrics for repository"

**Cause:** Repository hasn't been scanned

**Fix:**
```bash
curl -X POST /multi-repo/scan
```

## Roadmap

- ✅ Repository registry
- ✅ Central narrative resolver
- ✅ Cross-repo drift detection
- ✅ Organization dashboard
- 🔄 Slack notifications for org-wide drift
- 🔄 Automated PR creation for drift fixes
- 🔄 Repository groups/clusters
- 🔄 Cross-repo search
- 🔄 Narrative diff visualization
- 🔄 Conflict resolution UI

---

**Related Documentation:**
- [Drift Detection](DRIFT_ALERTS.md)
- [Semantic Drift](SEMANTIC_DRIFT.md)
- [AI Conflict Resolution](AI_CONFLICT_RESOLUTION.md)
