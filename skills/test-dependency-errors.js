#!/usr/bin/env node
/**
 * Test script to verify dependency error messages.
 * Tests the 4-part error message format that Fernando required.
 */

'use strict';

const { loadSkill } = require('./loader');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing dependency error messages...\n');

// Test 1: Version mismatch error
console.log('Test 1: Version mismatch detection');
console.log('-----------------------------------');

// Temporarily modify provenance-scoring version to cause mismatch
const provenancePkgPath = path.join(__dirname, 'provenance-scoring', 'package.json');
const originalPkg = fs.readFileSync(provenancePkgPath, 'utf-8');
const pkg = JSON.parse(originalPkg);
const originalVersion = pkg.version;

// Set version to 0.0.9 to trigger mismatch with blog-authoring-harness expecting ^0.1.0
pkg.version = '0.0.9';
fs.writeFileSync(provenancePkgPath, JSON.stringify(pkg, null, 2));

// Clear the cache to force reload
const { cache } = require('./loader');
if (cache && cache.clear) cache.clear();

try {
  loadSkill('blog-authoring-harness');
  console.log('❌ FAILED: Should have thrown version mismatch error\n');
} catch (error) {
  if (error.message.includes('[1/4]') &&
      error.message.includes('[2/4]') &&
      error.message.includes('[3/4]') &&
      error.message.includes('[4/4]')) {
    console.log('✅ PASSED: 4-part error message format correct');
    console.log('\nError message:');
    console.log(error.message);
    console.log();
  } else {
    console.log('❌ FAILED: Error message format incorrect');
    console.log('Got:', error.message);
    console.log();
  }
}

// Restore original version
pkg.version = originalVersion;
fs.writeFileSync(provenancePkgPath, originalPkg);

// Test 2: Missing dependency
console.log('\nTest 2: Missing dependency detection');
console.log('-------------------------------------');

// Temporarily rename huddle-harvest to cause missing dependency
const huddleDir = path.join(__dirname, 'huddle-harvest');
const huddleTempDir = path.join(__dirname, 'huddle-harvest.backup');

fs.renameSync(huddleDir, huddleTempDir);

try {
  // Clear cache again
  const loaderModule = require.cache[require.resolve('./loader')];
  if (loaderModule && loaderModule.exports.cache) {
    loaderModule.exports.cache.clear();
  }

  // Force module reload
  delete require.cache[require.resolve('./loader')];
  const { loadSkill: loadSkillFresh } = require('./loader');

  loadSkillFresh('blog-authoring-harness');
  console.log('❌ FAILED: Should have thrown missing dependency error\n');
} catch (error) {
  if (error.message.includes('Dependency not found') ||
      error.message.includes('Dependency issue')) {
    console.log('✅ PASSED: Missing dependency detected');
    console.log('\nError message:');
    console.log(error.message);
    console.log();
  } else {
    console.log('❌ FAILED: Wrong error type');
    console.log('Got:', error.message);
    console.log();
  }
}

// Restore huddle-harvest
fs.renameSync(huddleTempDir, huddleDir);

console.log('\n✅ Dependency error handling tests complete!');
