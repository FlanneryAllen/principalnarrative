#!/usr/bin/env node
/**
 * Debug Validation - Check what constraints are being used
 */

const { NarrativeClient } = require('../packages/sdk/dist/narrative-client');

async function debugValidation() {
  console.log('🔍 Debugging Validation\n');

  const client = new NarrativeClient('.narrative/narrative.db');

  const result = await client.queryNarrative({
    operation: 'writing code',
    context: { tags: ['typescript', 'healthcare', 'security'] }
  });

  console.log(`📋 Intent Chain (${result.narrativeChain.length} units):`);
  result.narrativeChain.forEach(item => {
    console.log(`  [${item.type}] ${item.assertion.substring(0, 60)}...`);
  });

  console.log(`\n🔒 Code Constraints:`);
  if (result.constraints.code) {
    console.log(`\n  Forbidden Patterns (${result.constraints.code.forbidden_patterns?.length || 0}):`);
    (result.constraints.code.forbidden_patterns || []).forEach(p => {
      console.log(`    ✗ ${p}`);
    });

    console.log(`\n  Required Patterns (${result.constraints.code.required_patterns?.length || 0}):`);
    (result.constraints.code.required_patterns || []).slice(0, 10).forEach(p => {
      console.log(`    • ${p}`);
    });
    if ((result.constraints.code.required_patterns || []).length > 10) {
      console.log(`    ... and ${result.constraints.code.required_patterns.length - 10} more`);
    }
  }

  client.close();
}

debugValidation().catch(err => {
  console.error('❌ Debug failed:', err);
  process.exit(1);
});
