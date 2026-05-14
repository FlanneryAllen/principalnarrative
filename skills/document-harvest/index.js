/**
 * document-harvest — PDF documents → structured narrative units
 *
 * Dependency-injected for testability:
 *   - pdfParser:  { parse(buffer) → { text, numpages, info } }
 *   - pii:        optional PII scrubber { scan(text) → { hasPII, redacted } }
 */

'use strict';

const MANIFEST = {
  name: 'document-harvest',
  version: '0.1.0',
  type: 'harvest',
};

// ───────────────────────── salience scoring ─────────────────────────

const DEFAULT_POSITIONING_BOOSTS = [
  'our vision',
  'we believe',
  'the opportunity',
  'we are building',
  'we are not',
  'the key insight',
  'our mission',
  'the thing is',
  'what matters',
];

/**
 * Score a paragraph for salience. Score ≥ threshold → eligible for unit creation.
 */
function salienceScore(text, opts = {}) {
  const trimmed = (text || '').trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (wordCount < (opts.minLengthWords || 20)) return 0;

  let score = Math.min(wordCount / 50, 1.0); // length component, capped

  const lower = trimmed.toLowerCase();
  const phrases = opts.positioningBoostPhrases || DEFAULT_POSITIONING_BOOSTS;
  for (const phrase of phrases) {
    if (lower.includes(phrase.toLowerCase())) {
      score += 0.6; // strong boost for positioning markers
      break;
    }
  }

  // Short paragraphs need a boost to be included
  if (wordCount < 30 && opts.requireBoostForShortParagraphs && score < 0.6) {
    return 0;
  }

  return Math.min(score, 2.0);
}

// ───────────────────────── text structure detection ─────────────────────────

/**
 * Detect if a line is likely a heading based on patterns.
 */
