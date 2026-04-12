const { NarrativeClient } = require('../packages/sdk/dist/narrative-client');

async function test() {
  const client = new NarrativeClient('.narrative/narrative.db');

  const result = await client.queryNarrative({
    operation: 'writing authentication code',
    context: { tags: ['authentication', 'security', 'patient'] }
  });

  console.log('Forbidden patterns:', result.constraints.code?.forbidden_patterns?.length || 0);
  (result.constraints.code?.forbidden_patterns || []).forEach(p => console.log(`  ✗ ${p}`));

  client.close();
}

test();
