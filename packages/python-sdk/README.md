# Narrative SDK for Python

**Intent Engineering SDK for Python - Query organizational intent for AI agents**

[![Python Version](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What Is This?

The Python SDK for Intent Engineering allows AI agents to query organizational intent before taking actions.

**Instead of vague system prompts:**
```python
# ❌ Vague, inconsistent
prompt = "You are a helpful assistant. Write secure code."
```

**Query structured organizational intent:**
```python
# ✅ Structured, consistent, machine-readable
from narrative_sdk import IntentClient

client = IntentClient('.narrative/intent.db')

result = client.query_intent(
    operation='writing authentication code',
    context={'tags': ['security', 'authentication']}
)

# Returns:
# - Required patterns: ['audit_logging', 'oauth2', 'mfa_support']
# - Forbidden patterns: ['localStorage', 'basic_auth']
# - Required libraries: ['jsonwebtoken', 'passport']
# - Evidence required: ['test_coverage_95_percent', 'security_audit']
```

---

## Installation

```bash
# From the Python SDK directory
pip install -e .

# Or with development dependencies
pip install -e ".[dev]"
```

---

## Quick Start

### 1. Initialize Client

```python
from narrative_sdk import IntentClient

# Connect to your intent database
client = IntentClient('.narrative/intent.db')

# Or use as context manager
with IntentClient('.narrative/intent.db') as client:
    # Use client
    result = client.query_intent('writing code')
```

### 2. Query Intent

```python
# Query what the organization wants
result = client.query_intent(
    operation='writing authentication code',
    context={'tags': ['security']}
)

# Result contains:
print(result['intentChain'])      # List of relevant intent units
print(result['constraints'])       # Merged constraints from chain
print(result['validationRules'])   # Validation rules to apply
print(result['evidenceRequired'])  # Evidence needed to prove alignment
```

### 3. Use Constraints to Guide Actions

```python
# Extract code constraints
code = result['constraints'].get('code', {})

# Check what's required
if 'oauth2' in code.get('required_patterns', []):
    # Must use OAuth 2.0
    pass

# Check what's forbidden
if 'localStorage' in code.get('forbidden_patterns', []):
    # Don't use localStorage
    pass

# Check required libraries
libraries = code.get('required_libraries', [])
# Install/import these libraries
```

---

## Real-World Examples

### AI Coding Agent

```python
from narrative_sdk import IntentClient

class AICodeAgent:
    def __init__(self):
        self.intent_client = IntentClient('.narrative/intent.db')

    def generate_code(self, user_request: str) -> str:
        # 1. Query organizational intent
        result = self.intent_client.query_intent(
            operation='writing authentication code',
            context={'user_request': user_request}
        )

        # 2. Extract constraints
        constraints = result['constraints'].get('code', {})
        required = constraints.get('required_patterns', [])
        forbidden = constraints.get('forbidden_patterns', [])

        # 3. Generate code aligned with constraints
        code = self._generate_with_constraints(
            required=required,
            forbidden=forbidden
        )

        return code
```

### Content Generation Agent

```python
result = client.query_intent(
    operation='writing marketing content',
    context={'tags': ['marketing', 'communication']}
)

# Get content constraints
content = result['constraints'].get('content', {})

tone = content.get('tone')  # e.g., 'professional'
required_themes = content.get('required_themes', [])  # e.g., ['trust', 'security']
forbidden_themes = content.get('forbidden_themes', [])  # e.g., ['fear_mongering']

# Generate content with these constraints
```

### API Development Agent

```python
result = client.query_intent(
    operation='creating API endpoint',
    context={'tags': ['api', 'backend']}
)

code = result['constraints'].get('code', {})

# API must include:
# - Versioning (e.g., /api/v1/resource)
# - Rate limiting
# - Error handling with request IDs
# - Standard HTTP status codes
```

---

## API Reference

### `IntentClient`

Main class for querying organizational intent.

#### `__init__(db_path: str = '.narrative/intent.db')`

Initialize client with path to SQLite database.

#### `query_intent(operation: str, context: dict = None) -> QueryResult`

Query organizational intent for an operation.

**Args:**
- `operation` (str): What you're doing (e.g., "writing auth code")
- `context` (dict, optional): Additional context (tags, file paths, etc.)

**Returns:**
- `QueryResult` with:
  - `intentChain`: List of relevant intent units
  - `constraints`: Merged constraints (code/content)
  - `validationRules`: Rules to validate against
  - `evidenceRequired`: Proof needed for alignment

**Example:**
```python
result = client.query_intent(
    operation='writing authentication code',
    context={'tags': ['security'], 'file_path': 'src/auth.py'}
)
```

#### `get_stats() -> GraphStats`

Get statistics about the intent graph.

**Returns:**
- `GraphStats` with:
  - `total`: Total number of units
  - `byType`: Count by intent type
  - `byValidation`: Count by validation state

#### `get_all_units() -> List[IntentUnit]`

Get all intent units in the database.

#### `close()`

Close database connection.

---

## Type Definitions

### Intent Types

```python
IntentType = Literal[
    'core_story',          # Strategic narrative
    'positioning',         # Market positioning
    'product_narrative',   # Product stories
    'operational',         # Execution requirements
    'evidence',            # Proof of alignment
    'communication'        # Messaging guidelines
]
```

### Validation States

```python
ValidationState = Literal[
    'ALIGNED',   # Code/content aligns with intent
    'DRIFTED',   # Minor drift from intent
    'BROKEN',    # Major violations
    'UNKNOWN'    # Not yet validated
]
```

### QueryResult

```python
class QueryResult(TypedDict):
    intentChain: List[IntentChainItem]
    constraints: Constraints
    validationRules: List[ValidationRule]
    evidenceRequired: List[str]
```

### Constraints

```python
class Constraints(TypedDict):
    code: CodeConstraints       # Code-specific constraints
    content: ContentConstraints # Content-specific constraints
```

### CodeConstraints

```python
class CodeConstraints(TypedDict):
    required_patterns: List[str]     # Patterns that must be present
    forbidden_patterns: List[str]    # Patterns that must not be present
    required_libraries: List[str]    # Libraries that must be used
    validation_rules: List[ValidationRule]
```

### ContentConstraints

```python
class ContentConstraints(TypedDict):
    required_themes: List[str]    # Themes that must be present
    forbidden_themes: List[str]   # Themes to avoid
    tone: str                     # Tone (e.g., 'professional')
    target_audience: str          # Target audience
```

---

## Running Examples

### Basic Usage

```bash
cd packages/python-sdk
python examples/basic_usage.py
```

Output shows:
- Querying intent for different operations
- Extracting constraints
- Graph statistics

### AI Agent Integration

```bash
python examples/ai_agent_integration.py
```

Output shows:
- AI agent receiving user request
- Querying organizational intent
- Generating code with constraints
- Validating generated code

---

## Running Tests

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=narrative_sdk

# Run specific test
pytest tests/test_client.py::test_query_intent_authentication
```

Or run tests directly:

```bash
python tests/test_client.py
```

---

## Development

### Setup Development Environment

```bash
# Install in editable mode with dev dependencies
pip install -e ".[dev]"

# Run type checking
mypy narrative_sdk/

# Format code
black narrative_sdk/ tests/ examples/
```

### Project Structure

```
packages/python-sdk/
├── narrative_sdk/           # Main package
│   ├── __init__.py         # Package exports
│   ├── client.py           # IntentClient class
│   └── types.py            # Type definitions
├── examples/               # Usage examples
│   ├── basic_usage.py
│   └── ai_agent_integration.py
├── tests/                  # Test suite
│   └── test_client.py
├── setup.py                # Package setup
└── README.md               # This file
```

---

## Use Cases

### 1. AI Coding Assistants
Query intent before generating code to ensure organizational alignment.

### 2. Content Generation
Query content constraints (tone, themes) before writing marketing materials.

### 3. API Development
Ensure APIs follow organizational standards (versioning, auth, error handling).

### 4. Security Automation
Enforce security patterns (encryption, audit logging, MFA) automatically.

### 5. Compliance Checking
Validate that actions meet regulatory requirements (HIPAA, SOC2, etc.).

---

## Integration with AI Frameworks

### LangChain

```python
from langchain import LLM
from narrative_sdk import IntentClient

client = IntentClient('.narrative/intent.db')

# Before LLM call, query intent
result = client.query_intent(operation='writing code')

# Add constraints to LLM prompt
prompt = f"""
Write authentication code with these constraints:
- Required patterns: {result['constraints']['code']['required_patterns']}
- Forbidden patterns: {result['constraints']['code']['forbidden_patterns']}
- Required libraries: {result['constraints']['code']['required_libraries']}
"""

llm.generate(prompt)
```

### OpenAI API

```python
import openai
from narrative_sdk import IntentClient

client = IntentClient('.narrative/intent.db')

result = client.query_intent(operation='writing authentication code')

response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": f"You must follow these constraints: {result['constraints']}"},
        {"role": "user", "content": "Write a login function"}
    ]
)
```

### Anthropic Claude

```python
import anthropic
from narrative_sdk import IntentClient

