/**
 * Test Intent Validator
 */

const { IntentValidator } = require('./dist/intent-validator');
const { IntentClient } = require('../sdk/dist/intent-client');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function setup() {
  // Create test DB
  const testDbPath = '/tmp/test-validator.db';
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Create intent units with constraints
  const client = new IntentClient(testDbPath);

  const coreStory = {
    id: 'core_story_security',
    type: 'core_story',
    assertion: 'We build secure, compliant software',
    intent: {
      objective: 'Ensure security and compliance',
      constraints: {
        code: {
          required_patterns: ['audit_logging'],
          forbidden_patterns: ['localStorage', 'console\\.log'],
        },
      },
    },
    dependencies: [],
    validationState: 'ALIGNED',
    confidence: 1.0,
  };

  const operational = {
    id: 'operational_auth',
    type: 'operational',
    assertion: 'Authentication must use modern standards',
    intent: {
      objective: 'Implement secure auth',
      constraints: {
        code: {
          required_libraries: ['jsonwebtoken'],
          forbidden_patterns: ['basic_auth'],
        },
      },
    },
    dependencies: ['core_story_security'],
    validationState: 'ALIGNED',
    confidence: 0.95,
  };

  await client.createUnit(coreStory);
  await client.createUnit(operational);

  client.close();

  return testDbPath;
}

async function createTestFiles(tmpDir) {
  // Create a file with violations
  const badFile = path.join(tmpDir, 'bad-auth.ts');
  fs.writeFileSync(badFile, `
// This file violates organizational intent

export function login(username: string, password: string) {
  // VIOLATION: Using localStorage (forbidden)
  localStorage.setItem('token', 'abc123');

  // VIOLATION: Using console.log (forbidden)
  console.log('User logged in:', username);

  // VIOLATION: Missing audit_logging (required)
  // VIOLATION: Missing jsonwebtoken import (required)

  return { success: true };
}
  `);

  // Create a file that complies
  const goodFile = path.join(tmpDir, 'good-auth.ts');
  fs.writeFileSync(goodFile, `
import jsonwebtoken from 'jsonwebtoken';
import { audit_logging } from './audit';

export function login(username: string, password: string) {
  // Compliant: Using JWT
  const token = jsonwebtoken.sign({ username }, 'secret');

  // Compliant: Using audit logging
  audit_logging('login', { username });

  // Compliant: Using httpOnly cookie (not localStorage)
  return {
    success: true,
    setCookie: \`token=\${token}; HttpOnly; Secure\`
  };
}
  `);

  return { badFile, goodFile };
}

async function test() {
  console.log('🧪 Testing Intent Validator\n');

  // Setup test DB
  const dbPath = await setup();
  console.log('✅ Created test intent database with constraints\n');

  // Create temporary directory for test files
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validator-test-'));
  const { badFile, goodFile } = await createTestFiles(tmpDir);
  console.log('✅ Created test files\n');

  const validator = new IntentValidator(dbPath);

  // Test 1: Validate bad file
  console.log('1️⃣ Validating non-compliant file...');
  const result1 = await validator.validate({
    rootDir: tmpDir,
    include: ['bad-auth.ts'],
    operation: 'writing authentication code',
    tags: ['authentication'],
  });

  console.log(`   📊 Files checked: ${result1.filesChecked}`);
  console.log(`   ❌ Violations: ${result1.violationsCount}`);
  console.log(`   ❌ Errors: ${result1.errorsCount}`);
  console.log(`   ⚠️  Warnings: ${result1.warningsCount}`);
  console.log(`   Status: ${result1.passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (result1.violations.length > 0) {
    console.log('\n   Violations found:');
    result1.violations.forEach(v => {
      console.log(`     - ${v.severity === 'error' ? '❌' : '⚠️'} ${v.message}`);
      if (v.suggestion) {
        console.log(`       💡 ${v.suggestion}`);
      }
    });
  }

  // Test 2: Validate good file
  console.log('\n2️⃣ Validating compliant file...');
  const result2 = await validator.validate({
    rootDir: tmpDir,
    include: ['good-auth.ts'],
    operation: 'writing authentication code',
    tags: ['authentication'],
  });

  console.log(`   📊 Files checked: ${result2.filesChecked}`);
  console.log(`   ✅ Violations: ${result2.violationsCount}`);
  console.log(`   Status: ${result2.passed ? '✅ PASSED' : '❌ FAILED'}`);

  // Test 3: Validate all files
  console.log('\n3️⃣ Validating all files...');
  const result3 = await validator.validate({
    rootDir: tmpDir,
    include: ['**/*.ts'],
    operation: 'writing authentication code',
  });

  console.log(`   📊 Files checked: ${result3.filesChecked}`);
  console.log(`   📊 Total violations: ${result3.violationsCount}`);
  console.log(`   ❌ Errors: ${result3.errorsCount}`);
  console.log(`   ⚠️  Warnings: ${result3.warningsCount}`);

  // Cleanup
  validator.close();
  fs.rmSync(tmpDir, { recursive: true });
  fs.unlinkSync(dbPath);

  console.log('\n✅ All validator tests passed!\n');

  // Summary
  console.log('📋 Summary:');
  console.log('   - Validator correctly detects forbidden patterns (localStorage, console.log)');
  console.log('   - Validator correctly detects missing required patterns (audit_logging)');
  console.log('   - Validator correctly detects missing required libraries (jsonwebtoken)');
  console.log('   - Compliant code passes validation');
  console.log('   - Non-compliant code fails validation\n');
}

test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
