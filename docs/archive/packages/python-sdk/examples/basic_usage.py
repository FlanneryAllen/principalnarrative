"""
Basic Usage Example

Shows how an AI agent queries organizational intent before taking action.
"""

import sys
from pathlib import Path

# Add package to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from narrative_sdk import IntentClient

# Initialize client (path from repository root)
DB_PATH = str(Path(__file__).parent.parent.parent.parent / '.narrative' / 'intent.db')
client = IntentClient(DB_PATH)

# Example 1: Query intent before writing authentication code
print("=" * 60)
print("Example 1: Writing Authentication Code")
print("=" * 60)

result = client.query_intent(
    operation='writing authentication code',
    context={'tags': ['security', 'authentication']}
)

print(f"\n📋 Intent Chain ({len(result['intentChain'])} units):")
for item in result['intentChain']:
    print(f"  [{item['type']}] {item['assertion'][:70]}...")

print(f"\n🔒 Code Constraints:")
if 'code' in result['constraints']:
    code = result['constraints']['code']

    if 'required_patterns' in code:
        print(f"\n  Required Patterns ({len(code['required_patterns'])}):")
        for pattern in code['required_patterns'][:5]:
            print(f"    • {pattern}")
        if len(code['required_patterns']) > 5:
            print(f"    ... and {len(code['required_patterns']) - 5} more")

    if 'forbidden_patterns' in code:
        print(f"\n  Forbidden Patterns ({len(code['forbidden_patterns'])}):")
        for pattern in code['forbidden_patterns'][:5]:
            print(f"    ✗ {pattern}")
        if len(code['forbidden_patterns']) > 5:
            print(f"    ... and {len(code['forbidden_patterns']) - 5} more")

    if 'required_libraries' in code:
        print(f"\n  Required Libraries:")
        for lib in code['required_libraries']:
            print(f"    • {lib}")

if result['evidenceRequired']:
    print(f"\n📊 Evidence Required:")
    for evidence in result['evidenceRequired'][:5]:
        print(f"  • {evidence}")

# Example 2: Query intent before creating API endpoint
print("\n\n" + "=" * 60)
print("Example 2: Creating API Endpoint")
print("=" * 60)

result = client.query_intent(
    operation='creating API endpoint',
    context={'tags': ['api', 'backend']}
)

print(f"\n📋 Intent Chain ({len(result['intentChain'])} units):")
for item in result['intentChain']:
    print(f"  [{item['type']}] {item['assertion'][:70]}...")

if 'code' in result['constraints']:
    code = result['constraints']['code']
    print(f"\n🔒 Code Constraints:")
    if 'required_patterns' in code:
        print(f"  Required: {', '.join(code['required_patterns'][:5])}")

# Example 3: Query intent before writing marketing content
print("\n\n" + "=" * 60)
print("Example 3: Writing Marketing Content")
print("=" * 60)

result = client.query_intent(
    operation='writing marketing content',
    context={'tags': ['communication', 'marketing']}
)

print(f"\n📋 Intent Chain ({len(result['intentChain'])} units):")
for item in result['intentChain']:
    print(f"  [{item['type']}] {item['assertion'][:70]}...")

if 'content' in result['constraints']:
    content = result['constraints']['content']
    print(f"\n📝 Content Constraints:")
    if 'required_themes' in content:
        print(f"  Required Themes: {', '.join(content['required_themes'])}")
    if 'forbidden_themes' in content:
        print(f"  Forbidden Themes: {', '.join(content['forbidden_themes'])}")
    if 'tone' in content:
        print(f"  Tone: {content['tone']}")

# Example 4: Get graph statistics
print("\n\n" + "=" * 60)
print("Example 4: Graph Statistics")
print("=" * 60)

stats = client.get_stats()
print(f"\n📊 Intent Graph Stats:")
print(f"  Total units: {stats['total']}")
print(f"\n  By Type:")
for type_name, count in sorted(stats['byType'].items()):
    print(f"    {type_name}: {count}")
print(f"\n  By Validation State:")
for state, count in sorted(stats['byValidation'].items()):
    print(f"    {state}: {count}")

# Clean up
client.close()

print("\n✅ Examples complete!")
