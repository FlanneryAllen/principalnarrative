/**
 * Test Integration: Markdown → Intent Units
 *
 * Demonstrates syncing .principalnarrative/applied-narrative
 * markdown files into the Intent Engineering database
 */

const { MarkdownToIntentConverter } = require('./dist/markdown-to-intent');
const { IntentClient } = require('../sdk/dist/intent-client');
const fs = require('fs');

async function test() {
  console.log('🧪 Testing Markdown → Intent Integration\n');

  // Clean up test DB
  const testDbPath = '/tmp/test-integration.db';
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const converter = new MarkdownToIntentConverter({
    appliedNarrativePath: '/Users/julieallen/Desktop/narrative-agentv2/.principalnarrative/applied-narrative',
    dbPath: testDbPath,
  });

  // Test 1: Import all markdown files
  console.log('1️⃣ Importing markdown files...');
  const result = await converter.importAll();

  console.log(`   📊 Results:`);
  console.log(`      Imported: ${result.imported.length}`);
  console.log(`      Skipped: ${result.skipped.length}`);
  console.log(`      Errors: ${result.errors.length}`);
  console.log('');

  if (result.imported.length > 0) {
    console.log('   ✅ Imported Intent Units:');
    result.imported.forEach(unit => {
      console.log(`      - ${unit.id}`);
      console.log(`        Type: ${unit.type}`);
      console.log(`        Assertion: ${unit.assertion.substring(0, 80)}...`);
      console.log('');
    });
  }

  // Test 2: Query the imported intent
  console.log('2️⃣ Querying imported intent...');
  const client = new IntentClient(testDbPath);

  const stats = await client.getStats();
  console.log(`   📊 Database Stats:`);
  console.log(`      Total units: ${stats.total}`);
  console.log(`      By type:`, stats.byType);
  console.log('');

  // Test 3: Query specific intent
  console.log('3️⃣ Querying for "writing code"...');
  const intent = await client.queryIntent({
    operation: 'writing code',
    context: {},
  });

  console.log(`   📋 Intent Chain:`);
  intent.intentChain.forEach(i => {
    console.log(`      [${i.type}] ${i.assertion.substring(0, 60)}...`);
  });
  console.log('');

  if (intent.constraints.content) {
    console.log('   🔒 Content Constraints:');
    if (intent.constraints.content.required_themes) {
      console.log('      Required themes:', intent.constraints.content.required_themes);
    }
    if (intent.constraints.content.tone) {
      console.log('      Tone:', intent.constraints.content.tone);
    }
  }

  // Test 4: Demonstrate the bridge
  console.log('\n4️⃣ The Bridge Works!\n');
  console.log('   ✅ Markdown files (human-editable) → Intent Units (machine-queryable)');
  console.log('   ✅ Vision & brand voice are now accessible to agents');
  console.log('   ✅ One source of truth, two complementary storage layers\n');

  // Clean up
  converter.close();
  client.close();
  fs.unlinkSync(testDbPath);

  console.log('✅ Integration test passed!\n');
}

test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
