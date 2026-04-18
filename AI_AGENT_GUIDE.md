# Using Narrative Intelligence with AI Agents

**How AI coding agents query organizational narrative before generating code**

---

## Overview

Narrative Intelligence provides a **queryable database of organizational narrative** that AI agents can use to align their actions with your organization's values, constraints, and requirements.

**Think of it as**: "System prompts, but structured and queryable"

---

## Quick Example: Before and After

### ❌ Without Narrative Intelligence

```python
# AI Agent receives vague prompt
system_prompt = "You are a helpful coding assistant. Write secure code."

# Agent generates code based on general best practices
def authenticate(username, password):
    # Seems reasonable to the agent
    token = base64.b64encode(f"{username}:{password}".encode())
    return token
```

**Problem**: Agent doesn't know your org requires OAuth 2.0, forbids basic auth, mandates audit logging.

### ✅ With Narrative Intelligence

```python
# AI Agent queries organizational narrative BEFORE generating code
from narrative_sdk import NarrativeClient

client = NarrativeClient('.narrative/narrative.db')

# Query what the org wants for this operation
narrative = client.query_narrative(
    operation='writing authentication code',
    context={'tags': ['security', 'patient-data']}
)

# narrative.constraints returns:
# {
#   'code': {
#     'required_patterns': ['oauth2', 'mfa', 'audit_logging'],
#     'forbidden_patterns': ['localStorage', 'basic_auth', 'console.log'],
#     'required_libraries': ['passport', 'jsonwebtoken']
#   }
# }

# Agent generates code ALIGNED with organizational narrative
def authenticate(username, password, mfa_code):
    audit_log('auth_attempt', username)  # ✅ Required

    # ✅ Uses OAuth2 (required)
    user = verify_oauth2_credentials(username, password)

    # ✅ MFA verification (required)
    if not verify_mfa(user, mfa_code):
        audit_log('mfa_failed', username)
        raise AuthenticationError('MFA verification failed')

    # ✅ JWT with expiration (per validation rules)
    token = jwt.sign({'user_id': user.id}, SECRET, expires_in='1h')

    audit_log('auth_success', username)  # ✅ Required
    return token
```

**Result**: Code automatically aligns with organizational narrative.

---

## Step-by-Step Integration Guide

### 1. Install the SDK

**TypeScript/JavaScript:**
```bash
npm install @narrative/sdk
```

**Python:**
```bash
pip install narrative-sdk
```

### 2. Initialize the Client

**TypeScript:**
```typescript
import { NarrativeClient } from '@narrative/sdk';

const client = new NarrativeClient('.narrative/narrative.db');
```

**Python:**
```python
from narrative_sdk import NarrativeClient

client = NarrativeClient('.narrative/narrative.db')
```

### 3. Query Before Acting

**Basic Query:**
```python
# Agent is about to generate authentication code
result = client.query_narrative(
    operation='writing authentication code'
)

print(result['narrativeChain'])
# ['We build HIPAA-compliant healthcare infrastructure',
#  'All authentication must use OAuth 2.0 with MFA']

print(result['constraints']['code']['forbidden_patterns'])
# ['localStorage', 'basic_auth', 'console.log', 'eval']
```

**Query with Context (Recommended):**
```python
# More specific query with tags
result = client.query_narrative(
    operation='writing authentication code',
    context={
        'tags': ['security', 'patient-data'],
        'file_path': 'src/auth/login.ts'
    }
)

# Returns constraints specific to healthcare + security context
```

### 4. Use Constraints to Guide Generation

```python
constraints = result['constraints']['code']

# Check what's required
if 'oauth2' in constraints['required_patterns']:
    # Must use OAuth 2.0
    pass

# Check what's forbidden
if 'localStorage' in constraints['forbidden_patterns']:
    # Cannot use localStorage
    pass

# Check required libraries
if 'jsonwebtoken' in constraints['required_libraries']:
    # Must use this library
    pass
```

### 5. Generate Aligned Code

