/**
 * Narrative Validator
 *
 * Validates code against organizational narrative constraints.
 * Uses AST parsing to detect violations of code patterns.
 */

import { parse } from '@typescript-eslint/typescript-estree';
import { NarrativeClient, NarrativeViolation, NarrativeConstraints } from '@narrative/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface ValidationOptions {
  /**
   * Root directory to validate
   */
  rootDir?: string;

  /**
   * File patterns to validate (glob patterns)
   */
  include?: string[];

  /**
   * File patterns to exclude
   */
  exclude?: string[];

  /**
   * Operation context for intent query
   */
  operation?: string;

  /**
   * Additional context tags
   */
  tags?: string[];

  /**
   * Whether to fail on warnings
   */
  failOnWarning?: boolean;
}

export interface ValidationResult {
  violations: NarrativeViolation[];
  filesChecked: number;
  violationsCount: number;
  errorsCount: number;
  warningsCount: number;
  passed: boolean;
}

export class NarrativeValidator {
  private client: NarrativeClient;

  constructor(dbPath?: string) {
    this.client = new NarrativeClient(dbPath);
  }

  /**
   * Validate files against organizational narrative
   */
  async validate(options: ValidationOptions = {}): Promise<ValidationResult> {
    const rootDir = options.rootDir ?? process.cwd();
    const include = options.include ?? ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    const exclude = options.exclude ?? [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.test.*',
      '**/*.spec.*',
    ];

    // Get intent constraints
    const intent = await this.client.queryNarrative({
      operation: options.operation ?? 'writing code',
      context: {
        tags: options.tags,
      },
    });

    if (!intent.constraints.code) {
      // No code constraints defined
      return {
        violations: [],
        filesChecked: 0,
        violationsCount: 0,
        errorsCount: 0,
        warningsCount: 0,
        passed: true,
      };
    }

    // Find files to validate
    const files = await this.findFiles(rootDir, include, exclude);

    // Validate each file
    const allViolations: NarrativeViolation[] = [];

    for (const file of files) {
      const violations = await this.validateFile(file, intent.constraints);
      allViolations.push(...violations);
    }

    const errorsCount = allViolations.filter(v => v.severity === 'error').length;
    const warningsCount = allViolations.filter(v => v.severity === 'warning').length;

    const passed = errorsCount === 0 && (options.failOnWarning ? warningsCount === 0 : true);

    return {
      violations: allViolations,
      filesChecked: files.length,
      violationsCount: allViolations.length,
      errorsCount,
      warningsCount,
      passed,
    };
  }

  /**
   * Validate a single file
   */
  private async validateFile(
    filePath: string,
    constraints: NarrativeConstraints
  ): Promise<NarrativeViolation[]> {
    const violations: NarrativeViolation[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check forbidden patterns (regex-based)
      if (constraints.code?.forbidden_patterns) {
        for (const pattern of constraints.code.forbidden_patterns) {
          const matches = this.findPattern(content, pattern);
          for (const match of matches) {
            violations.push({
              file: filePath,
              line: match.line,
              pattern,
              message: `Forbidden pattern "${pattern}" detected`,
              narrative: 'Code constraints',
              suggestion: this.getSuggestion(pattern),
              severity: 'error',
            });
          }
        }
      }

      // Check required patterns (should be present somewhere in file)
      if (constraints.code?.required_patterns) {
        for (const pattern of constraints.code.required_patterns) {
          const found = content.includes(pattern) || new RegExp(pattern).test(content);
          if (!found) {
            violations.push({
              file: filePath,
              pattern,
              message: `Required pattern "${pattern}" not found`,
              narrative: 'Code constraints',
              suggestion: `Add ${pattern} to implement organizational narrative`,
              severity: 'warning',
            });
          }
        }
      }

      // Check required libraries (in imports)
      if (constraints.code?.required_libraries) {
        const imports = this.extractImports(content);

        for (const lib of constraints.code.required_libraries) {
          const found = imports.some(imp => imp.includes(lib));
          if (!found) {
            violations.push({
              file: filePath,
              pattern: lib,
              message: `Required library "${lib}" not imported`,
              narrative: 'Code constraints',
              suggestion: `Import ${lib} as required by organizational narrative`,
              severity: 'warning',
            });
          }
        }
      }

      // Run custom validation rules
      if (constraints.validation_rules) {
        for (const rule of constraints.validation_rules) {
          const ruleViolations = this.checkValidationRule(filePath, content, rule);
          violations.push(...ruleViolations);
        }
      }
    } catch (error) {
      // Skip files that can't be parsed (e.g., not JS/TS)
      // console.error(`Error validating ${filePath}:`, error);
    }

    return violations;
  }

