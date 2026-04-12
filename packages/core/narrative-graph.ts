/**
 * Narrative Graph
 *
 * Core storage and dependency engine for intent units.
 * Maintains a directed acyclic graph (DAG) of organizational narrative.
 */

import Database from 'better-sqlite3';
import type {
  NarrativeUnit,
  NarrativeType,
  ValidationState,
} from './types';

export interface QueryFilters {
  type?: NarrativeType;
  ids?: string[];
  validationState?: ValidationState;
  tags?: string[];
}

export class NarrativeGraph {
  private db: Database.Database;

  constructor(dbPath: string = '.narrative/narrative.db') {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      -- Narrative units table
      CREATE TABLE IF NOT EXISTS narrative_units (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        assertion TEXT NOT NULL,
        intent JSON NOT NULL,
        dependencies JSON NOT NULL,
        validation_state TEXT DEFAULT 'ALIGNED',
        confidence REAL DEFAULT 1.0,
        signal JSON,
        propagation JSON,
        metadata JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_type ON narrative_units(type);
      CREATE INDEX IF NOT EXISTS idx_validation_state ON narrative_units(validation_state);
      CREATE INDEX IF NOT EXISTS idx_created_at ON narrative_units(created_at DESC);

      -- Dependency edges table (for efficient graph traversal)
      CREATE TABLE IF NOT EXISTS dependencies (
        dependent_id TEXT NOT NULL,
        dependency_id TEXT NOT NULL,
        PRIMARY KEY (dependent_id, dependency_id),
        FOREIGN KEY (dependent_id) REFERENCES narrative_units(id) ON DELETE CASCADE,
        FOREIGN KEY (dependency_id) REFERENCES narrative_units(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_dependent ON dependencies(dependent_id);
      CREATE INDEX IF NOT EXISTS idx_dependency ON dependencies(dependency_id);
    `);
  }

  /**
   * Create a new intent unit
   *
   * Validates DAG constraint (no cycles) before insertion
   */
  createUnit(unit: NarrativeUnit): NarrativeUnit {
    // Validate it would form a valid DAG
    if (unit.dependencies.length > 0) {
      this.validateDAG(unit.id, unit.dependencies);
    }

    // Insert the unit
    const stmt = this.db.prepare(`
      INSERT INTO narrative_units (
        id, type, assertion, intent, dependencies,
        validation_state, confidence, signal, propagation, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      unit.id,
      unit.type,
      unit.assertion,
      JSON.stringify(unit.intent),
      JSON.stringify(unit.dependencies),
      unit.validationState,
      unit.confidence,
      unit.signal ? JSON.stringify(unit.signal) : null,
      unit.propagation ? JSON.stringify(unit.propagation) : null,
      unit.metadata ? JSON.stringify(unit.metadata) : null
    );

    // Insert dependency edges
    if (unit.dependencies.length > 0) {
      const depStmt = this.db.prepare(`
        INSERT INTO dependencies (dependent_id, dependency_id)
        VALUES (?, ?)
      `);

      for (const depId of unit.dependencies) {
        depStmt.run(unit.id, depId);
      }
    }

    return unit;
  }

  /**
   * Get a single intent unit by ID
   */
  getUnit(id: string): NarrativeUnit | null {
    const row = this.db.prepare('SELECT * FROM narrative_units WHERE id = ?').get(id);
    return row ? this.deserializeUnit(row) : null;
  }

  /**
   * Query intent units with filters
   */
  query(filters: QueryFilters = {}): NarrativeUnit[] {
    let sql = 'SELECT * FROM narrative_units WHERE 1=1';
    const params: any[] = [];

    if (filters.type) {
      sql += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters.validationState) {
      sql += ' AND validation_state = ?';
      params.push(filters.validationState);
    }

    if (filters.ids && filters.ids.length > 0) {
      sql += ` AND id IN (${filters.ids.map(() => '?').join(',')})`;
      params.push(...filters.ids);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(row => this.deserializeUnit(row));
  }

  /**
   * Get all units that depend on this unit (downstream impact)
   */
  getDependents(unitId: string): NarrativeUnit[] {
    const dependentIds = this.db
      .prepare('SELECT dependent_id FROM dependencies WHERE dependency_id = ?')
      .all(unitId)
      .map((row: any) => row.dependent_id);

    if (dependentIds.length === 0) return [];

    return this.query({ ids: dependentIds });
  }

  /**
   * Get all units this unit depends on (upstream context)
   */
  getDependencies(unitId: string): NarrativeUnit[] {
    const unit = this.getUnit(unitId);
    if (!unit || unit.dependencies.length === 0) return [];

    return this.query({ ids: unit.dependencies });
  }

  /**
   * Get the complete dependency chain (transitive closure upstream)
   *
   * Returns all units from core_story down to this unit
   */
  getDependencyChain(unitId: string): NarrativeUnit[] {
    const visited = new Set<string>();
    const chain: NarrativeUnit[] = [];

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const unit = this.getUnit(id);
      if (!unit) return;

      // First traverse dependencies (depth-first)
      for (const depId of unit.dependencies) {
        traverse(depId);
      }

      // Then add this unit
      chain.push(unit);
    };

    traverse(unitId);

    // Order by layer (core_story first, then positioning, etc.)
    const layerOrder: Record<NarrativeType, number> = {
      core_story: 1,
      positioning: 2,
      product_narrative: 3,
      operational: 4,
      evidence: 5,
      communication: 6,
    };

    return chain.sort((a, b) => layerOrder[a.type] - layerOrder[b.type]);
  }

  /**
   * Get all affected units if this unit changes (propagate operation)
   *
   * Returns all units downstream in the dependency graph
   */
  getPropagationImpact(unitId: string): NarrativeUnit[] {
    const visited = new Set<string>();
    const affected: NarrativeUnit[] = [];

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const dependents = this.getDependents(id);
      for (const dependent of dependents) {
        affected.push(dependent);
        traverse(dependent.id);
      }
    };

    traverse(unitId);
    return affected;
  }

  /**
   * Update validation state of a unit
   */
  updateValidationState(
    unitId: string,
    state: ValidationState,
    confidence: number = 1.0
  ): void {
    this.db
      .prepare(`
        UPDATE narrative_units
        SET validation_state = ?, confidence = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(state, confidence, unitId);
  }

  /**
   * Delete a unit and all its dependency edges
   */
  deleteUnit(unitId: string): void {
    // Check if any units depend on this one
    const dependents = this.getDependents(unitId);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot delete unit ${unitId}: ${dependents.length} units depend on it. ` +
          `Delete dependents first: ${dependents.map(d => d.id).join(', ')}`
      );
    }

    this.db.prepare('DELETE FROM narrative_units WHERE id = ?').run(unitId);
  }

  /**
   * Get all units (full graph)
   */
  getAllUnits(): NarrativeUnit[] {
    return this.query();
  }

  /**
   * Get graph statistics
   */
  getStats() {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM narrative_units').get() as any;

    const byType = this.db
      .prepare('SELECT type, COUNT(*) as count FROM narrative_units GROUP BY type')
      .all() as any[];

    const byValidation = this.db
      .prepare('SELECT validation_state, COUNT(*) as count FROM narrative_units GROUP BY validation_state')
      .all() as any[];

    return {
      total: total.count,
      byType: Object.fromEntries(byType.map(r => [r.type, r.count])),
      byValidation: Object.fromEntries(byValidation.map(r => [r.validation_state, r.count])),
    };
  }

  /**
   * Validate that adding these dependencies won't create a cycle
   *
   * Uses DFS to detect cycles
   */
  private validateDAG(newUnitId: string, newDependencies: string[]): void {
    // For each proposed dependency, check if adding it would create a cycle
    for (const depId of newDependencies) {
      // Check if depId already depends on newUnitId (directly or transitively)
      if (this.wouldCreateCycle(newUnitId, depId)) {
        throw new Error(
          `Adding dependency ${newUnitId} → ${depId} would create a cycle. ` +
            `${depId} already depends on ${newUnitId} (directly or transitively).`
        );
      }
    }
  }

  /**
   * Check if making source depend on target would create a cycle
   */
  private wouldCreateCycle(source: string, target: string): boolean {
    // If target (transitively) depends on source, adding source → target creates a cycle
    const targetDependsOnSource = this.hasPath(target, source);
    return targetDependsOnSource;
  }

  /**
   * Check if there's a path from start to end in the dependency graph
   */
  private hasPath(start: string, end: string): boolean {
    const visited = new Set<string>();

    const dfs = (current: string): boolean => {
      if (current === end) return true;
      if (visited.has(current)) return false;

      visited.add(current);

      const unit = this.getUnit(current);
      if (!unit) return false;

      for (const depId of unit.dependencies) {
        if (dfs(depId)) return true;
      }

      return false;
    };

    return dfs(start);
  }

  /**
   * Deserialize a database row into an NarrativeUnit
   */
  private deserializeUnit(row: any): NarrativeUnit {
    return {
      id: row.id,
      type: row.type,
      assertion: row.assertion,
      intent: JSON.parse(row.intent),
      dependencies: JSON.parse(row.dependencies),
      validationState: row.validation_state,
      confidence: row.confidence,
      signal: row.signal ? JSON.parse(row.signal) : undefined,
      propagation: row.propagation ? JSON.parse(row.propagation) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
