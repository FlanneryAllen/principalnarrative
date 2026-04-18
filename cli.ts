#!/usr/bin/env node
/**
 * Intent Engineering CLI
 *
 * Main command-line interface for organizational intent infrastructure
 */

import { IntentClient } from './packages/sdk/dist/intent-client';
import { StorySignalMiner } from './packages/signal/dist/story-signal';
import { IntentValidator } from './packages/validator/dist/intent-validator';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0];

const CONFIG_PATH = '.narrative/config.json';
const DEFAULT_DB_PATH = '.narrative/intent.db';

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  }
  return { dbPath: DEFAULT_DB_PATH };
}

async function cmdCreate() {
  const config = loadConfig();
  const client = new IntentClient(config.dbPath);

  console.log('📝 Create Intent Unit\n');

  // For MVP, just print instructions
  // In production, this would be an interactive prompt
  console.log('To create an intent unit, use the Story Signal UI or programmatically:');
  console.log('');
  console.log('import { IntentClient } from "@narrative/sdk";');
  console.log('const client = new IntentClient();');
  console.log('await client.createUnit({ ... });');
  console.log('');
  console.log('Or use the Story Signal UI: static/story-signal.html');

  client.close();
}

async function cmdQuery() {
  const config = loadConfig();
  const client = new IntentClient(config.dbPath);

  const operation = args[1] ?? 'writing code';

  console.log(`🔍 Querying intent for: "${operation}"\n`);

  const intent = await client.queryIntent({
    operation,
    context: {},
  });

  if (intent.intentChain.length === 0) {
    console.log('No intent units found. Create some first!');
    client.close();
    return;
  }

  console.log('📋 Intent Chain:');
  intent.intentChain.forEach(i => {
    console.log(`   [${i.type}] ${i.assertion}`);
  });

  console.log('\n🔒 Constraints:');
  if (intent.constraints.code?.required_patterns?.length) {
    console.log('   Required patterns:', intent.constraints.code.required_patterns);
  }
  if (intent.constraints.code?.forbidden_patterns?.length) {
    console.log('   Forbidden patterns:', intent.constraints.code.forbidden_patterns);
  }
  if (intent.constraints.code?.required_libraries?.length) {
    console.log('   Required libraries:', intent.constraints.code.required_libraries);
  }

  console.log('');

  client.close();
}

async function cmdValidate() {
  const config = loadConfig();
  const validator = new IntentValidator(config.dbPath);

  console.log('🔍 Validating code against organizational intent\n');

  const result = await validator.validate({
    rootDir: process.cwd(),
    include: config.validation?.patterns?.include,
    exclude: config.validation?.patterns?.exclude,
    failOnWarning: config.validation?.failOnWarning,
  });

  console.log(`📊 Results:`);
  console.log(`   Files: ${result.filesChecked}`);
  console.log(`   Violations: ${result.violationsCount}`);
  console.log(`   Errors: ${result.errorsCount}`);
  console.log(`   Warnings: ${result.warningsCount}`);
  console.log('');

  if (result.violations.length > 0) {
    console.log('❌ Violations:');
    result.violations.slice(0, 10).forEach(v => {
      const file = path.relative(process.cwd(), v.file ?? '');
      console.log(`   ${v.severity === 'error' ? '❌' : '⚠️'} ${file}:${v.line ?? '?'}`);
      console.log(`      ${v.message}`);
    });

    if (result.violations.length > 10) {
      console.log(`   ... and ${result.violations.length - 10} more`);
    }
  }

  console.log('');
  console.log(result.passed ? '✅ Validation passed' : '❌ Validation failed');

  validator.close();
  process.exit(result.passed ? 0 : 1);
}

async function cmdStats() {
  const config = loadConfig();
  const client = new IntentClient(config.dbPath);

  const stats = await client.getStats();

  console.log('📊 Intent Graph Statistics\n');
  console.log(`Total Units: ${stats.total}`);
  console.log('');
  console.log('By Type:');
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });
  console.log('');
  console.log('By Validation State:');
  Object.entries(stats.byValidation).forEach(([state, count]) => {
    console.log(`   ${state}: ${count}`);
  });
  console.log('');

  // Signal stats
  const miner = new StorySignalMiner(config.dbPath);
  const signalStats = miner.getSignalStats();

  if (signalStats.totalConverted > 0) {
    console.log('📊 Story Signal Statistics\n');
    console.log(`Total Converted: ${signalStats.totalConverted}`);
    console.log(`Average Score: ${signalStats.averageScore.toFixed(2)}/100`);
    console.log(`Highest Score: ${signalStats.highestScore}/100`);
    console.log(`Lowest Score: ${signalStats.lowestScore}/100`);
    console.log('');
  }

  client.close();
  miner.close();
}

function cmdHelp() {
  console.log(`
Intent Engineering CLI - Making organizational intent machine-readable

Usage:
  narrative <command> [options]

Commands:
  create              Create a new intent unit (interactive)
  query <operation>   Query intent for an operation
  validate            Validate code against intent
  stats               Show intent graph statistics
  help                Show this help message

Examples:
  # Query intent
  narrative query "writing authentication code"

  # Validate code
  narrative validate

  # Show statistics
  narrative stats

Files:
  .narrative/config.json    Configuration
  .narrative/intent.db      Intent database
  .narrative/README.md      Documentation

Web UI:
  static/story-signal.html  Story Signal capture tool

For more information, see INTENT_ENGINEERING_README.md
  `);
}

async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    cmdHelp();
    return;
  }

  try {
    switch (command) {
      case 'create':
        await cmdCreate();
        break;
      case 'query':
        await cmdQuery();
        break;
      case 'validate':
        await cmdValidate();
        break;
      case 'stats':
        await cmdStats();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Run "narrative help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