```python
def generate_auth_code(narrative_result):
    """Generate authentication code that aligns with organizational narrative"""

    constraints = narrative_result['constraints']['code']
    required = constraints.get('required_patterns', [])
    forbidden = constraints.get('forbidden_patterns', [])

    code_parts = []

    # Add required patterns
    if 'audit_logging' in required:
        code_parts.append("audit_log('auth_attempt', user_id)")

    if 'oauth2' in required:
        code_parts.append("token = oauth2_client.get_token(credentials)")

    if 'mfa' in required:
        code_parts.append("verify_mfa(user, mfa_code)")

    # Avoid forbidden patterns
    if 'localStorage' not in forbidden:
        # Can use localStorage if not forbidden
        pass

    return '\n'.join(code_parts)
```

---

## Real-World Agent Integration Patterns

### Pattern 1: Agentic Code Generation (Claude, GPT-4, etc.)

```python
class NarrativeAwareAgent:
    def __init__(self, narrative_db_path):
        self.narrative_client = NarrativeClient(narrative_db_path)
        self.llm = AnthropicClient()  # or OpenAI, etc.

    def generate_code(self, task, file_path):
        # Step 1: Query organizational narrative
        narrative = self.narrative_client.query_narrative(
            operation=f'writing code for {task}',
            context={'file_path': file_path}
        )

        # Step 2: Build context-aware prompt
        system_prompt = self._build_prompt(narrative)

        # Step 3: Generate code with LLM
        code = self.llm.generate(
            system=system_prompt,
            user=f"Implement: {task}"
        )

        # Step 4: Validate against narrative
        violations = self._validate(code, narrative)

        if violations:
            # Regenerate with violation feedback
            code = self._fix_violations(code, violations)

        return code

    def _build_prompt(self, narrative):
        """Build LLM system prompt from narrative"""
        prompt = "You are a code generation assistant.\n\n"

        # Add organizational context
        prompt += "ORGANIZATIONAL NARRATIVE:\n"
        for item in narrative['narrativeChain']:
            prompt += f"- {item['assertion']}\n"

        # Add code constraints
        constraints = narrative['constraints'].get('code', {})

        if constraints.get('required_patterns'):
            prompt += "\nREQUIRED PATTERNS (must include):\n"
            for pattern in constraints['required_patterns']:
                prompt += f"- {pattern}\n"

        if constraints.get('forbidden_patterns'):
            prompt += "\nFORBIDDEN PATTERNS (never use):\n"
            for pattern in constraints['forbidden_patterns']:
                prompt += f"- {pattern}\n"

        if constraints.get('required_libraries'):
            prompt += "\nREQUIRED LIBRARIES (must use):\n"
            for lib in constraints['required_libraries']:
                prompt += f"- {lib}\n"

        return prompt
```

**Usage:**
```python
agent = NarrativeAwareAgent('.narrative/narrative.db')

code = agent.generate_code(
    task="Add user authentication",
    file_path="src/auth/login.ts"
)

print(code)
# Generated code automatically includes:
# - OAuth 2.0 (required)
# - Audit logging (required)
# - No localStorage (forbidden)
# - JWT tokens (required library)
```

### Pattern 2: Pre-Flight Checks

```python
def before_generating_code(operation, context):
    """Check narrative before generating any code"""

    # Query narrative
    narrative = client.query_narrative(
        operation=operation,
        context=context
    )

    # Extract constraints
    constraints = narrative['constraints']['code']

    # Return guidance for agent
    return {
        'allowed': True,
        'must_include': constraints.get('required_patterns', []),
        'must_avoid': constraints.get('forbidden_patterns', []),
        'use_libraries': constraints.get('required_libraries', []),
        'narrative_context': narrative['narrativeChain']
    }

# Before generating
guidance = before_generating_code(
    operation='writing API endpoint',
    context={'tags': ['api', 'patient-data']}
)

if 'rate_limiting' in guidance['must_include']:
    # Generate with rate limiting
    pass
```

### Pattern 3: Post-Generation Validation

