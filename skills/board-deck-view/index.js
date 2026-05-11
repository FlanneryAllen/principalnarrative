/**
 * board-deck-view — Composes workspace canon into board-meeting narrative.
 *
 * This is a `view` skill: it selects, ranks, and reframes existing canon
 * units into the 8-section board narrative. It does not mutate canon.
 */

'use strict';

const MANIFEST = {
  name: 'board-deck-view',
  version: '0.1.0',
  type: 'view',
};

// ───────────────────────── section definitions ─────────────────────────

/**
 * Each section declares: which units to select, how to rank them, and the
 * prompt template used to reframe them into board language.
 */
const SECTIONS = [
  {
    id: 'where-we-stand',
    title: 'Where we stand',
    select: (canon) => canon.units.filter((u) => u.type === 'core_story'),
    rank: (units) => units.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)),
    framing: 'present_state',
  },
  {
    id: 'what-changed',
    title: 'What changed this quarter',
    select: (canon, ctx) => ctx.changeLog || [],
    rank: (changes) => changes.sort((a, b) => new Date(b.at) - new Date(a.at)),
    framing: 'change_narrative',
  },
  {
    id: 'strategic-narrative',
    title: 'Strategic narrative',
    select: (canon) => canon.units.filter((u) => u.type === 'narrative_arc'),
    rank: (units) => units,
    framing: 'forward_arc',
  },
  {
    id: 'stakeholder-lens',
    title: 'Stakeholder lens',
    select: (canon, ctx) => ctx.stakeholderViews || [],
    rank: (views) => views,
    framing: 'stakeholder_summary',
  },
  {
    id: 'tension-contradictions',
    title: 'Tension & contradictions',
    select: (canon, ctx) => {
      const threshold = ctx.driftThreshold ?? 0.3;
      return (ctx.metrics.drift || []).filter((d) => d.score >= threshold);
    },
    rank: (drift) => drift.sort((a, b) => b.score - a.score).slice(0, 5),
    framing: 'tension_disclosure',
  },
  {
    id: 'coverage-gaps',
    title: 'Coverage & gaps',
    select: (canon, ctx) => {
      const threshold = ctx.coverageThreshold ?? 0.4;
      return (ctx.metrics.coverage || []).filter((c) => c.score < threshold);
    },
    rank: (gaps) => gaps.sort((a, b) => a.score - b.score),
    framing: 'gap_acknowledgment',
  },
  {
    id: 'risk',
    title: 'Risk',
    select: (canon, ctx) => ctx.metrics.validationFailures || [],
    rank: (failures) => failures.sort((a, b) => (b.severity || 0) - (a.severity || 0)),
    framing: 'risk_framing',
  },
  {
    id: 'asks',
    title: 'Asks',
    select: (canon, ctx) => (ctx.actions || []).filter((a) => a.priority === 'HIGH'),
    rank: (acts) => acts.sort((a, b) => (b.weight || 0) - (a.weight || 0)),
    framing: 'board_ask',
  },
];

// ───────────────────────── reframing prompts ─────────────────────────

