# Contributing to Principal Narrative Agent

Welcome! This guide will help you get started contributing to the project.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/narrative-agentv2.git
cd narrative-agentv2

# 2. Set up development environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Development dependencies

# 3. Install pre-commit hooks
pip install pre-commit
pre-commit install

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your settings

# 5. Run tests
pytest tests/ -v

# 6. Start development server
./run.sh
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write clean, readable code
- Follow PEP 8 style guide
- Add docstrings to functions
- Update tests as needed

### 3. Run Quality Checks

```bash
# Format code
black src/ tests/

# Check linting
flake8 src/ tests/

# Type checking
mypy src/

# Run tests
pytest tests/ -v --cov=src
```

### 4. Commit

```bash
git add .
git commit -m "feat: add new feature"
```

**Commit Message Format:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `chore:` Maintenance tasks

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Project Structure

```
narrative-agentv2/
├── src/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── models.py            # Data models
│   ├── auth/                # Authentication
│   ├── routes/              # API endpoints
│   ├── services/            # Business logic
│   ├── middleware/          # Request middleware
│   └── database/            # Database layer
├── tests/                   # Test suite
├── applied-narrative/       # Sample narrative data
├── data/                    # Runtime data
├── logs/                    # Application logs
└── docs/                    # Documentation

Key files:
- README.md                  # Project overview
- ARCHITECTURE.md            # System architecture
- DEPLOYMENT.md              # Deployment guide
- TESTING_SUMMARY.md         # Test results
- requirements.txt           # Python dependencies
```

## Code Quality Standards

### Python Style

- **PEP 8** compliance
- **Black** for formatting (line length: 100)
- **Type hints** for function signatures
- **Docstrings** for classes and public methods

Example:
```python
def analyze_drift(
    document_path: str,
    min_severity: DriftSeverity = DriftSeverity.LOW
) -> List[DriftEvent]:
    """
    Analyze document for drift events.
    
    Args:
        document_path: Path to document to analyze
        min_severity: Minimum severity level to report
        
    Returns:
        List of drift events found
        
    Raises:
        FileNotFoundError: If document doesn't exist
    """
    pass
```

### Testing

- **Unit tests** for business logic
- **Integration tests** for API endpoints
- **Minimum 80% code coverage**
- Use `pytest` fixtures for setup

Example:
```python
import pytest
from src.services.drift_detector import DriftDetector

@pytest.fixture
def drift_detector():
    return DriftDetector()

def test_detect_semantic_drift(drift_detector):
    events = drift_detector.detect_semantic_drift("test_doc.md")
    assert len(events) > 0
    assert events[0].type == DriftType.SEMANTIC
```

## Architecture Guidelines

### Service Layer Pattern

Each service should:
- Have a single responsibility
- Be independently testable
- Use dependency injection
- Have clear interfaces

### Error Handling

```python
from src.logging_config import get_logger

logger = get_logger(__name__)

try:
    result = risky_operation()
except SpecificException as e:
    logger.error(f"Operation failed: {e}")
    raise HTTPException(status_code=500, detail=str(e))
```

### API Design

- RESTful endpoints
- Consistent response format
- Proper HTTP status codes
- Comprehensive error messages
- API versioning when needed

## Common Tasks

### Adding a New API Endpoint

1. Define in `src/routes/`
2. Add business logic in `src/services/`
3. Update tests
4. Document in OpenAPI (automatic)

### Adding a New Drift Type

1. Add to `DriftType` enum in `models.py`
2. Implement detection in `drift_detector.py`
3. Add tests
4. Update documentation

### Adding Database Migration

1. Update schema in `database/schema.py`
2. Create migration script
3. Test locally
4. Document changes

## Testing

### Run All Tests

```bash
pytest tests/ -v
```

### Run Specific Test File

```bash
pytest tests/test_drift.py -v
```

### Run with Coverage

```bash
pytest tests/ --cov=src --cov-report=html
open htmlcov/index.html
```

### Integration Tests

```bash
# Start server in background
uvicorn src.main:app --port 8000 &
SERVER_PID=$!

# Run integration tests
python test_multi_repo.py

# Clean up
kill $SERVER_PID
```

## Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=DEBUG uvicorn src.main:app --reload
```

### Use Python Debugger

```python
import pdb; pdb.set_trace()
# or
breakpoint()  # Python 3.7+
```

### Check API Docs

```
http://localhost:8000/docs
```

## Performance Considerations

- Use async/await for I/O operations
- Cache expensive computations
- Batch database operations
- Profile before optimizing
- Monitor API response times

## Security Best Practices

- **Never commit secrets** (.env in .gitignore)
- **Validate all inputs**
- **Use parameterized queries**
- **Rate limit API endpoints**
- **Sanitize user content**
- **Keep dependencies updated**

## Getting Help

- **Documentation**: See README.md and docs/
- **API Reference**: http://localhost:8000/docs
- **Issues**: GitHub Issues
- **Questions**: Discussions tab on GitHub
- **Chat**: [Your team chat link]

## Code Review Process

All PRs must:
1. Pass CI/CD checks
2. Have tests for new features
3. Update documentation
4. Be reviewed by at least one team member
5. Have no merge conflicts

## Release Process

1. Update version in `src/config.py`
2. Update CHANGELOG.md
3. Create release branch
4. Tag release: `git tag -a v1.0.0 -m "Release 1.0.0"`
5. Deploy to staging for testing
6. Deploy to production
7. Announce release

## Performance Benchmarks

Expected performance:
- API health check: <10ms
- Simple query: <50ms
- Drift scan (50 docs): <5s
- Multi-repo scan (10 repos): <10s

If degraded, investigate and optimize.

## Resources

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Pydantic](https://docs.pydantic.dev/)
- [Anthropic API](https://docs.anthropic.com/)
- [Python Best Practices](https://docs.python-guide.org/)

---

Thank you for contributing! 🎉
