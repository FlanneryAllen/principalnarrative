"""
Tests for Intent Client

Run with: pytest tests/
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from narrative_sdk import IntentClient

# Path to seeded database (from repository root)
DB_PATH = str(Path(__file__).parent.parent.parent.parent / '.narrative' / 'intent.db')


def test_client_initialization():
    """Test that client initializes correctly"""
    # Using the seeded database
    client = IntentClient(DB_PATH)

    # Should be able to get stats
    stats = client.get_stats()
    assert stats['total'] > 0
    assert 'byType' in stats
    assert 'byValidation' in stats

    client.close()


def test_query_intent_authentication():
    """Test querying intent for authentication"""
    client = IntentClient(DB_PATH)

    result = client.query_intent(
        operation='writing authentication code',
        context={'tags': ['security', 'authentication']}
    )

    # Should find relevant units
    assert len(result['intentChain']) > 0

    # Should have code constraints
    assert 'code' in result['constraints']

    code = result['constraints']['code']

    # Should require security patterns
    assert 'required_patterns' in code
    assert 'oauth2' in code['required_patterns'] or 'mfa_support' in code['required_patterns']

    # Should forbid insecure patterns
    assert 'forbidden_patterns' in code
    assert 'localStorage' in code['forbidden_patterns'] or 'basic_auth' in code['forbidden_patterns']

    # Should require security libraries
    assert 'required_libraries' in code
    assert len(code['required_libraries']) > 0

    # Should have evidence requirements
    assert len(result['evidenceRequired']) > 0

    client.close()


def test_query_intent_api_endpoint():
    """Test querying intent for API endpoint creation"""
    client = IntentClient(DB_PATH)

    result = client.query_intent(
        operation='creating API endpoint',
        context={'tags': ['api', 'backend']}
    )

    # Should find relevant units
    assert len(result['intentChain']) > 0

    # Should have constraints
    assert 'code' in result['constraints'] or 'content' in result['constraints']

    client.close()


def test_query_intent_no_match():
    """Test querying with no matching intent"""
    client = IntentClient(DB_PATH)

    result = client.query_intent(
        operation='xyzqwerty nonexistent zzzabcdef'
    )

    # Should return result (even if empty is okay)
    # The important thing is it doesn't crash
    assert 'intentChain' in result
    assert 'constraints' in result
    assert 'validationRules' in result
    assert 'evidenceRequired' in result

    client.close()


def test_get_all_units():
    """Test getting all units"""
    client = IntentClient(DB_PATH)

    units = client.get_all_units()

    # Should have units (from seed data)
    assert len(units) > 0

    # Each unit should have required fields
    for unit in units:
        assert 'id' in unit
        assert 'type' in unit
        assert 'assertion' in unit
        assert 'intent' in unit
        assert 'dependencies' in unit
        assert 'validationState' in unit
        assert 'confidence' in unit
        assert 'metadata' in unit

    client.close()


def test_context_manager():
    """Test using client as context manager"""
    with IntentClient(DB_PATH) as client:
        stats = client.get_stats()
        assert stats['total'] > 0

    # Client should be closed after context


if __name__ == '__main__':
    print("Running tests...")

    test_client_initialization()
    print("✓ test_client_initialization")

    test_query_intent_authentication()
    print("✓ test_query_intent_authentication")

    test_query_intent_api_endpoint()
    print("✓ test_query_intent_api_endpoint")

    test_query_intent_no_match()
    print("✓ test_query_intent_no_match")

    test_get_all_units()
    print("✓ test_get_all_units")

    test_context_manager()
    print("✓ test_context_manager")

    print("\n✅ All tests passed!")
