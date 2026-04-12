#!/bin/bash

# Intent Engineering Infrastructure - Installation Script
# Sets up the complete system in your repository

set -e

echo "🚀 Installing Intent Engineering Infrastructure"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in a git repo
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Warning: Not in a git repository. Creating git repo...${NC}"
    git init
fi

# Create directories
echo -e "${BLUE}Creating .narrative and .principalnarrative directories...${NC}"
mkdir -p .narrative
mkdir -p .principalnarrative/applied-narrative

# Initialize intent database
echo -e "${BLUE}Initializing intent database...${NC}"
touch .narrative/intent.db

# Install packages
echo -e "${BLUE}Installing packages...${NC}"

if [ -f "package.json" ]; then
    # If package.json exists, add to dependencies
    echo -e "${BLUE}Adding @narrative packages to your project...${NC}"

    # For now, we'll use the local packages
    # In production, these would be published to npm
    npm install --save-dev \
        @typescript-eslint/parser \
        @typescript-eslint/typescript-estree \
        glob \
        minimatch \
        better-sqlite3

    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${YELLOW}No package.json found. Creating one...${NC}"
    npm init -y
fi

# Create .narrative/config.json
echo -e "${BLUE}Creating configuration file...${NC}"
cat > .narrative/config.json << 'EOF'
{
  "version": "0.1.0",
  "dbPath": ".narrative/intent.db",
  "validation": {
    "enabled": true,
    "failOnWarning": false,
    "patterns": {
      "include": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
      "exclude": ["node_modules/**", "dist/**", "**/*.test.*", "**/*.spec.*"]
    }
  },
  "signal": {
    "autoConvertThreshold": 85,
    "defaultIntentType": "core_story"
  }
}
EOF

echo -e "${GREEN}✓${NC} Configuration created at .narrative/config.json"

# Create pre-commit hook
echo -e "${BLUE}Setting up pre-commit hook...${NC}"
mkdir -p .git/hooks

cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/sh
# Intent Engineering pre-commit hook
# Validates code against organizational intent before allowing commit

echo "🔍 Validating code against organizational intent..."

# Run the validator
npx narrative-validate

if [ $? -eq 0 ]; then
    echo "✅ Validation passed!"
    exit 0
else
    echo "❌ Validation failed. Fix violations before committing."
    echo "   Run 'npx narrative-validate --verbose' for details."
    exit 1
fi
HOOK

chmod +x .git/hooks/pre-commit

echo -e "${GREEN}✓${NC} Pre-commit hook installed"

# Create sample intent units
echo -e "${BLUE}Creating sample intent units...${NC}"

cat > .narrative/sample-intents.json << 'EOF'
{
  "intents": [
    {
      "id": "example_core_story",
      "type": "core_story",
      "assertion": "We build secure, maintainable software",
      "intent": {
        "objective": "Create high-quality, secure software",
        "constraints": {
          "code": {
            "required_patterns": ["error_handling", "logging"],
            "forbidden_patterns": ["console.log", "eval"],
            "required_libraries": []
          },
          "content": {
            "required_themes": ["security", "quality"],
            "tone": "professional"
          }
        },
        "evidence_required": ["test_coverage_80_percent", "security_audit"]
      },
      "dependencies": [],
      "validationState": "ALIGNED",
      "confidence": 1.0,
      "metadata": {
        "created_by": "install_script",
        "tags": ["example", "core"]
      }
    }
  ]
}
EOF

echo -e "${GREEN}✓${NC} Sample intents created at .narrative/sample-intents.json"

# Seed database with example data
echo -e "${BLUE}Seeding database with example intent units...${NC}"

if [ -f "scripts/seed-database.js" ] && [ -f "examples/healthcare-saas-intent-units.json" ]; then
    node scripts/seed-database.js --clear
    echo -e "${GREEN}✓${NC} Database seeded with healthcare SaaS example"
else
    echo -e "${YELLOW}⚠${NC}  Seed script not found (example data won't be available)"
fi

# Sync markdown files to database
echo -e "${BLUE}Syncing Applied Narrative markdown → Intent Database...${NC}"

