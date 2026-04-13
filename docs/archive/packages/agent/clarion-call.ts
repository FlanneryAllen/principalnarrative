/**
 * Clarion Call Engine
 *
 * The clarion call is a triggered propagation check that runs when
 * canonical narrative changes. It answers: "Given this change, what
 * downstream narrative units are now potentially misaligned?"
 *
 * Named for what Julie did manually at Cisco for a decade —
 * reconciling dozens of teams' narratives against declared intent.
 * This automates that function.
 *
 * Three triggers:
 *   1. On change — canon file modified, system checks what broke
 *   2. On schedule — periodic coherence sweep
 *   3. On demand — `npx narrative clarion-call`
 */

import { NarrativeGraph, NarrativeAlgebra } from '@narrative/core';
import type { NarrativeUnit, ValidationState } from '@narrative/core';
import { CanonParser, type ParsedCanon, type SkillSet } from './canon-parser';

// ============================================================================
// Types
// ============================================================================

export interface DriftAlert {
  /** The unit that's drifting */
  unitId: string;
  unitAssertion: string;
  unitType: string;

  /** What it depends on that changed */
  dependsOn: string;
  dependsOnAssertion: string;

  /** The nature of the drift */
  severity: 'error' | 'warning' | 'info';
  message: string;

  /** How to fix it */
  suggestion?: string;
}

export interface TerminologyViolation {
  term: string;
  rule: string;
  unitId: string;
  unitAssertion: string;
  severity: 'error' | 'warning';
}

export interface ToneViolation {
  ruleId: string;
  rule: string;
  unitId: string;
  unitAssertion: string;
  match: string;
  severity: 'warning';
}

export interface ClarionCallResult {
  /** When the check ran */
  timestamp: string;

  /** What triggered it */
  trigger: 'change' | 'schedule' | 'demand';

  /** Total units checked */
  totalUnits: number;

  /** Coherence score (0-100) */
  coherenceScore: number;

  /** Units with broken dependencies */
  driftAlerts: DriftAlert[];

  /** Terminology violations found */
  terminologyViolations: TerminologyViolation[];

  /** Tone violations found */
  toneViolations: ToneViolation[];

  /** Units with missing dependencies (reference IDs that don't exist) */
  orphanedDependencies: Array<{ unitId: string; missingDep: string }>;

  /** Summary for humans */
  summary: string;
}

// ============================================================================
// Engine
// ============================================================================

export class ClarionCallEngine {
  private parser: CanonParser;
  private canon: ParsedCanon | null = null;

  constructor(narrativeDir: string) {
    this.parser = new CanonParser(narrativeDir);
  }

  /**
   * Run a full clarion call — parse canon, check coherence, return results
   */
  run(trigger: 'change' | 'schedule' | 'demand' = 'demand'): ClarionCallResult {
    // Parse all canon and skill files
    this.canon = this.parser.parse();
    const { units, skills } = this.canon;

    // Run all checks
    const driftAlerts = this.checkDrift(units);
    const orphanedDependencies = this.checkOrphanedDependencies(units);
    const terminologyViolations = this.checkTerminology(units, skills);
    const toneViolations = this.checkTone(units, skills);

    // Calculate coherence score
    const totalIssues = driftAlerts.length + orphanedDependencies.length +
                        terminologyViolations.length + toneViolations.length;
    const maxIssues = units.length * 4; // theoretical max: every unit fails every check
    const coherenceScore = maxIssues > 0
      ? Math.round(Math.max(0, 100 - (totalIssues / maxIssues * 100)))
      : 100;

    // Build summary
    const summary = this.buildSummary(units.length, coherenceScore, driftAlerts,
                                       terminologyViolations, toneViolations, orphanedDependencies);

    return {
      timestamp: new Date().toISOString(),
      trigger,
      totalUnits: units.length,
      coherenceScore,
      driftAlerts,
      terminologyViolations,
      toneViolations,
      orphanedDependencies,
      summary,
    };
  }

