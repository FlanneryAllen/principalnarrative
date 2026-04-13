/**
 * Narrative Watcher
 *
 * Watches the .narrative/ directory for changes and triggers
 * clarion calls automatically. This is the perception layer
 * for Git-controlled narrative sources.
 *
 * In production, this runs as a persistent process. In development,
 * it can be started with `npx narrative watch`.
 */

import * as path from 'path';
import { ClarionCallEngine, type ClarionCallResult } from './clarion-call';

// Chokidar is optional — only needed for watch mode
let chokidar: any;
try {
  chokidar = require('chokidar');
} catch {
  // Will fail gracefully if chokidar not installed
}

export type AlertHandler = (result: ClarionCallResult) => void;

export class NarrativeWatcher {
  private narrativeDir: string;
  private engine: ClarionCallEngine;
  private handlers: AlertHandler[] = [];
  private watcher: any = null;

  constructor(narrativeDir: string) {
    this.narrativeDir = narrativeDir;
    this.engine = new ClarionCallEngine(narrativeDir);
  }

  /**
   * Register a handler that fires when a clarion call produces results
   */
  onAlert(handler: AlertHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    if (!chokidar) {
      throw new Error('chokidar not installed — run: npm install chokidar');
    }

    const canonDir = path.join(this.narrativeDir, 'canon');
    const skillsDir = path.join(this.narrativeDir, 'skills');

    console.log(`Narrative Agent watching:`);
    console.log(`  Canon: ${canonDir}`);
    console.log(`  Skills: ${skillsDir}`);
    console.log(``);

    this.watcher = chokidar.watch([canonDir, skillsDir], {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    // Debounce changes — collect for 1 second before running
    let pendingFiles: string[] = [];
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const processChanges = () => {
      const files = [...pendingFiles];
      pendingFiles = [];

      const isCanonChange = files.some(f => f.includes('/canon/'));

      console.log(`\nDetected changes in ${files.length} file(s):`);
      files.forEach(f => console.log(`  → ${path.relative(this.narrativeDir, f)}`));

      let result: ClarionCallResult;
      if (isCanonChange) {
        console.log(`\nCanon changed — running full clarion call...\n`);
        result = this.engine.run('change');
      } else {
        console.log(`\nSkills changed — running coherence check...\n`);
        result = this.engine.run('change');
      }

      console.log(result.summary);

      // Fire handlers
      for (const handler of this.handlers) {
        handler(result);
      }
    };

    this.watcher.on('change', (filePath: string) => {
      pendingFiles.push(filePath);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processChanges, 1000);
    });

    this.watcher.on('add', (filePath: string) => {
      pendingFiles.push(filePath);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processChanges, 1000);
    });

    // Run initial check
    console.log(`Running initial clarion call...\n`);
    const initial = this.engine.run('schedule');
    console.log(initial.summary);
    console.log(`\nWatching for changes... (Ctrl+C to stop)\n`);

    for (const handler of this.handlers) {
      handler(initial);
    }
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
