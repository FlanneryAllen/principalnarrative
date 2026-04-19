# CI/CD Pipeline Documentation

## Overview

This repository uses GitHub Actions for continuous integration and deployment. The pipeline includes:

- **Code Quality**: ESLint, TypeScript compilation
- **Testing**: Multi-version Node.js testing
- **Security**: npm audit, secret scanning
- **Docker**: Multi-platform container builds
- **Deployment**: Staging (GitHub Pages) and Production (Vercel)

## Workflow Files

### 1. Main CI/CD Pipeline (`ci-cd.yml`)

The comprehensive pipeline that runs on every push and pull request.

#### Jobs:

1. **Lint** - Runs ESLint and checks for console.log statements
2. **Build** - Compiles TypeScript and uploads artifacts
3. **Test** - Runs tests on Node 18.x and 20.x
4. **Security** - Performs security audits and secret scanning
5. **Docker** - Builds and pushes multi-platform images to GitHub Container Registry
6. **Deploy-Staging** - Deploys to GitHub Pages from `develop` branch
7. **Deploy-Production** - Deploys to Vercel from `main` branch
8. **Release** - Creates GitHub releases for tagged commits

### 2. Legacy CI Pipeline (`ci.yml`)

The original pipeline kept for backward compatibility.

### 3. Dependabot Auto-Merge (`dependabot-auto-merge.yml`)

Automatically approves and merges patch dependency updates from Dependabot.

## Environments

### Staging
- **Branch**: `develop`
- **URL**: GitHub Pages (auto-generated)
- **Deployment**: Automatic on push

### Production
- **Branch**: `main`
- **URL**: https://narrativeagent.ai
- **Deployment**: Automatic on push
- **Platform**: Vercel

## Required Secrets

Configure these secrets in your GitHub repository settings:

### Vercel Deployment
- `VERCEL_TOKEN` - Your Vercel API token
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

### Docker (Optional)
- GitHub token is automatically provided for GitHub Container Registry

## Local Development

### Using Docker

```bash
# Start development server
docker-compose up

# Run tests
docker-compose --profile test up

# Run linting
docker-compose --profile lint up

# Build production image
docker build -t narrative-agent:prod .
```

### Without Docker

```bash
# Install dependencies
npm ci

# Run linting
npm run lint

# Build TypeScript
npm run build

# Run tests
npm test

# Start development server
npm run serve
```

## Deployment Process

### Automatic Deployment

1. **Feature Development**
   - Create feature branch from `develop`
   - Make changes and push
   - CI runs tests and checks
   - Create PR to `develop`

2. **Staging Deployment**
   - Merge PR to `develop`
   - Automatically deploys to GitHub Pages
   - Test in staging environment

3. **Production Deployment**
   - Create PR from `develop` to `main`
   - Merge after review
   - Automatically deploys to Vercel

### Manual Release

1. Tag the commit:
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

2. GitHub Actions will:
   - Build artifacts
   - Create GitHub release
   - Push Docker images with version tags

## Docker Registry

Images are published to GitHub Container Registry:

```bash
# Pull latest image
docker pull ghcr.io/flanneryallen/narrative-agentv2:main

# Pull specific version
docker pull ghcr.io/flanneryallen/narrative-agentv2:v1.0.0
```

## Security Features

1. **Dependency Scanning**
   - Dependabot enabled for automatic updates
   - Weekly security audits
   - Auto-merge for patch updates

2. **Code Scanning**
   - Secret detection in code
   - Console.log detection
   - Security headers in Vercel deployment

3. **Container Security**
   - Multi-stage builds for minimal attack surface
   - Non-root user in production
   - Health checks

## Monitoring

### Build Status
Check workflow runs at: `https://github.com/FlanneryAllen/narrative-agentv2/actions`

### Deployment Status
- Staging: Check GitHub Pages settings
- Production: Check Vercel dashboard

## Troubleshooting

### Failed Builds

1. Check TypeScript errors:
   ```bash
   npm run build
   ```

2. Check ESLint errors:
   ```bash
   npm run lint
   ```

3. Check test failures:
   ```bash
   npm test
   ```

### Failed Deployments

1. **Vercel**: Ensure secrets are configured correctly
2. **GitHub Pages**: Check repository settings for Pages configuration
3. **Docker**: Ensure you have package write permissions

## Performance Optimizations

1. **Caching**: Node modules cached between runs
2. **Parallel Jobs**: Independent jobs run in parallel
3. **Docker Layer Caching**: Uses GitHub Actions cache
4. **Multi-platform Builds**: AMD64 and ARM64 support

## Best Practices

1. Always create feature branches from `develop`
2. Keep `main` branch protected
3. Use conventional commit messages
4. Tag releases with semantic versioning
5. Review security alerts promptly
6. Test locally before pushing

## Support

For issues or questions:
1. Check GitHub Actions logs
2. Review this documentation
3. Create an issue in the repository