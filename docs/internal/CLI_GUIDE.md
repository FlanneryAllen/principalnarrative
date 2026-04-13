# Narrative Intelligence CLI - Quick Start Guide

**Interactive command-line interface for Narrative Intelligence Infrastructure**

No code required! Manage your organizational narrative entirely from the command line.

---

## Installation

```bash
# From repository root
cd narrative-agentv2

# Make CLI executable
chmod +x ./narrative

# Run CLI
./narrative
```

---

## Features

### 📝 Create Intent Unit (Interactive)
Create narrative units through guided prompts - no JSON required!

```bash
# Run CLI and select "Create Intent Unit"
./narrative

# You'll be prompted for:
# - Unit ID (snake_case identifier)
# - Intent Type (core_story, operational, etc.)
# - Assertion (what is this unit claiming?)
# - Objective (what does the org want?)
# - Constraints (code patterns, content rules)
# - Dependencies (which units does this depend on?)
```

**Example Flow:**
```
📝 Create Intent Unit

? Unit ID (snake_case): operational_auth_mfa
? Intent Type: Operational (execution)
? Assertion: All authentication must include multi-factor authentication
? Objective: Ensure secure user authentication with MFA
? Add constraints? Yes
? What type of constraints? Code Constraints
? Required patterns: mfa, two_factor, totp
? Forbidden patterns: password_only, basic_auth
? Required libraries: speakeasy, qrcode
? Does this depend on other narrative units? Yes
? Select dependencies: core_story_security

✅ Intent unit created successfully!
```

---

### 🔍 Query Intent (Agent Simulation)
See what constraints an agent would receive for an operation.

```bash
#Run CLI and select "Query Intent"
./narrative

# Example queries:
# - "writing authentication code"
# - "creating marketing content"
# - "designing API endpoints"
# - "implementing encryption"
```

**Example Output:**
```
🔍 Query Intent

? What operation are you performing? writing authentication code
? Add context tags? Yes
? Tags: security, authentication

✅ Query complete!

📋 Intent Chain:
  [core_story] We build secure, compliant software
  [operational] All authentication must include MFA

🔒 Code Constraints:
  Required patterns: audit_logging, mfa, two_factor
  Forbidden patterns: localStorage, password_only
  Required libraries: speakeasy, jsonwebtoken

📊 Evidence Required:
  - test_coverage_90_percent
  - security_audit_passed
```

---

### 📊 View Graph (Visualization)
See the dependency structure of your narrative units.

```bash
# Select "View Graph" from main menu
```

**Example Output:**
```
Intent Graph Visualization:

CORE STORY:
  • core_story_security [2 dependents]
    "We build secure, compliant software that protects user data..."

OPERATIONAL:
  • operational_auth_mfa (depends on: core_story_security) [1 dependent]
    "All authentication must include multi-factor authentication..."
  • operational_encryption (depends on: core_story_security)
    "All data must be encrypted at rest and in transit..."

COMMUNICATION:
  • communication_security_messaging (depends on: core_story_security)
    "When discussing security, emphasize trust and compliance..."

Graph Statistics:
  Total units: 4
  Root units (no dependencies): 1
  Leaf units (no dependents): 2
```

---

### 📋 List All Units (Table View)
Quick overview of all narrative units in a table.

```bash
# Select "List All Units"
```

**Example Output:**
```
┌──────────────────────────┬────────────┬──────────────────────────┬─────────┬──────┐
│ ID                       │ Type       │ Assertion                │ State   │ Deps │
├──────────────────────────┼────────────┼──────────────────────────┼─────────┼──────┤
│ core_story_security      │ core_story │ We build secure, com...  │ ALIGNED │ 0    │
│ operational_auth_mfa     │ operational│ All authentication mu... │ ALIGNED │ 1    │
│ operational_encryption   │ operational│ All data must be encr... │ ALIGNED │ 1    │
│ communication_security...│ communica..│ When discussing secur... │ ALIGNED │ 1    │
└──────────────────────────┴────────────┴──────────────────────────┴─────────┴──────┘
```

