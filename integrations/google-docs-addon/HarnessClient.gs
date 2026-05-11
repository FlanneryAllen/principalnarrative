/**
 * HarnessClient.gs — Thin client for the Narrative Agent harness HTTP API.
 *
 * Apps Script restrictions:
 *   - UrlFetchApp.fetch is the only outbound HTTP path
 *   - No native promises; everything synchronous
 *   - Properties service for token storage
 *
 * Methods exposed:
 *   startSession({workspaceId, docId, authoredBy}) → {sessionId, ...}
 *   scoreDraft(sessionId, draft)                   → {score, spans, ...}
 *   suggestQuotes(sessionId, paragraph)            → {suggestions}
 *   attemptPublish(sessionId, draft, title)        → {ok, ...}
 *   overridePublish(sessionId, draft, title, reason) → {ok, publishId, ...}
 */

var HarnessClient = (function () {
  function baseUrl_() {
    var url = PropertiesService.getUserProperties().getProperty('narrative.workspace_url');
    if (!url) throw new Error('Narrative Agent: workspace URL not configured');
    return url.replace(/\/+$/, '');
  }

  function token_() {
    var t = PropertiesService.getUserProperties().getProperty('narrative.api_token');
    if (!t) throw new Error('Narrative Agent: API token not configured');
    return t;
  }

  function call_(path, payload, method) {
    var resp = UrlFetchApp.fetch(baseUrl_() + path, {
      method: method || 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token_() },
      payload: payload ? JSON.stringify(payload) : undefined,
      muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    var body = resp.getContentText();
    if (code >= 200 && code < 300) {
      return JSON.parse(body);
    }
    throw new Error('Narrative Agent API ' + code + ': ' + body);
  }

  return {
    startSession: function (args) { return call_('/api/harness/session', args); },
    scoreDraft: function (sessionId, draft) {
      return call_('/api/harness/score', { sessionId: sessionId, draft: draft });
    },
    suggestQuotes: function (sessionId, paragraph) {
      return call_('/api/harness/suggest', { sessionId: sessionId, paragraph: paragraph });
    },
    attemptPublish: function (sessionId, draft, title) {
      return call_('/api/harness/publish/attempt', {
        sessionId: sessionId, draft: draft, title: title,
      });
    },
    overridePublish: function (sessionId, draft, title, reason) {
      return call_('/api/harness/publish/override', {
        sessionId: sessionId, draft: draft, title: title, reason: reason,
      });
    },
  };
})();
