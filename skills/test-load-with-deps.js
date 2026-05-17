#!/usr/bin/env node
/**
 * Test script to verify loading skills with dependencies works correctly.
 */

'use strict';

const { loadSkill } = require('./loader');

console.log('🧪 Testing skill loading with dependencies...\n');

try {
  // Load blog-authoring-harness which depends on provenance-scoring and huddle-harvest
  console.log('Loading blog-authoring-harness...');
  const harness = loadSkill('blog-authoring-harness');

  console.log('✅ Skill loaded successfully\n');
  console.log('Skill details:');
  console.log(`  Name: ${harness.manifest.name}`);
  console.log(`  Version: ${harness.manifest.version}`);
  console.log(`  Type: ${harness.manifest.type}`);
  console.log(`  Description: ${harness.manifest.description}`);

  console.log('\nDependencies loaded:');
  for (const [depName, dep] of Object.entries(harness.dependencies)) {
    console.log(`  ✓ ${depName} (v${dep.manifest.version})`);
  }

  // Verify dependencies are the expected ones
  const expectedDeps = ['provenance-scoring', 'huddle-harvest'];
  const actualDeps = Object.keys(harness.dependencies);

  if (expectedDeps.every(dep => actualDeps.includes(dep))) {
    console.log('\n✅ All expected dependencies loaded correctly!');
  } else {
    console.log('\n❌ Missing expected dependencies');
    console.log(`   Expected: ${expectedDeps.join(', ')}`);
    console.log(`   Got: ${actualDeps.join(', ')}`);
  }

} catch (error) {
  console.error('❌ Test failed:');
  console.error(error.message);
  process.exit(1);
}