---

### 🎯 Capture Story Signal (5 R's Framework)
Score organizational stories and auto-convert to narrative units.

```bash
# Select "Capture Story Signal"
```

**Example Flow:**
```
🎯 Capture Story Signal
Use the 5 R's framework to score organizational stories

? Story or insight: We need to prioritize security over speed to market
? Source: meeting://leadership-retreat
? Resonance (0-20): 18
? Relevance (0-20): 20
? Rarity (0-20): 12
? Relatability (0-20): 17
? Risk/Reward (0-20): 19

📊 Total Score: 86/100
✨ High-value signal! Auto-converting to intent unit...

✅ Created intent unit: signal_we_need_to_prioritize_security_over_speed_to_mar_abc123
```

---

### 🔄 Sync Markdown → Database
Sync `.principalnarrative/applied-narrative/` markdown files to the narrative database.

```bash
# Select "Sync Markdown → Database"
```

**Example Output:**
```
🔄 Sync Markdown → Database

✅ Sync complete!

📊 Results:
  Created: 3
  Updated: 2
  Unchanged: 0
```

**Files Synced:**
- `vision.md` → `applied_narrative_vision_vision`
- `brand-voice.md` → `applied_narrative_brandVoice_brand_voice`
- `priorities.md` → `applied_narrative_priorities_priorities`

---

### ✅ Validate Code
Run pre-commit validation against organizational narrative.

```bash
# Select "Validate Code"
```

**Example Output:**
```
✅ Validate Code

✅ Validation passed!

📊 Results:
  Files checked: 42
  Violations: 0
  Errors: 0
  Warnings: 0
```

**If violations found:**
```
❌ Validation failed

📊 Results:
  Files checked: 42
  Violations: 3
  Errors: 2
  Warnings: 1

❌ Violations:
  src/auth.ts:15
    Forbidden pattern "localStorage" detected
    💡 Use httpOnly cookies or secure session storage instead

  src/api.ts:42
    Required pattern "audit_logging" not found
    💡 Add audit logging to implement organizational narrative
```

---

### 📈 Show Statistics
View intent graph and story signal statistics.

```bash
# Select "Show Statistics"
```

**Example Output:**
```
📈 Statistics

Intent Graph:
  Total units: 8

  By Type:
    core_story: 2
    operational: 3
    communication: 2
    positioning: 1

  By Validation State:
    ALIGNED: 7
    DRIFTED: 1
    BROKEN: 0

Story Signals:
  Total converted: 3
  Average score: 87.33/100
  Highest score: 92/100
  Lowest score: 82/100
```

---

### 🔧 Manage Units
View details, update states, delete units, or export to JSON.

```bash
# Select "Manage Units"
```

**Actions:**
1. **View Unit Details** - See full JSON of intent unit
2. **Update Validation State** - Change ALIGNED/DRIFTED/BROKEN/UNKNOWN
3. **Delete Unit** - Remove unit (checks for dependents first)
4. **Export Unit (JSON)** - Save unit to file

**Example - Update Validation State:**
```
🔧 Manage Units

? What would you like to do? Update Validation State
? Select unit: operational_auth_mfa (operational)
? New validation state: DRIFTED

✅ Updated operational_auth_mfa to DRIFTED
```

---

## Common Workflows

### Workflow 1: Create New Product Feature Intent

```bash
./narrative

# 1. Create core story (if doesn't exist)
Select: Create Intent Unit
  ID: core_story_feature_quality
  Type: Core Story
  Assertion: All features must be thoroughly tested before release
  Objective: Maintain high quality standards

# 2. Create operational intent that depends on it
Select: Create Intent Unit
  ID: operational_testing_coverage
  Type: Operational
  Assertion: All new features must have 90% test coverage
  Dependencies: core_story_feature_quality
  Constraints:
    Required patterns: test, coverage, spec

# 3. Query to verify
Select: Query Intent
  Operation: writing feature code
  → See merged constraints from chain
```