```python
from narrative_sdk import NarrativeValidator

def after_generating_code(code, operation, context):
    """Validate generated code against narrative"""

    # Write code to temp file
    with open('temp.ts', 'w') as f:
        f.write(code)

    # Validate
    validator = NarrativeValidator('.narrative/narrative.db')
    result = validator.validate(
        files=['temp.ts'],
        operation=operation,
        tags=context.get('tags', [])
    )

    if result['violations']:
        return {
            'valid': False,
            'violations': result['violations'],
            'suggestions': [v['suggestion'] for v in result['violations']]
        }

    return {'valid': True}

# After generating
code = generate_code(...)
validation = after_generating_code(
    code=code,
    operation='writing authentication code',
    context={'tags': ['security']}
)

if not validation['valid']:
    print("Violations found:")
    for v in validation['violations']:
        print(f"  - {v['message']}")
        print(f"    Suggestion: {v['suggestion']}")
```

### Pattern 4: Iterative Refinement

```python
def generate_with_refinement(task, max_iterations=3):
    """Generate code and iteratively refine based on violations"""

    # Query narrative
    narrative = client.query_narrative(
        operation=f'writing code for {task}',
        context={'tags': extract_tags(task)}
    )

    code = None
    for i in range(max_iterations):
        # Generate code
        if code is None:
            code = initial_generation(task, narrative)
        else:
            # Regenerate with violation feedback
            code = refine_generation(code, violations)

        # Validate
        violations = validate_code(code, narrative)

        if not violations:
            return code  # Success!

        print(f"Iteration {i+1}: {len(violations)} violations, refining...")

    raise Exception(f"Could not generate valid code after {max_iterations} iterations")
```

---

## Common Agent Workflows

### Workflow 1: New Feature Development

```python
# 1. Agent receives task
task = "Add MFA support to login"

# 2. Query narrative for context
narrative = client.query_narrative(
    operation='adding authentication feature',
    context={'tags': ['auth', 'security', 'mfa']}
)

# 3. Check if MFA is required
required = narrative['constraints']['code']['required_patterns']
if 'mfa' in required:
    print("✅ MFA is required by organizational narrative")

# 4. Check which MFA libraries are approved
libraries = narrative['constraints']['code'].get('required_libraries', [])
if 'speakeasy' in libraries:
    print("✅ Use speakeasy for TOTP")

# 5. Generate implementation
code = generate_mfa_code(
    required_patterns=required,
    approved_libraries=libraries
)

# 6. Validate before committing
validation = validate_code(code, narrative)
if validation['valid']:
    save_code(code)
```

### Workflow 2: Bug Fix with Constraints

```python
# 1. Agent identifies bug in authentication
bug = "Users can bypass MFA"

# 2. Query narrative for security constraints
narrative = client.query_narrative(
    operation='fixing security bug in authentication',
    context={'tags': ['security', 'auth', 'bugfix']}
)

# 3. Check constraints
constraints = narrative['constraints']['code']

# 4. Generate fix that maintains compliance
fix = generate_fix(
    bug=bug,
    must_include=constraints['required_patterns'],
    must_avoid=constraints['forbidden_patterns']
)

# 5. Validate fix doesn't violate narrative
if validate_fix(fix, narrative):
    apply_fix(fix)
```

### Workflow 3: Code Review Agent

```python
def review_pull_request(pr_files):
    """Agent reviews PR against organizational narrative"""

    violations = []

    for file in pr_files:
        # Query narrative for this file's context
        narrative = client.query_narrative(
            operation='reviewing code changes',
            context={
                'file_path': file['path'],
                'tags': infer_tags(file)
            }
        )

        # Check for violations
        file_violations = check_violations(
            file['content'],
            narrative['constraints']
        )

        violations.extend(file_violations)

    if violations:
        post_review_comment(
            "❌ Found violations of organizational narrative:\n" +
            "\n".join(f"- {v['message']}" for v in violations)
        )
    else:
        approve_pr("✅ Aligned with organizational narrative")
```

---

## Advanced: Multi-Context Queries

Different parts of your codebase may have different constraints:

```python
# Frontend code (user-facing)
frontend_narrative = client.query_narrative(
    operation='writing frontend component',
    context={'tags': ['frontend', 'ui', 'patient-facing']}
)
# Returns: Professional tone, accessibility required, no medical jargon

# Backend code (API)
backend_narrative = client.query_narrative(
    operation='writing API endpoint',
    context={'tags': ['backend', 'api', 'patient-data']}
)
# Returns: OAuth required, audit logging, encryption at rest

# DevOps code (infrastructure)
devops_narrative = client.query_narrative(
    operation='writing deployment script',
    context={'tags': ['devops', 'infrastructure']}
)
# Returns: HIPAA-compliant regions, encryption in transit, audit trails
```

