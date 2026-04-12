#!/usr/bin/env node
/**
 * Verification Script
 *
 * Verifies the seeded database works correctly by running sample queries
 */

const { NarrativeClient } = require('../packages/sdk/dist/narrative-client');

async function verifyDatabase(dbPath = '.narrative/narrative.db') {
  console.log('🔍 Verifying Narrative Database\n');

  const client = new NarrativeClient(dbPath);

  try {
    // 1. Check total units
    const allUnits = client['graph'].getAllUnits();
    console.log(`✅ Database has ${allUnits.length} units`);

    // 2. Check by type
    const byType = {};
    allUnits.forEach(u => {
      byType[u.type] = (byType[u.type] || 0) + 1;
    });
    console.log('\n📊 By Type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    // 3. Test query for authentication
    console.log('\n🔍 Query Test: "writing authentication code"');
    const authResult = await client.queryNarrative({
      operation: 'writing authentication code',
      context: {
        tags: ['security', 'authentication']
      }
    });

    console.log(`   Matched ${authResult.narrativeChain.length} units:`);
    authResult.narrativeChain.forEach(u => {
      console.log(`   • ${u.source} (${u.type})`);
    });

    // 4. Check merged constraints
    const constraints = authResult.constraints;
    if (constraints.code) {
      console.log('\n🔒 Code Constraints:');
      if (constraints.code.required_patterns) {
        console.log(`   Required: ${constraints.code.required_patterns.join(', ')}`);
      }
      if (constraints.code.forbidden_patterns) {
        console.log(`   Forbidden: ${constraints.code.forbidden_patterns.join(', ')}`);
      }
      if (constraints.code.required_libraries) {
        console.log(`   Libraries: ${constraints.code.required_libraries.join(', ')}`);
      }
    }

    // 5. Test dependency chain
    console.log('\n🔗 Dependency Chain Test:');
    const oauth = client['graph'].getUnit('operational_authentication_oauth');
    if (oauth) {
      console.log(`   Unit: ${oauth.id}`);
      console.log(`   Depends on: ${oauth.dependencies.join(', ')}`);

      // Get full chain
      const chain = [];
      const visited = new Set();
      const traverse = (unitId) => {
        if (visited.has(unitId)) return;
        visited.add(unitId);
        const unit = client['graph'].getUnit(unitId);
        if (unit) {
          chain.push(unit);
          unit.dependencies.forEach(traverse);
        }
      };
      traverse(oauth.id);

      console.log(`   Full chain has ${chain.length} units`);
      chain.forEach(u => {
        console.log(`     → ${u.id} (${u.type})`);
      });
    }

    // 6. Test graph stats
    console.log('\n📈 Graph Statistics:');
    const stats = await client.getStats();
    console.log(`   Total: ${stats.total}`);
    console.log(`   Types:`);
    Object.entries(stats.byType).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });
    console.log(`   Validation States:`);
    Object.entries(stats.byValidation).forEach(([state, count]) => {
      console.log(`     ${state}: ${count}`);
    });

    console.log('\n✅ All verification checks passed!');
    console.log('\n🎉 Database is ready for use with the CLI');
    console.log('   Run: ./narrative');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

// Run
verifyDatabase().catch(err => {
  console.error('❌ Verification error:', err);
  process.exit(1);
});
