/**
 * Smoke tests for bundled skills. Run: node skills/test-skills.js
 *
 * Validates:
 *   - Loader parses each SKILL.md manifest
 *   - slack-harvest produces well-shaped units from mock Slack data
 *   - weekly-coherence-digest renders both HTML and text without throwing
 *   - board-deck-view composes 8 sections and renders markdown
 */

'use strict';

const assert = require('assert');
const { loadSkill, listSkills } = require('./loader');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed += 1;
    })
    .catch((err) => {
      console.log(`  ✗ ${name}`);
      console.log(`    ${err.message}`);
      if (err.stack) console.log(err.stack.split('\n').slice(1, 4).join('\n'));
      failed += 1;
    });
}

(async () => {
  console.log('\nSkill Loader');

  await test('lists all bundled skills', () => {
    const skills = listSkills();
    const names = skills.map((s) => s.name).sort();
    assert.deepStrictEqual(names, [
      'blog-authoring-harness',
      'board-deck-view',
      'huddle-harvest',
      'provenance-scoring',
      'slack-harvest',
      'weekly-coherence-digest',
    ]);
  });

  await test('parses manifest frontmatter', () => {
    const { manifest } = loadSkill('slack-harvest');
    assert.strictEqual(manifest.name, 'slack-harvest');
    assert.strictEqual(manifest.type, 'harvest');
    assert.strictEqual(manifest.version, '0.1.0');
  });

  console.log('\nslack-harvest');

  await test('harvest returns empty for empty config', async () => {
    const skill = loadSkill('slack-harvest');
    const result = await skill.harvest({ slack: {}, config: {} });
    assert.deepStrictEqual(result, { units: [], sources: [] });
  });

  await test('inferUnitType: pinned → core_story', () => {
    const skill = loadSkill('slack-harvest');
    const t = skill._internals.inferUnitType({ pinned: true }, {});
    assert.strictEqual(t, 'core_story');
  });

  await test('inferUnitType: long thread → narrative_arc', () => {
    const skill = loadSkill('slack-harvest');
    const t = skill._internals.inferUnitType(
      { thread_ts: '123.45', reply_count: 12 },
      {},
    );
    assert.strictEqual(t, 'narrative_arc');
  });

  await test('inferUnitType: explicit channel config overrides', () => {
    const skill = loadSkill('slack-harvest');
    const t = skill._internals.inferUnitType({ pinned: true }, { type: 'tactical' });
    assert.strictEqual(t, 'tactical');
  });

  await test('buildUnitId is stable & url-safe', () => {
    const skill = loadSkill('slack-harvest');
    const id = skill._internals.buildUnitId('C01ABC', '1731234567.123456');
    assert.strictEqual(id, 'slack-C01ABC-1731234567123456');
    assert.match(id, /^[a-zA-Z0-9-]+$/);
  });

  await test('full harvest produces well-shaped units from mock Slack', async () => {
    const skill = loadSkill('slack-harvest');
    const slack = mockSlack();
    const result = await skill.harvest({
      slack,
      config: {
        channels: [{
          id: 'C_ANNOUNCE',
          authorWhitelist: ['U_CEO'],
          type: 'core_story',
          scope: 'company',
        }],
        pinned: true,
      },
    });
    assert.strictEqual(result.units.length, 2); // 1 pinned + 1 from whitelist
    for (const u of result.units) {
      assert.ok(u.id.startsWith('slack-C_ANNOUNCE-'));
      assert.strictEqual(u.source.platform, 'slack');
      assert.ok(u.source.permalink.startsWith('https://'));
      assert.ok(u.author);
      assert.ok(u.authoredAt);
      assert.strictEqual(u.intent.needsReview, true);
    }
    assert.strictEqual(result.sources[0].status, 'ok');
  });

  console.log('\nweekly-coherence-digest');

  await test('composeDigest produces a valid model', () => {
    const skill = loadSkill('weekly-coherence-digest');
    const model = skill.composeDigest({
      workspace: { id: 'w1', name: 'Acme' },
      metrics: mockMetrics(),
      lastSnapshot: { nci: 0.78, coverage: [] },
      actions: mockActions(),
      recentlyChangedUnits: [
        { change: 'added' }, { change: 'added' }, { change: 'updated' },
      ],
      thresholds: { drift_top_n: 3, actions_top_n: 5 },
    });
    assert.strictEqual(model.workspaceName, 'Acme');
    assert.strictEqual(model.nci.current, '0.82');
    assert.strictEqual(model.nci.delta.dir, 'up');
    assert.strictEqual(model.drift.length, 2); // only 2 drift items in mock
    assert.strictEqual(model.actions.length, 3); // 3 actions in mock
    assert.strictEqual(model.canonChanges.added, 2);
    assert.strictEqual(model.isBaseline, false);
  });

  await test('composeDigest handles baseline week (no last snapshot)', () => {
    const skill = loadSkill('weekly-coherence-digest');
    const model = skill.composeDigest({
      workspace: { id: 'w1', name: 'Acme' },
      metrics: mockMetrics(),
      lastSnapshot: null,
      actions: [],
      recentlyChangedUnits: [],
      thresholds: {},
    });
    assert.strictEqual(model.isBaseline, true);
    assert.strictEqual(model.nci.delta.text, '—');
  });

  await test('renderHtml produces non-empty HTML with NCI value', () => {
    const skill = loadSkill('weekly-coherence-digest');
    const model = skill.composeDigest({
      workspace: { id: 'w1', name: 'Acme' },
      metrics: mockMetrics(),
      lastSnapshot: { nci: 0.78 },
      actions: mockActions(),
      recentlyChangedUnits: [],
      thresholds: {},
    });
    const html = skill.renderHtml(model);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('0.82'));
    assert.ok(html.includes('Acme'));
  });

  await test('renderText produces plain-text fallback', () => {
    const skill = loadSkill('weekly-coherence-digest');
    const model = skill.composeDigest({
      workspace: { id: 'w1', name: 'Acme' },
      metrics: mockMetrics(),
      lastSnapshot: null,
      actions: mockActions(),
      recentlyChangedUnits: [],
      thresholds: {},
    });
    const text = skill.renderText(model);
    assert.ok(text.includes('Acme'));
    assert.ok(text.includes('NCI:'));
    assert.ok(!text.includes('<'));
  });

  await test('deliver caches digest when no email connector', async () => {
    const skill = loadSkill('weekly-coherence-digest');
    let cached = null;
    const result = await skill.deliver({
      workspace: { id: 'w1', name: 'Acme', admins: [{ email: 'a@acme.com' }] },
      metrics: mockMetrics(),
      lastSnapshot: null,
      actions: mockActions(),
      recentlyChangedUnits: [],
      config: { recipients: [{ role: 'workspace_admin' }] },
      email: null,
      snapshots: { saveDigest: (id, d) => { cached = { id, d }; } },
    });
    assert.strictEqual(result.delivered, false);
    assert.strictEqual(result.reason, 'no_email_connector');
    assert.strictEqual(result.cached, true);
    assert.strictEqual(cached.id, 'w1');
  });

  console.log('\nboard-deck-view');

  await test('compose produces 8 sections', async () => {
    const skill = loadSkill('board-deck-view');
    const view = await skill.compose({
      workspaceId: 'w1',
      canon: mockCanon(),
      metrics: mockMetrics(),
      lastBoardSnapshot: { nci: 0.71 },
      changeLog: [{ summary: 'Repositioning around enterprise tier', at: '2026-04-15', trigger: 'series_b' }],
      stakeholderViews: [{ audience: 'Investors', summary: 'Series B framing' }],
      actions: mockActions(),
      config: { meetingDate: '2026-05-15', audience: { sophistication: 'high', name: 'Acme Board' } },
      // No llm → falls back to raw assertion text
    });
    assert.strictEqual(view.sections.length, 8);
    assert.strictEqual(view.audience, 'Acme Board');
    assert.strictEqual(view.nciSnapshot.delta, 0.11);
  });

  await test('every section has title + narrative + slideNotes', async () => {
    const skill = loadSkill('board-deck-view');
    const view = await skill.compose({
      workspaceId: 'w1',
      canon: mockCanon(),
      metrics: mockMetrics(),
      actions: mockActions(),
      config: { meetingDate: '2026-05-15' },
    });
    for (const s of view.sections) {
      assert.ok(s.title, `section ${s.id} missing title`);
      assert.ok(s.slideNotes, `section ${s.id} missing slide notes`);
      assert.ok(typeof s.narrative === 'string', `section ${s.id} narrative wrong type`);
    }
  });

  await test('asks include only HIGH priority actions', async () => {
    const skill = loadSkill('board-deck-view');
    const view = await skill.compose({
      workspaceId: 'w1',
      canon: mockCanon(),
      metrics: mockMetrics(),
      actions: mockActions(),
      config: { meetingDate: '2026-05-15' },
    });
    for (const a of view.asks) {
      assert.strictEqual(a.priority, 'HIGH');
    }
  });

  await test('exportTo markdown produces readable doc', async () => {
    const skill = loadSkill('board-deck-view');
    const view = await skill.compose({
      workspaceId: 'w1',
      canon: mockCanon(),
      metrics: mockMetrics(),
      actions: mockActions(),
      config: { meetingDate: '2026-05-15', audience: { name: 'Acme Board' } },
    });
    const md = await skill.exportTo(view, 'markdown', {});
    assert.ok(md.startsWith('# Acme Board'));
    assert.ok(md.includes('## Where we stand'));
    assert.ok(md.includes('## Asks'));
  });

  await test('exportTo pptx throws without office/pptx skill', async () => {
    const skill = loadSkill('board-deck-view');
    const view = await skill.compose({
      workspaceId: 'w1',
      canon: mockCanon(),
      metrics: mockMetrics(),
      actions: [],
      config: { meetingDate: '2026-05-15' },
    });
    await assert.rejects(() => skill.exportTo(view, 'pptx', {}), /office\/pptx/);
  });

  // ───── summary ─────
  console.log(`\n${passed} passed · ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();

// ───────────────────────── mocks ─────────────────────────

function mockSlack() {
  return {
    conversations: {
      info: async ({ channel }) => ({ channel: { id: channel, name: 'announcements' } }),
      history: async () => ({
        messages: [
          { ts: '1731234567.000001', user: 'U_CEO', text: 'Today we are repositioning around the enterprise tier.' },
        ],
      }),
    },
    pins: {
      list: async () => ({
        items: [{
          type: 'message',
          message: { ts: '1731000000.000001', user: 'U_CEO', text: 'Our mission is to bridge sync and async collaboration.' },
        }],
      }),
    },
    users: {
      info: async ({ user }) => ({
        user: {
          name: user,
          profile: { real_name: 'Sarah Chen', title: 'CEO' },
        },
      }),
    },
    chat: {
      getPermalink: async ({ channel, message_ts }) => ({
        permalink: `https://acme.slack.com/archives/${channel}/p${message_ts.replace('.', '')}`,
      }),
    },
  };
}

