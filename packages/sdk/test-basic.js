/**
 * Basic smoke test for IntentClient
 */

const { IntentClient } = require('./dist/intent-client');
const fs = require('fs');
const path = require('path');

async function test() {
  // Clean up any existing test DB
  const testDbPath = '/tmp/test-intent.db';
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const client = new IntentClient(testDbPath);

  console.log('🧪 Testing IntentClient...\n');

  // Test 1: Create core story unit
  console.log('1️⃣ Creating core story unit...');
  const coreStory = {
    id: 'core_story_test',
    type: 'core_story',
    assertion: 'We build secure healthcare software',
    intent: {
      objective: 'Be the most trusted healthcare provider',
      constraints: {
        code: {
          required_patterns: ['audit_logging'],
          forbidden_patterns: ['console.log'],
        },
      },
    },
    dependencies: [],
    validationState: 'ALIGNED',
    confidence: 1.0,
  };

  const created = await client.createUnit(coreStory);
  console.log('   ✅ Created:', created.id);

  // Test 2: Create operational unit that depends on core story
  console.log('\n2️⃣ Creating operational unit...');
  const operational = {
    id: 'operational_auth',
    type: 'operational',
    assertion: 'Use OAuth 2.0 for authentication',
    intent: {
      objective: 'Implement secure auth',
      constraints: {
        code: {
          required_libraries: ['jsonwebtoken'],
        },
      },
    },
    dependencies: ['core_story_test'],
    validationState: 'ALIGNED',
    confidence: 0.95,
    metadata: {
      tags: ['authentication', 'security'],
    },
  };

  const created2 = await client.createUnit(operational);
  console.log('   ✅ Created:', created2.id);

  // Test 3: Query intent
  console.log('\n3️⃣ Querying intent for "authentication"...');
  const intent = await client.queryIntent({
    operation: 'writing authentication code',
    context: {
      tags: ['authentication'],
    },
  });

  console.log('   📋 Intent Chain:');
  intent.intentChain.forEach(i => {
    console.log(`      [${i.type}] ${i.assertion}`);
  });

  console.log('\n   🔒 Merged Constraints:');
  console.log('      Required patterns:', intent.constraints.code?.required_patterns);
  console.log('      Forbidden patterns:', intent.constraints.code?.forbidden_patterns);
  console.log('      Required libraries:', intent.constraints.code?.required_libraries);

  // Test 4: Propagation impact
  console.log('\n4️⃣ Testing propagation impact...');
  const impact = await client.getPropagationImpact('core_story_test');
  console.log(`   🔄 Changing core_story_test would affect ${impact.length} units:`);
  impact.forEach(u => console.log(`      - ${u.id}`));

  // Test 5: Stats
  console.log('\n5️⃣ Graph statistics...');
  const stats = await client.getStats();
  console.log('   📊 Total units:', stats.total);
  console.log('   📊 By type:', stats.byType);

  // Clean up
  client.close();

  console.log('\n✅ All tests passed!\n');
}

test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
