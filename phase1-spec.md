# Phase 1: Web-Native Experience — Implementation Spec

## Goal
Transform the narrative-agent from a local CLI tool into a hosted web app.
Users go to narrativeagent.ai, sign in with GitHub, paste/select a repo URL,
and get a full Narrative Coherence dashboard — no npm install, no CLI.

## Architecture

### New file: `packages/serve/web-app.js`
This is the **hosted** server — separate from `server.js` which remains the local CLI server.
Zero external dependencies beyond what's already in the project (Node.js stdlib + `yaml`).

### Key Differences from server.js
| | server.js (local) | web-app.js (hosted) |
|---|---|---|
| Auth | None — localhost only | GitHub OAuth |
| Data source | Local filesystem (.narrative/) | GitHub API (reads .narrative/ from repo) |
| Users | Single user | Multi-user with sessions |
| Canon parsing | `fs.readFileSync` | `https` fetch from GitHub raw API |
| File watching | `fs.watch` | GitHub webhooks |
| Dashboard | `dashboard.html` (local-focused) | `app.html` (auth + repo selector + onboarding) |

## Implementation Details

### 1. GitHub OAuth Flow (no external deps)
```
GET /auth/github → redirect to github.com/login/oauth/authorize
GET /auth/callback → exchange code for token via github API
```

- Use env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`
- Sessions: signed cookies with HMAC-SHA256, in-memory session store (Map)
- Cookie name: `na_session`, HttpOnly, Secure, SameSite=Lax
- Session stores: `{ githubToken, githubUser, repos: Map<repoFullName, lastCheck> }`

### 2. GitHub API Integration (stdlib `https` only)
Functions needed:
- `githubGet(path, token)` — GET request to api.github.com with token
- `githubGetRaw(owner, repo, path, token)` — GET raw file contents
- `fetchRepoCanon(owner, repo, token)` — reads .narrative/canon/*.yml and .narrative/skills/*.yml from repo via API
- `listUserRepos(token)` — GET /user/repos for repo selector dropdown

The `fetchRepoCanon()` function should:
1. List files in `.narrative/canon/` via Contents API
2. List files in `.narrative/skills/` via Contents API  
3. Fetch each YAML file's content
4. Parse with existing YAML parser
5. Return same `{ units, skills, files, errors }` structure as `parseCanon()`

### 3. Webhook Handler
```
POST /webhook/github
```
- Verify `X-Hub-Signature-256` with HMAC-SHA256 using `WEBHOOK_SECRET` env var
- On `push` event to default branch:
  1. Extract repo full_name from payload
  2. Find all sessions connected to that repo
  3. Re-fetch canon from GitHub API
  4. Run clarion call
  5. Push update via SSE to connected dashboards
  6. Store result in in-memory history

### 4. Web Dashboard (app.html)
Brand: dark navy (#0a1628), copper (#d4872c), Inter + JetBrains Mono.

#### Pages/States:
1. **Landing/Login** — "Sign in with GitHub" button, brief product pitch
2. **Repo Selector** — after auth, show user's repos with .narrative/ detected, or paste any repo URL
3. **Dashboard** — full algebra-powered dashboard (NCI gauge, layer health, graph viz, drift, coverage)
4. **Onboarding** — if selected repo has no .narrative/, offer to create one (guided wizard)

#### Dashboard Features (reuse from existing dashboard.html):
- NCI gauge (0-100)
- Layer health bars (core_story, positioning, product_narrative, operational, evidence, communication)
- Coverage ratio
- Drift rate + drifted units list
- Narrative graph visualization (D3.js force-directed)
- Stakeholder compose views (board, investor, engineering, customer, marketing, compliance)
- Resonance tester (paste text, get ρ score)
- Real-time updates via SSE when webhook fires

#### New Dashboard Features:
- User avatar + name in header (from GitHub profile)
- Repo selector dropdown in header
- "Connect a repo" flow
- Webhook status indicator (connected/disconnected)
- "Set up webhook" instructions panel

### 5. API Endpoints (web-app.js)

All endpoints below require auth (check `na_session` cookie).

```
# Auth
GET  /auth/github                  → redirect to GitHub OAuth
GET  /auth/callback                → exchange code, set session cookie, redirect to /
GET  /auth/logout                  → clear session, redirect to /
GET  /api/me                       → current user info + connected repos

