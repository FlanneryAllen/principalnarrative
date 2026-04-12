# Narrative Intelligence - 5-Minute Quick Start

**Get from zero to your first intent query in 5 minutes**

## What You'll Do

1. Install the system (1 min)
2. Explore the pre-loaded healthcare SaaS example (2 min)
3. Make your first intent query (2 min)

---

## Step 1: Install (1 minute)

```bash
# Clone or navigate to the repository
cd narrative-agentv2

# Run install script
./install.sh
```

**What just happened?**
- Created `.narrative/` directory with SQLite database
- Created `.principalnarrative/` directory for markdown files
- **Seeded database with 14 healthcare SaaS example narrative units**
- Set up pre-commit validation hook
- Made `./narrative` CLI executable

---

## Step 2: Explore Examples (2 minutes)

Launch the interactive CLI:

```bash
./narrative
```

You'll see:
```
┌─────────────────────────────────────────────┐
│                                             │
│   Narrative Intelligence Infrastructure         │
│   Interactive CLI                           │
│                                             │
└─────────────────────────────────────────────┘

? What would you like to do? (Use arrow keys)
  📝 Create Intent Unit
  🔍 Query Intent
  📊 View Graph
❯ 📋 List All Units
  🎯 Capture Story Signal
  🔄 Sync Markdown → Database
  ✅ Validate Code
  📈 Show Statistics
  🔧 Manage Units
  ❌ Exit
```

### Try: View Graph

Select **"📊 View Graph"** to see the dependency structure:

```
Intent Graph Visualization:

CORE STORY:
  • core_story_healthcare_trust [5 dependents]
    "We build the most trusted healthcare data infrastructure..."

  • core_story_developer_experience [4 dependents]
    "We make healthcare data accessible through elegant APIs..."

OPERATIONAL:
  • operational_authentication_oauth (depends on: core_story_healthcare_trust)
    "All API authentication must use OAuth 2.0 with refresh tokens..."

  • operational_data_encryption (depends on: core_story_healthcare_trust)
    "All patient data must be encrypted at rest using AES-256..."

[... 10 more units ...]

Graph Statistics:
  Total units: 14
  Root units: 2
  Leaf units: 3
```

### Try: List All Units

Select **"📋 List All Units"** to see a table:

```
┌──────────────────────────┬─────────────┬──────────────────────────┬─────────┬──────┐
│ ID                       │ Type        │ Assertion                │ State   │ Deps │
├──────────────────────────┼─────────────┼──────────────────────────┼─────────┼──────┤
│ core_story_healthcare... │ core_story  │ We build the most tru... │ ALIGNED │ 0    │
│ operational_auth_oauth   │ operational │ All API authenticatio... │ ALIGNED │ 1    │
│ operational_encryption   │ operational │ All patient data must... │ ALIGNED │ 1    │
└──────────────────────────┴─────────────┴──────────────────────────┴─────────┴──────┘
```

---

## Step 3: Query Intent (2 minutes)

This is what AI agents do - they query intent before acting.

### Run Your First Query

1. From the main menu, select **"🔍 Query Intent"**

2. When prompted:
   ```
   ? What operation are you performing?
   ```
   Enter: **`writing authentication code`**

3. When asked "Add context tags?", select **Yes**

4. Enter tags: **`security, authentication`**

5. Watch the results:

```
✅ Query complete!

📋 Intent Chain (5 units in dependency order):
  [core_story] We build the most trusted healthcare data infrastructure...
  [core_story] We make healthcare data accessible through elegant APIs...
  [operational] All API authentication must use OAuth 2.0 with refresh tokens...
  [operational] All API errors must return standard HTTP codes...
  [communication] All developer-facing content must include working code examples...

🔒 Code Constraints:
  Required patterns:
    • audit_logging
    • encryption_at_rest
    • encryption_in_transit
    • oauth2
    • refresh_token
    • mfa_support
    • jwt_signing
    • request_id
    • error_code
    • error_message

  Forbidden patterns:
    • console.log
    • localStorage
    • eval
    • basic_auth
    • api_keys_in_url
    • password_storage_plaintext
    • generic_500_error

  Required libraries:
    • @aws-sdk/client-kms
    • bcrypt
    • passport
    • jsonwebtoken
    • @types/passport

📊 Evidence Required:
  • SOC2_Type_II_certification
  • HIPAA_compliance_audit
  • auth_test_coverage_95_percent
  • oauth_flow_documented
  • error_documentation_complete
```

**What just happened?**

The query system:
1. Found 5 narrative units relevant to "authentication"
2. Built complete dependency chains for each
3. Merged constraints from all units in the chain
4. Returned consolidated requirements

