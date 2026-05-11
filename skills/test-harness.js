/**
 * Tests for the huddle provenance harness: huddle-harvest +
 * provenance-scoring + blog-authoring-harness.
 *
 * Run: node skills/test-harness.js
 */

'use strict';

const assert = require('assert');
const { loadSkill } = require('./loader');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  ✓ ${name}`); passed += 1; })
    .catch((err) => {
      console.log(`  ✗ ${name}`);
      console.log(`    ${err.message}`);
      if (err.stack) console.log(err.stack.split('\n').slice(1, 4).join('\n'));
      failed += 1;
    });
}

(async () => {

  // ════════════════════════════════════════════════════════════
  console.log('\nhuddle-harvest');
  // ════════════════════════════════════════════════════════════

  const huddle = loadSkill('huddle-harvest');

  await test('salienceScore filters short utterances', () => {
    const score = huddle._internals.salienceScore({ text: 'yeah ok cool' }, {});
    assert.strictEqual(score, 0);
  });

  await test('salienceScore boosts topic phrases', () => {
    const baseline = huddle._internals.salienceScore(
      { text: 'The product needs better positioning across our channels overall' },
      {},
    );
    const boosted = huddle._internals.salienceScore(
      { text: 'The thing is we need better positioning across our channels overall' },
      {},
    );
    assert.ok(boosted > baseline);
  });

  await test('buildQuoteUnit produces well-shaped verbatim units', () => {
    const seg = {
      text: 'We are not building a developer tool — we are building organizational infrastructure.',
      speaker: 'U_JULIE',
      ts: 14 * 60 + 23,
      absoluteTimestamp: '2026-05-09T14:23:00Z',
    };
    const huddleMeta = {
      id: 'huddle-2026-05-09-am',
      channel: 'C_HUDDLE',
      startedAt: '2026-05-09T14:00:00Z',
      transcriptUrl: 'https://slack.example/transcript.txt',
      permalink: 'https://slack.example/huddle',
    };
    const unit = huddle._internals.buildQuoteUnit(
      seg, huddleMeta, 'huddle-2026-05-09-am', 0, { default_scope: 'positioning' },
      { name: 'Julie Allen', title: 'CEO' },
    );
    assert.strictEqual(unit.id, 'huddle-2026-05-09-am-q0');
    assert.strictEqual(unit.author, 'Julie Allen, CEO');
    assert.strictEqual(unit.scope, 'positioning');
    assert.strictEqual(unit.source.derivation, 'verbatim');
    assert.strictEqual(unit.source.timestamp_in_recording, '00:14:23');
    assert.strictEqual(unit.confidence, 0.95);
    assert.strictEqual(unit.intent.promotable_to_blog, true);
    assert.strictEqual(unit.intent.needs_review, false);
  });

  await test('full huddle harvest produces verbatim units (no LLM = no ideas)', async () => {
    const slack = mockSlack();
    const transcriber = mockTranscriber();
    const result = await huddle.harvest({
      huddles: [{
        id: 'h1',
        channel: 'C_HUDDLE',
        startedAt: '2026-05-09T14:00:00Z',
        audioUrl: 'https://slack.example/audio.mp3',
        permalink: 'https://slack.example/huddle/h1',
        transcriptUrl: 'https://slack.example/transcript.txt',
      }],
      slack,
      transcriber,
      llm: null,
      config: {
        speakers: { whitelist: ['U_JULIE'] },
        default_scope: 'positioning',
        layers: { verbatim: true, ideas: true },
      },
    });
    assert.strictEqual(result.units.length, 2); // 2 long Julie utterances pass salience
    assert.ok(result.units.every((u) => u.source.derivation === 'verbatim'));
    assert.ok(result.units.every((u) => u.source.speaker_id === 'U_JULIE'));
    assert.strictEqual(result.huddles[0].quote_units, 2);
    assert.strictEqual(result.huddles[0].idea_units, 0);
  });

  await test('huddle harvest creates idea units when LLM available', async () => {
    const slack = mockSlack();
    const transcriber = mockTranscriber();
    const llm = mockIdeaLLM();
    const result = await huddle.harvest({
      huddles: [{
        id: 'h1',
        channel: 'C_HUDDLE',
        startedAt: '2026-05-09T14:00:00Z',
        audioUrl: 'https://slack.example/audio.mp3',
      }],
      slack,
      transcriber,
      llm,
      config: {
        speakers: { whitelist: ['U_JULIE'] },
        layers: { verbatim: true, ideas: true, ideas_max_per_huddle: 5 },
      },
    });
    const ideas = result.units.filter((u) => u.source.derivation === 'paraphrase');
    assert.ok(ideas.length >= 1);
    assert.ok(ideas[0].dependencies.length > 0); // grounded in source quotes
    assert.strictEqual(ideas[0].intent.needs_review, true);
  });

  await test('huddle harvest skips PII-detected segments', async () => {
    const slack = mockSlack();
    const transcriber = mockTranscriber();
    const pii = {
      scan: (text) => ({ hasPII: /\b\d{3}-\d{2}-\d{4}\b/.test(text) }),
    };
    // Inject a PII segment into the transcriber output
    const piiTranscriber = {
      transcribe: async () => ({
        segments: [
          { speaker: 'U_JULIE', ts: 0, text: 'My social security is 123-45-6789 obviously not really.' },
          { speaker: 'U_JULIE', ts: 30, text: 'The thing is we need better positioning across our channels overall.' },
        ],
      }),
    };
    const result = await huddle.harvest({
      huddles: [{ id: 'h1', channel: 'C', startedAt: '2026-05-09T14:00:00Z', audioUrl: 'x' }],
      slack, transcriber: piiTranscriber, llm: null, pii,
      config: { speakers: { whitelist: ['U_JULIE'] } },
    });
    assert.strictEqual(result.units.length, 1);
    assert.ok(!result.units[0].source.verbatim_text.includes('123-45'));
  });

  await test('huddle harvest skips huddles without recording', async () => {
    const result = await huddle.harvest({
      huddles: [{ id: 'h-no-rec', startedAt: '2026-05-09T14:00:00Z' }],
      slack: mockSlack(), transcriber: mockTranscriber(), llm: null,
      config: {},
    });
    assert.strictEqual(result.units.length, 0);
    assert.strictEqual(result.skipped.length, 1);
    assert.strictEqual(result.skipped[0].reason, 'no_recording');
  });

  // ════════════════════════════════════════════════════════════
  console.log('\nprovenance-scoring');
  // ════════════════════════════════════════════════════════════

  const prov = loadSkill('provenance-scoring');

  await test('splitSentences preserves offsets', () => {
    const draft = 'First sentence. Second one! Third?';
    const sents = prov._internals.splitSentences(draft);
    assert.strictEqual(sents.length, 3);
    assert.strictEqual(draft.slice(sents[0].start, sents[0].end), 'First sentence.');
    assert.strictEqual(draft.slice(sents[1].start, sents[1].end), 'Second one!');
  });

  await test('verbatim match catches exact substring', () => {
    const canon = [{
      id: 'q1',
      assertion: 'We are not building a developer tool',
      source: { verbatim_text: 'We are not building a developer tool — we are building organizational infrastructure.' },
    }];
    const m = prov._internals.matchVerbatim(
      { text: 'We are not building a developer tool — we are building organizational infrastructure.' },
      canon,
    );
    assert.ok(m);
    assert.strictEqual(m.unit.id, 'q1');
  });

  await test('verbatim match handles case + whitespace normalization', () => {
    const canon = [{
      id: 'q1',
      source: { verbatim_text: 'We are not building a developer tool — we are building organizational infrastructure.' },
    }];
    const m = prov._internals.matchVerbatim(
      { text: 'WE ARE NOT BUILDING A DEVELOPER TOOL  —  WE ARE BUILDING ORGANIZATIONAL INFRASTRUCTURE.' },
      canon,
    );
    assert.ok(m);
  });

  await test('cosine similarity behaves correctly', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    const c = [0, 1, 0];
    assert.strictEqual(prov._internals.cosine(a, b), 1);
    assert.strictEqual(prov._internals.cosine(a, c), 0);
  });

  await test('coalesceSpans merges adjacent same-source spans', () => {
    const spans = [
      { start: 0, end: 10, layer: 'verbatim', sourceUnitId: 'u1' },
      { start: 11, end: 20, layer: 'verbatim', sourceUnitId: 'u1' },
      { start: 30, end: 40, layer: 'verbatim', sourceUnitId: 'u2' },
    ];
    const merged = prov._internals.coalesceSpans(spans);
    assert.strictEqual(merged.length, 2);
    assert.strictEqual(merged[0].end, 20);
  });

  await test('score: verbatim-only path (no embedder) computes correct P', async () => {
    const draft = 'We are not building a developer tool. The market is mostly unaware. We focus on infrastructure.';
    const canon = [{
      id: 'q1', assertion: '', intent: { promotable_to_blog: true },
      source: { platform: 'slack-huddle', verbatim_text: 'We are not building a developer tool' },
    }];
    const result = await prov.score({ draft, canon });
    assert.ok(result.score > 0);
    assert.strictEqual(result.layerBreakdown.verbatim.count, 1);
    assert.strictEqual(result.totalChars, draft.length);
  });

  await test('score: passes/fails based on threshold', async () => {
    // Draft is partially verbatim: ~half matched, rest unmatched.
    const draft = 'We are not building a developer tool. This whole second sentence is entirely my own synthesis and not in canon at all whatsoever today.';
    const canon = [{
      id: 'q1', source: { platform: 'slack-huddle', verbatim_text: 'We are not building a developer tool' },
      intent: { promotable_to_blog: true },
    }];
    const highBar = await prov.score({
      draft, canon, config: { thresholds: { publish: 0.99 } },
    });
    // Only the first sentence matches → P well below 0.99
    assert.strictEqual(highBar.passes, false);
    assert.ok(highBar.score < 0.99, `expected <0.99, got ${highBar.score}`);

    const lowBar = await prov.score({
      draft, canon, config: { thresholds: { publish: 0.01 } },
    });
    assert.strictEqual(lowBar.passes, true);
  });

  await test('score: layered with mock embedder produces multi-layer breakdown', async () => {
    // Mock embedder that returns deterministic vectors based on simple keyword overlap
    const embedder = mockEmbedder();
    const llm = { complete: async ({ prompt }) => ({ text: 'YES' }) };

    const canon = [
      {
        id: 'q-verbatim',
        source: {
          platform: 'slack-huddle',
          verbatim_text: 'Infrastructure not tools',
        },
        intent: { promotable_to_blog: true },
      },
      {
        id: 'q-paraphrase-target',
        source: {
          platform: 'slack-huddle',
          verbatim_text: 'Markets reward stories that endure',
        },
        intent: { promotable_to_blog: true },
      },
    ];

    const draft = 'Infrastructure not tools. Markets reward stories that endure over time.';
    const result = await prov.score({
      draft, canon, embedder, llm,
      config: { thresholds: { publish: 0.1, paraphrase_similarity: 0.5, concept_similarity: 0.3, near_verbatim_similarity: 0.99 } },
    });
    assert.ok(result.score > 0);
    assert.ok(result.layerBreakdown.verbatim.count >= 1);
  });

  await test('score: canon_filter restricts to source_platform', async () => {
    const draft = 'We are not building a developer tool.';
    const canon = [
      {
        id: 'web-1', source: { platform: 'website', verbatim_text: 'We are not building a developer tool' },
        intent: { promotable_to_blog: true },
      },
      {
        id: 'huddle-1', source: { platform: 'slack-huddle', verbatim_text: 'completely unrelated text here' },
        intent: { promotable_to_blog: true },
      },
    ];
    const result = await prov.score({
      draft, canon,
      config: { canon_filter: { source_platform: 'slack-huddle', intent_promotable_to_blog: true } },
    });
    // Website match should be filtered out → 0 verbatim hits
    assert.strictEqual(result.layerBreakdown.verbatim.count, 0);
  });

  // ════════════════════════════════════════════════════════════
  console.log('\nblog-authoring-harness');
  // ════════════════════════════════════════════════════════════

  const harness = loadSkill('blog-authoring-harness');

  await test('startSession returns session id + canon count + threshold', async () => {
    const ctx = mockHarnessCtx();
    const result = await harness.startSession(ctx, {
      workspaceId: 'w1', docId: 'gdocs:abc', authoredBy: 'julie@noeticlabs.com',
    });
    assert.ok(result.sessionId.startsWith('sess_'));
    assert.strictEqual(result.canonUnitCount, 2);
    assert.strictEqual(result.threshold, 0.5);
  });

  await test('scoreDraft uses the session canon', async () => {
    const ctx = mockHarnessCtx();
    const s = await harness.startSession(ctx, {
      workspaceId: 'w1', docId: 'd', authoredBy: 'julie',
    });
    const scored = await harness.scoreDraft(ctx, {
      sessionId: s.sessionId,
      draft: 'We are not building a developer tool.',
    });
    assert.ok(scored.score >= 0);
    assert.ok(scored.layerBreakdown);
  });

  await test('attemptPublish returns ok=true above threshold', async () => {
    const ctx = mockHarnessCtx({ threshold: 0.0 }); // anything passes
    const s = await harness.startSession(ctx, {
      workspaceId: 'w1', docId: 'd', authoredBy: 'julie',
    });
    const r = await harness.attemptPublish(ctx, {
      sessionId: s.sessionId, draft: 'anything', title: 'Test',
    });
    assert.strictEqual(r.ok, true);
    assert.ok(r.publishId);
    assert.strictEqual(ctx._publishes.length, 1);
    assert.strictEqual(ctx._publishes[0].passed, true);
    assert.strictEqual(ctx._publishes[0].override, null);
  });

  await test('attemptPublish below threshold requests override', async () => {
    const ctx = mockHarnessCtx({ threshold: 1.0 }); // nothing passes
    const s = await harness.startSession(ctx, {
      workspaceId: 'w1', docId: 'd', authoredBy: 'julie',
    });
    const r = await harness.attemptPublish(ctx, {
      sessionId: s.sessionId, draft: 'unrelated text', title: 'Test',
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.requires_override, true);
    assert.ok(r.prompt);
    assert.ok(r.minReasonLength >= 1);
    assert.strictEqual(ctx._publishes.length, 0); // not yet logged
  });

  await test('logOverride records the publish + requires reason length', async () => {
    const ctx = mockHarnessCtx({ threshold: 1.0 });
    const s = await harness.startSession(ctx, {
      workspaceId: 'w1', docId: 'd', authoredBy: 'julie',
    });
    await assert.rejects(
      () => harness.logOverride(ctx, {
        sessionId: s.sessionId, draft: 'x', title: 't', reason: 'too short',
      }),
      /at least/,
    );

    const r = await harness.logOverride(ctx, {
      sessionId: s.sessionId,
      draft: 'unrelated draft text',
      title: 'Vision piece',
      reason: 'Vision piece — intentionally aspirational, will draw from upcoming huddle series.',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.override, true);
    assert.strictEqual(ctx._publishes.length, 1);
    assert.strictEqual(ctx._publishes[0].passed, false);
    assert.ok(ctx._publishes[0].override.reason.length >= 20);
  });

  await test('logOverride notifies configured channels', async () => {
    let notified = null;
    const ctx = mockHarnessCtx({
      threshold: 1.0,
      override: { requireReason: true, minReasonLength: 20, notify: [{ channel: '#voice-integrity' }] },
    });
    ctx.notifier = { notify: async (n) => { notified = n; } };
    const s = await harness.startSession(ctx, {
      workspaceId: 'w1', docId: 'd', authoredBy: 'julie',
    });
    await harness.logOverride(ctx, {
      sessionId: s.sessionId,
      draft: 'unrelated draft text',
      title: 'Vision piece',
      reason: 'Vision piece — intentionally aspirational so we can publish it now and revise later.',
    });
    assert.ok(notified);
    assert.strictEqual(notified.channel, '#voice-integrity');
    assert.match(notified.body, /Override published/);
  });

  // ════════════════════════════════════════════════════════════
  console.log(`\n${passed} passed · ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();

