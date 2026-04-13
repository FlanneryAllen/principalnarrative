#!/bin/bash

# Demo: Unified Intent Engineering System
# Shows both layers working together end-to-end

echo "🎬 Intent Engineering - Unified System Demo"
echo ""
echo "This demonstrates:"
echo "  1. Markdown files (human-editable source)"
echo "  2. Sync to database (automatic conversion)"
echo "  3. Agent queries (machine-readable runtime)"
echo "  4. Code validation (enforcement)"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Show markdown files
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 1: View Organizational Context (Markdown)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

echo "📄 Vision & Mission (.principalnarrative/applied-narrative/vision.md):"
head -n 30 .principalnarrative/applied-narrative/vision.md | grep -A 3 "Mission Statement"
echo ""

echo "📄 Brand Voice (.principalnarrative/applied-narrative/brand-voice.md):"
head -n 50 .principalnarrative/applied-narrative/brand-voice.md | grep -A 5 "Technical but Accessible"
echo ""

read -p "Press Enter to continue..."
echo ""

# Step 2: Sync markdown → database
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 2: Sync Markdown → Intent Database${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "packages/integrations/dist/sync-cli.js" ]; then
    node packages/integrations/dist/sync-cli.js sync
else
    echo -e "${YELLOW}⚠ Sync tool not built. Run: npm run build in packages/integrations${NC}"
fi

echo ""
read -p "Press Enter to continue..."
echo ""

# Step 3: Query intent
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 3: Agent Queries Intent${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "packages/sdk/dist/intent-client.js" ]; then
    echo "Running: client.queryIntent({ operation: 'writing code' })"
    echo ""

    # Create a quick test script
    cat > /tmp/test-query.js << 'EOF'
const { IntentClient } = require('./packages/sdk/dist/intent-client');

async function test() {
  const client = new IntentClient('.narrative/intent.db');

  const stats = await client.getStats();
  console.log('📊 Database Stats:');
  console.log('   Total units:', stats.total);
  console.log('   By type:', stats.byType);
  console.log('');

  const intent = await client.queryIntent({
    operation: 'writing code',
    context: {}
  });

  if (intent.intentChain.length > 0) {
    console.log('📋 Intent Chain:');
    intent.intentChain.forEach(i => {
      console.log(`   [${i.type}] ${i.assertion.substring(0, 60)}...`);
    });
  } else {
    console.log('No intent found for "writing code"');
    console.log('(Try querying with different keywords)');
  }

  client.close();
}

test().catch(console.error);
EOF

    node /tmp/test-query.js
    rm /tmp/test-query.js
else
    echo -e "${YELLOW}⚠ SDK not built. Run: npm run build in packages/sdk${NC}"
fi

echo ""
read -p "Press Enter to continue..."
echo ""

# Step 4: Show the unified architecture
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 4: Unified Architecture${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

echo "┌────────────────────────────────────────────────────┐"
echo "│  LAYER 1: Applied Narrative                        │"
echo "│  (Human-Editable Markdown)                         │"
echo "│                                                     │"
echo "│  .principalnarrative/applied-narrative/            │"
echo "│  ├── vision.md          (mission, values)          │"
echo "│  ├── brand-voice.md     (communication)            │"
echo "│  └── priorities.md      (goals, OKRs)              │"
echo "└────────────────────────────────────────────────────┘"
echo "                      ↓"
echo "            narrative-sync (automatic)"
echo "                      ↓"
echo "┌────────────────────────────────────────────────────┐"
echo "│  LAYER 2: Intent Engineering                       │"
echo "│  (Machine-Queryable Database)                      │"
echo "│                                                     │"
echo "│  .narrative/intent.db                              │"
echo "│  ├── Intent units                                  │"
echo "│  ├── DAG validation                                │"
echo "│  ├── Fast queries                                  │"
echo "│  └── Pre-commit validation                         │"
echo "└────────────────────────────────────────────────────┘"
echo ""

# Step 5: Summary
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Demo Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo ""

echo "What you've seen:"
echo ""
echo "1. ✅ Markdown files are human-friendly, Git-native source of truth"
echo "2. ✅ Sync tool converts markdown → intent units automatically"
echo "3. ✅ Agents query database for fast, structured access"
echo "4. ✅ One system, two complementary storage layers"
echo ""

echo "Next steps:"
echo ""
echo "• Edit markdown files: vim .principalnarrative/applied-narrative/vision.md"
echo "• Sync changes: node packages/integrations/dist/sync-cli.js sync"
echo "• Query intent: import { IntentClient } from '@narrative/sdk'"
echo "• Validate code: npx narrative-validate"
echo ""

echo "📚 Documentation:"
echo "   README.md                        - Quick start"
echo "   README_INTENT_ENGINEERING.md     - Technical guide"
echo ""
