#!/usr/bin/env node
/**
 * Test Dogfooding - Query intent for actual development tasks on this project
 */

const { NarrativeClient } = require('../packages/sdk/dist/narrative-client');

async function testDogfooding() {
  console.log('🐕 Testing Dogfooding - Intent Engineering on itself\n');

  const client = new NarrativeClient('.narrative/narrative.db');

  // Test 1: Adding a new TypeScript package
  console.log('=' .repeat(70));
  console.log('Test 1: Adding a new TypeScript package');
  console.log('=' .repeat(70));

  const result1 = await client.queryNarrative({
    operation: 'creating new typescript package',
    context: { tags: ['typescript', 'infrastructure'] }
  });

  console.log(`\n📋 Intent Chain (${result1.narrativeChain.length} units):`);
  result1.narrativeChain.forEach(item => {
    console.log(`  [${item.type}] ${item.assertion.substring(0, 60)}...`);
  });

  if (result1.constraints.code) {
    console.log(`\n🔒 Code Constraints:`);
    if (result1.constraints.code.required_patterns) {
      console.log(`  Required: ${result1.constraints.code.required_patterns.join(', ')}`);
    }
    if (result1.constraints.code.forbidden_patterns) {
      console.log(`  Forbidden: ${result1.constraints.code.forbidden_patterns.join(', ')}`);
    }
  }

  if (result1.evidenceRequired.length > 0) {
    console.log(`\n📊 Evidence Required:`);
    result1.evidenceRequired.forEach(e => console.log(`  • ${e}`));
  }

  // Test 2: Writing documentation
  console.log('\n\n' + '='.repeat(70));
  console.log('Test 2: Writing documentation');
  console.log('=' .repeat(70));

  const result2 = await client.queryNarrative({
    operation: 'writing documentation',
    context: { tags: ['documentation', 'examples'] }
  });

  console.log(`\n📋 Intent Chain (${result2.narrativeChain.length} units):`);
  result2.narrativeChain.forEach(item => {
    console.log(`  [${item.type}] ${item.assertion.substring(0, 60)}...`);
  });

  if (result2.constraints.content) {
    console.log(`\n📝 Content Constraints:`);
    if (result2.constraints.content.required_themes) {
      console.log(`  Required Themes: ${result2.constraints.content.required_themes.join(', ')}`);
    }
    if (result2.constraints.content.forbidden_themes) {
      console.log(`  Forbidden Themes: ${result2.constraints.content.forbidden_themes.join(', ')}`);
    }
    if (result2.constraints.content.tone) {
      console.log(`  Tone: ${result2.constraints.content.tone}`);
    }
  }

  // Test 3: Adding dependencies
  console.log('\n\n' + '='.repeat(70));
  console.log('Test 3: Adding npm dependencies');
  console.log('=' .repeat(70));

  const result3 = await client.queryNarrative({
    operation: 'adding npm dependency',
    context: { tags: ['dependencies', 'npm'] }
  });

  console.log(`\n📋 Intent Chain (${result3.narrativeChain.length} units):`);
  result3.narrativeChain.forEach(item => {
    console.log(`  [${item.type}] ${item.assertion.substring(0, 60)}...`);
  });

  if (result3.constraints.code) {
    console.log(`\n🔒 Code Constraints:`);
    if (result3.constraints.code.required_patterns) {
      console.log(`  Required: ${result3.constraints.code.required_patterns.join(', ')}`);
    }
    if (result3.constraints.code.forbidden_patterns) {
      console.log(`  Forbidden: ${result3.constraints.code.forbidden_patterns.join(', ')}`);
    }
  }

  // Test 4: Compare healthcare vs narrative-agentv2 queries
  console.log('\n\n' + '='.repeat(70));
  console.log('Test 4: Same query, different context (authentication)');
  console.log('=' .repeat(70));

  const healthcareAuth = await client.queryNarrative({
    operation: 'writing authentication code',
    context: { tags: ['security', 'authentication'] }
  });

  const infrastructureAuth = await client.queryNarrative({
    operation: 'writing authentication code',
    context: { tags: ['infrastructure', 'typescript'] }
  });

  console.log(`\n🏥 Healthcare context: ${healthcareAuth.narrativeChain.length} units`);
  console.log(`Required patterns: ${healthcareAuth.constraints.code?.required_patterns?.join(', ') || 'none'}`);

  console.log(`\n🏗️  Infrastructure context: ${infrastructureAuth.narrativeChain.length} units`);
  console.log(`Required patterns: ${infrastructureAuth.constraints.code?.required_patterns?.join(', ') || 'none'}`);

  // Summary statistics
  console.log('\n\n' + '='.repeat(70));
  console.log('Summary Statistics');
  console.log('=' .repeat(70));

  const stats = await client.getStats();
  console.log(`\n📊 Intent Graph:`);
  console.log(`  Total units: ${stats.total}`);
  console.log(`\n  By Type:`);
  Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });

  // Find narrative-agentv2 specific units
  const allUnits = client.graph.getAllUnits();
  const narrativeUnits = allUnits.filter(u =>
    u.metadata?.created_by === 'dogfooding'
  );
  const healthcareUnits = allUnits.filter(u =>
    u.id.includes('healthcare') || u.id.includes('patient') || u.id.includes('hipaa')
  );

  console.log(`\n  By Project:`);
  console.log(`    narrative-agentv2 (dogfooding): ${narrativeUnits.length} units`);
  console.log(`    healthcare-saas (example): ${healthcareUnits.length} units`);

  client.close();

  console.log('\n✅ Dogfooding test complete!');
  console.log('\n💡 Key Insight:');
  console.log('   The same infrastructure serves BOTH healthcare SaaS and');
  console.log('   the Intent Engineering project itself - proving composability!');
}

testDogfooding().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