function isLikelyHeading(line, nextLine) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const wordCount = trimmed.split(/\s+/).length;

  // Very short lines that aren't full sentences are likely headings
  if (wordCount <= 10 && !trimmed.endsWith('.') && !trimmed.endsWith(',')) {
    return true;
  }

  // Numbered sections: "1. Product Vision", "Section 2: Strategy"
  if (/^(\d+\.|\d+:)\s+[A-Z]/.test(trimmed)) {
    return true;
  }

  // All caps (but not single words, likely acronyms)
  if (wordCount >= 2 && trimmed === trimmed.toUpperCase() && /^[A-Z\s]+$/.test(trimmed)) {
    return true;
  }

  // Title case followed by blank line or new heading
  if (/^[A-Z][a-z]/.test(trimmed) && wordCount <= 8 && !trimmed.endsWith('.')) {
    if (!nextLine || !nextLine.trim() || isLikelyHeading(nextLine, null)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect boilerplate patterns (footers, headers, page numbers).
 */
function isBoilerplate(text) {
  const trimmed = text.trim();

  // Page numbers
  if (/^(page\s+)?\d+(\s+of\s+\d+)?$/i.test(trimmed)) return true;

  // Copyright notices
  if (/©|copyright|confidential|proprietary/i.test(trimmed) && trimmed.length < 100) return true;

  // Very short lines (likely artifacts)
  if (trimmed.length < 5) return true;

  // Common footer patterns
  if (/^(slide|page)\s+\d+/i.test(trimmed)) return true;

  return false;
}

// ───────────────────────── unit builders ─────────────────────────

function docId(metadata) {
  const base = metadata.filename
    ? metadata.filename.replace(/\.pdf$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : 'uploaded-doc';
  return `doc-${base}`;
}

function createMetadataUnit(metadata, allUnits) {
  const docIdValue = docId(metadata);
  return {
    id: `${docIdValue}-meta`,
    type: 'document_metadata',
    assertion: `${metadata.title || metadata.filename} — ${metadata.pageCount} pages, uploaded ${metadata.uploadedAt || new Date().toISOString().split('T')[0]}`,
    author: metadata.author || 'Unknown',
    authoredAt: metadata.createdDate || new Date().toISOString(),
    scope: 'company',
    confidence: 1.0,
    dependencies: [],
    source: {
      platform: 'pdf-upload',
      filename: metadata.filename,
      pageCount: metadata.pageCount,
      createdDate: metadata.createdDate,
      uploadedAt: metadata.uploadedAt,
    },
    intent: {
      promotable_to_blog: false,
      needs_review: false,
    },
  };
}

function createTitleUnit(title, metadata, pageNumber = 1) {
  const docIdValue = docId(metadata);
  return {
    id: `${docIdValue}-title`,
    type: 'positioning',
    assertion: title,
    author: metadata.author || 'Unknown',
    authoredAt: metadata.createdDate || new Date().toISOString(),
    scope: 'company',
    confidence: 0.95,
    dependencies: [`${docIdValue}-meta`],
    source: {
      platform: 'pdf-upload',
      filename: metadata.filename,
      pageNumber,
      extractionMethod: 'title',
    },
    intent: {
      promotable_to_blog: true,
      needs_review: false,
    },
  };
}

function createHeadingUnit(heading, metadata, pageNumber, sectionIndex) {
  const docIdValue = docId(metadata);
  return {
    id: `${docIdValue}-section-${sectionIndex}`,
    type: 'positioning',
    assertion: heading,
    author: metadata.author || 'Unknown',
    authoredAt: metadata.createdDate || new Date().toISOString(),
    scope: 'positioning',
    confidence: 0.9,
    dependencies: [`${docIdValue}-meta`],
    source: {
      platform: 'pdf-upload',
      filename: metadata.filename,
      pageNumber,
      extractionMethod: 'heading',
    },
    intent: {
      promotable_to_blog: true,
      needs_review: false,
    },
  };
}

function createParagraphUnit(paragraph, metadata, pageNumber, paragraphIndex, currentSection, salienceScoreValue) {
  const docIdValue = docId(metadata);
  const dependencies = [`${docIdValue}-meta`];
  if (currentSection) {
    dependencies.push(currentSection.id);
  }

  return {
    id: `${docIdValue}-p${paragraphIndex}`,
    type: 'tactical',
    assertion: paragraph,
    author: metadata.author || 'Unknown',
    authoredAt: metadata.createdDate || new Date().toISOString(),
    scope: 'positioning',
    confidence: 0.8,
    dependencies,
    source: {
      platform: 'pdf-upload',
      filename: metadata.filename,
      pageNumber,
      extractionMethod: 'paragraph',
      salienceScore: salienceScoreValue,
    },
    intent: {
      promotable_to_blog: true,
      needs_review: true,
    },
  };
}

// ───────────────────────── main harvest function ─────────────────────────

/**
 * Harvest narrative units from a PDF document.
 *
 * @param {Object} options
 * @param {Buffer} options.pdfBuffer - PDF file as Buffer
 * @param {Object} options.metadata - { filename, author?, uploadedAt? }
 * @param {Object} options.pdfParser - { parse(buffer) → { text, numpages, info } }
 * @param {Object} [options.pii] - optional PII scrubber
 * @param {Object} [options.config] - harvest configuration
 * @returns {Promise<{ units: Array, metadata: Object }>}
 */
async function harvest({ pdfBuffer, metadata, pdfParser, pii, config = {} }) {
  if (!pdfBuffer || !metadata || !pdfParser) {
    throw new Error('document-harvest requires pdfBuffer, metadata, and pdfParser');
  }

  const opts = {
    minLengthWords: config.minLengthWords || 20,
    positioningBoostPhrases: config.positioningBoostPhrases || DEFAULT_POSITIONING_BOOSTS,
    requireBoostForShortParagraphs: config.requireBoostForShortParagraphs !== false,
    skipFooters: config.skipFooters !== false,
    skipHeaders: config.skipHeaders !== false,
  };

  // Parse PDF
  let parsed;
  try {
    parsed = await pdfParser.parse(pdfBuffer);
  } catch (err) {
    throw new Error(`PDF parse failed: ${err.message}`);
  }

  const { text, numpages, info } = parsed;

  // Extract metadata
  const enrichedMetadata = {
    ...metadata,
    pageCount: numpages,
    title: info?.Title || metadata.filename?.replace(/\.pdf$/i, '') || 'Untitled',
    author: metadata.author || info?.Author || 'Unknown',
    createdDate: info?.CreationDate || metadata.uploadedAt || new Date().toISOString(),
    uploadedAt: metadata.uploadedAt || new Date().toISOString(),
  };

  const units = [];

  // Create metadata unit
  const metaUnit = createMetadataUnit(enrichedMetadata, units);
  units.push(metaUnit);

  // Create title unit
  if (enrichedMetadata.title) {
    units.push(createTitleUnit(enrichedMetadata.title, enrichedMetadata));
  }

  // Split text into lines and process
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentSection = null;
  let sectionIndex = 0;
  let paragraphIndex = 0;
  let currentParagraph = [];
  let currentPage = 1; // Approximate page tracking

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // Skip boilerplate
    if (opts.skipFooters && isBoilerplate(line)) {
      continue;
    }

    // Detect headings
    if (isLikelyHeading(line, nextLine)) {
      // Flush current paragraph if any
      if (currentParagraph.length > 0) {
        const para = currentParagraph.join(' ');
        const score = salienceScore(para, opts);
        if (score >= 0.5) {
          paragraphIndex++;
          units.push(createParagraphUnit(para, enrichedMetadata, currentPage, paragraphIndex, currentSection, score));
        }
        currentParagraph = [];
      }

      // Create heading unit
      sectionIndex++;
      const headingUnit = createHeadingUnit(line, enrichedMetadata, currentPage, sectionIndex);
      units.push(headingUnit);
      currentSection = headingUnit;
      continue;
    }

    // Accumulate paragraph
    currentParagraph.push(line);

    // End paragraph on blank line or end of content
    if (!nextLine || !nextLine.trim()) {
      if (currentParagraph.length > 0) {
        const para = currentParagraph.join(' ');

        // PII check if available
        if (pii) {
          const scan = await pii.scan(para);
          if (scan.hasPII) {
            // Skip paragraphs with PII or use redacted version
            currentParagraph = [];
            continue;
          }
        }

        const score = salienceScore(para, opts);
        if (score >= 0.5) {
          paragraphIndex++;
          units.push(createParagraphUnit(para, enrichedMetadata, currentPage, paragraphIndex, currentSection, score));
        }
        currentParagraph = [];
      }
    }
  }

  // Flush any remaining paragraph
  if (currentParagraph.length > 0) {
    const para = currentParagraph.join(' ');
    const score = salienceScore(para, opts);
    if (score >= 0.5) {
      paragraphIndex++;
      units.push(createParagraphUnit(para, enrichedMetadata, currentPage, paragraphIndex, currentSection, score));
    }
  }

  return {
    units,
    metadata: enrichedMetadata,
  };
}

// ───────────────────────── exports ─────────────────────────

module.exports = {
  MANIFEST,
  harvest,

  // Exported for testing
  salienceScore,
  isLikelyHeading,
  isBoilerplate,
  createMetadataUnit,
  createTitleUnit,
  createHeadingUnit,
  createParagraphUnit,
};
