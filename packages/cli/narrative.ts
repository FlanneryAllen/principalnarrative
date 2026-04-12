#!/usr/bin/env node
/**
 * Narrative CLI - Comprehensive command-line interface
 *
 * Making Narrative Intelligence accessible without writing code
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import boxen from 'boxen';
import {
  NarrativeClient,
  NarrativeUnit,
  NarrativeType,
  ValidationState,
  StakeholderPreset,
  NarrativeSubgraph,
  PropagationResult,
  CoverageResult,
  DriftResult,
  NarrativeMetrics,
} from '@narrative/sdk';
import { StorySignalMiner, StoryCapture } from '@narrative/signal';
import { NarrativeValidator } from '@narrative/validator';
import { MarkdownToNarrativeConverter } from '@narrative/integrations';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = '.narrative/config.json';
const DEFAULT_DB_PATH = '.narrative/intent.db';

interface Config {
  dbPath: string;
  validation?: any;
  signal?: any;
}

function loadConfig(): Config {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  }
  return { dbPath: DEFAULT_DB_PATH };
}

async function mainMenu() {
  console.clear();
  console.log(boxen(
    chalk.bold.blue('Narrative Intelligence CLI') + '\n' +
    chalk.gray('Making organizational narrative machine-readable'),
    { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'blue' }
  ));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '📝 Create Intent Unit', value: 'create' },
        { name: '🔍 Query Intent', value: 'query' },
        { name: '📊 View Graph', value: 'graph' },
        { name: '📋 List All Units', value: 'list' },
        { name: '🎯 Capture Story Signal', value: 'signal' },
        { name: '🔄 Sync Markdown → Database', value: 'sync' },
        { name: '✅ Validate Code', value: 'validate' },
        { name: '📈 Show Statistics', value: 'stats' },
        new inquirer.Separator(chalk.gray('── Narrative Algebra ──')),
        { name: '🧮 Compose Stakeholder View', value: 'algebra-compose' },
        { name: '🌊 Propagation Impact', value: 'algebra-propagate' },
        { name: '📐 NCI Report', value: 'algebra-nci' },
        { name: '🔀 Drift Report', value: 'algebra-drift' },
        { name: '🎯 Resonate Signal', value: 'algebra-resonate' },
        new inquirer.Separator(chalk.gray('────────────────────')),
        { name: '🔧 Manage Units', value: 'manage' },
        { name: '❌ Exit', value: 'exit' },
      ],
      pageSize: 18,
    },
  ]);

  switch (action) {
    case 'create':
      await createNarrativeUnit();
      break;
    case 'query':
      await queryNarrative();
      break;
    case 'graph':
      await viewGraph();
      break;
    case 'list':
      await listUnits();
      break;
    case 'signal':
      await captureSignal();
      break;
    case 'sync':
      await syncMarkdown();
      break;
    case 'validate':
      await validateCode();
      break;
    case 'stats':
      await showStats();
      break;
    case 'algebra-compose':
      await algebraCompose();
      break;
    case 'algebra-propagate':
      await algebraPropagate();
      break;
    case 'algebra-nci':
      await algebraNCI();
      break;
    case 'algebra-drift':
      await algebraDrift();
      break;
    case 'algebra-resonate':
      await algebraResonate();
      break;
    case 'manage':
      await manageUnits();
      break;
    case 'exit':
      console.log(chalk.blue('\n👋 Goodbye!\n'));
      process.exit(0);
  }

  // Return to main menu
  await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
  await mainMenu();
}

async function createNarrativeUnit() {
  console.log(chalk.bold.blue('\n📝 Create Intent Unit\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'id',
      message: 'Unit ID (snake_case):',
      validate: (input) => /^[a-z][a-z0-9_]*$/.test(input) || 'Must be snake_case',
    },
    {
      type: 'list',
      name: 'type',
      message: 'Intent Type:',
      choices: [
        { name: 'Core Story (strategic intent)', value: 'core_story' },
        { name: 'Positioning (market claims)', value: 'positioning' },
        { name: 'Product Narrative (capabilities)', value: 'product_narrative' },
        { name: 'Operational (execution)', value: 'operational' },
        { name: 'Evidence (validation data)', value: 'evidence' },
        { name: 'Communication (messaging)', value: 'communication' },
      ],
    },
    {
      type: 'input',
      name: 'assertion',
      message: 'Assertion (what is this unit claiming?):',
      validate: (input) => input.length > 0 || 'Assertion required',
    },
    {
      type: 'input',
      name: 'objective',
      message: 'Objective (what does the org want?):',
      validate: (input) => input.length > 0 || 'Objective required',
    },
    {
      type: 'confirm',
      name: 'hasConstraints',
      message: 'Add constraints (code/content rules)?',
      default: true,
    },
  ]);

  let constraints: any = {};

  if (answers.hasConstraints) {
    const { constraintType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'constraintType',
        message: 'What type of constraints?',
        choices: ['Code Constraints', 'Content Constraints', 'Both'],
      },
    ]);

    if (constraintType === 'Code Constraints' || constraintType === 'Both') {
      const codeAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'requiredPatterns',
          message: 'Required patterns (comma-separated):',
          filter: (input) => input ? input.split(',').map((s: string) => s.trim()) : [],
        },
        {
          type: 'input',
          name: 'forbiddenPatterns',
          message: 'Forbidden patterns (comma-separated):',
          filter: (input) => input ? input.split(',').map((s: string) => s.trim()) : [],
        },
        {
          type: 'input',
          name: 'requiredLibraries',
          message: 'Required libraries (comma-separated):',
          filter: (input) => input ? input.split(',').map((s: string) => s.trim()) : [],
        },
      ]);

      constraints.code = {
        required_patterns: codeAnswers.requiredPatterns,
        forbidden_patterns: codeAnswers.forbiddenPatterns,
        required_libraries: codeAnswers.requiredLibraries,
      };
    }

    if (constraintType === 'Content Constraints' || constraintType === 'Both') {
      const contentAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'tone',
          message: 'Tone:',
          choices: ['professional', 'casual', 'technical', 'empathetic', 'urgent'],
        },
        {
          type: 'input',
          name: 'requiredThemes',
          message: 'Required themes (comma-separated):',
          filter: (input) => input ? input.split(',').map((s: string) => s.trim()) : [],
        },
        {
          type: 'input',
          name: 'forbiddenThemes',
          message: 'Forbidden themes (comma-separated):',
          filter: (input) => input ? input.split(',').map((s: string) => s.trim()) : [],
        },
      ]);

      constraints.content = {
        tone: contentAnswers.tone,
        required_themes: contentAnswers.requiredThemes,
        forbidden_themes: contentAnswers.forbiddenThemes,
      };
    }
  }

  const { hasDependencies } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'hasDependencies',
      message: 'Does this depend on other intent units?',
      default: false,
    },
  ]);

  let dependencies: string[] = [];
  if (hasDependencies) {
    const config = loadConfig();
    const client = new NarrativeClient(config.dbPath);
    const allUnits = client['graph'].getAllUnits();
    client.close();

    if (allUnits.length > 0) {
      const { selectedDeps } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedDeps',
          message: 'Select dependencies:',
          choices: allUnits.map((u: NarrativeUnit) => ({
            name: `${u.id} (${u.type})`,
            value: u.id,
          })),
        },
      ]);
      dependencies = selectedDeps;
    } else {
      console.log(chalk.yellow('  No existing units to depend on'));
    }
  }

  // Create the unit
  const spinner = ora('Creating intent unit...').start();

  const unit: NarrativeUnit = {
    id: answers.id,
    type: answers.type as NarrativeType,
    assertion: answers.assertion,
    intent: {
      objective: answers.objective,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
    },
    dependencies,
    validationState: 'ALIGNED' as ValidationState,
    confidence: 1.0,
    metadata: {
      created_at: new Date().toISOString(),
      created_by: 'cli',
      tags: [answers.type],
    },
  };

  try {
    const config = loadConfig();
    const client = new NarrativeClient(config.dbPath);
    const created = await client.createUnit(unit);
    client.close();

    spinner.succeed(chalk.green('Intent unit created successfully!'));
    console.log(chalk.gray('\n' + JSON.stringify(created, null, 2)));
  } catch (error) {
    spinner.fail(chalk.red('Failed to create unit'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function queryNarrative() {
  console.log(chalk.bold.blue('\n🔍 Query Intent\n'));

  const { operation } = await inquirer.prompt([
    {
      type: 'input',
      name: 'operation',
      message: 'What operation are you performing?',
      default: 'writing code',
    },
  ]);

  const { addTags } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addTags',
      message: 'Add context tags?',
      default: false,
    },
  ]);

  let tags: string[] = [];
  if (addTags) {
    const { tagsInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'tagsInput',
        message: 'Tags (comma-separated):',
      },
    ]);
    tags = tagsInput.split(',').map((s: string) => s.trim());
  }

  const spinner = ora('Querying intent...').start();

  try {
    const config = loadConfig();
    const client = new NarrativeClient(config.dbPath);

    const intent = await client.queryNarrative({
      operation,
      context: { tags },
    });

    client.close();
    spinner.succeed(chalk.green('Query complete!'));

    if (intent.narrativeChain.length === 0) {
      console.log(chalk.yellow('\n  No matching intent units found'));
      console.log(chalk.gray('  Try different keywords or create new intent units'));
      return;
    }

    console.log(chalk.bold('\n📋 Intent Chain:'));
    intent.narrativeChain.forEach(i => {
      console.log(chalk.cyan(`  [${i.type}]`) + ` ${i.assertion}`);
    });

    if (intent.constraints.code) {
      console.log(chalk.bold('\n🔒 Code Constraints:'));
      if (intent.constraints.code.required_patterns?.length) {
        console.log('  Required patterns:', chalk.green(intent.constraints.code.required_patterns.join(', ')));
      }
      if (intent.constraints.code.forbidden_patterns?.length) {
        console.log('  Forbidden patterns:', chalk.red(intent.constraints.code.forbidden_patterns.join(', ')));
      }
      if (intent.constraints.code.required_libraries?.length) {
        console.log('  Required libraries:', chalk.blue(intent.constraints.code.required_libraries.join(', ')));
      }
    }

    if (intent.constraints.content) {
      console.log(chalk.bold('\n📝 Content Constraints:'));
      if (intent.constraints.content.tone) {
        console.log('  Tone:', chalk.cyan(intent.constraints.content.tone));
      }
      if (intent.constraints.content.required_themes?.length) {
        console.log('  Required themes:', chalk.green(intent.constraints.content.required_themes.join(', ')));
      }
      if (intent.constraints.content.forbidden_themes?.length) {
        console.log('  Forbidden themes:', chalk.red(intent.constraints.content.forbidden_themes.join(', ')));
      }
    }

    if (intent.evidenceRequired?.length) {
      console.log(chalk.bold('\n📊 Evidence Required:'));
      intent.evidenceRequired.forEach(e => console.log(`  - ${e}`));
    }

  } catch (error) {
    spinner.fail(chalk.red('Query failed'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function viewGraph() {
  console.log(chalk.bold.blue('\n📊 Intent Graph\n'));

  const config = loadConfig();
  const client = new NarrativeClient(config.dbPath);
  const units = client['graph'].getAllUnits();
  client.close();

  if (units.length === 0) {
    console.log(chalk.yellow('  No intent units yet'));
    return;
  }

  // Build adjacency list for visualization
  const graph = new Map<string, string[]>();
  units.forEach((u: NarrativeUnit) => {
    if (!graph.has(u.id)) graph.set(u.id, []);
    u.dependencies.forEach((dep: string) => {
      if (!graph.has(dep)) graph.set(dep, []);
      graph.get(dep)!.push(u.id);
    });
  });

  // Group by type
  const byType = units.reduce((acc: Record<string, NarrativeUnit[]>, u: NarrativeUnit) => {
    if (!acc[u.type]) acc[u.type] = [];
    acc[u.type].push(u);
    return acc;
  }, {} as Record<string, NarrativeUnit[]>);

  console.log(chalk.bold('Intent Graph Visualization:\n'));

  const typeOrder: NarrativeType[] = ['core_story', 'positioning', 'product_narrative', 'operational', 'evidence', 'communication'];

  typeOrder.forEach((type: NarrativeType) => {
    if (byType[type]) {
      console.log(chalk.bold.cyan(`\n${type.toUpperCase().replace('_', ' ')}:`));
      byType[type].forEach((unit: NarrativeUnit) => {
        const deps = unit.dependencies.length > 0
          ? chalk.gray(` (depends on: ${unit.dependencies.join(', ')})`)
          : '';
        const dependents = graph.get(unit.id)?.length || 0;
        const depInfo = dependents > 0
          ? chalk.blue(` [${dependents} dependent${dependents > 1 ? 's' : ''}]`)
          : '';

        console.log(`  • ${chalk.green(unit.id)}${deps}${depInfo}`);
        console.log(chalk.gray(`    "${unit.assertion.substring(0, 60)}..."`));
      });
    }
  });

  console.log(chalk.bold('\n\nGraph Statistics:'));
  console.log(`  Total units: ${units.length}`);
  console.log(`  Root units (no dependencies): ${units.filter((u: NarrativeUnit) => u.dependencies.length === 0).length}`);
  console.log(`  Leaf units (no dependents): ${units.filter((u: NarrativeUnit) => !graph.get(u.id)?.length).length}`);
}

async function listUnits() {
  console.log(chalk.bold.blue('\n📋 All Intent Units\n'));

  const config = loadConfig();
  const client = new NarrativeClient(config.dbPath);
  const units = client['graph'].getAllUnits();
  client.close();

  if (units.length === 0) {
    console.log(chalk.yellow('  No intent units yet'));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Type'),
      chalk.cyan('Assertion'),
      chalk.cyan('State'),
      chalk.cyan('Deps'),
    ],
    colWidths: [30, 20, 50, 12, 8],
    wordWrap: true,
  });

  units.forEach((unit: NarrativeUnit) => {
    table.push([
      unit.id,
      unit.type,
      unit.assertion.substring(0, 47) + '...',
      unit.validationState,
      unit.dependencies.length.toString(),
    ]);
  });

  console.log(table.toString());
}

async function captureSignal() {
  console.log(chalk.bold.blue('\n🎯 Capture Story Signal\n'));
  console.log(chalk.gray('Use the 5 R\'s framework to score organizational stories\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'story',
      message: 'Story or insight:',
      validate: (input) => input.length > 0 || 'Story required',
    },
    {
      type: 'input',
      name: 'source',
      message: 'Source (e.g., slack://leadership):',
      default: 'cli',
    },
    {
      type: 'number',
      name: 'resonance',
      message: 'Resonance (0-20, how emotionally compelling?):',
      default: 10,
      validate: (input) => (input >= 0 && input <= 20) || 'Must be 0-20',
    },
    {
      type: 'number',
      name: 'relevance',
      message: 'Relevance (0-20, how relevant to strategy?):',
      default: 10,
      validate: (input) => (input >= 0 && input <= 20) || 'Must be 0-20',
    },
    {
      type: 'number',
      name: 'rarity',
      message: 'Rarity (0-20, how unique/novel?):',
      default: 10,
      validate: (input) => (input >= 0 && input <= 20) || 'Must be 0-20',
    },
    {
      type: 'number',
      name: 'relatability',
      message: 'Relatability (0-20, can stakeholders relate?):',
      default: 10,
      validate: (input) => (input >= 0 && input <= 20) || 'Must be 0-20',
    },
    {
      type: 'number',
      name: 'riskReward',
      message: 'Risk/Reward (0-20, potential impact?):',
      default: 10,
      validate: (input) => (input >= 0 && input <= 20) || 'Must be 0-20',
    },
  ]);

  const capture: StoryCapture = {
    story: answers.story,
    source: answers.source,
    dimensions: {
      resonance: answers.resonance,
      relevance: answers.relevance,
      rarity: answers.rarity,
      relatability: answers.relatability,
      riskReward: answers.riskReward,
    },
  };

  const config = loadConfig();
  const miner = new StorySignalMiner(config.dbPath, {
    autoConvertThreshold: config.signal?.autoConvertThreshold ?? 85,
    requireReview: false,
  });

  const totalScore = miner.calculateScore(capture.dimensions);

  console.log(chalk.bold(`\n📊 Total Score: ${totalScore}/100`));

  if (totalScore >= (config.signal?.autoConvertThreshold ?? 85)) {
    console.log(chalk.green('✨ High-value signal! Auto-converting to intent unit...'));

    const result = await miner.processSignal(capture);
    if (result.intentUnit) {
      console.log(chalk.green(`\n✅ Created intent unit: ${result.intentUnit.id}`));
      console.log(chalk.gray(JSON.stringify(result.intentUnit, null, 2)));
    }
  } else {
    console.log(chalk.yellow(`\n⚠️  Score below threshold (${config.signal?.autoConvertThreshold ?? 85})`));

    const { convert } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'convert',
        message: 'Convert to intent unit anyway?',
        default: false,
      },
    ]);

    if (convert) {
      const intentUnit = await miner.convertToNarrativeUnit(capture);
      console.log(chalk.green(`\n✅ Created intent unit: ${intentUnit.id}`));
    }
  }

  miner.close();
}

async function syncMarkdown() {
  console.log(chalk.bold.blue('\n🔄 Sync Markdown → Database\n'));

  const spinner = ora('Syncing markdown files...').start();

  try {
    const converter = new MarkdownToNarrativeConverter({
      appliedNarrativePath: '.principalnarrative/applied-narrative',
      dbPath: loadConfig().dbPath,
    });

    const result = await converter.sync();
    converter.close();

    spinner.succeed(chalk.green('Sync complete!'));

    console.log(chalk.bold('\n📊 Results:'));
    console.log(`  Created: ${chalk.green(result.created)}`);
    console.log(`  Updated: ${chalk.yellow(result.updated)}`);
    console.log(`  Unchanged: ${chalk.gray(result.unchanged)}`);

  } catch (error) {
    spinner.fail(chalk.red('Sync failed'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function validateCode() {
  console.log(chalk.bold.blue('\n✅ Validate Code\n'));

  const spinner = ora('Validating code against intent...').start();

  try {
    const config = loadConfig();
    const validator = new NarrativeValidator(config.dbPath);

    const result = await validator.validate({
      rootDir: process.cwd(),
      include: config.validation?.patterns?.include,
      exclude: config.validation?.patterns?.exclude,
      failOnWarning: config.validation?.failOnWarning,
    });

    validator.close();

    if (result.passed) {
      spinner.succeed(chalk.green('Validation passed!'));
    } else {
      spinner.fail(chalk.red('Validation failed'));
    }

    console.log(chalk.bold('\n📊 Results:'));
    console.log(`  Files checked: ${result.filesChecked}`);
    console.log(`  Violations: ${result.violationsCount}`);
    console.log(`  Errors: ${chalk.red(result.errorsCount)}`);
    console.log(`  Warnings: ${chalk.yellow(result.warningsCount)}`);

    if (result.violations.length > 0) {
      console.log(chalk.bold('\n❌ Violations:'));
      result.violations.slice(0, 5).forEach(v => {
        const file = path.relative(process.cwd(), v.file ?? '');
        console.log(chalk.red(`  ${file}:${v.line ?? '?'}`));
        console.log(`    ${v.message}`);
        if (v.suggestion) {
          console.log(chalk.gray(`    💡 ${v.suggestion}`));
        }
      });

      if (result.violations.length > 5) {
        console.log(chalk.gray(`\n  ... and ${result.violations.length - 5} more`));
      }
    }

  } catch (error) {
    spinner.fail(chalk.red('Validation error'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function showStats() {
  console.log(chalk.bold.blue('\n📈 Statistics\n'));

  const config = loadConfig();
  const client = new NarrativeClient(config.dbPath);
  const stats = await client.getStats();
  client.close();

  console.log(chalk.bold('Intent Graph:'));
  console.log(`  Total units: ${chalk.cyan(stats.total)}`);

  console.log(chalk.bold('\n  By Type:'));
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`    ${type}: ${chalk.cyan(count)}`);
  });

  console.log(chalk.bold('\n  By Validation State:'));
  Object.entries(stats.byValidation).forEach(([state, count]) => {
    const color = state === 'ALIGNED' ? chalk.green : state === 'BROKEN' ? chalk.red : chalk.yellow;
    console.log(`    ${state}: ${color(count)}`);
  });

  // Signal stats
  const miner = new StorySignalMiner(config.dbPath);
  const signalStats = miner.getSignalStats();
  miner.close();

  if (signalStats.totalConverted > 0) {
    console.log(chalk.bold('\nStory Signals:'));
    console.log(`  Total converted: ${chalk.cyan(signalStats.totalConverted)}`);
    console.log(`  Average score: ${chalk.cyan(signalStats.averageScore.toFixed(2))}/100`);
    console.log(`  Highest score: ${chalk.green(signalStats.highestScore)}/100`);
    console.log(`  Lowest score: ${chalk.yellow(signalStats.lowestScore)}/100`);
  }
}

async function manageUnits() {
  console.log(chalk.bold.blue('\n🔧 Manage Units\n'));

  const config = loadConfig();
  const client = new NarrativeClient(config.dbPath);
  const units = client['graph'].getAllUnits();

  if (units.length === 0) {
    console.log(chalk.yellow('  No units to manage'));
    client.close();
    return;
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'View Unit Details', value: 'view' },
        { name: 'Update Validation State', value: 'update' },
        { name: 'Delete Unit', value: 'delete' },
        { name: 'Export Unit (JSON)', value: 'export' },
        { name: 'Back to Main Menu', value: 'back' },
      ],
    },
  ]);

  if (action === 'back') {
    client.close();
    return;
  }

  const { unitId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'unitId',
      message: 'Select unit:',
      choices: units.map((u: NarrativeUnit) => ({
        name: `${u.id} (${u.type})`,
        value: u.id,
      })),
      pageSize: 15,
    },
  ]);

  const unit = client['graph'].getUnit(unitId);
  if (!unit) {
    console.log(chalk.red('  Unit not found'));
    client.close();
    return;
  }

  switch (action) {
    case 'view':
      console.log(chalk.bold('\nUnit Details:'));
      console.log(chalk.gray(JSON.stringify(unit, null, 2)));
      break;

    case 'update':
      const { newState } = await inquirer.prompt([
        {
          type: 'list',
          name: 'newState',
          message: 'New validation state:',
          choices: ['ALIGNED', 'DRIFTED', 'BROKEN', 'UNKNOWN'],
        },
      ]);
      client['graph'].updateValidationState(unitId, newState as ValidationState, unit.confidence);
      console.log(chalk.green(`\n✅ Updated ${unitId} to ${newState}`));
      break;

    case 'delete':
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.red(`Are you sure you want to delete ${unitId}?`),
          default: false,
        },
      ]);
      if (confirm) {
        try {
          client['graph'].deleteUnit(unitId);
          console.log(chalk.green(`\n✅ Deleted ${unitId}`));
        } catch (error) {
          console.log(chalk.red(`\n❌ Cannot delete: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
      break;

    case 'export':
      const filename = `${unitId}.json`;
      fs.writeFileSync(filename, JSON.stringify(unit, null, 2));
      console.log(chalk.green(`\n✅ Exported to ${filename}`));
      break;
  }

  client.close();
}

// =============================================================================
// Narrative Algebra Commands
// =============================================================================

const STAKEHOLDER_CHOICES: Array<{ name: string; value: StakeholderPreset }> = [
  { name: 'Board — core story, positioning, evidence (depth 2)', value: 'board' },
  { name: 'Investor — core story, positioning, evidence (depth 3)', value: 'investor' },
  { name: 'Engineering — product, operational, evidence (full depth)', value: 'engineering' },
  { name: 'Compliance — operational, evidence, core story (full depth)', value: 'compliance' },
  { name: 'Customer — product, communication, positioning (depth 3)', value: 'customer' },
  { name: 'Marketing — positioning, communication, product (depth 3)', value: 'marketing' },
];

function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function stateColor(state: ValidationState): string {
  switch (state) {
    case 'ALIGNED': return chalk.green(state);
    case 'DRIFTED': return chalk.yellow(state);
    case 'BROKEN':  return chalk.red(state);
    default:        return chalk.gray(state);
  }
}

async function algebraCompose() {
  console.log(boxen(
    chalk.bold.magenta('Σ  Compose Stakeholder View') + '\n' +
    chalk.gray('Filter the narrative graph for a specific audience'),
    { padding: 1, borderStyle: 'round', borderColor: 'magenta' }
  ));

  const { preset } = await inquirer.prompt([
    {
      type: 'list',
      name: 'preset',
      message: 'Select stakeholder view:',
      choices: STAKEHOLDER_CHOICES,
    },
  ]);

  const spinner = ora('Composing subgraph...').start();

  try {
    const config = loadConfig();
    const client = new NarrativeClient(config.dbPath);
    const subgraph = client.composeForStakeholder(preset as StakeholderPreset);
    const coverage = client.coverSubgraph(subgraph);
    client.close();

    spinner.succeed(chalk.green(`Composed ${preset} view`));

    // Summary box
    console.log(boxen(
      chalk.bold(`${preset.toUpperCase()} VIEW`) + '\n\n' +
      `Units: ${chalk.cyan(subgraph.units.length.toString())}    ` +
      `Edges: ${chalk.cyan(subgraph.edges.length.toString())}    ` +
      `Coverage: ${chalk.cyan(formatPercent(coverage.coverage))}`,
      { padding: 1, borderStyle: 'single', borderColor: 'cyan' }
    ));

    // Units table
    if (subgraph.units.length > 0) {
      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Layer'),
          chalk.cyan('State'),
          chalk.cyan('Confidence'),
          chalk.cyan('Assertion'),
        ],
        colWidths: [25, 20, 10, 12, 50],
        wordWrap: true,
      });

      subgraph.units.forEach(u => {
        table.push([
          u.id,
          u.type,
          stateColor(u.validationState),
          formatPercent(u.confidence),
          u.assertion.substring(0, 47) + (u.assertion.length > 47 ? '...' : ''),
        ]);
      });

      console.log(table.toString());
    }

    // Layer coverage breakdown
    console.log(chalk.bold('\n  Layer Coverage:'));
    for (const [layer, data] of Object.entries(coverage.byLayer)) {
      if (data.total > 0) {
        const bar = '█'.repeat(Math.round(data.coverage * 20)).padEnd(20, '░');
        console.log(`    ${layer.padEnd(20)} ${chalk.cyan(bar)} ${formatPercent(data.coverage)} (${data.aligned}/${data.total})`);
      }
    }

    // Gaps
    if (coverage.gaps.length > 0) {
      console.log(chalk.bold.yellow(`\n  ⚠ ${coverage.gaps.length} gap(s) (no evidence backing):`));
      coverage.gaps.slice(0, 5).forEach(g => {
        console.log(chalk.yellow(`    • ${g.id}: "${g.assertion.substring(0, 50)}..."`);
      });
      if (coverage.gaps.length > 5) {
        console.log(chalk.gray(`    ... and ${coverage.gaps.length - 5} more`));
      }
    }

    console.log(chalk.gray(`\n  Provenance: ${subgraph.provenance.operation} @ ${subgraph.provenance.timestamp}`));

  } catch (error) {
    spinner.fail(chalk.red('Compose failed'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function algebraPropagate() {
  console.log(boxen(
    chalk.bold.magenta('Δ  Propagation Impact') + '\n' +
    chalk.gray('What happens when a unit changes?'),
    { padding: 1, borderStyle: 'round', borderColor: 'magenta' }
  ));

  const config = loadConfig();
  const client = new NarrativeClient(config.dbPath);
  const allUnits = client['graph'].getAllUnits();

  if (allUnits.length === 0) {
    console.log(chalk.yellow('  No units in the graph'));
    client.close();
    return;
  }

  const { unitId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'unitId',
      message: 'Select the unit that would change:',
      choices: allUnits.map((u: NarrativeUnit) => ({
        name: `${u.id} (${u.type}) — "${u.assertion.substring(0, 40)}..."`,
        value: u.id,
      })),
      pageSize: 15,
    },
  ]);

  const spinner = ora('Computing propagation...').start();

  try {
    const result = client.propagate(unitId);
    client.close();

    spinner.succeed(chalk.green('Propagation computed'));

    console.log(boxen(
      chalk.bold(`Impact of changing: ${unitId}`) + '\n\n' +
      `Affected units: ${chalk.cyan(result.affectedUnits.length.toString())}    ` +
      `Scope: ${chalk.cyan(formatPercent(result.scope))} of graph`,
      { padding: 1, borderStyle: 'single', borderColor: 'yellow' }
    ));

    if (result.affectedUnits.length > 0) {
      // Group by layer
      console.log(chalk.bold('\n  Impact by Layer:'));
      for (const [layer, units] of Object.entries(result.byLayer)) {
        if ((units as NarrativeUnit[]).length > 0) {
          console.log(chalk.bold.cyan(`\n    ${layer.toUpperCase()}:`));
          (units as NarrativeUnit[]).forEach(u => {
            console.log(`      ${stateColor(u.validationState)} ${u.id} — "${u.assertion.substring(0, 45)}..."`);
          });
        }
      }
    } else {
      console.log(chalk.gray('\n  No downstream units affected — this is a leaf node.'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Propagation failed'));
    client.close();
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function algebraNCI() {
  console.log(boxen(
    chalk.bold.magenta('NCI  Narrative Coherence Report') + '\n' +
    chalk.gray('NCI(G) = |{n ∈ G | V(n) = ALIGNED}| / |G|'),
    { padding: 1, borderStyle: 'round', borderColor: 'magenta' }
  ));

  const spinner = ora('Computing metrics...').start();

  try {
    const config = loadConfig();
    const client = new NarrativeClient(config.dbPath);
    const metrics = client.computeMetrics();
    const coverage = client.cover();
    const drift = client.drift();
    client.close();

    spinner.succeed(chalk.green('Metrics computed'));

    // NCI headline
    const nciValue = metrics.narrativeCoherenceIndex;
    const nciColor = nciValue >= 0.8 ? chalk.green : nciValue >= 0.5 ? chalk.yellow : chalk.red;
    const nciBar = '█'.repeat(Math.round(nciValue * 30)).padEnd(30, '░');

    console.log(boxen(
      chalk.bold('NARRATIVE COHERENCE INDEX') + '\n\n' +
      `  ${nciColor(nciBar)}  ${nciColor(formatPercent(nciValue))}` + '\n\n' +
      `  Total Units: ${chalk.cyan(metrics.totalUnits.toString())}    ` +
      `Total Edges: ${chalk.cyan(metrics.totalEdges.toString())}    ` +
      `Coverage: ${chalk.cyan(formatPercent(metrics.coverageRatio))}    ` +
      `Drift: ${chalk.cyan(formatPercent(drift.driftRate))}`,
      { padding: 1, borderStyle: 'double', borderColor: nciValue >= 0.8 ? 'green' : nciValue >= 0.5 ? 'yellow' : 'red' }
    ));

    // Layer health table
    const table = new Table({
      head: [
        chalk.cyan('Layer'),
        chalk.cyan('NCI'),
        chalk.cyan('Units'),
        chalk.cyan('Aligned'),
        chalk.cyan('Drifted'),
        chalk.cyan('Broken'),
        chalk.cyan('Coverage'),
        chalk.cyan('Health'),
      ],
      colWidths: [22, 8, 8, 9, 9, 8, 10, 22],
    });

    const layerOrder: NarrativeType[] = [
      'core_story', 'positioning', 'product_narrative',
      'operational', 'evidence', 'communication',
    ];

    layerOrder.forEach(layer => {
      const health = metrics.layerHealth[layer];
      if (health.unitCount > 0) {
        const bar = '█'.repeat(Math.round(health.nci * 15)).padEnd(15, '░');
        const barColor = health.nci >= 0.8 ? chalk.green : health.nci >= 0.5 ? chalk.yellow : chalk.red;
        table.push([
          layer,
          formatPercent(health.nci),
          health.unitCount.toString(),
          chalk.green(health.alignedCount.toString()),
          health.driftedCount > 0 ? chalk.yellow(health.driftedCount.toString()) : '0',
          health.brokenCount > 0 ? chalk.red(health.brokenCount.toString()) : '0',
          formatPercent(coverage.byLayer[layer]?.coverage ?? 0),
          barColor(bar),
        ]);
      }
    });

    console.log(table.toString());

    // Gaps & orphans
    if (coverage.gaps.length > 0 || coverage.orphans.length > 0) {
      console.log(chalk.bold.yellow('\n  Issues:'));
      if (coverage.gaps.length > 0) {
        console.log(chalk.yellow(`    • ${coverage.gaps.length} unit(s) have no evidence backing`));
      }
      if (coverage.orphans.length > 0) {
        console.log(chalk.yellow(`    • ${coverage.orphans.length} orphan unit(s) (no connections)`));
      }
    }

    if (drift.driftedUnits.length > 0) {
      console.log(chalk.bold.yellow(`\n  Drifted Units (${drift.driftedUnits.length}):  `));
      drift.driftedUnits.slice(0, 5).forEach(u => {
        console.log(chalk.yellow(`    • ${u.id} (${u.type}) — ${u.validationState}`));
      });
      if (drift.driftedUnits.length > 5) {
        console.log(chalk.gray(`    ... and ${drift.driftedUnits.length - 5} more`));
      }
    }

  } catch (error) {
    spinner.fail(chalk.red('Metrics computation failed'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function algebraDrift() {
  console.log(boxen(
    chalk.bold.magenta('δ  Drift Report') + '\n' +
    chalk.gray('Measure narrative coherence decay'),
    { padding: 1, borderStyle: 'round', borderColor: 'magenta' }
  ));

  const { filterLayers } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'filterLayers',
      message: 'Filter to specific layers?',
      default: false,
    },
  ]);

  let layers: NarrativeType[] | undefined;
  if (filterLayers) {
    const { selectedLayers } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedLayers',
        message: 'Select layers:',
        choices: [
          { name: 'Core Story', value: 'core_story' },
          { name: 'Positioning', value: 'positioning' },
          { name: 'Product Narrative', value: 'product_narrative' },
          { name: 'Operational', value: 'operational' },
          { name: 'Evidence', value: 'evidence' },
          { name: 'Communication', value: 'communication' },
        ],
      },
    ]);
    layers = selectedLayers;
  }

  const spinner = ora('Computing drift...').start();

  try {
    const config = loadConfig();
    const client = new NarrativeClient(config.dbPath);
    const drift = client.drift(layers ? { layers } : undefined);
    client.close();

    spinner.succeed(chalk.green('Drift computed'));

    const driftColor = drift.driftRate === 0 ? chalk.green :
                       drift.driftRate < 0.2 ? chalk.yellow : chalk.red;

    console.log(boxen(
      chalk.bold('DRIFT RATE: ') + driftColor(formatPercent(drift.driftRate)) + '\n\n' +
      `Drifted/Broken units: ${chalk.cyan(drift.driftedUnits.length.toString())}`,
      { padding: 1, borderStyle: 'single', borderColor: drift.driftRate === 0 ? 'green' : drift.driftRate < 0.2 ? 'yellow' : 'red' }
    ));

    // By-layer breakdown
    const table = new Table({
      head: [
        chalk.cyan('Layer'),
        chalk.cyan('Total'),
        chalk.cyan('Drifted'),
        chalk.cyan('Rate'),
        chalk.cyan('Status'),
      ],
      colWidths: [22, 8, 9, 10, 22],
    });

    for (const [layer, data] of Object.entries(drift.byLayer)) {
      if (data.total > 0) {
        const bar = '░'.repeat(Math.round((1 - data.rate) * 15)) + '█'.repeat(Math.round(data.rate * 15));
        const barColor = data.rate === 0 ? chalk.green : data.rate < 0.3 ? chalk.yellow : chalk.red;
        table.push([
          layer,
          data.total.toString(),
          data.drifted > 0 ? chalk.yellow(data.drifted.toString()) : '0',
          formatPercent(data.rate),
          barColor(bar),
        ]);
      }
    }

    console.log(table.toString());

    // List drifted units
    if (drift.driftedUnits.length > 0) {
      console.log(chalk.bold.yellow('\n  Drifted Units:'));
      drift.driftedUnits.forEach(u => {
        console.log(`    ${stateColor(u.validationState)} ${chalk.bold(u.id)} (${u.type})`);
        console.log(chalk.gray(`       "${u.assertion.substring(0, 60)}..."`);
      });
    } else {
      console.log(chalk.green('\n  ✓ No drift detected — narrative is fully coherent'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Drift computation failed'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function algebraResonate() {
  console.log(boxen(
    chalk.bold.magenta('ρ  Resonate Signal') + '\n' +
    chalk.gray('Score an external signal against the narrative graph'),
    { padding: 1, borderStyle: 'round', borderColor: 'magenta' }
  ));

  const { signalText } = await inquirer.prompt([
    {
      type: 'input',
      name: 'signalText',
      message: 'Enter the signal (market intel, competitor move, news):',
      validate: (input) => input.length > 0 || 'Signal text required',
    },
  ]);

  const spinner = ora('Computing resonance...').start();

  try {
    const config = loadConfig();
    const client = new NarrativeClient(config.dbPath);
    const result = client.resonate(signalText);
    client.close();

    spinner.succeed(chalk.green('Resonance computed'));

    const urgencyColor = {
      critical: chalk.red,
      high: chalk.yellow,
      medium: chalk.cyan,
      low: chalk.gray,
    };

    console.log(boxen(
      chalk.bold('SIGNAL RESONANCE') + '\n\n' +
      `  Resonance:  ${chalk.cyan(formatPercent(result.resonance))}\n` +
      `  Relevance:  ${chalk.cyan(formatPercent(result.relevance))}\n` +
      `  Scope:      ${chalk.cyan(formatPercent(result.scope))} of graph affected\n` +
      `  Urgency:    ${urgencyColor[result.urgency](result.urgency.toUpperCase())}`,
      { padding: 1, borderStyle: 'single', borderColor: result.urgency === 'critical' ? 'red' : result.urgency === 'high' ? 'yellow' : 'cyan' }
    ));

    if (result.matchedUnits.length > 0) {
      console.log(chalk.bold(`\n  Matched Units (${result.matchedUnits.length}):  `));

      const table = new Table({
        head: [
          chalk.cyan('Unit ID'),
          chalk.cyan('Layer'),
          chalk.cyan('Similarity'),
          chalk.cyan('Assertion'),
        ],
        colWidths: [25, 20, 12, 50],
        wordWrap: true,
      });

      result.matchedUnits.forEach(m => {
        table.push([
          m.unit.id,
          m.unit.type,
          formatPercent(m.similarity),
          m.unit.assertion.substring(0, 47) + (m.unit.assertion.length > 47 ? '...' : ''),
        ]);
      });

      console.log(table.toString());
    } else {
      console.log(chalk.gray('\n  No matching units — signal does not resonate with current narrative.'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Resonance computation failed'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

// Main entry point
async function main() {
  try {
    await mainMenu();
  } catch (error) {
    if ((error as any).isTtyError) {
      console.error(chalk.red('Prompt couldn\'t be rendered in this environment'));
    } else {
      console.error(chalk.red('An error occurred:'), error);
    }
    process.exit(1);
  }
}

main();
