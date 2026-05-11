/**
 * blog-authoring-harness — Author session + publish gate built on top of
 * provenance-scoring + huddle-harvest.
 *
 * Stateful: maintains in-memory sessions. Persistent state (publish log,
 * overrides) writes through ctx.store.
 *
 * Dependency injection:
 *   - scoringSkill: result of loadSkill('provenance-scoring')
 *   - canonProvider: { getPromotableUnits(workspaceId) → Promise<unit[]> }
 *   - store: { savePublish(rec), listPublishes(filter) }
 *   - embedder, llm: passed through to scoring
 *   - notifier: optional { notify({channel, body}) }
 */

'use strict';

const crypto = require('crypto');

const MANIFEST = {
  name: 'blog-authoring-harness',
  version: '0.1.0',
  type: 'view',
};

const DEFAULT_CONFIG = {
  threshold: 0.5,
  liveScore: { enabled: true, debounceMs: 800 },
  suggestions: { enabled: true, perParagraph: 3 },
  override: {
    requireReason: true,
    minReasonLength: 20,
    notify: [],
  },
};

// ───────────────────────── session store ─────────────────────────

class SessionStore {
  constructor() { this.sessions = new Map(); }

  create({ workspaceId, docId, authoredBy, canonUnits, threshold }) {
    const id = `sess_${crypto.randomBytes(8).toString('hex')}`;
    const session = {
      id,
      workspaceId,
      docId,
      authoredBy,
      canonUnits,
      threshold,
      createdAt: new Date().toISOString(),
      lastScore: null,
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id) { return this.sessions.get(id); }
  update(id, patch) {
    const s = this.sessions.get(id);
    if (s) Object.assign(s, patch);
    return s;
  }
  end(id) { this.sessions.delete(id); }
}

const sessions = new SessionStore();

// ───────────────────────── core operations ─────────────────────────

async function startSession(ctx, { workspaceId, docId, authoredBy }) {
  const config = mergeConfig(ctx.config);
  const canonUnits = await ctx.canonProvider.getPromotableUnits(workspaceId);
  const session = sessions.create({
    workspaceId,
    docId,
    authoredBy,
    canonUnits,
    threshold: config.threshold,
  });
  return {
    sessionId: session.id,
    canonUnitCount: canonUnits.length,
    threshold: config.threshold,
    liveScoreDebounceMs: config.liveScore.debounceMs,
  };
}

async function scoreDraft(ctx, { sessionId, draft }) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`No session: ${sessionId}`);

  const result = await ctx.scoringSkill.score({
    draft,
    canon: session.canonUnits,
    embedder: ctx.embedder,
    llm: ctx.llm,
    config: {
      thresholds: { publish: session.threshold },
      canon_filter: { source_platform: 'slack-huddle', intent_promotable_to_blog: true },
    },
  });

  sessions.update(sessionId, { lastScore: result.score, lastDraft: draft });
  return result;
}

async function suggestQuotes(ctx, { sessionId, paragraph }) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`No session: ${sessionId}`);
  if (!ctx.embedder) return { suggestions: [] };

  // Reuse scoring's suggestion path on a single-paragraph "draft"
  const result = await ctx.scoringSkill.score({
    draft: paragraph,
    canon: session.canonUnits,
    embedder: ctx.embedder,
    llm: ctx.llm,
    config: {
      thresholds: { publish: 0 }, // we don't care about pass/fail
    },
  });
  const ranges = result.unmatchedRanges || [];
  const sugg = [];
  for (const r of ranges) {
    if (r.suggestions) sugg.push(...r.suggestions);
  }
  // Dedupe by unitId, keep highest similarity
  const dedup = new Map();
  for (const s of sugg) {
    const prev = dedup.get(s.unitId);
    if (!prev || s.similarity > prev.similarity) dedup.set(s.unitId, s);
  }
  return {
    suggestions: [...dedup.values()]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, mergeConfig(ctx.config).suggestions.perParagraph),
  };
}

