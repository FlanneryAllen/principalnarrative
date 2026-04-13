#!/usr/bin/env node
/**
 * Sync CLI
 *
 * Syncs .principalnarrative/applied-narrative markdown files
 * with the Intent Engineering database
 */

import { MarkdownToNarrativeConverter } from './markdown-to-narrative';

const args = process.argv.slice(2);
const command = args[0] ?? 'sync';

async function syncCommand() {
  console.log('🔄 Syncing Applied Narrative → Intent Engineering\n');

  const converter = new MarkdownToNarrativeConverter({
    appliedNarrativePath: '.principalnarrative/applied-narrative',
    dbPath: '.narrative/intent.db',
  });

  try {
    const result = await converter.sync();

    console.log('📊 Sync Results:');
    console.log(`   Created: ${result.created}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Unchanged: ${result.unchanged}`);
    console.log('');

    if (result.created + result.updated > 0) {
      console.log('✅ Sync complete! Markdown files imported to intent database.');
    } else {
      console.log('✅ All intent units are up to date.');
    }

    converter.close();
  } catch (error) {
    console.error('❌ Sync failed:', error);
    converter.close();
    process.exit(1);
  }
}

async function importCommand() {
  console.log('📥 Importing Applied Narrative → Intent Engineering\n');

  const converter = new MarkdownToNarrativeConverter({
    appliedNarrativePath: '.principalnarrative/applied-narrative',
    dbPath: '.narrative/intent.db',
  });

  try {
    const result = await converter.importAll();

    console.log('📊 Import Results:');
    console.log(`   Imported: ${result.imported.length}`);
    console.log(`   Skipped: ${result.skipped.length}`);
    console.log(`   Errors: ${result.errors.length}`);
    console.log('');

    if (result.imported.length > 0) {
      console.log('✅ Imported Intent Units:');
      result.imported.forEach(unit => {
        console.log(`   - ${unit.id} (${unit.type})`);
      });
      console.log('');
    }

    if (result.errors.length > 0) {
      console.log('❌ Errors:');
      result.errors.forEach(err => {
        console.log(`   - ${err.file}: ${err.error}`);
      });
      console.log('');
    }

    converter.close();
  } catch (error) {
    console.error('❌ Import failed:', error);
    converter.close();
    process.exit(1);
  }
}

async function main() {
  if (command === 'sync') {
    await syncCommand();
  } else if (command === 'import') {
    await importCommand();
  } else if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`
Narrative Sync - Integrate Applied Narrative with Intent Engineering

Usage:
  narrative-sync <command>

Commands:
  sync      Sync markdown files to intent database (incremental)
  import    Import all markdown files to intent database (full)
  help      Show this help message

Examples:
  # Incremental sync (only updates changed files)
  narrative-sync sync

  # Full import (imports all files)
  narrative-sync import

About:
  This tool bridges the Git-native Applied Narrative system
  (markdown files in .principalnarrative/applied-narrative)
  with the Intent Engineering database (.narrative/intent.db).

  Markdown files remain the source of truth (human-editable),
  while the database provides fast machine-queryable access for agents.
    `);
  } else {
    console.log(`Unknown command: ${command}`);
    console.log('Run "narrative-sync help" for usage information');
    process.exit(1);
  }
}

main();
