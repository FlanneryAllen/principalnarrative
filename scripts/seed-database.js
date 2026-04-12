#!/usr/bin/env node
/**
 * Seed Database Script
 *
 * Populates the narrative database with realistic example data
 */

const { NarrativeClient } = require('../packages/sdk/dist/narrative-client');
const fs = require('fs');
const path = require('path');

const examples = {
  'healthcare-saas': './examples/healthcare-saas-narrative-units.json',
  'narrative-agentv2': './examples/narrative-agentv2-narrative-units.json',
};

async function seedDatabase(exampleName = 'healthcare-saas', dbPath = '.narrative/narrative.db') {
  console.log('🌱 Seeding Narrative Database\n');

  const examplePath = examples[exampleName];
  if (!examplePath) {
    console.error(`❌ Unknown example: ${exampleName}`);
    console.log('Available examples:', Object.keys(examples).join(', '));
    process.exit(1);
  }

  if (!fs.existsSync(examplePath)) {
    console.error(`❌ Example file not found: ${examplePath}`);
    process.exit(1);
  }

  // Load example data
  const data = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));

  console.log(`📦 Loading: ${data.description}`);
  console.log(`   Company: ${data.company}`);
  console.log(`   Units: ${data.units.length}\n`);

  const client = new NarrativeClient(dbPath);

  // Check if database already has units
  const existing = client['graph'].getAllUnits();
  if (existing.length > 0) {
    console.log(`⚠️  Database already contains ${existing.length} units`);
    console.log('   This will add more units to the existing database.\n');

    // Simple confirmation (in real CLI we'd use inquirer)
    if (process.argv.includes('--force')) {
      console.log('   --force flag detected, proceeding...\n');
    } else {
      console.log('   Run with --force to proceed, or use --clear to start fresh\n');
      client.close();
      return;
    }
  }

  if (process.argv.includes('--clear')) {
    console.log('🗑️  Clearing existing database...');
    existing.forEach(unit => {
      try {
        client['graph'].deleteUnit(unit.id);
      } catch (e) {
        // Unit has dependents, skip
      }
    });
    // Try again after clearing dependents
    const remaining = client['graph'].getAllUnits();
    remaining.forEach(unit => {
      try {
        client['graph'].deleteUnit(unit.id);
      } catch (e) {
        console.log(`   Couldn't delete ${unit.id}:`, e.message);
      }
    });
    console.log('   ✅ Database cleared\n');
  }

  // Create units in dependency order (roots first)
  console.log('📝 Creating narrative units...\n');

  let created = 0;
  let errors = 0;

  for (const unit of data.units) {
    try {
      // Check if unit already exists
      const existingUnit = client['graph'].getUnit(unit.id);
      if (existingUnit) {
        console.log(`   ⏭️  Skipped ${unit.id} (already exists)`);
        continue;
      }

      await client.createUnit(unit);
      created++;

      const icon = {
        core_story: '🎯',
        positioning: '🏷️ ',
        product_narrative: '📦',
        operational: '⚙️ ',
        evidence: '📊',
        communication: '📢',
      }[unit.type] || '📝';

      console.log(`   ${icon} ${unit.id}`);
      console.log(`      ${unit.assertion.substring(0, 70)}...`);

      if (unit.dependencies.length > 0) {
        console.log(`      → Depends on: ${unit.dependencies.join(', ')}`);
      }
      console.log('');

    } catch (error) {
      errors++;
      console.error(`   ❌ Failed to create ${unit.id}`);
      console.error(`      ${error.message}\n`);
    }
  }

  // Show summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Seed complete!`);
  console.log(`   Created: ${created} units`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total in database: ${client['graph'].getAllUnits().length}`);

  // Show stats
  const stats = await client.getStats();
  console.log('\n📊 Database Stats:');
  console.log(`   Total units: ${stats.total}`);
  console.log(`   By type:`);
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`     ${type}: ${count}`);
  });

  client.close();

  console.log('\n🎉 Next steps:');
  console.log('   • Run: ./narrative');
  console.log('   • Select: "View Graph" to see the dependency structure');
  console.log('   • Select: "Query Intent" to simulate agent queries');
  console.log('   • Try query: "writing authentication code"\n');
}

// Parse arguments
const args = process.argv.slice(2);
const exampleName = args.find(a => !a.startsWith('--')) || 'healthcare-saas';
const dbPath = args.includes('--db')
  ? args[args.indexOf('--db') + 1]
  : '.narrative/narrative.db';

// Run
seedDatabase(exampleName, dbPath).catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
