#!/usr/bin/env node
/**
 * CI validation script for skill dependencies.
 *
 * This script validates all skills by:
 * 1. Loading each skill through the loader (triggers dependency validation)
 * 2. Reporting clear errors if any skill has broken dependencies
 *
 * Following Fernando's requirement: catch broken dependencies before deploy.
 * Following Michael's requirement: fail-fast during CI, not at runtime.
 *
 * Usage:
 *   node skills/validate-skills.js
 *   npm run validate:skills
 *
 * Exit codes:
 *   0 - All skills valid
 *   1 - One or more skills have dependency issues
 */

'use strict';

const { loadSkill, listSkills } = require('./loader');

console.log('🔍 Validating all skills and their dependencies...\n');

const allSkills = listSkills();
const results = {
  passed: [],
  failed: [],
};

for (const skillInfo of allSkills) {
  const skillName = skillInfo.name;

  try {
    // Loading the skill will trigger dependency validation
    const skill = loadSkill(skillName);

    const depCount = Object.keys(skill.dependencies || {}).length;
    const depMsg = depCount > 0
      ? ` (${depCount} ${depCount === 1 ? 'dependency' : 'dependencies'})`
      : '';

    console.log(`✅ ${skillName}${depMsg}`);
    results.passed.push(skillName);
  } catch (error) {
    console.error(`❌ ${skillName}`);
    console.error(`   ${error.message.split('\n').join('\n   ')}\n`);
    results.failed.push({ name: skillName, error: error.message });
  }
}

console.log('\n' + '='.repeat(60));
console.log('Validation Results:');
console.log('='.repeat(60));
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);

if (results.failed.length > 0) {
  console.log('\n❌ Validation failed. Fix the issues above before deploying.\n');
  process.exit(1);
}

console.log('\n✅ All skills validated successfully!\n');
process.exit(0);