const FRAMING_PROMPTS = {
  present_state: (item, audience) => `
You are reframing a company's core narrative unit for a board with ${audience.sophistication} sophistication.
Preserve every factual claim. Add strategic framing. Never invent metrics.

UNIT TYPE: ${item.type}
ASSERTION: ${item.assertion}
ATTRIBUTION: ${item.author}, ${item.authoredAt}

Output a single board-ready paragraph (max 60 words) that opens the company's story.`,

  change_narrative: (item) => `
You are summarizing a change to a company's narrative for a board.
CHANGE: ${item.summary || item.assertion}
TRIGGER: ${item.trigger || 'periodic_review'}
DATE: ${item.at}

Output: 1-2 sentences explaining what changed and why it matters strategically.`,

  forward_arc: (item) => `
Reframe this narrative arc as a forward commitment for the next 12 months.
ASSERTION: ${item.assertion}

Output: 2-3 sentences. Use confident but measured language.`,

  stakeholder_summary: (view) => `
Summarize how a stakeholder hears the company's narrative.
STAKEHOLDER: ${view.audience}
COMPOSITION: ${view.summary}

Output: 1-2 sentences from the stakeholder's perspective. No first-person.`,

  tension_disclosure: (item) => `
Surface a narrative tension for board awareness. Disclose, don't downplay.
CLAIM: ${item.assertion}
DRIFT SCORE: ${item.score}
CONTESTED BY: ${item.contestedBy?.length || 0} units

Output: 2 sentences — what the tension is, and what we're doing about it.`,

  gap_acknowledgment: (item) => `
Acknowledge a coverage gap honestly.
SCOPE: ${item.scope}
COVERAGE SCORE: ${item.score}

Output: 1 sentence acknowledging the gap and 1 sentence on intent to address it.`,

  risk_framing: (item) => `
Frame a narrative risk for the board's risk discussion.
RISK: ${item.description || item.assertion}
SEVERITY: ${item.severity}

Output: 1-2 sentences. Concrete, not alarmist.`,

  board_ask: (action) => `
Frame this action as a board ask.
ACTION: ${action.title}
OWNER: ${action.owner || 'TBD'}
RATIONALE: ${action.rationale || ''}

Output: 1 sentence stating the ask, 1 sentence stating the decision needed from the board.`,
};

// ───────────────────────── reframe + compose ─────────────────────────

/**
 * Reframe a single item via the LLM. Falls back to raw text if no LLM
 * available (useful for tests and offline rendering).
 */
async function reframe(item, framing, audience, llm) {
  const prompt = FRAMING_PROMPTS[framing](item, audience || { sophistication: 'high' });
  if (!llm) {
    // Fallback: return assertion as-is
    return item.assertion || item.summary || item.description || item.title || '';
  }
  const resp = await llm.complete({
    prompt,
    maxTokens: 200,
    temperature: 0.3,
  });
  return (resp.text || '').trim();
}

/**
 * Build the source attribution for a reframed paragraph — every claim
 * traceable to a canon unit.
 */
function attribution(item) {
  if (item.unitId) {
    return { sourceUnitId: item.unitId, evidenceUrl: `/units/${item.unitId}` };
  }
  if (item.id) {
    return { sourceUnitId: item.id, evidenceUrl: `/units/${item.id}` };
  }
  return null;
}

/**
 * Compose the board deck view.
 *
 * @param {object} ctx
 * @param {object} ctx.canon — { units, ... }
 * @param {object} ctx.metrics — current metrics snapshot
 * @param {object} [ctx.lastBoardSnapshot]
 * @param {object[]} [ctx.changeLog]
 * @param {object[]} [ctx.stakeholderViews]
 * @param {object[]} [ctx.actions]
 * @param {object} ctx.config
 * @param {object} [ctx.llm]
 * @returns {Promise<object>} board deck view object
 */
async function compose(ctx) {
  const { canon, metrics, lastBoardSnapshot, config, llm } = ctx;
  const audience = config.audience || { sophistication: 'high', name: 'Board of Directors' };

  const sectionCtx = {
    metrics,
    changeLog: ctx.changeLog || [],
    stakeholderViews: ctx.stakeholderViews || [],
    actions: ctx.actions || [],
    driftThreshold: 0.3,
    coverageThreshold: 0.4,
  };

  const sections = [];
  for (const def of SECTIONS) {
    const selected = def.select(canon, sectionCtx);
    const ranked = def.rank(selected).slice(0, def.id === 'tension-contradictions' ? 5 : 3);

    const narratives = [];
    for (const item of ranked) {
      const text = await reframe(item, def.framing, audience, llm);
      narratives.push({ text, ...attribution(item) });
    }

    sections.push({
      id: def.id,
      title: def.title,
      narrative: narratives.map((n) => n.text).join('\n\n'),
      keyClaims: narratives.filter((n) => n.sourceUnitId),
      slideNotes: generateSlideNotes(def.id, ranked, metrics),
      itemCount: ranked.length,
    });
  }

  return {
    meetingDate: config.meetingDate,
    audience: audience.name,
    generatedAt: new Date().toISOString(),
    nciSnapshot: {
      current: metrics.nci,
      lastBoard: lastBoardSnapshot?.nci,
      delta: lastBoardSnapshot
        ? +(metrics.nci - lastBoardSnapshot.nci).toFixed(3)
        : null,
    },
    sections,
    asks: (ctx.actions || []).filter((a) => a.priority === 'HIGH').slice(0, 5),
    appendix: {
      fullCanonExport: `/workspaces/${ctx.workspaceId}/canon/export?asOf=${new Date().toISOString()}`,
      driftReport: `/workspaces/${ctx.workspaceId}/drift?asOf=${new Date().toISOString()}`,
    },
  };
}

