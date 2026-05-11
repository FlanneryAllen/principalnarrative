const { score } = require('/home/user/workspace/principalnarrative/skills/provenance-scoring/index.js');

const canon = [
  { id: 'h508-pm-01', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'most developers believe they understand their code, but actually lack a comprehensive view', timestamp_in_recording: '32:02' },
    intent: { promotable_to_blog: true } },
  { id: 'h508-pm-02', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'burning social capital', timestamp_in_recording: '43:04' },
    intent: { promotable_to_blog: true } },
  { id: 'h507-01', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'a collaboration primitive', timestamp_in_recording: '30:13' },
    intent: { promotable_to_blog: true } },
  { id: 'h507-02', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'asking for review currently burns significant time and resources', timestamp_in_recording: '31:09' },
    intent: { promotable_to_blog: true } },
  { id: 'h510-01', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'human-verified content', timestamp_in_recording: '40:05' },
    intent: { promotable_to_blog: true } },
  { id: 'h510-02', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'solving organizational alignment, not just traditional code review', timestamp_in_recording: '20:27' },
    intent: { promotable_to_blog: true } },
  { id: 'h510-03', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'help teams quickly understand project intent and maintain momentum in collaborative environments', timestamp_in_recording: '22:06' },
    intent: { promotable_to_blog: true } },
  { id: 'h509-01', author: 'Julie',
    source: { platform: 'slack_huddle', verbatim_text: 'A new way to collaborate with software', timestamp_in_recording: '46:52' },
    intent: { promotable_to_blog: true } },
  { id: 'h504-01', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'now that coding has been solved, code trails will solve alignment to make dependable software factories possible', timestamp_in_recording: 'thread' },
    intent: { promotable_to_blog: true } },
  { id: 'h504-02', author: 'Fernando',
    source: { platform: 'slack_huddle', verbatim_text: 'once you align on intent, the implementation is straightforward for the agent', timestamp_in_recording: 'thread' },
    intent: { promotable_to_blog: true } },
];

const draft = require('fs').readFileSync('/home/user/workspace/blog-draft-hn.md', 'utf8');

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
