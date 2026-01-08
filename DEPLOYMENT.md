# Production Deployment Guide

Complete guide for deploying Principal Narrative Agent v2 to production environments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Security Configuration](#security-configuration)
4. [Deployment Options](#deployment-options)
5. [Post-Deployment](#post-deployment)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Disk: 20GB SSD
- OS: Linux (Ubuntu 20.04+), macOS 11+, Windows Server 2019+

**Recommended for Production:**
- CPU: 4+ cores
- RAM: 8GB+
- Disk: 50GB+ SSD
- OS: Ubuntu 22.04 LTS

### Software Dependencies

```bash
# Python 3.9+
python --version  # Should be 3.9 or higher

# Git
git --version

# System libraries (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y \
    python3-dev \
    python3-pip \
    python3-venv \
    build-essential \
    libssl-dev \
    libffi-dev \
    git

# For PDF export (optional)
sudo apt-get install -y \
    libgobject-2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0
```

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/narrative-agentv2.git
cd narrative-agentv2
```

### 2. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt

# Install Playwright browsers (for JavaScript rendering)
playwright install
```

### 4. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env  # or vim, code, etc.
```

**Required Environment Variables:**

```bash
# AI Features
ANTHROPIC_API_KEY=sk-ant-api03-...  # From console.anthropic.com

# Application
API_BASE_URL=https://your-domain.com
ENVIRONMENT=production
LOG_LEVEL=INFO

# Security
API_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
JWT_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
CORS_ORIGINS=https://your-frontend.com

# Database
DATABASE_PATH=data/narrative.db
NARRATIVE_PATH=applied-narrative
```

**Optional but Recommended:**

```bash
# Slack Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#drift-alerts

# Email Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@yourdomain.com
SMTP_PASSWORD=your-app-password

# GitHub Integration
GITHUB_TOKEN=ghp_...
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
ENABLE_METRICS=true
```

---

## Security Configuration

### 1. Generate Secure Keys

```bash
# API Key
python -c "import secrets; print('API_KEY=' + secrets.token_urlsafe(32))" >> .env

# JWT Secret
python -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(32))" >> .env

# Webhook Secret
python -c "import secrets; print('GITHUB_WEBHOOK_SECRET=' + secrets.token_urlsafe(32))" >> .env
```

### 2. Enable Rate Limiting

Add to .env:
```bash
RATE_LIMIT=60  # requests per minute
RATE_LIMIT_BURST=10  # burst capacity
```

### 3. Configure CORS

```bash
# Allow specific origins only
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Never use * in production!
```

### 4. Enable HTTPS

**Using Nginx (Recommended):**

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. Secure File Permissions

```bash
chmod 600 .env
chmod 700 data/
chmod 644 applied-narrative/**/*.md
```

---

## Deployment Options

### Option 1: Systemd Service (Recommended for Linux)

#### Create Service File

```bash
sudo nano /etc/systemd/system/narrative-api.service
```

```ini
[Unit]
Description=Principal Narrative API
After=network.target

[Service]
Type=simple
User=narrative
WorkingDirectory=/opt/narrative-agentv2
Environment="PATH=/opt/narrative-agentv2/venv/bin"
ExecStart=/opt/narrative-agentv2/venv/bin/uvicorn src.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    --log-level info
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable narrative-api
sudo systemctl start narrative-api
sudo systemctl status narrative-api
```

### Option 2: Docker Deployment

#### Build Image

```bash
docker build -t narrative-api:latest .
```

#### Run Container

```bash
docker run -d \
    --name narrative-api \
    -p 8000:8000 \
    -v $(pwd)/data:/app/data \
    -v $(pwd)/applied-narrative:/app/applied-narrative \
    -v $(pwd)/.env:/app/.env \
    --restart unless-stopped \
    narrative-api:latest
```

#### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./applied-narrative:/app/applied-narrative
      - ./.env:/app/.env
    restart: unless-stopped
    environment:
      - ENVIRONMENT=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Option 3: Kubernetes Deployment

See `k8s/` directory for complete Kubernetes manifests.

```bash
kubectl apply -f k8s/
```

---

## Post-Deployment

### 1. Verify Deployment

```bash
# Health check
curl https://your-domain.com/health

# Expected response
{
  "status": "healthy",
  "version": "1.0.0",
  "narrative_path": "/app/applied-narrative",
  "narrative_exists": true
}
```

### 2. Test API Endpoints

```bash
# List repositories
curl -H "X-API-Key: your_api_key" \
    https://your-domain.com/multi-repo/repositories

# Run drift scan
curl -X POST -H "X-API-Key: your_api_key" \
    https://your-domain.com/coherence/scan?include_semantic=true
```

### 3. Set Up Monitoring

#### Enable Prometheus Metrics

Add to .env:
```bash
ENABLE_METRICS=true
METRICS_PORT=9090
```

Access metrics at: `https://your-domain.com/metrics`

#### Configure Sentry

```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

### 4. Configure Alerts

```bash
# Test Slack integration
curl -X POST -H "Content-Type: application/json" \
    -d '{"text": "Test alert from Narrative API"}' \
    $SLACK_WEBHOOK_URL

# Create alert rule
curl -X POST -H "X-API-Key: your_api_key" \
    -H "Content-Type: application/json" \
    https://your-domain.com/alerts/rules \
    -d '{
      "name": "High Severity Drift",
      "min_severity": "high",
      "channels": ["slack"],
      "enabled": true
    }'
```

### 5. Initial Data Setup

```bash
# Register your first repository
curl -X POST -H "X-API-Key: your_api_key" \
    -H "Content-Type: application/json" \
    https://your-domain.com/multi-repo/register \
    -d '{
      "name": "main-app",
      "type": "service",
      "mode": "central",
      "description": "Main application",
      "owner_team": "engineering",
      "owner_contact": "team@example.com"
    }'