// ═════════════════════════════ mocks ═════════════════════════════

function mockSlack() {
  return {
    users: {
      info: async ({ user }) => ({
        user: {
          name: user,
          profile: { real_name: user === 'U_JULIE' ? 'Julie Allen' : 'Other', title: 'CEO' },
        },
      }),
    },
  };
}

function mockTranscriber() {
  return {
    transcribe: async () => ({
      segments: [
        { speaker: 'U_JULIE', ts: 0,   text: 'okay let me think about that' }, // too short
        { speaker: 'U_OTHER', ts: 12,  text: 'I agree with that, the strategy needs more shape' }, // not whitelisted
        { speaker: 'U_JULIE', ts: 30,  text: 'We are not building a developer tool — we are building organizational infrastructure for our customers.' },
        { speaker: 'U_JULIE', ts: 60,  text: 'The thing is we need to keep saying this in every external conversation we have.' },
      ],
    }),
  };
}

function mockIdeaLLM() {
  return {
    complete: async () => ({
      text: '{"summary": "Positioning shift: infrastructure language replaces tooling language.", "attributedTo": "Julie Allen", "supportingQuoteIndices": [0, 1], "scope": "positioning"}',
    }),
  };
}

/**
 * Mock embedder using token-overlap-based "embeddings". Same token bag = similar.
 */
