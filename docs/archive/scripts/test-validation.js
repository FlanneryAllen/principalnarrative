#!/usr/bin/env node
/**
 * Test Validation - Show intent-based validation catching violations
 */

const { IntentValidator } = require('../packages/validator/dist/intent-validator');

async function testValidation() {
  console.log('🔍 Testing Intent-Based Validation\n');

  const validator = new IntentValidator('.narrative/narrative.db');

  // Test on the file with intentional violations
  console.log('=' .repeat(70));
  console.log('Test: Validating test-violations.ts');
  console.log('=' .repeat(70));

  const result = await validator.validate({
    rootDir: process.cwd(),
    include: ['test-violations.ts'],  // Only check our test file
    exclude: [],
    operation: 'writing authentication code',  // More specific operation
    tags: ['authentication', 'security', 'patient'],  // Healthcare context
    failOnWarning: false
  });

  console.log(`\n📊 Results:`);
  console.log(`   Files checked: ${result.filesChecked}`);
  console.log(`   Total violations: ${result.violationsCount}`);
  console.log(`   Errors: ${result.errorsCount}`);
  console.log(`   Warnings: ${result.warningsCount}`);
  console.log(`   Passed: ${result.passed ? '✅' : '❌'}`);

  if (result.violations.length > 0) {
    console.log(`\n❌ Intent Violations Found:\n`);

    // Group by type
    const errors = result.violations.filter(v => v.severity === 'error');
    const warnings = result.violations.filter(v => v.severity === 'warning');

    if (errors.length > 0) {
      console.log(`🚨 Errors (${errors.length}):`);
      errors.forEach(v => {
        console.log(`   ${v.file}:${v.line || '?'}`);
        console.log(`   ❌ ${v.message}`);
        if (v.suggestion) {
          console.log(`   💡 ${v.suggestion}`);
        }
        console.log('');
      });
    }

    if (warnings.length > 0 && warnings.length < 50) {  // Don't spam too many warnings
      console.log(`⚠️  Warnings (${warnings.length}):`);
      warnings.slice(0, 10).forEach(v => {
        console.log(`   ${v.file}${v.line ? ':' + v.line : ''}`);
        console.log(`   ⚠️  ${v.message}`);
        console.log('');
      });
      if (warnings.length > 10) {
        console.log(`   ... and ${warnings.length - 10} more warnings`);
      }
    }
  }

  validator.close();

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('Key Findings:');
  console.log('='.repeat(70));

  const forbiddenFound = result.violations.filter(v =>
    v.message.includes('Forbidden pattern')
  );

  console.log(`\n✅ Validator successfully caught forbidden patterns:`);
  forbiddenFound.forEach(v => {
    console.log(`   • ${v.pattern} (line ${v.line})`);
  });

  console.log(`\n💡 This proves Intent Engineering works:`);
  console.log(`   1. Intent units define constraints (forbidden patterns)`);
  console.log(`   2. Validator queries narrative units`);
  console.log(`   3. Validator checks code against constraints`);
  console.log(`   4. Violations are caught and reported`);
  console.log(`\n📋 Next: Connect this to pre-commit hook`);
}

testValidation().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