  /**
   * Run a clarion call focused on specific changed files
   */
  runForChangedFiles(changedFiles: string[], trigger: 'change' = 'change'): ClarionCallResult {
    // Parse the full canon first
    this.canon = this.parser.parse();
    const { units, skills } = this.canon;

    // Find the IDs of units that were in the changed files
    const changedUnitIds = new Set<string>();
    for (const file of changedFiles) {
      const fileUnits = this.parser.parseFile(file);
      for (const u of fileUnits) {
        changedUnitIds.add(u.id);
      }
    }

    // Find all downstream units that depend on changed units (transitive)
    const affectedIds = this.findDownstream(units, changedUnitIds);

    // Filter alerts to only affected units
    const allDrift = this.checkDrift(units);
    const driftAlerts = allDrift.filter(d =>
      affectedIds.has(d.unitId) || changedUnitIds.has(d.unitId)
    );

    const orphanedDependencies = this.checkOrphanedDependencies(units)
      .filter(o => affectedIds.has(o.unitId) || changedUnitIds.has(o.unitId));

    const terminologyViolations = this.checkTerminology(units.filter(u =>
      affectedIds.has(u.id) || changedUnitIds.has(u.id)
    ), skills);

    const toneViolations = this.checkTone(units.filter(u =>
      affectedIds.has(u.id) || changedUnitIds.has(u.id)
    ), skills);

    const totalChecked = changedUnitIds.size + affectedIds.size;
    const totalIssues = driftAlerts.length + orphanedDependencies.length +
                        terminologyViolations.length + toneViolations.length;
    const coherenceScore = totalChecked > 0
      ? Math.round(Math.max(0, 100 - (totalIssues / (totalChecked * 4) * 100)))
      : 100;

    const summary = this.buildSummary(totalChecked, coherenceScore, driftAlerts,
                                       terminologyViolations, toneViolations, orphanedDependencies,
                                       changedUnitIds.size, affectedIds.size);

    return {
      timestamp: new Date().toISOString(),
      trigger,
      totalUnits: totalChecked,
      coherenceScore,
      driftAlerts,
      terminologyViolations,
      toneViolations,
      orphanedDependencies,
      summary,
    };
  }

  // ==========================================================================
  // Checks
  // ==========================================================================

