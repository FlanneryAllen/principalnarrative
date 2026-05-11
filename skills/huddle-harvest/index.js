/**
 * huddle-harvest — Slack huddle recordings → transcribe → verbatim quote units
 * + extracted idea units.
 *
 * Dependency-injected for testability:
 *   - slack:        @slack/web-api client (or mock)
 *   - transcriber:  { transcribe({ audioUrl, diarize }) → { segments: [{ speaker, ts, text }] } }
 *   - llm:          { complete({ prompt }) → { text } }   // for idea extraction
 *   - pii:          optional PII scrubber { scan(text) → { hasPII, redacted } }
 */

'use strict';

const MANIFEST = {
  name: 'huddle-harvest',
  version: '0.1.0',
  type: 'harvest',
};

// ───────────────────────── salience scoring ─────────────────────────

const DEFAULT_TOPIC_BOOSTS = [
  'what i keep saying',
  'the thing is',
  'the key thing is',
  'the key insight',
  "here's what",
  "we're not building",
  'we are building',
];

/**
 * Score an utterance for salience. Score ≥ threshold → eligible for unit creation.
 */
function salienceScore(segment, opts) {
  const text = (segment.text || '').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < (opts.minLengthWords || 8)) return 0;

  let score = Math.min(wordCount / 20, 1.0); // length component, capped
  const lower = text.toLowerCase();
  const phrases = opts.topicBoostPhrases || DEFAULT_TOPIC_BOOSTS;
  for (const phrase of phrases) {
    if (lower.includes(phrase.toLowerCase())) {
      score += 0.5; // strong boost for marker phrases
      break;
    }
  }
  if (segment.reactionCount && segment.reactionCount > 0) {
    score += 0.3; // team reacted to this moment
  }
  return Math.min(score, 2.0);
}

// ───────────────────────── unit builders ─────────────────────────

function huddleId(huddle) {
  return huddle.id || `huddle-${huddle.startedAt?.slice(0, 10)}-${huddle.channel || 'unknown'}`;
}

function quoteUnitId(hId, idx) {
  return `${hId}-q${idx}`;
}

function ideaUnitId(hId, idx) {
  return `${hId}-idea${idx}`;
}

function formatTs(seconds) {
  if (seconds == null) return '00:00:00';
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Build a verbatim quote unit from a transcript segment.
 */
function buildQuoteUnit(segment, huddle, hId, idx, config, speakerInfo) {
  const speakerName = speakerInfo?.name || segment.speaker || 'Unknown';
  const speakerTitle = speakerInfo?.title || '';
  const author = speakerTitle ? `${speakerName}, ${speakerTitle}` : speakerName;

  return {
    id: quoteUnitId(hId, idx),
    type: config.unit_type || 'tactical',
    assertion: segment.text.trim(),
    author,
    authoredAt: segment.absoluteTimestamp || huddle.startedAt,
    scope: config.default_scope || null,
    confidence: 0.95, // verbatim is high confidence
    dependencies: [],
    contestedBy: [],
    tensionIntent: null,
    evidence_required: [],
    source: {
      platform: 'slack-huddle',
      huddle_id: hId,
      huddle_channel: huddle.channel,
      timestamp_in_recording: formatTs(segment.ts),
      speaker_id: segment.speaker,
      speaker_name: speakerName,
      verbatim_text: segment.text.trim(),
      transcript_url: huddle.transcriptUrl,
      permalink: huddle.permalink
        ? `${huddle.permalink}?t=${Math.floor(segment.ts || 0)}`
        : null,
      derivation: 'verbatim',
    },
    intent: {
      promotable_to_blog: true,
      needs_review: false,
      harvested: true,
    },
  };
}

/**
 * Build a paraphrased idea unit derived from one or more verbatim units.
 */
function buildIdeaUnit(idea, sourceQuoteIds, huddle, hId, idx, config) {
  const sourceAuthor = idea.attributedTo || 'Multiple speakers';
  return {
    id: ideaUnitId(hId, idx),
    type: config.unit_type || 'tactical',
    assertion: idea.summary,
    author: sourceAuthor,
    authoredAt: huddle.startedAt,
    scope: idea.scope || config.default_scope || null,
    confidence: 0.75,
    dependencies: sourceQuoteIds.slice(),
    contestedBy: [],
    tensionIntent: null,
    evidence_required: [],
    source: {
      platform: 'slack-huddle',
      huddle_id: hId,
      derivation: 'paraphrase',
      source_unit_ids: sourceQuoteIds.slice(),
    },
    intent: {
      promotable_to_blog: true,
      needs_review: true, // paraphrases default to review
      harvested: true,
    },
  };
}

// ───────────────────────── idea extraction ─────────────────────────

const IDEA_EXTRACTION_PROMPT = (transcript, maxIdeas) => `You are reading a team huddle transcript. Extract the ${maxIdeas} most important *ideas* the team articulated — not every topic, just the load-bearing ones that future blog posts or canon should preserve.

For each idea output JSON on its own line:
{"summary": "<one-sentence idea>", "attributedTo": "<speaker name or 'Multiple speakers'>", "supportingQuoteIndices": [<0-based indices into the segments array>], "scope": "<positioning | product | strategy | operations | culture | null>"}

Only output the JSON lines, nothing else.

TRANSCRIPT (one segment per line, indexed):
${transcript}`;

async function extractIdeas(segments, opts, llm) {
  if (!llm || !opts.maxIdeas) return [];
  const indexed = segments
    .map((s, i) => `[${i}] (${s.speakerName || s.speaker}) ${s.text}`)
    .join('\n');
  const resp = await llm.complete({
    prompt: IDEA_EXTRACTION_PROMPT(indexed, opts.maxIdeas),
    maxTokens: 800,
    temperature: 0.2,
  });

  const ideas = [];
  for (const line of (resp.text || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.summary && Array.isArray(obj.supportingQuoteIndices)) {
        ideas.push(obj);
      }
    } catch {
      // Skip malformed lines
    }
  }
  return ideas;
}