client = IntentClient('.narrative/intent.db')

result = client.query_intent(operation='writing code')

message = anthropic_client.messages.create(
    model="claude-3-opus-20240229",
    system=f"Follow these organizational constraints: {result['constraints']}",
    messages=[{"role": "user", "content": "Write auth code"}]
)
```

---

## Why Python SDK?

1. **Most AI agents use Python** - OpenAI, Anthropic, LangChain, AutoGPT, etc.
2. **Same database as TypeScript** - Shares `.narrative/intent.db` with TypeScript SDK
3. **Zero external dependencies** - Uses built-in `sqlite3` module
4. **Type-safe** - Full TypedDict support for type checking
5. **Easy integration** - Drop into existing AI agent workflows

---

## Comparison: TypeScript vs Python SDK

| Feature | TypeScript SDK | Python SDK |
|---------|---------------|------------|
| Intent querying | ✅ | ✅ |
| Constraint extraction | ✅ | ✅ |
| Validation rules | ✅ | ✅ |
| Graph statistics | ✅ | ✅ |
| CLI tools | ✅ | ❌ |
| Database creation | ✅ | ❌ (read-only) |
| Target users | Node.js devs, CLI | AI agents, Python devs |

**Use TypeScript SDK for:**
- Creating intent units
- Managing the database
- CLI operations
- Web dashboards

**Use Python SDK for:**
- AI coding agents
- Python-based automation
- LangChain/OpenAI integration
- Content generation

---

## Contributing

Contributions welcome! Please:

1. Run tests: `pytest tests/`
2. Type check: `mypy narrative_sdk/`
3. Format code: `black narrative_sdk/ tests/ examples/`
4. Update documentation

---

## License

MIT License - see LICENSE file

---

## Related Projects

- **TypeScript SDK** - `packages/sdk/` - Full-featured SDK with database management
- **CLI** - `packages/cli/` - Interactive command-line interface
- **Core** - `packages/core/` - NarrativeGraph implementation
- **Validator** - `packages/validator/` - Pre-commit validation

---

## Support

- **Documentation**: See main README.md and QUICKSTART.md
- **Examples**: Check `examples/` directory
- **Issues**: File issues on GitHub

---

**Make organizational intent machine-readable. Query it from Python.**
