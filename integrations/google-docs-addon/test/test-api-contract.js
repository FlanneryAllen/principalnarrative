/**
 * Contract test — verifies the Apps Script HarnessClient sends payloads
 * that the blog-authoring-harness skill accepts, and that response shapes
 * match what the sidebar consumes.
 *
 * This catches the most common bug: server-side renames a field, the
 * Apps Script side keeps sending the old name. Pure-JS so it runs in CI.
 *
 * Run: node integrations/google-docs-addon/test/test-api-contract.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const { loadSkill } = require(path.join(__dirname, '..', '..', '..', 'skills', 'loader'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  ✓ ${name}`); passed += 1; })
    .catch((err) => {
      console.log(`  ✗ ${name}: ${err.message}`);
      failed += 1;
    });
}

/**
 * The exact set of fields the Apps Script HarnessClient.gs sends in each
 * request body. If these names drift from what the skill expects, the
 * add-on breaks silently in production. Pinned here.
 */
const ADDON_PAYLOADS = {
  startSession: { workspaceId: 'w', docId: 'gdocs:abc', authoredBy: 'u@x.com' },
  scoreDraft:   { sessionId: 'sess_abc', draft: 'Test draft sentence here.' },
  attempt:      { sessionId: 'sess_abc', draft: 'Test draft sentence here.', title: 'My Post' },
  override:     { sessionId: 'sess_abc', draft: 'd', title: 't', reason: 'a'.repeat(40) },
};

/**
 * The exact set of fields the Sidebar.html JavaScript reads from each
 * response. If the server stops returning these, the UI breaks.
 */
const SIDEBAR_READS = {
  scoreDraft: ['score', 'spans', 'threshold', 'layerBreakdown', 'unmatchedRanges', 'passes'],
  attempt:    ['ok', 'publishId', 'requires_override', 'prompt', 'minReasonLength', 'score'],
  override:   ['ok', 'publishId', 'override'],
};

function mockCtx() {
  return {
    scoringSkill: loadSkill('provenance-scoring'),
    canonProvider: { getPromotableUnits: async () => [{
      id: 'h-q1',
      source: { platform: 'slack-huddle', verbatim_text: 'Test draft sentence' },
      intent: { promotable_to_blog: true },
    }] },
    store: { savePublish: async () => {}, listPublishes: async () => [] },
    embedder: null, llm: null,
    config: { threshold: 0.0 },
  };
}

(async () => {
  console.log('\nGoogle Docs add-on ↔ harness contract');
  const harness = loadSkill('blog-authoring-harness');

  await test('startSession accepts add-on payload', async () => {
    const ctx = mockCtx();
    const r = await harness.startSession(ctx, ADDON_PAYLOADS.startSession);
    assert.ok(r.sessionId);
    assert.ok('threshold' in r);
    assert.ok('canonUnitCount' in r);
  });

  await test('scoreDraft accepts add-on payload + returns sidebar fields', async () => {
    const ctx = mockCtx();
    const s = await harness.startSession(ctx, ADDON_PAYLOADS.startSession);
    const result = await harness.scoreDraft(ctx, {
      sessionId: s.sessionId, draft: ADDON_PAYLOADS.scoreDraft.draft,
    });
    for (const field of SIDEBAR_READS.scoreDraft) {
      assert.ok(field in result, `missing field: ${field}`);
    }
  });

  await test('attemptPublish accepts add-on payload', async () => {
    const ctx = mockCtx();
    const s = await harness.startSession(ctx, ADDON_PAYLOADS.startSession);
    const r = await harness.attemptPublish(ctx, {
      sessionId: s.sessionId,
      draft: ADDON_PAYLOADS.attempt.draft,
      title: ADDON_PAYLOADS.attempt.title,
    });
    // Either pass or require-override path — both share 'ok' and 'score'
    for (const field of ['ok', 'score']) {
      assert.ok(field in r, `missing field: ${field}`);
    }
  });

  await test('logOverride accepts add-on payload + returns override flag', async () => {
    const ctx = mockCtx();
    ctx.config.threshold = 1.0; // force override path
    const s = await harness.startSession(ctx, ADDON_PAYLOADS.startSession);
    const r = await harness.logOverride(ctx, {
      sessionId: s.sessionId,
      draft: ADDON_PAYLOADS.override.draft,
      title: ADDON_PAYLOADS.override.title,
      reason: ADDON_PAYLOADS.override.reason,
    });
    for (const field of SIDEBAR_READS.override) {
      assert.ok(field in r, `missing field: ${field}`);
    }
  });

  await test('span shape matches what Highlighter.gs expects', async () => {
    const ctx = mockCtx();
    const s = await harness.startSession(ctx, ADDON_PAYLOADS.startSession);
    const result = await harness.scoreDraft(ctx, {
      sessionId: s.sessionId, draft: 'Test draft sentence here.',
    });
    for (const span of result.spans || []) {
      // Highlighter.gs reads: start, end, layer
      assert.strictEqual(typeof span.start, 'number');
      assert.strictEqual(typeof span.end, 'number');
      assert.ok(['verbatim', 'near_verbatim', 'paraphrase_verified', 'concept_only'].includes(span.layer));
    }
  });

  console.log(`\n${passed} passed · ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