---

## Integration with Popular Agent Frameworks

### LangChain

```python
from langchain.tools import Tool
from narrative_sdk import NarrativeClient

client = NarrativeClient('.narrative/narrative.db')

narrative_tool = Tool(
    name="QueryOrganizationalNarrative",
    func=lambda q: client.query_narrative(operation=q),
    description="Query organizational narrative and constraints before writing code"
)

# Add to agent
agent = create_agent(
    tools=[narrative_tool, ...],
    llm=llm
)
```

### AutoGPT

```python
# Add narrative query to agent's commands
class NarrativeCommand(Command):
    def execute(self, operation):
        narrative = client.query_narrative(operation=operation)
        return narrative['constraints']

# Agent can now query narrative before acting
```

### CrewAI

```python
from crewai import Agent, Task

narrative_aware_agent = Agent(
    role='Narrative-Aware Developer',
    goal='Write code that aligns with organizational narrative',
    backstory='Always queries narrative before generating code',
    tools=[query_narrative_tool]
)
```

---

## Best Practices

### 1. Always Query Before Generating

```python
# ❌ Bad: Generate blindly
code = generate_code(task)

# ✅ Good: Query first
narrative = client.query_narrative(operation=task)
code = generate_code(task, constraints=narrative['constraints'])
```

### 2. Use Specific Tags

```python
# ❌ Vague
narrative = client.query_narrative(operation='writing code')

# ✅ Specific
narrative = client.query_narrative(
    operation='writing authentication code',
    context={'tags': ['security', 'patient-data', 'oauth']}
)
```

### 3. Validate After Generating

```python
# Always validate
code = generate_code(...)
violations = validate_code(code, narrative)

if violations:
    # Fix or regenerate
    code = fix_violations(code, violations)
```

### 4. Include Narrative Chain in LLM Context

```python
# Give LLM the "why" behind constraints
system_prompt = f"""
Organizational Context:
{format_narrative_chain(narrative['narrativeChain'])}

You must follow these constraints because they reflect our organizational values.
"""
```

---

## Example: Full Agent Implementation

See `packages/python-sdk/examples/ai_agent_integration.py` for a complete working example of a narrative-aware AI coding agent.

**Key features:**
- ✅ Queries narrative before generating code
- ✅ Builds context-aware system prompts
- ✅ Validates output against constraints
- ✅ Iteratively refines based on violations
- ✅ Provides explanations for why certain patterns are required/forbidden

---

## Troubleshooting

### "No narrative units found"

```python
# Check if database is seeded
stats = client.get_stats()
print(f"Total units: {stats['total']}")

# If 0, seed the database
# Run: node scripts/seed-database.js
```

### "Query returns empty constraints"

```python
# Try more generic operation
narrative = client.query_narrative(
    operation='writing code',  # More generic
    context={'tags': ['backend']}
)

# Or check what units exist
units = client.query_units(filters={})
print(f"Available units: {[u['id'] for u in units]}")
```

### "Validation too strict"

```python
# Use failOnWarning=False for warnings
result = validator.validate(
    files=['src/code.ts'],
    failOnWarning=False  # Only fail on errors
)
```

---

## Next Steps

1. **Read the Python SDK docs**: `packages/python-sdk/README.md`
2. **Try the example agent**: `packages/python-sdk/examples/ai_agent_integration.py`
3. **Seed your database**: `node scripts/seed-database.js`
4. **Query your narrative**: `./narrative` → "Query Narrative"
5. **Build your agent**: Use patterns from this guide

---

## Questions?

- **Examples**: See `examples/` directory
- **API Docs**: See `README_INTENT_ENGINEERING.md`
- **Python SDK**: See `packages/python-sdk/README.md`
- **Issues**: File on GitHub

---

**Remember**: The goal is alignment, not restriction. Narrative Intelligence helps agents understand what your organization values, not just what code compiles.
