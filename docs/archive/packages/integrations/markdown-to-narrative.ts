/**
 * Markdown to Intent Converter
 *
 * Converts .principalnarrative/applied-narrative markdown files
 * into Intent Units for the Intent Engineering system.
 *
 * This bridges the human-readable Git-native storage with the
 * machine-queryable Intent Engineering database.
 */

import { NarrativeClient, NarrativeUnit, NarrativeType } from '@narrative/sdk';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

export interface MarkdownDocument {
  path: string;
  frontmatter: any;
  content: string;
  documentType: string;
}

export interface ConversionOptions {
  appliedNarrativePath?: string;
  dbPath?: string;
  overwrite?: boolean;
}

export class MarkdownToNarrativeConverter {
  private client: NarrativeClient;
  private appliedNarrativePath: string;

  constructor(options: ConversionOptions = {}) {
    this.appliedNarrativePath = options.appliedNarrativePath ?? '.principalnarrative/applied-narrative';
    this.client = new NarrativeClient(options.dbPath);
  }

  /**
   * Import all markdown documents from applied-narrative into intent units
   */
  async importAll(): Promise<{
    imported: NarrativeUnit[];
    skipped: string[];
    errors: Array<{ file: string; error: string }>;
  }> {
    const documents = this.discoverDocuments();
    const imported: NarrativeUnit[] = [];
    const skipped: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const doc of documents) {
      try {
        const intentUnit = await this.convertDocument(doc);
        if (intentUnit) {
          imported.push(intentUnit);
        } else {
          skipped.push(doc.path);
        }
      } catch (error) {
        errors.push({
          file: doc.path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { imported, skipped, errors };
  }

  /**
   * Discover all markdown documents in applied-narrative directory
   */
  private discoverDocuments(): MarkdownDocument[] {
    const documents: MarkdownDocument[] = [];

    if (!fs.existsSync(this.appliedNarrativePath)) {
      return documents;
    }

    const files = this.getAllMarkdownFiles(this.appliedNarrativePath);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const parsed = matter(content);

        documents.push({
          path: file,
          frontmatter: parsed.data,
          content: parsed.content,
          documentType: parsed.data.documentType ?? 'unknown',
        });
      } catch (error) {
        console.warn(`Failed to parse ${file}:`, error);
      }
    }

    return documents;
  }

  /**
   * Get all markdown files recursively
   */
  private getAllMarkdownFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        files.push(...this.getAllMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Convert a markdown document to an intent unit
   */
  async convertDocument(doc: MarkdownDocument): Promise<NarrativeUnit | null> {
    // Map document types to intent types
    const typeMapping: Record<string, NarrativeType> = {
      vision: 'core_story',
      brandVoice: 'communication',
      priorities: 'operational',
      customerPainPoints: 'positioning',
      decision: 'operational',
      technicalContext: 'operational',
    };

    const intentType = typeMapping[doc.documentType] ?? 'core_story';

    // Generate ID from file path
    const id = this.generateId(doc.path, doc.documentType);

    // Extract assertion from content
    const assertion = this.extractAssertion(doc);

    // Extract constraints based on document type
    const constraints = this.extractConstraints(doc);

    // Build the intent unit
    const intentUnit: NarrativeUnit = {
      id,
      type: intentType,
      assertion,
      intent: {
        objective: doc.frontmatter.tags?.[0] ?? doc.documentType,
        constraints,
      },
      dependencies: [],
      validationState: doc.frontmatter.status === 'approved' ? 'ALIGNED' : 'UNKNOWN',
      confidence: doc.frontmatter.status === 'approved' ? 1.0 : 0.7,
      metadata: {
        created_at: doc.frontmatter.lastUpdated ?? new Date().toISOString(),
        created_by: doc.frontmatter.author ?? 'applied_narrative',
        tags: doc.frontmatter.tags ?? [doc.documentType],
      },
    };

    // Create the unit
    return this.client.createUnit(intentUnit);
  }

  /**
   * Generate ID from file path
   */
  private generateId(filePath: string, documentType: string): string {
    const filename = path.basename(filePath, '.md');
    const cleanName = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `applied_narrative_${documentType}_${cleanName}`;
  }

  /**
   * Extract assertion from document content
   */
  private extractAssertion(doc: MarkdownDocument): string {
    // Try to find a mission statement, vision statement, or first H2 heading
    const lines = doc.content.split('\n');

    // Look for quoted text (often mission/vision statements)
    const quotedMatch = doc.content.match(/^>\s*(.+)$/m);
    if (quotedMatch) {
      return quotedMatch[1].trim();
    }

    // Look for first paragraph after a heading
    let inSection = false;
    for (const line of lines) {
      if (line.startsWith('## ') && !line.includes('Template') && !line.includes('Instructions')) {
        inSection = true;
        continue;
      }

      if (inSection && line.trim() && !line.startsWith('#') && !line.startsWith('-')) {
        return line.trim().substring(0, 200);
      }
    }

    // Fallback: use document type as assertion
    return `${doc.documentType}: ${path.basename(doc.path, '.md')}`;
  }

  /**
   * Extract constraints from document based on type
   */
  private extractConstraints(doc: MarkdownDocument): any {
    const constraints: any = {};

    // For brand voice documents, extract communication constraints
    if (doc.documentType === 'brandVoice') {
      constraints.content = this.extractBrandVoiceConstraints(doc);
    }

    // For priorities, extract operational constraints
    if (doc.documentType === 'priorities') {
      constraints.operational = this.extractPriorityConstraints(doc);
    }

    // Extract any explicit "Do's and Don'ts" sections
    const dosAndDonts = this.extractDosAndDonts(doc.content);
    if (dosAndDonts.dos.length > 0 || dosAndDonts.donts.length > 0) {
      if (!constraints.content) constraints.content = {};
      constraints.content.required_themes = dosAndDonts.dos;
      constraints.content.forbidden_themes = dosAndDonts.donts;
    }

    return Object.keys(constraints).length > 0 ? constraints : undefined;
  }

  /**
   * Extract brand voice constraints
   */
  private extractBrandVoiceConstraints(doc: MarkdownDocument): any {
    const content = doc.content;
    const constraints: any = {};

    // Try to extract tone
    const toneMatch = content.match(/\*\*Tone:\*\*\s*\[?e\.g\.,\s*"([^"]+)"/);
    if (toneMatch) {
      constraints.tone = toneMatch[1].toLowerCase().includes('professional')
        ? 'professional'
        : 'casual';
    }

    // Extract voice attributes as themes
    const attributeMatches = content.matchAll(/### Attribute \d+:\s*\[?e\.g\.,\s*"([^"]+)"\]?/g);
    const themes: string[] = [];
    for (const match of attributeMatches) {
      themes.push(match[1].toLowerCase().replace(/\s+/g, '_'));
    }

    if (themes.length > 0) {
      constraints.required_themes = themes;
    }

    return constraints;
  }

  /**
   * Extract priority constraints
   */
  private extractPriorityConstraints(doc: MarkdownDocument): any {
    const content = doc.content;
    const priorities: string[] = [];

    // Extract priority names
    const priorityMatches = content.matchAll(/### Priority \d+:\s*\[([^\]]+)\]/g);
    for (const match of priorityMatches) {
      priorities.push(match[1]);
    }

    return priorities.length > 0 ? { priorities } : undefined;
  }

  /**
   * Extract Do's and Don'ts from content
   */
  private extractDosAndDonts(content: string): { dos: string[]; donts: string[] } {
    const dos: string[] = [];
    const donts: string[] = [];

    // Look for "Good:" and "Bad:" examples
    const goodMatches = content.matchAll(/\*\*Good:\*\*\s*"([^"]+)"/g);
    for (const match of goodMatches) {
      dos.push(match[1]);
    }

    const badMatches = content.matchAll(/\*\*Bad:\*\*\s*"([^"]+)"/g);
    for (const match of badMatches) {
      donts.push(match[1]);
    }

    return { dos, donts };
  }

  /**
   * Sync changes from markdown files to intent database
   *
   * Checks if markdown files have been updated since last sync
   */
  async sync(): Promise<{
    updated: number;
    created: number;
    unchanged: number;
  }> {
    const result = { updated: 0, created: 0, unchanged: 0 };

    const documents = this.discoverDocuments();

    for (const doc of documents) {
      try {
        const id = this.generateId(doc.path, doc.documentType);
        const existing = this.client['graph'].getUnit(id);

        if (existing) {
          // Check if markdown is newer than intent unit
          const mdUpdated = new Date(doc.frontmatter.lastUpdated ?? 0);
          const intentUpdated = new Date(existing.metadata?.updated_at ?? 0);

          if (mdUpdated > intentUpdated) {
            // Update the intent unit
            await this.convertDocument(doc);
            result.updated++;
          } else {
            result.unchanged++;
          }
        } else {
          // Create new intent unit
          await this.convertDocument(doc);
          result.created++;
        }
      } catch (error) {
        console.error(`Error syncing ${doc.path}:`, error);
      }
    }

    return result;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.client.close();
  }
}
