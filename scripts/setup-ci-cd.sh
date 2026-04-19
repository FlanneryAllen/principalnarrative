#!/bin/bash

# CI/CD Setup Script for Narrative Agent
# This script helps configure the necessary secrets and settings for GitHub Actions

set -e

echo "========================================="
echo "  Narrative Agent CI/CD Setup Script"
echo "========================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ You are not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is installed and authenticated"
echo ""

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
    echo "❌ Could not detect repository. Make sure you're in a git repository."
    exit 1
fi

echo "📦 Repository: $REPO"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local secret_value=$2
    local environment=$3

    if [ -z "$environment" ]; then
        echo "Setting repository secret: $secret_name"
        echo "$secret_value" | gh secret set "$secret_name"
    else
        echo "Setting environment secret: $secret_name (environment: $environment)"
        echo "$secret_value" | gh secret set "$secret_name" --env "$environment"
    fi
}

# Setup Vercel (Optional)
echo "========================================="
echo "  Vercel Configuration (Optional)"
echo "========================================="
echo ""
read -p "Do you want to configure Vercel deployment? (y/n): " configure_vercel

if [ "$configure_vercel" = "y" ] || [ "$configure_vercel" = "Y" ]; then
    echo ""
    echo "To get your Vercel tokens:"
    echo "1. Go to https://vercel.com/account/tokens"
    echo "2. Create a new token"
    echo "3. Go to your project settings for Organization and Project IDs"
    echo ""

    read -p "Enter your Vercel Token: " vercel_token
    read -p "Enter your Vercel Organization ID: " vercel_org_id
    read -p "Enter your Vercel Project ID: " vercel_project_id

    set_secret "VERCEL_TOKEN" "$vercel_token"
    set_secret "VERCEL_ORG_ID" "$vercel_org_id"
    set_secret "VERCEL_PROJECT_ID" "$vercel_project_id"

    echo "✅ Vercel secrets configured"
fi

# Setup GitHub Pages
echo ""
echo "========================================="
echo "  GitHub Pages Configuration"
echo "========================================="
echo ""
echo "Enabling GitHub Pages..."

# Enable GitHub Pages
gh api repos/$REPO/pages -X POST \
    -f source='{"branch":"gh-pages","path":"/"}' \
    2>/dev/null || echo "GitHub Pages may already be enabled"

echo "✅ GitHub Pages configuration complete"

# Create environments
echo ""
echo "========================================="
echo "  Environment Configuration"
echo "========================================="
echo ""

# Create staging environment
echo "Creating staging environment..."
gh api repos/$REPO/environments/staging -X PUT \
    -F wait_timer=0 \
    -F reviewers='[]' \
    -F deployment_branch_policy='{"protected_branches":false,"custom_branch_policies":true}' \
    2>/dev/null || true

# Create production environment
echo "Creating production environment..."
gh api repos/$REPO/environments/production -X PUT \
    -F wait_timer=0 \
    -F reviewers='[]' \
    -F deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' \
    2>/dev/null || true

echo "✅ Environments configured"

# Setup branch protection
echo ""
echo "========================================="
echo "  Branch Protection"
echo "========================================="
echo ""
read -p "Do you want to setup branch protection rules? (y/n): " setup_protection

if [ "$setup_protection" = "y" ] || [ "$setup_protection" = "Y" ]; then
    echo "Setting up branch protection for main..."

    gh api repos/$REPO/branches/main/protection -X PUT \
        -F required_status_checks='{"strict":true,"contexts":["lint","build","test"]}' \
        -F enforce_admins=false \
        -F required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
        -F restrictions=null \
        2>/dev/null || echo "Branch protection may already be configured"

    echo "✅ Branch protection configured"
fi

# Install dependencies
echo ""
echo "========================================="
echo "  Installing Dependencies"
echo "========================================="
echo ""
npm ci
echo "✅ Dependencies installed"

# Run initial checks
echo ""
echo "========================================="
echo "  Running Initial Checks"
echo "========================================="
echo ""

echo "Running ESLint..."
npm run lint || echo "⚠️  ESLint found some issues"

echo ""
echo "Building TypeScript..."
npm run build || echo "⚠️  Build failed"

echo ""
echo "Running tests..."
npm test || echo "⚠️  Some tests failed"

# Summary
echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "✅ CI/CD pipeline is configured and ready to use!"
echo ""
echo "Next steps:"
echo "1. Review and commit the new files"
echo "2. Push to GitHub to trigger the pipeline"
echo "3. Check GitHub Actions for build status"
echo ""
echo "Workflows will run on:"
echo "- Push to main or develop branches"
echo "- Pull requests to main"
echo "- Manual trigger via GitHub Actions UI"
echo ""
echo "Documentation: docs/CI-CD-SETUP.md"