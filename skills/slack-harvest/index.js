/**
 * slack-harvest — Pulls candidate narrative units from Slack.
 *
 * Reference implementation. The Slack client is injected by the skill loader
 * so tests can pass a mock and prod can pass a real @slack/web-api client.
 */

'use strict';

const MANIFEST = {
  name: 'slack-harvest',
  version: '0.1.0',
  type: 'harvest',
};

/**
 * Infer the most likely unit type from channel config + message shape.
 */
function inferUnitType(message, channelConfig) {
  if (channelConfig.type) return channelConfig.type;
  if (message.pinned) return 'core_story';
  if (message.thread_ts && message.reply_count > 5) return 'narrative_arc';
  return 'tactical';
}

/**
 * Build a stable unit ID from Slack identifiers.
 */
function buildUnitId(channelId, ts) {
  // Slack ts looks like "1731234567.123456" — collapse to numeric portion
  const stamp = ts.replace('.', '');
  return `slack-${channelId}-${stamp}`;
}

/**
 * Resolve a Slack user ID → { name, title } using the users.info cache.
 */
async function resolveAuthor(slack, userId, userCache) {
  if (userCache.has(userId)) return userCache.get(userId);
  const info = await slack.users.info({ user: userId });
  const profile = info.user.profile || {};
  const author = {
    name: profile.real_name || info.user.name,
    title: profile.title || '',
  };
  userCache.set(userId, author);
  return author;
}

/**
 * Convert a Slack message into a candidate narrative unit.
 */
async function messageToUnit(slack, message, channel, channelConfig, userCache) {
  const author = await resolveAuthor(slack, message.user, userCache);
  const authorDisplay = author.title
    ? `${author.name}, ${author.title}`
    : author.name;

  const permalinkResp = await slack.chat.getPermalink({
    channel: channel.id,
    message_ts: message.ts,
  });

  return {
    id: buildUnitId(channel.id, message.ts),
    type: inferUnitType(message, channelConfig),
    assertion: message.text,
    scope: channelConfig.scope || null,
    author: authorDisplay,
    authoredAt: new Date(parseFloat(message.ts) * 1000).toISOString(),
    confidence: message.pinned ? 0.85 : 0.7,
    dependencies: [],
    contestedBy: [],
    tensionIntent: null,
    evidence_required: [],
    source: {
      platform: 'slack',
      channel: { id: channel.id, name: channel.name },
      permalink: permalinkResp.permalink,
      thread_ts: message.thread_ts || null,
      pinned: !!message.pinned,
    },
    intent: { harvested: true, needsReview: true },
  };
}

/**
 * Harvest from a single configured channel.
 */
async function harvestChannel(slack, channelConfig, opts) {
  const { id } = channelConfig;
  const oldest = opts.historyDays
    ? (Date.now() / 1000 - opts.historyDays * 86400).toFixed(6)
    : undefined;

  // 1. Channel info (name, topic, purpose)
  const info = await slack.conversations.info({ channel: id });
  const channel = info.channel;

  // 2. Pinned messages (highest signal)
  let pinned = [];
  if (opts.pinned) {
    const pinResp = await slack.pins.list({ channel: id });
    pinned = (pinResp.items || [])
      .filter((item) => item.type === 'message')
      .map((item) => ({ ...item.message, pinned: true }));
  }

  // 3. Recent history from whitelisted authors
  let history = [];
  if (channelConfig.authorWhitelist && channelConfig.authorWhitelist.length) {
    const histResp = await slack.conversations.history({
      channel: id,
      oldest,
      limit: 200,
    });
    history = (histResp.messages || []).filter(
      (m) => channelConfig.authorWhitelist.includes(m.user) && !m.bot_id,
    );
  }

  const userCache = new Map();
  const units = [];
  for (const msg of [...pinned, ...history]) {
    try {
      const unit = await messageToUnit(slack, msg, channel, channelConfig, userCache);
      units.push(unit);
    } catch (err) {
      // Skip unresolvable messages; log via opts.logger if provided
      opts.logger?.warn(`slack-harvest: skip message ${msg.ts}`, err.message);
    }
  }
  return units;
}

/**
 * Public hook — called by the skill loader.
 *
 * @param {object} ctx
 * @param {object} ctx.slack — Slack web API client (or mock in tests)
 * @param {object} ctx.config — workspace's slack-harvest config (see SKILL.md)
 * @param {object} [ctx.logger]
 * @returns {Promise<{units: object[], sources: object[]}>}
 */
async function harvest(ctx) {
  const { slack, config, logger } = ctx;
  if (!slack) throw new Error('slack-harvest: slack client not injected');
  if (!config || !config.channels) {
    return { units: [], sources: [] };
  }

  const opts = {
    pinned: config.pinned !== false,
    historyDays: config.historyDays || 90,
    logger,
  };

  const allUnits = [];
  const sources = [];
  for (const channelConfig of config.channels) {
    try {
      const units = await harvestChannel(slack, channelConfig, opts);
      allUnits.push(...units);
      sources.push({
        platform: 'slack',
        channel: channelConfig.id,
        unitCount: units.length,
        status: 'ok',
      });
    } catch (err) {
      logger?.error(`slack-harvest: channel ${channelConfig.id} failed`, err);
      sources.push({
        platform: 'slack',
        channel: channelConfig.id,
        unitCount: 0,
        status: 'error',
        error: err.message,
      });
    }
  }

  return { units: allUnits, sources };
}

module.exports = {
  manifest: MANIFEST,
  harvest,
  // Exposed for testing
  _internals: { inferUnitType, buildUnitId, messageToUnit },
};