function generateSlideNotes(sectionId, items, metrics) {
  const baseNotes = {
    'where-we-stand': `Open with the company story. Current NCI: ${metrics.nci?.toFixed(2) || 'n/a'}.`,
    'what-changed': `Acknowledge change. ${items.length} significant shifts since last board.`,
    'strategic-narrative': 'Commit to the 12-month arc. Take questions on dependencies.',
    'stakeholder-lens': 'Briefly characterize each audience. Save depth for Q&A.',
    'tension-contradictions': 'Disclose. Show ownership. Show the remediation in next section.',
    'coverage-gaps': 'Honesty here builds trust. Connect each gap to a planned investment.',
    'risk': 'Frame as known and managed, not as discovery.',
    'asks': 'Make the decision the board needs to make crystal clear.',
  };
  return baseNotes[sectionId] || '';
}

// ───────────────────────── export adapters ─────────────────────────

/**
 * Render the composed view to the requested format. PPTX/PDF require their
 * respective office skills; markdown and json are always available.
 */
async function exportTo(view, format, ctx) {
  switch (format) {
    case 'markdown':
      return renderMarkdown(view);
    case 'json':
      return JSON.stringify(view, null, 2);
    case 'pptx':
      if (!ctx.pptx) throw new Error('board-deck-view: office/pptx skill required for pptx export');
      return ctx.pptx.fromBoardView(view);
    case 'pdf':
      if (!ctx.pdf) throw new Error('board-deck-view: office/pdf skill required for pdf export');
      return ctx.pdf.fromBoardView(view);
    default:
      throw new Error(`board-deck-view: unknown format ${format}`);
  }
}

function renderMarkdown(view) {
  const lines = [
    `# ${view.audience} — Board Deck`,
    `*Meeting: ${view.meetingDate} · Generated: ${view.generatedAt}*`,
    '',
    `**NCI:** ${view.nciSnapshot.current?.toFixed(2)}` +
      (view.nciSnapshot.delta != null
        ? ` (${view.nciSnapshot.delta >= 0 ? '+' : ''}${view.nciSnapshot.delta} vs last board)`
        : ''),
    '',
  ];

  for (const s of view.sections) {
    lines.push(`## ${s.title}`);
    lines.push('');
    lines.push(s.narrative || '_(no content this section)_');
    if (s.keyClaims?.length) {
      lines.push('');
      lines.push('**Sources:**');
      for (const c of s.keyClaims) {
        lines.push(`- [${c.sourceUnitId}](${c.evidenceUrl})`);
      }
    }
    lines.push('');
    lines.push(`> _Speaker notes:_ ${s.slideNotes}`);
    lines.push('');
  }

  if (view.asks?.length) {
    lines.push('## Asks');
    for (const a of view.asks) {
      lines.push(`- **${a.title}** — owner: ${a.owner || 'TBD'}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  manifest: MANIFEST,
  compose,
  exportTo,
  // Exposed for testing & for skills that want to compose section-by-section
  SECTIONS,
  FRAMING_PROMPTS,
  _internals: { reframe, renderMarkdown, generateSlideNotes },
};