function mockMetrics() {
  return {
    nci: 0.82,
    asOf: '2026-05-10T20:00:00Z',
    drift: [
      { unitId: 'u1', assertion: 'We integrate with anything', score: 0.31, originatedBy: 'Sarah Chen', contestedBy: ['u8', 'u9', 'u10'] },
      { unitId: 'u2', assertion: 'Enterprise-ready out of the box', score: 0.22, originatedBy: 'Marketing', contestedBy: ['u11'] },
    ],
    coverage: [
      { scope: 'customer-support', score: 0.12 },
      { scope: 'enterprise-tier', score: 0.0 },
      { scope: 'product', score: 0.85 },
    ],
    validationFailures: [
      { description: 'Marketing claim "trusted by 10k companies" lacks evidence', severity: 0.7 },
    ],
  };
}

function mockActions() {
  return [
    { id: 'a1', priority: 'HIGH', title: 'Reconcile "integrate with anything"', owner: 'Sarah', weight: 0.9, rationale: 'Engineering and marketing diverged' },
    { id: 'a2', priority: 'HIGH', title: 'Author Enterprise Tier canon unit', owner: 'Product', weight: 0.85 },
    { id: 'a3', priority: 'MED', title: 'Refresh customer support voice', owner: 'CX', weight: 0.5 },
  ];
}

function mockCanon() {
  return {
    units: [
      { id: 'u-mission', type: 'core_story', assertion: 'Bridge sync and async collaboration.', author: 'Sarah Chen, CEO', authoredAt: '2025-09-15', confidence: 1.0 },
      { id: 'u-wedge', type: 'core_story', assertion: 'We are the only platform with first-class real-time + async parity.', author: 'Sarah Chen, CEO', authoredAt: '2025-09-15', confidence: 0.95 },
      { id: 'u-arc-q3', type: 'narrative_arc', assertion: 'In 12 months we are the default collaboration platform for distributed engineering teams.', author: 'Sarah Chen, CEO', authoredAt: '2026-01-10' },
    ],
  };
}
