/**
 * weekly-coherence-digest — Composes & delivers the weekly coherence email.
 *
 * Pure composer: no algebra computation. Reads precomputed metrics, snapshots,
 * and actions from the agent's standard API surface.
 */

'use strict';

const MANIFEST = {
  name: 'weekly-coherence-digest',
  version: '0.1.0',
  type: 'delivery',
};

// ───────────────────────────── helpers ─────────────────────────────

function formatDelta(curr, prev) {
  if (prev == null) return { text: '—', dir: 'flat' };
  const diff = curr - prev;
  const sign = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  return { text: `${sign} ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`, dir };
}

function formatNCI(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function weekRange(asOf) {
  const end = new Date(asOf);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const opts = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', opts);
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

// ───────────────────────────── compose ─────────────────────────────

/**
 * Build the digest data model from metrics + actions + last week snapshot.
 *
 * @param {object} args
 * @param {object} args.workspace — { id, name, brand }
 * @param {object} args.metrics — current metrics (NCI, weighted, perStakeholder, etc.)
 * @param {object|null} args.lastSnapshot — previous week's metrics, or null
 * @param {object[]} args.actions — prescriptive actions sorted by weight desc
 * @param {object[]} args.recentlyChangedUnits — units modified this week
 * @param {object} args.thresholds
 * @returns {object} digest model
 */
function composeDigest({
  workspace,
  metrics,
  lastSnapshot,
  actions,
  recentlyChangedUnits,
  thresholds,
}) {
  const topN = thresholds.drift_top_n || 3;
  const actN = thresholds.actions_top_n || 5;
  const covT = thresholds.coverage_gap_threshold ?? 0.5;
  const asOf = metrics.asOf || new Date().toISOString();

  const driftSorted = (metrics.drift || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, topN);

  const coverageGaps = (metrics.coverage || [])
    .filter((c) => (c.score || 0) < covT)
    .sort((a, b) => (a.score || 0) - (b.score || 0));

  const added = recentlyChangedUnits.filter((u) => u.change === 'added').length;
  const updated = recentlyChangedUnits.filter((u) => u.change === 'updated').length;
  const retired = recentlyChangedUnits.filter((u) => u.change === 'retired').length;

  return {
    workspaceName: workspace.name,
    weekLabel: weekRange(asOf),
    nci: {
      current: formatNCI(metrics.nci),
      delta: formatDelta(metrics.nci, lastSnapshot?.nci),
      lastWeek: lastSnapshot ? formatNCI(lastSnapshot.nci) : null,
    },
    drift: driftSorted.map((d) => ({
      assertion: d.assertion,
      score: d.score.toFixed(2),
      originatedBy: d.originatedBy,
      contestedCount: d.contestedBy?.length || 0,
      dashboardUrl: `/workspaces/${workspace.id}/units/${d.unitId}`,
    })),
    coverageGaps: coverageGaps.map((g) => ({
      scope: g.scope,
      score: g.score.toFixed(2),
      lastWeekScore: lastSnapshot?.coverage?.find((c) => c.scope === g.scope)?.score?.toFixed(2),
    })),
    actions: actions.slice(0, actN).map((a) => ({
      priority: a.priority || 'MED',
      title: a.title,
      owner: a.owner || 'Unassigned',
      url: `/workspaces/${workspace.id}/actions/${a.id}`,
    })),
    canonChanges: { added, updated, retired },
    isBaseline: !lastSnapshot,
    isCleanWeek: driftSorted.length === 0 && actions.length === 0,
  };
}

// ───────────────────────────── render ─────────────────────────────

function renderHtml(d, brand = {}) {
  const primary = brand.primary_color || '#0a1628';
  const logo = brand.logo_url
    ? `<img src="${brand.logo_url}" alt="" style="height:32px;margin-bottom:16px"/>`
    : '';

  const trendBlock = d.isBaseline
    ? '<p style="color:#64748b;font-size:13px">Baseline week — trends start next Monday.</p>'
    : `<div style="font-size:13px;color:${d.nci.delta.dir === 'down' ? '#dc2626' : '#059669'}">
         ${d.nci.delta.text} vs. ${d.nci.lastWeek} last week
       </div>`;

  const driftRows = d.drift.length
    ? d.drift.map((x, i) => `
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#64748b;width:24px">${i + 1}.</td>
          <td style="padding:8px 0">
            <div style="font-weight:600">${escapeHtml(x.assertion)}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">
              δ=${x.score} · originated by ${escapeHtml(x.originatedBy || 'unknown')} · ${x.contestedCount} contested
            </div>
            <a href="${x.dashboardUrl}" style="font-size:12px;color:${primary}">Review →</a>
          </td>
        </tr>`).join('')
    : '<tr><td style="color:#64748b;padding:8px 0">No drift detected this week.</td></tr>';

  const actionRows = d.actions.length
    ? d.actions.map((a) => `
        <tr>
          <td style="padding:6px 8px 6px 0;vertical-align:top">
            <span style="font-size:11px;font-weight:700;color:${a.priority === 'HIGH' ? '#dc2626' : '#64748b'}">[${a.priority}]</span>
          </td>
          <td style="padding:6px 0">
            <div>${escapeHtml(a.title)}</div>
            <div style="font-size:12px;color:#64748b">Owner: ${escapeHtml(a.owner)}</div>
          </td>
        </tr>`).join('')
    : '<tr><td style="color:#64748b">Clean week — no actions recommended.</td></tr>';

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,Inter,sans-serif;color:#0f172a">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
  ${logo}
  <h1 style="font-size:20px;margin:0 0 4px">${escapeHtml(d.workspaceName)} — Weekly Coherence Digest</h1>
  <div style="color:#64748b;font-size:13px;margin-bottom:24px">Week of ${d.weekLabel}</div>

  <div style="background:${primary};color:#fff;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
    <div style="font-size:11px;letter-spacing:1.5px;opacity:0.7;text-transform:uppercase">NCI this week</div>
    <div style="font-size:40px;font-weight:700;margin:4px 0">${d.nci.current}</div>
    ${trendBlock}
  </div>

  <h2 style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin:24px 0 8px">Top Drift</h2>
  <table style="width:100%;border-collapse:collapse">${driftRows}</table>

  <h2 style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin:24px 0 8px">Recommended Actions</h2>
  <table style="width:100%;border-collapse:collapse">${actionRows}</table>

  <h2 style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin:24px 0 8px">Canon changes</h2>
  <div style="font-size:14px;color:#475569">
    <span style="color:#059669">+ ${d.canonChanges.added} added</span> ·
    <span>~ ${d.canonChanges.updated} updated</span> ·
    <span style="color:#dc2626">− ${d.canonChanges.retired} retired</span>
  </div>
</div>
<div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px">
  Generated by Narrative Agent · <a href="/settings/digest" style="color:#94a3b8">Manage delivery</a>
</div>
</body></html>`;
}

function renderText(d) {
  const lines = [
    `${d.workspaceName} — Weekly Coherence Digest`,
    `Week of ${d.weekLabel}`,
    '',
    `NCI: ${d.nci.current}  (${d.isBaseline ? 'baseline week' : `${d.nci.delta.text} vs ${d.nci.lastWeek}`})`,
    '',
    'TOP DRIFT',
    ...d.drift.map((x, i) => `  ${i + 1}. "${x.assertion}" — δ=${x.score} · ${x.contestedCount} contested`),
    '',
    'RECOMMENDED ACTIONS',
    ...d.actions.map((a) => `  [${a.priority}] ${a.title} (${a.owner})`),
    '',
    `Canon: +${d.canonChanges.added} added, ~${d.canonChanges.updated} updated, -${d.canonChanges.retired} retired`,
  ];
  return lines.join('\n');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ───────────────────────────── deliver ─────────────────────────────

/**
 * Public hook — called by the scheduler.
 *
 * @param {object} ctx
 * @param {object} ctx.workspace
 * @param {object} ctx.metrics — current metrics
 * @param {object|null} ctx.lastSnapshot
 * @param {object[]} ctx.actions
 * @param {object[]} ctx.recentlyChangedUnits
 * @param {object} ctx.config — skill config
 * @param {object} ctx.email — email connector { send({to, subject, html, text}) }
 */
async function deliver(ctx) {
  const digest = composeDigest({
    workspace: ctx.workspace,
    metrics: ctx.metrics,
    lastSnapshot: ctx.lastSnapshot,
    actions: ctx.actions,
    recentlyChangedUnits: ctx.recentlyChangedUnits,
    thresholds: ctx.config.thresholds || {},
  });

  const html = renderHtml(digest, ctx.config.brand);
  const text = renderText(digest);
  const subject = `${ctx.workspace.name} — NCI ${digest.nci.current} ${digest.nci.delta.text}`;

  const recipients = resolveRecipients(ctx.workspace, ctx.config.recipients || []);
  if (!recipients.length) {
    return { delivered: false, reason: 'no_recipients' };
  }

  if (!ctx.email) {
    // Save digest for later delivery
    ctx.snapshots?.saveDigest?.(ctx.workspace.id, { digest, html, text });
    return { delivered: false, reason: 'no_email_connector', cached: true };
  }

  await ctx.email.send({ to: recipients, subject, html, text });
  return { delivered: true, recipients: recipients.length, digest };
}

function resolveRecipients(workspace, recipientConfig) {
  const out = new Set();
  for (const r of recipientConfig) {
    if (r.role === 'workspace_admin' && workspace.admins) {
      workspace.admins.forEach((a) => out.add(a.email));
    }
    if (Array.isArray(r.emails)) {
      r.emails.forEach((e) => out.add(e));
    }
  }
  return [...out];
}

module.exports = {
  manifest: MANIFEST,
  deliver,
  // Exposed for testing & for other skills that want to reuse the renderer
  composeDigest,
  renderHtml,
  renderText,
};
