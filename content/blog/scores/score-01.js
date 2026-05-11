// Run the May 10 huddle draft through provenance-scoring.
// Verbatim-only (no embedder) — anything that scores is an exact substring
// match against the huddle canon.
const path = require('path');
const { score } = require('/home/user/workspace/principalnarrative/skills/provenance-scoring/index.js');

// Canon units harvested from the May 10 huddle notes (verbatim phrases).
const canon = [
  {
    id: 'h510-01', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'trails that you can trust', timestamp_in_recording: '59:37' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h510-02', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'human-verified content', timestamp_in_recording: '40:05' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h510-03', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'ensuring that AI-generated materials are reviewed and validated by humans', timestamp_in_recording: '40:05' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h510-04', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'incremental information discovery', timestamp_in_recording: '42:23' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h510-05', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'progressively understand project details', timestamp_in_recording: '42:23' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h510-06', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'a TikTok-era approach to documentation: short, focused, and quickly digestible content', timestamp_in_recording: '37:46' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h510-07', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'targeted TLDR summaries that highlight the most critical aspects of a project or code trail', timestamp_in_recording: '51:21' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h510-08', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'solving organizational alignment, not just traditional code review', timestamp_in_recording: '20:27' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h510-09', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'help teams quickly understand project intent and maintain momentum in collaborative environments', timestamp_in_recording: '22:06' },
    intent: { promotable_to_blog: true },
  },
  // From May 8 PM — same product, complementary language
  {
    id: 'h508-01', author: 'Michael',
    source: { platform: 'slack_huddle', verbatim_text: 'indoor plumbing - something people didn\'t know they needed until experiencing its convenience', timestamp_in_recording: '1:03:42' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h508-02', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'most developers believe they understand their code, but actually lack a comprehensive view', timestamp_in_recording: '32:02' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h508-03', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'burning social capital', timestamp_in_recording: '43:04' },
    intent: { promotable_to_blog: true },
  },
  // From May 7
  {
    id: 'h507-01', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'a collaboration primitive', timestamp_in_recording: '30:13' },
    intent: { promotable_to_blog: true },
  },
  {
    id: 'h507-02', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'explaining code clearly and quickly, allowing for easy sharing and rapid understanding', timestamp_in_recording: '28:34' },
    intent: { promotable_to_blog: true },
  },
];

const draft = require('fs').readFileSync('/home/user/workspace/blog-draft.md', 'utf8');

score({ draft, canon, config: { canon_filter: { source_platform: 'slack_huddle', intent_promotable_to_blog: true } } })
  .then((res) => {
    console.log('SCORE:', res.score, ' threshold:', res.threshold, ' passes:', res.passes);
    console.log('totalChars:', res.totalChars, ' matchedChars:', res.matchedChars, ' weightedChars:', res.weightedChars);
    console.log('\nLayer breakdown:');
    for (const [layer, info] of Object.entries(res.layerBreakdown)) {
      console.log(`  ${layer.padEnd(22)} chars=${String(info.chars).padStart(4)}  count=${info.count}`);
    }
    console.log('\nMatched spans (verbatim, since no embedder):');
    for (const s of res.spans) {
      const txt = draft.slice(s.start, s.end);
      console.log(`  [${s.layer}] (${s.sourceAuthor} @ ${s.sourceTimestamp})  "${txt.slice(0, 80)}${txt.length > 80 ? '…' : ''}"`);
    }
    console.log('\nWord count:', draft.trim().split(/\s+/).length);
  })
  .catch((e) => { console.error(e); process.exit(1); });
