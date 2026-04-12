#!/usr/bin/env node
/**
 * Narrative Intent Validator CLI
 *
 * Pre-commit hook for validating code against organizational intent.
 */

import { NarrativeValidator } from './narrative-validator';
import * as path from 'path';

const args = process.argv.slice(2);

interface CliOptions {
  rootDir?: string;
  dbPath?: string;
  include?: string[];
  exclude?: string[];
  operation?: string;
  tags?: string[];
  failOnWarning?: boolean;
  verbose?: boolean;
  help?: boolean;
}

function parseArgs(): CliOptions {
  const options: CliOptions = {
    failOnWarning: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--root-dir' || arg === '-r') {
      options.rootDir = args[++i];
    } else if (arg === '--db-path' || arg === '-d') {
      options.dbPath = args[++i];
    } else if (arg === '--include' || arg === '-i') {
      options.include = args[++i].split(',');
    } else if (arg === '--exclude' || arg === '-e') {
      options.exclude = args[++i].split(',');
    } else if (arg === '--operation' || arg === '-o') {
      options.operation = args[++i];
    } else if (arg === '--tags' || arg === '-t') {
      options.tags = args[++i].split(',');
    } else if (arg === '--fail-on-warning' || arg === '-w') {
      options.failOnWarning = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Narrative Intent Validator - Pre-commit hook for intent compliance

Usage:
  narrative-validate [options]

Options:
  -h, --help                Show this help message
  -r, --root-dir DIR        Root directory to validate (default: cwd)
  -d, --db-path PATH        Path to intent database (default: .narrative/intent.db)
  -i, --include PATTERNS    Comma-separated glob patterns to include (default: **/*.{ts,tsx,js,jsx})
  -e, --exclude PATTERNS    Comma-separated glob patterns to exclude (default: node_modules,dist)
  -o, --operation OP        Operation context (default: "writing code")
  -t, --tags TAGS           Comma-separated context tags
  -w, --fail-on-warning     Fail validation on warnings (default: false)
  -v, --verbose             Verbose output

Examples:
  # Validate all TypeScript files
  narrative-validate

  # Validate specific operation
  narrative-validate --operation "authentication code" --tags "auth,security"

  # Custom patterns
  narrative-validate --include "src/**/*.ts" --exclude "**/*.test.ts"

  # Fail on warnings
  narrative-validate --fail-on-warning

Git Hook Setup:
  # .git/hooks/pre-commit
  #!/bin/sh
  npx narrative-validate || exit 1
  `);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('🔍 Narrative Intent Validator\n');

  const validator = new NarrativeValidator(options.dbPath);

  try {
    const result = await validator.validate({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
      operation: options.operation,
      tags: options.tags,
      failOnWarning: options.failOnWarning,
    });

    console.log(`📊 Validation Results:`);
    console.log(`   Files checked: ${result.filesChecked}`);
    console.log(`   Violations: ${result.violationsCount}`);
    console.log(`   Errors: ${result.errorsCount}`);
    console.log(`   Warnings: ${result.warningsCount}`);
    console.log('');

    if (result.violations.length > 0) {
      console.log('❌ Intent Violations:\n');

      // Group by file
      const byFile = result.violations.reduce((acc, v) => {
        const file = v.file ?? 'unknown';
        if (!acc[file]) acc[file] = [];
        acc[file].push(v);
        return acc;
      }, {} as Record<string, typeof result.violations>);

      for (const [file, violations] of Object.entries(byFile)) {
        console.log(`📄 ${path.relative(options.rootDir ?? process.cwd(), file)}`);

        for (const violation of violations) {
          const icon = violation.severity === 'error' ? '❌' : '⚠️';
          const location = violation.line ? `:${violation.line}` : '';

          console.log(`   ${icon} ${violation.message}${location}`);

          if (violation.suggestion && options.verbose) {
            console.log(`      💡 Suggestion: ${violation.suggestion}`);
          }

          if (options.verbose) {
            console.log(`      🎯 Intent: ${violation.narrative}`);
            console.log(`      🔍 Pattern: ${violation.pattern}`);
          }

          console.log('');
        }
      }
    }

    if (result.passed) {
      console.log('✅ Validation passed! All code aligns with organizational intent.\n');
      validator.close();
      process.exit(0);
    } else {
      console.log('❌ Validation failed! Fix violations before committing.\n');
      validator.close();
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation error:', error);
    validator.close();
    process.exit(1);
  }
}

main();
