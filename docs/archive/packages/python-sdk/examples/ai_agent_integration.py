"""
AI Agent Integration Example

Shows how an AI coding agent uses Intent Engineering to guide code generation.
This is the core use case: agents query intent → receive constraints → generate aligned code.
"""

import sys
from pathlib import Path
from typing import Dict, List, Any

# Add package to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from narrative_sdk import IntentClient

# Database path
DB_PATH = str(Path(__file__).parent.parent.parent.parent / '.narrative' / 'intent.db')


class AICodeAgent:
    """
    Example AI coding agent that queries organizational intent
    before generating code.

    This demonstrates the pattern all AI agents should follow:
    1. Receive task from user
    2. Query organizational intent
    3. Use constraints to guide generation
    4. Validate against evidence requirements
    """

    def __init__(self, intent_db_path: str = None):
        if intent_db_path is None:
            intent_db_path = DB_PATH
        self.client = IntentClient(intent_db_path)

    def generate_authentication_code(self, user_request: str) -> str:
        """
        Generate authentication code guided by organizational intent.

        Args:
            user_request: User's request (e.g., "Create login endpoint")

        Returns:
            Generated code that aligns with organizational intent
        """
        print(f"🤖 AI Agent: Received request: '{user_request}'")
        print("🔍 Querying organizational intent...")

        # 1. Query intent
        result = self.client.query_intent(
            operation='writing authentication code',
            context={
                'tags': ['security', 'authentication'],
                'user_request': user_request
            }
        )

        print(f"✅ Found {len(result['intentChain'])} relevant intent units")

        # 2. Extract constraints
        code_constraints = result['constraints'].get('code', {})
        required_patterns = code_constraints.get('required_patterns', [])
        forbidden_patterns = code_constraints.get('forbidden_patterns', [])
        required_libraries = code_constraints.get('required_libraries', [])

        print(f"\n📋 Constraints:")
        print(f"  Must include: {', '.join(required_patterns[:5])}")
        print(f"  Must avoid: {', '.join(forbidden_patterns[:5])}")
        print(f"  Must use: {', '.join(required_libraries[:3])}")

        # 3. Generate code aligned with constraints
        print(f"\n💻 Generating code with organizational alignment...")

        # Check what patterns are required
        needs_oauth = 'oauth2' in required_patterns
        needs_mfa = 'mfa_support' in required_patterns
        needs_audit = 'audit_logging' in required_patterns
        needs_jwt = 'jwt_signing' in required_patterns

        # Check what's forbidden
        cannot_use_localstorage = 'localStorage' in forbidden_patterns
        cannot_use_basic_auth = 'basic_auth' in forbidden_patterns

        # Generate aligned code
        code = self._generate_code(
            needs_oauth=needs_oauth,
            needs_mfa=needs_mfa,
            needs_audit=needs_audit,
            needs_jwt=needs_jwt,
            cannot_use_localstorage=cannot_use_localstorage,
            required_libraries=required_libraries
        )

        print(f"✅ Code generated with organizational alignment!\n")
        return code

    def _generate_code(
        self,
        needs_oauth: bool,
        needs_mfa: bool,
        needs_audit: bool,
        needs_jwt: bool,
        cannot_use_localstorage: bool,
        required_libraries: List[str]
    ) -> str:
        """Generate code based on constraints"""

        # This is where the AI model would actually generate code
        # For this example, we'll return a template that shows alignment

        imports = []
        if needs_jwt or 'jsonwebtoken' in required_libraries:
            imports.append("import jwt")
        if 'passport' in required_libraries:
            imports.append("from passport import OAuth2Strategy")
        if needs_audit:
            imports.append("from audit import log_auth_event")

        code_parts = [
            "# Generated with Intent Engineering alignment",
            "# Organizational constraints enforced:",
            f"#   - OAuth 2.0: {'✓' if needs_oauth else '✗'}",
            f"#   - MFA Support: {'✓' if needs_mfa else '✗'}",
            f"#   - Audit Logging: {'✓' if needs_audit else '✗'}",
            f"#   - JWT Signing: {'✓' if needs_jwt else '✗'}",
            "",
            *imports,
            "",
            "def authenticate_user(username: str, password: str, mfa_token: str = None):",
        ]

        if needs_audit:
            code_parts.append("    # Audit logging (required by org intent)")
            code_parts.append("    log_auth_event('login_attempt', username)")

        if needs_mfa:
            code_parts.append("    # MFA verification (required by org intent)")
            code_parts.append("    if not verify_mfa(username, mfa_token):")
            code_parts.append("        raise AuthError('MFA verification failed')")

        if needs_jwt:
            code_parts.append("    # Generate JWT with expiration (required by org intent)")
            code_parts.append("    token = jwt.sign({")
            code_parts.append("        'user_id': user.id,")
            code_parts.append("        'exp': datetime.now() + timedelta(hours=1)")
            code_parts.append("    }, SECRET_KEY)")

        if cannot_use_localstorage:
            code_parts.append("    # Store in httpOnly cookie (localStorage forbidden by org intent)")
            code_parts.append("    response.set_cookie('auth_token', token, httponly=True, secure=True)")

        code_parts.append("    return token")

        return "\n".join(code_parts)

    def validate_code(self, code: str, operation: str) -> Dict[str, Any]:
        """
        Validate generated code against organizational intent.

        Args:
            code: The generated code
            operation: What the code does

        Returns:
            Validation result with violations
        """
        print(f"✅ Validating generated code against intent...")

        result = self.client.query_intent(operation=operation)
        constraints = result['constraints'].get('code', {})

        violations = []

        # Check forbidden patterns
        for pattern in constraints.get('forbidden_patterns', []):
            if pattern in code:
                violations.append({
                    'type': 'forbidden_pattern',
                    'pattern': pattern,
                    'message': f"Code contains forbidden pattern: {pattern}"
                })

        # Check required patterns (simplified - real validation would use AST)
        for pattern in constraints.get('required_patterns', []):
            pattern_variants = [
                pattern,
                pattern.replace('_', ''),
                pattern.replace('_', ' ')
            ]
            if not any(variant in code.lower() for variant in pattern_variants):
                violations.append({
                    'type': 'missing_pattern',
                    'pattern': pattern,
                    'message': f"Code missing required pattern: {pattern}"
                })

        return {
            'valid': len(violations) == 0,
            'violations': violations,
            'evidence_required': result['evidenceRequired']
        }

    def close(self):
        """Clean up resources"""
        self.client.close()


# Example Usage
if __name__ == '__main__':
    print("=" * 70)
    print("AI Agent Integration Demo")
    print("=" * 70)
    print()

    # Create AI agent
    agent = AICodeAgent()

    # User makes a request
    user_request = "Create a secure login endpoint with MFA support"

    # Agent queries intent and generates aligned code
    generated_code = agent.generate_authentication_code(user_request)

    print("Generated Code:")
    print("-" * 70)
    print(generated_code)
    print("-" * 70)

    # Validate the generated code
    print("\n🔍 Validating generated code...")
    validation = agent.validate_code(
        code=generated_code,
        operation='writing authentication code'
    )

    if validation['valid']:
        print("✅ Code is aligned with organizational intent!")
    else:
        print(f"❌ Found {len(validation['violations'])} violations:")
        for v in validation['violations']:
            print(f"  • {v['message']}")

    if validation['evidence_required']:
        print(f"\n📊 Evidence Required:")
        for evidence in validation['evidence_required'][:5]:
            print(f"  • {evidence}")

    # Clean up
    agent.close()

    print("\n✅ Demo complete!")
