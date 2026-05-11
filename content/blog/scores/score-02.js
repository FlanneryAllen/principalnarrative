const { score } = require('/home/user/workspace/principalnarrative/skills/provenance-scoring/index.js');

// Canon harvested from the May 7, 8 PM, 9, and 10 huddles — verbatim phrases.
const canon = [
  // May 8 PM (primary canon for this post)
  { id: 'h508-01', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'burning social capital', timestamp_in_recording: '43:04' },
    intent: { promotable_to_blog: true } },
  { id: 'h508-02', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'developers can easily get feedback without "burning social capital"', timestamp_in_recording: '43:04' },
    intent: { promotable_to_blog: true } },
  { id: 'h508-03', author: 'Michael',
    source: { platform: 'slack_huddle', verbatim_text: 'indoor plumbing - something people didn\'t know they needed until experiencing its convenience', timestamp_in_recording: '1:03:42' },
    intent: { promotable_to_blog: true } },
  { id: 'h508-04', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'most developers believe they understand their code, but actually lack a comprehensive view', timestamp_in_recording: '32:02' },
    intent: { promotable_to_blog: true } },
  { id: 'h508-05', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'create and share code trails with minimal friction', timestamp_in_recording: '1:04:00' },
    intent: { promotable_to_blog: true } },

  // May 7
  { id: 'h507-01', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'a collaboration primitive', timestamp_in_recording: '30:13' },
    intent: { promotable_to_blog: true } },
  { id: 'h507-02', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'asking for review currently burns significant time and resources', timestamp_in_recording: '31:09' },
    intent: { promotable_to_blog: true } },
  { id: 'h507-03', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'explaining code clearly and quickly, allowing for easy sharing and rapid understanding', timestamp_in_recording: '28:34' },
    intent: { promotable_to_blog: true } },
  { id: 'h507-04', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'the asymmetry in code feedback', timestamp_in_recording: '31:09' },
    intent: { promotable_to_blog: true } },

  // May 9
  { id: 'h509-01', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'A new way to collaborate with software', timestamp_in_recording: '46:52' },
    intent: { promotable_to_blog: true } },
  { id: 'h509-02', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'show, don\'t tell', timestamp_in_recording: '23:23' },
    intent: { promotable_to_blog: true } },
  { id: 'h509-03', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'Frame.io that allow immediate interaction and feedback', timestamp_in_recording: '23:23' },
    intent: { promotable_to_blog: true } },

  // May 4 thread (Fernando typed verbatim into Slack — counts as huddle adjacent)
  { id: 'h504-01', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'code trails are a new collaboration primitive to align teams on the intent of a product', timestamp_in_recording: 'thread' },
    intent: { promotable_to_blog: true } },
];

const draft = require('fs').readFileSync('/home/user/workspace/blog-draft-2.md', 'utf8');

score({ draft, canon, config: { canon_filter: { source_platform: 'slack_huddle', intent_promotable_to_blog: true } } })
  .then((res) => {
    console.log('SCORE:', res.score, ' threshold:', res.threshold, ' passes:', res.passes);
    console.log('totalChars:', res.totalChars, ' matchedChars:', res.matchedChars);
    console.log('\nLayer breakdown:');
    for (const [layer, info] of Object.entries(res.layerBreakdown)) {
      console.log(`  ${layer.padEnd(22)} chars=${String(info.chars).padStart(4)}  count=${info.count}`);
    }
    console.log('\nMatched spans:');
    for (const s of res.spans) {
      const txt = draft.slice(s.start, s.end);
      console.log(`  [${s.layer}] (${s.sourceAuthor} @ ${s.sourceTimestamp})  "${txt.slice(0, 90)}${txt.length > 90 ? '…' : ''}"`);
    }
    console.log('\nWord count:', draft.trim().split(/\s+/).length);
  })
  .catch((e) => { console.error(e); process.exit(1); });