async function attemptPublish(ctx, { sessionId, draft, title }) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`No session: ${sessionId}`);
  const scored = await scoreDraft(ctx, { sessionId, draft });
  const config = mergeConfig(ctx.config);

  if (scored.passes) {
    const publishId = await savePublish(ctx, {
      session, draft, title, score: scored.score, override: null,
    });
    return {
      ok: true,
      publishId,
      score: scored.score,
      passed: true,
    };
  }

  // Below threshold — require override
  return {
    ok: false,
    requires_override: true,
    score: scored.score,
    threshold: scored.threshold,
    prompt: buildOverridePrompt(scored, session),
    minReasonLength: config.override.minReasonLength,
  };
}

async function logOverride(ctx, { sessionId, draft, title, reason }) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`No session: ${sessionId}`);
  const config = mergeConfig(ctx.config);

  if (config.override.requireReason) {
    if (!reason || reason.length < config.override.minReasonLength) {
      throw new Error(`Override reason must be at least ${config.override.minReasonLength} chars`);
    }
  }

  const scored = await scoreDraft(ctx, { sessionId, draft });
  const publishId = await savePublish(ctx, {
    session, draft, title, score: scored.score,
    override: { reason, acknowledgedAt: new Date().toISOString() },
  });

  // Notify configured channels
  if (ctx.notifier && config.override.notify?.length) {
    for (const target of config.override.notify) {
      try {
        await ctx.notifier.notify({
          channel: target.channel,
          body: `Override published: *${title}* by ${session.authoredBy} · P=${scored.score} (threshold ${session.threshold}) · Reason: "${reason}"`,
        });
      } catch (err) {
        ctx.logger?.warn('blog-authoring-harness: notify failed', err.message);
      }
    }
  }

  return { ok: true, publishId, score: scored.score, override: true };
}

async function savePublish(ctx, { session, draft, title, score, override }) {
  const publishId = `pub_${new Date().toISOString().slice(0, 10)}_${
    session.authoredBy.toLowerCase().replace(/[^a-z0-9]/g, '')
  }_${crypto.randomBytes(3).toString('hex')}`;

  const record = {
    publishId,
    workspaceId: session.workspaceId,
    docId: session.docId,
    title,
    authoredBy: session.authoredBy,
    finalScore: score,
    threshold: session.threshold,
    passed: score >= session.threshold,
    override,
    draftLength: draft.length,
    publishedAt: new Date().toISOString(),
  };

  await ctx.store?.savePublish?.(record);
  sessions.end(session.id);
  return publishId;
}

function buildOverridePrompt(scored, session) {
  const shortBy = (session.threshold - scored.score) * 100;
  return `This draft scored ${(scored.score * 100).toFixed(0)}% — ${shortBy.toFixed(0)} points below the ${(session.threshold * 100).toFixed(0)}% threshold. ` +
         `Publishing requires a brief reason for the override (will be logged to the workspace audit trail).`;
}

function mergeConfig(user) {
  if (!user) return DEFAULT_CONFIG;
  return {
    threshold: user.threshold ?? DEFAULT_CONFIG.threshold,
    liveScore: { ...DEFAULT_CONFIG.liveScore, ...(user.liveScore || {}) },
    suggestions: { ...DEFAULT_CONFIG.suggestions, ...(user.suggestions || {}) },
    override: { ...DEFAULT_CONFIG.override, ...(user.override || {}) },
  };
}

// ───────────────────────── HTTP route mounting ─────────────────────────

/**
 * Mount the harness's HTTP routes onto a context-bound router. Designed
 * to be called from web-app.js's route table.
 */
function mountRoutes(routes, ctx) {
  routes.post('/api/harness/session', async (body) =>
    startSession(ctx, body));

  routes.post('/api/harness/score', async (body) =>
    scoreDraft(ctx, body));

  routes.post('/api/harness/suggest', async (body) =>
    suggestQuotes(ctx, body));

  routes.post('/api/harness/publish/attempt', async (body) =>
    attemptPublish(ctx, body));

  routes.post('/api/harness/publish/override', async (body) =>
    logOverride(ctx, body));

  routes.get('/api/harness/publishes', async (query) =>
    ctx.store?.listPublishes?.(query) || []);
}

module.exports = {
  manifest: MANIFEST,
  startSession,
  scoreDraft,
  suggestQuotes,
  attemptPublish,
  logOverride,
  mountRoutes,
  _internals: { SessionStore, buildOverridePrompt, mergeConfig, sessions },
};