  /**
   * Find pattern in code and return line numbers
   */
  private findPattern(content: string, pattern: string): Array<{ line: number; column: number }> {
    const matches: Array<{ line: number; column: number }> = [];
    const lines = content.split('\n');

    try {
      const regex = new RegExp(pattern, 'g');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = regex.exec(line);
        if (match) {
          matches.push({
            line: i + 1,
            column: match.index,
          });
        }
      }
    } catch (e) {
      // Pattern not a valid regex, try literal match
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(pattern)) {
          matches.push({
            line: i + 1,
            column: line.indexOf(pattern),
          });
        }
      }
    }

    return matches;
  }

  /**
   * Extract import statements from code
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: true,
      });

      // Walk AST and find import declarations
      const walk = (node: any) => {
        if (node.type === 'ImportDeclaration' && node.source?.value) {
          imports.push(node.source.value);
        }

        // Recursively walk children
        for (const key in node) {
          if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') {
            continue;
          }

          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(c => typeof c === 'object' && c !== null && walk(c));
          } else if (typeof child === 'object' && child !== null) {
            walk(child);
          }
        }
      };

      walk(ast);
    } catch (e) {
      // Fallback to regex if AST parsing fails
      const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  /**
   * Check a custom validation rule
   */
  private checkValidationRule(
    filePath: string,
    content: string,
    rule: any
  ): NarrativeViolation[] {
    const violations: NarrativeViolation[] = [];

    if (rule.type === 'regex') {
      try {
        const regex = new RegExp(rule.check);
        if (!regex.test(content)) {
          violations.push({
            file: filePath,
            pattern: rule.check,
            message: rule.error_message ?? `Validation rule failed: ${rule.check}`,
            narrative: 'Custom validation rule',
            suggestion: rule.suggestion,
            severity: 'error',
          });
        }
      } catch (e) {
        // Invalid regex
      }
    }

    if (rule.type === 'ast_pattern') {
      // For MVP, treat as regex
      // Future: proper AST pattern matching
      try {
        const regex = new RegExp(rule.check);
        if (!regex.test(content)) {
          violations.push({
            file: filePath,
            pattern: rule.check,
            message: rule.error_message ?? `AST pattern not found: ${rule.check}`,
            narrative: 'Custom validation rule',
            suggestion: rule.suggestion,
            severity: 'error',
          });
        }
      } catch (e) {
        // Invalid pattern
      }
    }

    return violations;
  }

  /**
   * Get suggestion for a forbidden pattern
   */
  private getSuggestion(pattern: string): string {
    const suggestions: Record<string, string> = {
      'localStorage': 'Use httpOnly cookies or secure session storage instead',
      'console\\.log': 'Use a proper logging library with log levels',
      'eval': 'Avoid eval() for security reasons',
      'basic_auth': 'Use OAuth 2.0 or JWT authentication instead',
      'password_storage': 'Never store passwords directly; use proper hashing with bcrypt/argon2',
    };

    return suggestions[pattern] ?? `Remove usage of ${pattern}`;
  }

  /**
   * Find files matching patterns
   */
  private async findFiles(
    rootDir: string,
    include: string[],
    exclude: string[]
  ): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of include) {
      const files = await glob(pattern, {
        cwd: rootDir,
        ignore: exclude,
        absolute: true,
        nodir: true,
      });
      allFiles.push(...files);
    }

    // Deduplicate
    return Array.from(new Set(allFiles));
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.client.close();
  }
}