### Workflow 2: Import Existing Markdown to Database

```bash
# 1. Edit markdown files
vim .principalnarrative/applied-narrative/vision.md
vim .principalnarrative/applied-narrative/brand-voice.md

# 2. Sync to database
./narrative
Select: Sync Markdown → Database

# 3. View results
Select: View Graph
→ See markdown-sourced units in graph

# 4. Query to verify
Select: Query Intent
  Operation: writing code
  → See constraints from vision.md and brand-voice.md
```

### Workflow 3: Validate Before Commit

```bash
# 1. Write code
vim src/feature.ts

# 2. Run validation
./narrative
Select: Validate Code

# 3. If violations, fix them
vim src/feature.ts

# 4. Validate again
Select: Validate Code
→ ✅ Validation passed

# 5. Commit
git commit -m "Add feature"
```

---

## Tips & Tricks

### Quick Navigation
- Use arrow keys to navigate menus
- Press Enter to select
- Type to filter long lists

### Creating Related Units
- Start with core_story units (strategic intent)
- Add operational units that depend on them
- Create communication units for messaging
- Build dependency chains from top to bottom

### Best Practices
1. **Use descriptive IDs**: `operational_auth_oauth` not `op1`
2. **Add dependencies**: Connect units to show intent flow
3. **Be specific with constraints**: `audit_logging` not `logging`
4. **Sync regularly**: Keep markdown and database in sync
5. **Validate often**: Catch violations early

### Keyboard Shortcuts (in menus)
- `j/k` or arrow keys: Navigate
- `Enter`: Select
- `Ctrl+C`: Exit/Cancel
- `/`: Search (in long lists)

---

## Troubleshooting

### "No narrative units found"
**Problem**: Query returns no results

**Solution**:
1. Check if database has units: Select "List All Units"
2. If empty, create units or sync markdown
3. Try different keywords in query

### "Cannot delete unit: X units depend on it"
**Problem**: Trying to delete a unit with dependents

**Solution**:
1. View graph to see dependents
2. Delete dependent units first (bottom-up)
3. Or update dependencies to remove the link

### CLI won't start
**Problem**: Permission or path issues

**Solution**:
```bash
chmod +x ./narrative
npm run build  # in packages/cli
```

---

## Advanced Usage

### Export All Units
```bash
# From CLI, select Manage Units → Export for each unit
# Or use direct API:
const client = new IntentClient();
const units = client.graph.getAllUnits();
fs.writeFileSync('backup.json', JSON.stringify(units, null, 2));
```

### Batch Create Units
```bash
# Create JSON file with multiple units
# Use CLI to import or write script:
const client = new IntentClient();
units.forEach(u => client.createUnit(u));
```

### Integrate with Git Hooks
```bash
# .git/hooks/pre-commit
#!/bin/sh
./narrative --validate || exit 1
```

---

## Next Steps

1. **Start with core stories**: Create 2-3 strategic narrative units
2. **Add operational details**: Create specific implementation units
3. **Sync existing docs**: Import vision.md and brand-voice.md
4. **Test queries**: Simulate agent queries for different operations
5. **Validate code**: Run validation on your codebase

---

## Reference

**CLI Location:** `./narrative` (repository root)

**Database:** `.narrative/narrative.db`

**Config:** `.narrative/config.json`

**Markdown Source:** `.principalnarrative/applied-narrative/`

**Documentation:**
- README.md - Overview
- README_INTENT_ENGINEERING.md - Technical guide
- This file - CLI guide

---

**Questions? Issues?**

See README.md for full documentation or file an issue at the repository.

---

**"No code required. Just organizational narrative, made machine-readable."**