  /**
   * Check for narrative drift — units whose dependencies have changed
   * in ways that might invalidate them
   */
  private checkDrift(units: NarrativeUnit[]): DriftAlert[] {
    const alerts: DriftAlert[] = [];
    const unitMap = new Map(units.map(u => [u.id, u]));

    for (const unit of units) {
      for (const depId of unit.dependencies) {
        const dep = unitMap.get(depId);
        if (!dep) continue;

        // Check theme alignment — does this unit's content themes
        // contradict its parent's forbidden themes?
        const unitThemes = unit.intent.constraints?.content?.required_themes || [];
        const depForbidden = dep.intent.constraints?.content?.forbidden_themes || [];
        const conflicts = unitThemes.filter(t => depForbidden.includes(t));

        if (conflicts.length > 0) {
          alerts.push({
            unitId: unit.id,
            unitAssertion: unit.assertion,
            unitType: unit.type,
            dependsOn: dep.id,
            dependsOnAssertion: dep.assertion,
            severity: 'error',
            message: `Theme conflict: "${unit.id}" requires themes [${conflicts.join(', ')}] which are forbidden by parent "${dep.id}"`,
            suggestion: `Remove conflicting themes from ${unit.id} or update the parent's forbidden list`,
          });
        }

        // Check tone consistency
        const unitTone = unit.intent.constraints?.content?.tone;
        const depTone = dep.intent.constraints?.content?.tone;
        if (unitTone && depTone && unitTone !== depTone) {
          alerts.push({
            unitId: unit.id,
            unitAssertion: unit.assertion,
            unitType: unit.type,
            dependsOn: dep.id,
            dependsOnAssertion: dep.assertion,
            severity: 'warning',
            message: `Tone mismatch: "${unit.id}" uses tone "${unitTone}" but parent "${dep.id}" uses "${depTone}"`,
            suggestion: `Align tones between parent and child units`,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Check for orphaned dependencies — units that reference IDs that don't exist
   */
  private checkOrphanedDependencies(units: NarrativeUnit[]): Array<{ unitId: string; missingDep: string }> {
    const knownIds = new Set(units.map(u => u.id));
    const orphans: Array<{ unitId: string; missingDep: string }> = [];

    for (const unit of units) {
      for (const depId of unit.dependencies) {
        if (!knownIds.has(depId)) {
          orphans.push({ unitId: unit.id, missingDep: depId });
        }
      }
    }

    return orphans;
  }

  /**
   * Check all unit assertions against terminology rules
   */
  private checkTerminology(units: NarrativeUnit[], skills: SkillSet): TerminologyViolation[] {
    const violations: TerminologyViolation[] = [];

    if (!skills.terminology) return violations;

    // Check forbidden words
    const forbidden = skills.terminology.forbidden || [];
    for (const unit of units) {
      const text = unit.assertion.toLowerCase();
      for (const word of forbidden) {
        if (text.includes(word.toLowerCase())) {
          violations.push({
            term: word,
            rule: `Forbidden term "${word}" found in assertion`,
            unitId: unit.id,
            unitAssertion: unit.assertion,
            severity: 'warning',
          });
        }
      }
    }

    // Check preferred terminology — flag if the "avoid" version is used
    const preferred = skills.terminology.preferred || [];
    for (const unit of units) {
      const text = unit.assertion.toLowerCase();
      for (const pref of preferred) {
        const avoidList = pref.avoid || [];
        for (const avoid of avoidList) {
          if (text.includes(avoid.toLowerCase())) {
            violations.push({
              term: avoid,
              rule: `Use "${pref.term}" instead of "${avoid}"`,
              unitId: unit.id,
              unitAssertion: unit.assertion,
              severity: 'warning',
            });
          }
        }
      }
    }

    // Check brand name violations
    if (skills.brand?.never) {
      for (const unit of units) {
        for (const wrong of skills.brand.never) {
          if (unit.assertion.includes(wrong)) {
            violations.push({
              term: wrong,
              rule: `Use "${skills.brand.company_name}" instead of "${wrong}"`,
              unitId: unit.id,
              unitAssertion: unit.assertion,
              severity: 'error',
            });
          }
        }
      }
    }

    // Check product name violations
    if (skills.products) {
      for (const unit of units) {
        for (const product of skills.products) {
          if (product.never) {
            for (const wrong of product.never) {
              if (unit.assertion.includes(wrong)) {
                violations.push({
                  term: wrong,
                  rule: `Use "${product.name}" instead of "${wrong}"`,
                  unitId: unit.id,
                  unitAssertion: unit.assertion,
                  severity: 'error',
                });
              }
            }
          }
        }
      }
    }

    return violations;
  }

  /**
   * Check unit assertions against tone of voice rules
   */
  private checkTone(units: NarrativeUnit[], skills: SkillSet): ToneViolation[] {
    const violations: ToneViolation[] = [];

    if (!skills.voice?.principles) return violations;

    for (const unit of units) {
      const text = unit.assertion.toLowerCase();

      for (const principle of skills.voice.principles) {
        // Check if any "bad" examples match patterns in the assertion
        if (principle.examples?.bad) {
          for (const bad of principle.examples.bad) {
            // Extract key phrases from bad examples to check
            const badLower = bad.toLowerCase();
            // Check for common bad patterns
            const badPatterns = extractPatterns(badLower);
            for (const pattern of badPatterns) {
              if (text.includes(pattern)) {
                violations.push({
                  ruleId: principle.id,
                  rule: principle.rule,
                  unitId: unit.id,
                  unitAssertion: unit.assertion,
                  match: pattern,
                  severity: 'warning',
                });
              }
            }
          }
        }
      }
    }

    return violations;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Find all units that transitively depend on the given set of IDs
   */
  private findDownstream(units: NarrativeUnit[], changedIds: Set<string>): Set<string> {
    const affected = new Set<string>();
    let frontier = new Set(changedIds);

    // BFS through dependency graph
    while (frontier.size > 0) {
      const nextFrontier = new Set<string>();
      for (const unit of units) {
        if (affected.has(unit.id) || changedIds.has(unit.id)) continue;
        const dependsOnChanged = unit.dependencies.some(d =>
          frontier.has(d) || changedIds.has(d) || affected.has(d)
        );
        if (dependsOnChanged) {
          affected.add(unit.id);
          nextFrontier.add(unit.id);
        }
      }
      frontier = nextFrontier;
    }

    return affected;
  }

  /**
   * Build a human-readable summary
   */
  private buildSummary(
    totalUnits: number,
    coherenceScore: number,
    driftAlerts: DriftAlert[],
    termViolations: TerminologyViolation[],
    toneViolations: ToneViolation[],
    orphans: Array<{ unitId: string; missingDep: string }>,
    changedCount?: number,
    affectedCount?: number,
  ): string {
    const lines: string[] = [];

    lines.push(`CLARION CALL — Narrative Coherence Check`);
    lines.push(`═══════════════════════════════════════════`);
    lines.push(``);

    if (changedCount !== undefined) {
      lines.push(`Changed units: ${changedCount}`);
      lines.push(`Affected downstream: ${affectedCount}`);
    }
    lines.push(`Total units checked: ${totalUnits}`);
    lines.push(`Coherence score: ${coherenceScore}/100`);
    lines.push(``);

    if (driftAlerts.length > 0) {
      lines.push(`⚠ Drift Alerts (${driftAlerts.length}):`);
      for (const alert of driftAlerts) {
        const icon = alert.severity === 'error' ? '✗' : '~';
        lines.push(`  ${icon} ${alert.message}`);
        if (alert.suggestion) {
          lines.push(`    → ${alert.suggestion}`);
        }
      }
      lines.push(``);
    }

    if (termViolations.length > 0) {
      lines.push(`⚠ Terminology Violations (${termViolations.length}):`);
      for (const v of termViolations) {
        lines.push(`  ~ [${v.unitId}] ${v.rule}`);
      }
      lines.push(``);
    }

    if (toneViolations.length > 0) {
      lines.push(`⚠ Tone Violations (${toneViolations.length}):`);
      for (const v of toneViolations) {
        lines.push(`  ~ [${v.unitId}] Rule "${v.ruleId}": matched "${v.match}"`);
      }
      lines.push(``);
    }

    if (orphans.length > 0) {
      lines.push(`⚠ Orphaned Dependencies (${orphans.length}):`);
      for (const o of orphans) {
        lines.push(`  ✗ "${o.unitId}" depends on "${o.missingDep}" which doesn't exist`);
      }
      lines.push(``);
    }

    if (driftAlerts.length === 0 && termViolations.length === 0 &&
        toneViolations.length === 0 && orphans.length === 0) {
      lines.push(`✓ All clear. Narrative is coherent.`);
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Utility
// ============================================================================

/**
 * Extract meaningful phrases from a bad example for pattern matching.
 * Looks for multi-word marketing-speak patterns.
 */
function extractPatterns(text: string): string[] {
  const patterns: string[] = [];

  // Common marketing-speak patterns to detect
  const knownBad = [
    'cutting-edge', 'ai-powered', 'leverage', 'unlock',
    'unprecedented', 'maximize', 'revolutionize', 'game-changing',
    'best-in-class', 'synergy', 'holistic', 'paradigm',
    'comprehensive solution', 'enables organizations',
    'take back control', 'empower',
  ];

  for (const bad of knownBad) {
    if (text.includes(bad)) {
      patterns.push(bad);
    }
  }

  return patterns;
}