# Run initial drift scan
curl -X POST -H "X-API-Key: your_api_key" \
    https://your-domain.com/coherence/scan?include_semantic=true
```

---

## Monitoring & Maintenance

### Logs

```bash
# Systemd service logs
sudo journalctl -u narrative-api -f

# Docker logs
docker logs -f narrative-api

# Log files
tail -f logs/narrative-api.log
```

### Performance Monitoring

```bash
# CPU and memory usage
htop

# API response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com/health

# Database size
du -sh data/narrative.db
```

### Backup Strategy

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf backups/narrative-$DATE.tar.gz \
    data/ \
    applied-narrative/ \
    .env

# Keep last 30 days
find backups/ -name "narrative-*.tar.gz" -mtime +30 -delete
```

### Updates

```bash
# Pull latest code
git pull origin main

# Restart service
sudo systemctl restart narrative-api

# Or reload without downtime (if using workers)
kill -HUP $(cat /var/run/narrative-api.pid)
```

---

## Troubleshooting

### Common Issues

#### 1. API Not Starting

**Error:** `ModuleNotFoundError: No module named 'X'`

**Solution:**
```bash
source venv/bin/activate
pip install -r requirements.txt
```

#### 2. WeasyPrint Errors

**Error:** `OSError: cannot load library 'libgobject-2.0-0'`

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get install libgobject-2.0-0 libpango-1.0-0

# macOS (or disable PDF export)
brew install pango gobject-introspection

# Or disable in .env
ENABLE_PDF_EXPORT=false
```

#### 3. AI Features Not Working

**Error:** `AI conflict resolver unavailable`

**Solution:**
```bash
# Check API key is set
grep ANTHROPIC_API_KEY .env

# Verify key is valid
curl https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01"
```

#### 4. Rate Limiting Too Aggressive

**Symptom:** Legitimate requests getting 429 errors

**Solution:**
```bash
# Increase limits in .env
RATE_LIMIT=120  # 120 requests per minute
RATE_LIMIT_BURST=20  # Allow bursts of 20
```

#### 5. Database Locked Errors

**Error:** `database is locked`

**Solution:**
```bash
# SQLite doesn't support high concurrency well
# Consider Redis for caching (future enhancement)
# For now, reduce concurrent workers:
--workers 2  # Instead of 4
```

### Debug Mode

```bash
# Enable detailed logging
LOG_LEVEL=DEBUG

# Run with reload for development
uvicorn src.main:app --reload --log-level debug
```

### Getting Help

- **Documentation:** See README.md, ARCHITECTURE.md, API docs at `/docs`
- **Issues:** https://github.com/your-org/narrative-agentv2/issues
- **Support:** team@yourdomain.com

---

## Production Checklist

Before going live, ensure:

- [ ] Environment variables configured (.env)
- [ ] ANTHROPIC_API_KEY set
- [ ] Secure API_KEY and JWT_SECRET generated
- [ ] HTTPS enabled with valid SSL certificate
- [ ] CORS configured for your domains only
- [ ] Rate limiting enabled
- [ ] Database backup strategy in place
- [ ] Monitoring and alerting configured
- [ ] Log rotation configured
- [ ] Firewall rules configured
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Drift scan runs successfully
- [ ] Multi-repo registration works
- [ ] Documentation reviewed by team

---

## Performance Tuning

### Recommended Settings for Production

```bash
# Workers (CPU cores * 2 + 1)
--workers 4

# Timeout for long-running operations
REQUEST_TIMEOUT=300

# Cache settings
CACHE_TTL=86400  # 24 hours

# Batch processing
BATCH_CONCURRENCY=5

# Database connection pool
DB_POOL_SIZE=20
```

### Expected Performance

- API Response Time: <100ms (health, simple queries)
- Drift Scan: ~2-5s for 50 documents
- Multi-Repo Scan: ~2-10s depending on repository count
- AI Resolution: ~3-10s per drift event (depends on Claude API)

---

## Security Best Practices

1. **Never commit .env** - Add to .gitignore
2. **Rotate keys regularly** - Every 90 days
3. **Use strong passwords** - For SMTP, database, etc.
4. **Enable audit logging** - Track all API access
5. **Regular updates** - Keep dependencies current
6. **Penetration testing** - Before major releases
7. **Principle of least privilege** - Minimal permissions
8. **Encrypt sensitive data** - At rest and in transit

---

## Cost Optimization

### Anthropic API Usage

- **Drift Detection:** Free (pattern-based)
- **AI Resolution:** ~$0.02-0.05 per event with Claude Sonnet 4
- **Batch Processing:** Efficient to process multiple events together

**Estimated Monthly Costs:**
- Small team (10 repos, 100 drift events/month): ~$5-10
- Medium team (50 repos, 500 drift events/month): ~$25-50
- Large org (200 repos, 2000 drift events/month): ~$100-200

### Infrastructure Costs

**Minimal Setup:**
- VPS: $5-10/month (DigitalOcean, Linode)
- Domain + SSL: $12-20/year

**Production Setup:**
- VPS: $20-40/month
- Monitoring (Sentry): $26/month
- Backups: $5/month
- Total: ~$50-75/month

---

This deployment guide should get you up and running in production. For questions or issues, please refer to the troubleshooting section or open an issue on GitHub.

**Happy deploying! 🚀**