// ───────────────────────── per-huddle harvest ─────────────────────────

async function harvestHuddle(huddle, ctx) {
  const { slack, transcriber, llm, pii, config, logger } = ctx;
  const hId = huddleId(huddle);

  // 1. Get the audio recording URL
  if (!huddle.audioUrl && !huddle.transcriptText) {
    return { huddle: hId, units: [], skipped: 'no_recording' };
  }

  // 2. Transcribe (unless transcript already provided)
  let segments;
  if (huddle.transcriptText && huddle.segments) {
    segments = huddle.segments;
  } else {
    const result = await transcriber.transcribe({
      audioUrl: huddle.audioUrl,
      diarize: config.transcription?.diarize !== false,
    });
    segments = result.segments;
  }
  if (!segments || segments.length === 0) {
    return { huddle: hId, units: [], skipped: 'transcription_empty' };
  }

  // 3. Resolve speaker info (cache user lookups)
  const speakerCache = new Map();
  for (const seg of segments) {
    if (seg.speaker && !speakerCache.has(seg.speaker) && slack?.users?.info) {
      try {
        const info = await slack.users.info({ user: seg.speaker });
        speakerCache.set(seg.speaker, {
          name: info.user.profile?.real_name || info.user.name,
          title: info.user.profile?.title || '',
        });
      } catch {
        speakerCache.set(seg.speaker, null);
      }
    }
    seg.speakerName = speakerCache.get(seg.speaker)?.name || seg.speaker;
  }

  // 4. Filter by speaker whitelist
  const whitelist = config.speakers?.whitelist;
  let eligible = segments;
  if (whitelist && whitelist.length) {
    eligible = segments.filter((s) => whitelist.includes(s.speaker));
  }

  // 5. PII scrub
  if (pii) {
    eligible = eligible.filter((s) => {
      const scan = pii.scan(s.text);
      if (scan.hasPII) {
        logger?.warn(`huddle-harvest: PII detected, dropping segment at ${formatTs(s.ts)}`);
        return false;
      }
      return true;
    });
  }

  // 6. Salience filter
  const salOpts = {
    minLengthWords: config.salience?.min_length_words ?? 8,
    topicBoostPhrases: config.salience?.topic_boost_phrases || DEFAULT_TOPIC_BOOSTS,
  };
  const threshold = config.salience?.require_topic_boost ? 0.8 : 0.4;
  const salient = eligible.filter((s) => salienceScore(s, salOpts) >= threshold);

  // 7. Build verbatim quote units
  const quoteUnits = [];
  if (config.layers?.verbatim !== false) {
    salient.forEach((seg, idx) => {
      const speakerInfo = speakerCache.get(seg.speaker);
      quoteUnits.push(buildQuoteUnit(seg, huddle, hId, idx, config, speakerInfo));
    });
  }

  // 8. Extract & build idea units
  const ideaUnits = [];
  if (config.layers?.ideas !== false && llm && salient.length > 0) {
    const maxIdeas = config.layers?.ideas_max_per_huddle || 7;
    const ideas = await extractIdeas(salient, { maxIdeas }, llm);
    ideas.forEach((idea, idx) => {
      const sourceIds = idea.supportingQuoteIndices
        .filter((i) => quoteUnits[i])
        .map((i) => quoteUnits[i].id);
      if (sourceIds.length === 0) return; // skip ideas without grounded sources
      ideaUnits.push(buildIdeaUnit(idea, sourceIds, huddle, hId, idx, config));
    });
  }

  return {
    huddle: hId,
    units: [...quoteUnits, ...ideaUnits],
    metrics: {
      segments_in: segments.length,
      eligible: eligible.length,
      salient: salient.length,
      quote_units: quoteUnits.length,
      idea_units: ideaUnits.length,
    },
  };
}

// ───────────────────────── public hook ─────────────────────────

/**
 * Harvest a batch of huddles.
 *
 * @param {object} ctx
 * @param {object[]} ctx.huddles — array of huddle metadata
 * @param {object}   ctx.slack
 * @param {object}   ctx.transcriber
 * @param {object}   ctx.llm
 * @param {object}   [ctx.pii]
 * @param {object}   ctx.config
 * @param {object}   [ctx.logger]
 * @returns {Promise<{units, huddles, skipped}>}
 */
async function harvest(ctx) {
  const huddles = ctx.huddles || [];
  const config = ctx.config || {};

  const allUnits = [];
  const huddleReports = [];
  const skipped = [];

  for (const huddle of huddles) {
    try {
      const report = await harvestHuddle(huddle, { ...ctx, config });
      if (report.skipped) {
        skipped.push({ huddle: report.huddle, reason: report.skipped });
        continue;
      }
      allUnits.push(...report.units);
      huddleReports.push({ huddle: report.huddle, ...report.metrics });
    } catch (err) {
      ctx.logger?.error(`huddle-harvest: ${huddle.id} failed`, err);
      skipped.push({ huddle: huddleId(huddle), reason: 'error', error: err.message });
    }
  }

  return { units: allUnits, huddles: huddleReports, skipped };
}

module.exports = {
  manifest: MANIFEST,
  harvest,
  _internals: {
    salienceScore,
    buildQuoteUnit,
    buildIdeaUnit,
    extractIdeas,
    formatTs,
    huddleId,
    DEFAULT_TOPIC_BOOSTS,
  },
};