An AI agent would use these constraints to:
- ✅ Include audit logging
- ✅ Use OAuth 2.0 with MFA
- ✅ Require @aws-sdk/client-kms
- ❌ Never use localStorage or console.log
- ❌ Never store passwords in plaintext

---

## What's Next?

### Create Your Own Intent Units

1. From CLI, select **"📝 Create Intent Unit"**
2. Follow the wizard (no code required!)
3. Example:

```
? Unit ID: operational_testing_coverage
? Intent Type: Operational (execution)
? Assertion: All features must have 90% test coverage
? Objective: Ensure high code quality
? Add constraints? Yes
? Required patterns: test, spec, coverage
? Forbidden patterns: skip, only
? Dependencies: (select from existing units)
```

### Edit Markdown Files

Edit your organization's vision:

```bash
vim .principalnarrative/applied-narrative/vision.md
```

Then sync to database:

```bash
./narrative
# Select: "🔄 Sync Markdown → Database"
```

### Validate Your Code

Run validation manually:

```bash
./narrative
# Select: "✅ Validate Code"
```

Or commit (validation runs automatically via pre-commit hook):

```bash
git add .
git commit -m "Add feature"
# → Validation runs automatically
```

---

## Real-World Use Cases

### For Product Teams
```
Query: "creating user-facing content"
→ Returns: brand voice, tone guidelines, forbidden themes
```

### For Backend Developers
```
Query: "implementing API endpoint"
→ Returns: versioning rules, rate limits, error handling patterns
```

### For Security Teams
```
Query: "handling patient data"
→ Returns: encryption requirements, audit logging, compliance rules
```

### For AI Coding Agents
```typescript
// Before generating code, agent queries intent
const intent = await client.queryIntent({
  operation: 'writing authentication code',
  context: { file_path: 'src/auth/login.ts' }
});

// Use constraints to guide generation
if (intent.constraints.code.forbidden_patterns.includes('localStorage')) {
  // Don't generate code using localStorage
}

if (intent.constraints.code.required_patterns.includes('audit_logging')) {
  // Include audit logging in generated code
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Applied Narrative (Human-Editable Source)         │
│ .principalnarrative/applied-narrative/*.md                  │
│ - vision.md, brand-voice.md, priorities.md                 │
│ - Git-native, markdown, human-friendly                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ narrative-sync (one-way)
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Narrative Intelligence (Machine-Queryable Cache)      │
│ .narrative/narrative.db (SQLite)                              │
│ - Narrative units with constraints, validation rules          │
│ - DAG structure with dependency chains                     │
│ - Fast queries for AI agents                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ client.queryIntent()
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ AI Agents / Developers / Validators                        │
│ - Query before acting                                      │
│ - Receive merged constraints                               │
│ - Align actions with organizational narrative                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Intent Units
Composable primitives that capture organizational narrative:
- **Core Story**: Strategic narrative (e.g., "We prioritize security over speed")
- **Operational**: Execution requirements (e.g., "Use OAuth 2.0 for auth")
- **Communication**: Messaging guidelines (e.g., "Professional tone, no jargon")
- **Evidence**: Proof of alignment (e.g., "SOC2 certified")

### Dependency Chains
Narrative units can depend on others:
```
core_story_security
  ↓
operational_auth_oauth
  ↓
operational_audit_logging
```

When you query for "auth", you get constraints from **entire chain**.

### Merged Constraints
Multiple units contribute to final constraints:
- Unit A requires: `["oauth2", "mfa"]`
- Unit B requires: `["audit_logging"]`
- **Merged**: `["oauth2", "mfa", "audit_logging"]`

---

## Troubleshooting

### "No narrative units found" in query
- Check database: Select "📋 List All Units"
- If empty, run: `node scripts/seed-database.js`
- Try different keywords in query

### CLI won't start
```bash
chmod +x ./narrative
npm run build  # in packages/cli if needed
```

### Want to start fresh
```bash
# Clear database and re-seed
node scripts/seed-database.js --clear
```

---

## Next Steps

1. **Read CLI_GUIDE.md** - Complete CLI feature walkthrough
2. **Read README.md** - Full architecture and philosophy
3. **Read README_INTENT_ENGINEERING.md** - Technical implementation details
4. **Explore examples/** - More sample narrative units
5. **Build your own** - Start capturing your org's intent!

---

**Congratulations! You just:**
- ✅ Installed Narrative Intelligence Infrastructure
- ✅ Explored pre-loaded healthcare SaaS examples
- ✅ Made your first intent query
- ✅ Saw how constraints merge across dependency chains

**Ready to capture your organization's intent?**

Run `./narrative` and select "📝 Create Intent Unit" to get started!