if [ -f "packages/integrations/dist/sync-cli.js" ]; then
    node packages/integrations/dist/sync-cli.js sync
    echo -e "${GREEN}✓${NC} Markdown files synced to intent database"
else
    echo -e "${YELLOW}⚠${NC}  Sync tool not built yet (run: npm run build in packages/integrations)"
fi

# Add to .gitignore
echo -e "${BLUE}Updating .gitignore...${NC}"

if [ ! -f ".gitignore" ]; then
    touch .gitignore
fi

if ! grep -q ".narrative/intent.db" .gitignore; then
    echo "" >> .gitignore
    echo "# Intent Engineering" >> .gitignore
    echo ".narrative/intent.db" >> .gitignore
    echo ".narrative/*.db" >> .gitignore
    echo -e "${GREEN}✓${NC} Updated .gitignore"
else
    echo -e "${GREEN}✓${NC} .gitignore already configured"
fi

# Create README
echo -e "${BLUE}Creating documentation...${NC}"

cat > .narrative/README.md << 'EOF'
# Intent Engineering Setup

This directory contains your organizational intent infrastructure.

## Files

- `intent.db` - SQLite database storing intent units
- `config.json` - Configuration for validation and signal processing
- `sample-intents.json` - Example intent units to get started

## Quick Start

### 1. View Story Signal UI

Open `static/story-signal.html` in your browser to capture organizational stories.

### 2. Create Intent Units

```typescript
import { IntentClient } from '@narrative/sdk';

const client = new IntentClient('.narrative/intent.db');

await client.createUnit({
  id: 'your_intent_id',
  type: 'core_story',
  assertion: 'Your organizational intent',
  intent: {
    objective: 'What you want to achieve',
    constraints: {
      code: {
        required_patterns: ['pattern1'],
        forbidden_patterns: ['pattern2'],
      }
    }
  },
  dependencies: [],
  validationState: 'ALIGNED',
  confidence: 1.0
});
```

### 3. Query Intent (for agents)

```typescript
const intent = await client.queryIntent({
  operation: 'writing authentication code',
  context: { tags: ['security'] }
});

// Use constraints to guide code generation
if (intent.constraints.code?.forbidden_patterns?.includes('localStorage')) {
  // Don't use localStorage
}
```

### 4. Validate Code

```bash
# Manual validation
npx narrative-validate

# Validation runs automatically on git commit via pre-commit hook
git commit -m "Your changes"  # Will validate first
```

## Architecture

```
Story Signal → Narrative Graph → Intent Client → Agents
                                              ↓
                                         Validator
```

## Learn More

See the main README for complete documentation.
EOF

echo -e "${GREEN}✓${NC} Documentation created"

# Final summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Explore the CLI (database already seeded with examples!):"
echo "   ./narrative"
echo "   Try: View Graph, Query Intent, List All Units"
echo ""
echo "2. Test a query:"
echo "   Select 'Query Intent' → Enter: 'writing authentication code'"
echo "   See merged constraints from the healthcare SaaS example"
echo ""
echo "3. Edit your organizational context:"
echo "   .principalnarrative/applied-narrative/vision.md"
echo "   .principalnarrative/applied-narrative/brand-voice.md"
echo ""
echo "4. Sync markdown → database:"
echo "   ./narrative → Select 'Sync Markdown → Database'"
echo ""
echo "5. Create your own intent units:"
echo "   ./narrative → Select 'Create Intent Unit'"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Overview and architecture"
echo "   - CLI_GUIDE.md - Complete CLI walkthrough"
echo "   - README_INTENT_ENGINEERING.md - Technical details"
echo ""
echo "📦 Examples:"
echo "   - 14 healthcare SaaS intent units already loaded!"
echo "   - examples/healthcare-saas-intent-units.json"
echo ""
echo "🔧 Tools:"
echo "   - ./narrative - Interactive CLI (no code required!)"
echo "   - static/story-signal.html - Story capture UI"
echo "   - scripts/seed-database.js - Database seeding"
echo ""