# Repo management
GET  /api/repos                    → list user's GitHub repos
POST /api/repos/connect            → { owner, repo } → fetch canon, run initial check, store
POST /api/repos/disconnect         → { owner, repo } → remove from session
GET  /api/repos/:owner/:repo/scan  → re-scan repo's .narrative/ and return results

# Algebra operations (all scoped to a repo)
GET  /api/repos/:owner/:repo/metrics
GET  /api/repos/:owner/:repo/compose?stakeholder=board
GET  /api/repos/:owner/:repo/propagate?unit=core_visibility
GET  /api/repos/:owner/:repo/drift
GET  /api/repos/:owner/:repo/cover
POST /api/repos/:owner/:repo/validate
POST /api/repos/:owner/:repo/resonate  → { signal: "text" }
POST /api/repos/:owner/:repo/review    → { text: "content to check" }

# Webhook
POST /webhook/github               → GitHub push events (no auth — signature verified)

# SSE
GET  /api/events                   → SSE stream (auth required)

# Dashboard
GET  /                             → app.html
```

### 6. In-Memory Data Store

```js
const store = {
  sessions: new Map(),        // sessionId → { githubToken, user, connectedRepos }
  repoCache: new Map(),       // "owner/repo" → { canon, lastCheck, clarionResult, history[] }
  sseClients: new Map(),      // sessionId → Set<Response>
};
```

No database. Everything in memory. This is Phase 1 — persistent storage comes in Phase 2.

### 7. Security
- CORS: Allow requests from same origin only (no cross-origin needed for hosted app)
- All API routes check session cookie (except /webhook/github which uses signature)
- GitHub tokens stored in memory only, never logged
- Webhook payloads verified with HMAC-SHA256
- 1MB body size limit
- Rate limiting: 60 requests/min per session (in-memory counter)

### 8. Files to Create
- `packages/serve/web-app.js` — Main hosted server (~800-1000 lines)
- `packages/serve/app.html` — Web dashboard with auth + repo selector + all algebra visualizations (~1500 lines)
- `packages/serve/test-web-app.js` — Tests for auth flow, repo scanning, webhook, API endpoints

### 9. Files to Modify
- `packages/serve/package.json` — Add `"web": "web-app.js"` to bin, `"web": "node web-app.js"` to scripts
- Root `package.json` — Add `"web": "node packages/serve/web-app.js"` to scripts

### 10. Environment Variables
```
GITHUB_CLIENT_ID      — GitHub OAuth App client ID
GITHUB_CLIENT_SECRET  — GitHub OAuth App client secret
WEBHOOK_SECRET        — Secret for verifying GitHub webhook signatures
SESSION_SECRET        — Secret for signing session cookies
PORT                  — Server port (default: 3000)
BASE_URL              — Public URL (default: http://localhost:3000)
```

### 11. Constraints
- ZERO new npm dependencies. Use Node.js stdlib (`http`, `https`, `crypto`, `url`, `querystring`)
- Reuse ALL algebra logic from `algebra.js` — import createAlgebra, STAKEHOLDER_PRESETS, ALL_LAYERS
- Reuse content checking from `check.js` — import checkContent
- The existing `server.js` and `cli.js` remain unchanged (local-first experience still works)
- Single-file HTML dashboard (app.html) with inline CSS/JS, same as current dashboard.html pattern
- D3.js loaded from CDN for graph visualization
- Inter + JetBrains Mono loaded from Google Fonts CDN
