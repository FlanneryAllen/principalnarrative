# GitHub Workflow Files

Due to OAuth permissions, these workflow files need to be added manually to your repository:

## How to Add:

1. **Via GitHub Web Interface** (Recommended):
   - Go to https://github.com/FlanneryAllen/principalnarrative
   - Click on "Actions" tab
   - Click "New workflow"
   - Click "set up a workflow yourself"
   - Copy and paste each workflow file content

2. **Via Git with proper authentication**:
   - Clone the repo with SSH or a personal access token with `workflow` scope
   - Add the workflow files
   - Commit and push

## Files to Add:

1. `.github/workflows/ci-cd.yml` - Main CI/CD pipeline
2. `.github/workflows/dependabot-auto-merge.yml` - Auto-merge Dependabot PRs
3. `.github/dependabot.yml` - Dependabot configuration

The workflow files are in this directory ready to be copied.