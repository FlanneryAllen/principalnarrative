/**
 * Basic Usage Example
 *
 * Demonstrates how an autonomous agent queries organizational intent
 * before performing an operation.
 */

import { IntentClient, IntentUnit } from '@narrative/sdk';

async function main() {
  // Initialize the client
  const client = new IntentClient('.narrative/intent.db');

  // ============================================================================
  // SETUP: Seed the graph with example organizational intent
  // ============================================================================

  // Core Story: Strategic intent from CEO
  const coreStory: IntentUnit = {
    id: 'core_story_healthcare_focus',
    type: 'core_story',
    assertion: 'We are building healthcare infrastructure that protects patient data',
    intent: {
      objective: 'Become the most trusted healthcare infrastructure provider',
      constraints: {
        code: {
          required_patterns: ['audit_logging', 'encryption_at_rest'],
          forbidden_patterns: ['console.log', 'localStorage'],
        },
        content: {
          required_themes: ['security', 'compliance', 'trust'],
          forbidden_themes: ['fast_iteration', 'move_fast_break_things'],
          tone: 'professional',
          target_audience: 'healthcare_decision_makers',
        },
      },
      evidence_required: ['SOC2_certification', 'HIPAA_compliance_audit'],
    },
    dependencies: [],
    validationState: 'ALIGNED',
    confidence: 1.0,
    metadata: {
      created_by: 'ceo',
      tags: ['healthcare', 'security', 'compliance'],
    },
  };

  // Operational: How engineering executes
  const operational: IntentUnit = {
    id: 'operational_auth_implementation',
    type: 'operational',
    assertion: 'All authentication must use OAuth 2.0 with refresh tokens',
    intent: {
      objective: 'Implement secure, auditable authentication',
      constraints: {
        code: {
          required_libraries: ['@aws-sdk/client-kms', 'jsonwebtoken'],
          required_patterns: ['jwt_signing', 'token_rotation'],
          forbidden_patterns: ['basic_auth', 'password_storage'],
        },
        validation_rules: [
          {
            type: 'ast_pattern',
            check: 'no-localStorage-for-tokens',
            error_message: 'Tokens must not be stored in localStorage',
            suggestion: 'Use httpOnly cookies or secure session storage',
          },
          {
            type: 'regex',
            check: 'audit\\(.*auth',
            error_message: 'Authentication events must be audited',
            suggestion: 'Add audit() call after authentication',
          },
        ],
      },
      evidence_required: ['auth_test_coverage_90_percent'],
    },
    dependencies: ['core_story_healthcare_focus'],
    validationState: 'ALIGNED',
    confidence: 0.95,
    metadata: {
      created_by: 'cto',
      tags: ['authentication', 'security', 'oauth'],
    },
  };

  // Create the intent units
  await client.createUnit(coreStory);
  await client.createUnit(operational);

  console.log('✅ Intent graph seeded with 2 units\n');

  // ============================================================================
  // AGENT USE CASE: Coding agent about to write authentication code
  // ============================================================================

  console.log('🤖 Agent Query: Writing authentication code...\n');

  const intentResponse = await client.queryIntent({
    operation: 'writing authentication code',
    context: {
      file_path: 'src/auth/login.ts',
      tags: ['authentication'],
    },
  });

  console.log('📋 Intent Chain:');
  intentResponse.intentChain.forEach(intent => {
    console.log(`  [${intent.type}] ${intent.assertion}`);
  });

  console.log('\n🔒 Code Constraints:');
  console.log('  Required Patterns:', intentResponse.constraints.code?.required_patterns);
  console.log('  Forbidden Patterns:', intentResponse.constraints.code?.forbidden_patterns);
  console.log('  Required Libraries:', intentResponse.constraints.code?.required_libraries);

  console.log('\n📝 Content Constraints:');
  console.log('  Tone:', intentResponse.constraints.content?.tone);
  console.log('  Required Themes:', intentResponse.constraints.content?.required_themes);

  console.log('\n✅ Validation Rules:');
  intentResponse.validationRules.forEach(rule => {
    console.log(`  - ${rule.check}: ${rule.error_message}`);
  });

  console.log('\n📊 Evidence Required:');
  intentResponse.evidenceRequired?.forEach(evidence => {
    console.log(`  - ${evidence}`);
  });

  // ============================================================================
  // AGENT DECISION: Use constraints to guide code generation
  // ============================================================================

  console.log('\n\n🎯 Agent Decision Logic:\n');

  // Check if localStorage is forbidden
  if (intentResponse.constraints.code?.forbidden_patterns?.includes('localStorage')) {
    console.log('❌ Cannot use localStorage for tokens (forbidden pattern)');
    console.log('✅ Will use httpOnly cookies instead');
  }

  // Check required libraries
  if (intentResponse.constraints.code?.required_libraries?.includes('jsonwebtoken')) {
    console.log('✅ Will import jsonwebtoken library');
  }

  // Check required patterns
  if (intentResponse.constraints.code?.required_patterns?.includes('audit_logging')) {
    console.log('✅ Will add audit logging to authentication flow');
  }

  // ============================================================================
  // PROPAGATION: What if we change the core story?
  // ============================================================================

  console.log('\n\n🔄 Propagation Analysis:\n');

  const impact = await client.getPropagationImpact('core_story_healthcare_focus');
  console.log(`Changing core_story_healthcare_focus would affect ${impact.length} units:`);
  impact.forEach(unit => {
    console.log(`  - ${unit.id} (${unit.type})`);
  });

  // ============================================================================
  // STATS
  // ============================================================================

  console.log('\n\n📊 Graph Statistics:\n');
  const stats = await client.getStats();
  console.log('  Total Units:', stats.total);
  console.log('  By Type:', stats.byType);
  console.log('  By Validation:', stats.byValidation);

  // Clean up
  client.close();
}

// Run the example
main().catch(console.error);