function mockEmbedder() {
  function vec(text) {
    const VOCAB = ['infrastructure', 'tools', 'markets', 'stories', 'endure', 'developer', 'building'];
    const t = text.toLowerCase();
    return VOCAB.map((w) => (t.includes(w) ? 1 : 0));
  }
  return { embed: async (text) => vec(text) };
}

function mockHarnessCtx(configOverrides = {}) {
  const huddleQuoteUnits = [
    {
      id: 'huddle-q1',
      assertion: 'We are not building a developer tool',
      author: 'Julie Allen',
      source: {
        platform: 'slack-huddle',
        verbatim_text: 'We are not building a developer tool',
        derivation: 'verbatim',
      },
      intent: { promotable_to_blog: true },
    },
    {
      id: 'huddle-q2',
      assertion: 'Markets reward stories that endure',
      author: 'Julie Allen',
      source: {
        platform: 'slack-huddle',
        verbatim_text: 'Markets reward stories that endure',
        derivation: 'verbatim',
      },
      intent: { promotable_to_blog: true },
    },
  ];

  const publishes = [];
  return {
    scoringSkill: loadSkill('provenance-scoring'),
    canonProvider: { getPromotableUnits: async () => huddleQuoteUnits },
    store: {
      savePublish: async (rec) => { publishes.push(rec); },
      listPublishes: async () => publishes,
    },
    embedder: null, // verbatim-only is sufficient for harness tests
    llm: null,
    config: configOverrides,
    _publishes: publishes,
  };
}
