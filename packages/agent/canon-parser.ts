/**
 * Canon Parser
 *
 * Reads the .narrative/canon/ YAML files and converts them into
 * NarrativeUnit objects that the algebra engine can operate on.
 *
 * Also reads .narrative/skills/ for tone-of-voice and terminology rules
 * that the agent uses as evaluation lenses.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import type { NarrativeUnit, NarrativeType, ValidationState } from '@narrative/core';

// ============================================================================
// Types
// ============================================================================

export interface CanonFile {
  version: string;
  last_updated: string;
  owner: string;
  units: CanonUnit[];
}

export interface CanonUnit {
  id: string;
  type: NarrativeType;
  assertion: string;
  intent: {
    objective: string;
    constraints?: {
      code?: {
        required_patterns?: string[];
        forbidden_patterns?: string[];
        required_libraries?: string[];
      };
      content?: {
        required_themes?: string[];
        forbidden_themes?: string[];
        tone?: string;
        target_audience?: string;
      };
    };
  };
  evidence_required?: string[];
  dependencies: string[];
  confidence: number;
}

export interface ToneRule {
  id: string;
  rule: string;
  examples?: {
    good?: string[];
    bad?: string[];
  };
}

export interface TerminologyEntry {
  term: string;
  definition?: string;
  usage?: string;
  context?: string;
  tier?: number;
  avoid?: string[];
  never?: string[];
}

export interface SkillSet {
  voice?: {
    name: string;
    summary: string;
    principles: ToneRule[];
  };
  terminology?: {
    preferred: TerminologyEntry[];
    forbidden: string[];
  };
  brand?: {
    company_name: string;
    never: string[];
    website: string;
  };
  products?: Array<{
    name: string;
    dimension: string;
    description: string;
    never?: string[];
  }>;
}

export interface ParsedCanon {
  units: NarrativeUnit[];
  skills: SkillSet;
  files: string[];
  errors: Array<{ file: string; error: string }>;
}

// ============================================================================
// Parser
// ============================================================================

export class CanonParser {
  private narrativeDir: string;

  constructor(narrativeDir: string) {
    this.narrativeDir = narrativeDir;
  }

  /**
   * Parse all canon and skill files in the .narrative directory
   */
  parse(): ParsedCanon {
    const result: ParsedCanon = {
      units: [],
      skills: {},
      files: [],
      errors: [],
    };

    // Parse canon files
    const canonDir = path.join(this.narrativeDir, 'canon');
    if (fs.existsSync(canonDir)) {
      const canonFiles = fs.readdirSync(canonDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      for (const file of canonFiles) {
        const filePath = path.join(canonDir, file);
        result.files.push(filePath);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = YAML.parse(content) as CanonFile;
          if (parsed?.units) {
            for (const unit of parsed.units) {
              result.units.push(this.toNarrativeUnit(unit, filePath));
            }
          }
        } catch (err: any) {
          result.errors.push({ file: filePath, error: err.message });
        }
      }
    }

    // Parse skill files
    const skillsDir = path.join(this.narrativeDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      const skillFiles = fs.readdirSync(skillsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      for (const file of skillFiles) {
        const filePath = path.join(skillsDir, file);
        result.files.push(filePath);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = YAML.parse(content);
          // Merge skill data
          if (parsed?.voice) result.skills.voice = parsed.voice;
          if (parsed?.terminology) result.skills.terminology = parsed.terminology;
          if (parsed?.brand) result.skills.brand = parsed.brand;
          if (parsed?.products) result.skills.products = parsed.products;
        } catch (err: any) {
          result.errors.push({ file: filePath, error: err.message });
        }
      }
    }

    return result;
  }

  /**
   * Parse a single file and return just the units from it
   */
  parseFile(filePath: string): NarrativeUnit[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(content) as CanonFile;
    if (!parsed?.units) return [];
    return parsed.units.map(u => this.toNarrativeUnit(u, filePath));
  }

  /**
   * Convert a YAML canon unit to a NarrativeUnit
   */
  private toNarrativeUnit(unit: CanonUnit, sourceFile: string): NarrativeUnit {
    return {
      id: unit.id,
      type: unit.type,
      assertion: unit.assertion.trim(),
      intent: {
        objective: unit.intent.objective,
        constraints: unit.intent.constraints ? {
          code: unit.intent.constraints.code,
          content: unit.intent.constraints.content as any,
        } : undefined,
        evidence_required: unit.evidence_required,
      },
      dependencies: unit.dependencies || [],
      validationState: 'ALIGNED' as ValidationState,
      confidence: unit.confidence ?? 1.0,
      metadata: {
        created_at: new Date().toISOString(),
        tags: ['canon', path.basename(sourceFile, path.extname(sourceFile))],
      },
    };
  }
}
