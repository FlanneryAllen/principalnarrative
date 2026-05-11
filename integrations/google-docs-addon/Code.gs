/**
 * Code.gs — Google Docs add-on entrypoint for the Narrative Agent harness.
 *
 * Lifecycle:
 *   onInstall / onHomepage  → show CTA card or start session
 *   openSidebar             → injects Sidebar.html via HtmlService
 *   scoreCurrentDocument    → reads body, sends to API, returns score payload
 *   applyHighlights         → paints spans by layer
 *   attemptPublish          → calls the harness gate; UI handles override flow
 */

const ADDON_TITLE = 'Narrative Agent';
const PROP_KEYS = {
  WORKSPACE_URL: 'narrative.workspace_url',
  API_TOKEN: 'narrative.api_token',
  WORKSPACE_ID: 'narrative.workspace_id',
  SESSION_ID: 'narrative.session_id',
  AUTHORED_BY: 'narrative.authored_by',
};

function onInstall(e) {
  onHomepage(e);
}

function onHomepage(e) {
  if (!getSetting_(PROP_KEYS.API_TOKEN)) {
    return buildOnboardingCard_();
  }
  return buildHomepageCard_();
}

function onFileScopeGranted(e) {
  return buildHomepageCard_();
}

/**
 * Open the harness sidebar in the current document.
 */
function openSidebar() {
  ensureSession_();
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle(ADDON_TITLE)
    .setWidth(360);
  DocumentApp.getUi().showSidebar(html);
}

/**
 * Read the current document's plain text and request a score.
 * Returns the full scoring payload to the sidebar.
 */
function scoreCurrentDocument() {
  const sessionId = ensureSession_();
  const doc = DocumentApp.getActiveDocument();
  const draft = doc.getBody().getText();
  if (!draft || draft.trim().length === 0) {
    return { score: 0, spans: [], message: 'Document is empty' };
  }
  return HarnessClient.scoreDraft(sessionId, draft);
}

/**
 * Apply background colors to scored spans. Called from the sidebar after
 * scoreCurrentDocument resolves.
 */
function applyHighlights(spans) {
  Highlighter.clear();
  Highlighter.paint(spans || []);
  return { painted: (spans || []).length };
}

/**
 * Attempt to publish — calls /publish/attempt. Returns either
 *   { ok: true, publishId } or { ok: false, requires_override: true, prompt }.
 */
function attemptPublish(title) {
  const sessionId = ensureSession_();
  const draft = DocumentApp.getActiveDocument().getBody().getText();
  return HarnessClient.attemptPublish(sessionId, draft, title);
}

/**
 * Publish with an override reason. Returns { ok: true, publishId, override }.
 */
function overridePublish(title, reason) {
  const sessionId = ensureSession_();
  const draft = DocumentApp.getActiveDocument().getBody().getText();
  return HarnessClient.overridePublish(sessionId, draft, title, reason);
}

/**
 * Save the user's settings (workspace URL + API token). Called from the
 * onboarding card.
 */
function saveSettings(workspaceUrl, apiToken, workspaceId, authoredBy) {
  setSetting_(PROP_KEYS.WORKSPACE_URL, workspaceUrl);
  setSetting_(PROP_KEYS.API_TOKEN, apiToken);
  setSetting_(PROP_KEYS.WORKSPACE_ID, workspaceId);
  setSetting_(PROP_KEYS.AUTHORED_BY, authoredBy || Session.getActiveUser().getEmail());
  // Force fresh session on next open
  setSetting_(PROP_KEYS.SESSION_ID, '');
  return { ok: true };
}

// ───────────────────────── helpers ─────────────────────────

function ensureSession_() {
  const existing = getSetting_(PROP_KEYS.SESSION_ID);
  if (existing) return existing;

  const doc = DocumentApp.getActiveDocument();
  const result = HarnessClient.startSession({
    workspaceId: getSetting_(PROP_KEYS.WORKSPACE_ID),
    docId: 'gdocs:' + doc.getId(),
    authoredBy: getSetting_(PROP_KEYS.AUTHORED_BY)
      || Session.getActiveUser().getEmail(),
  });
  setSetting_(PROP_KEYS.SESSION_ID, result.sessionId);
  return result.sessionId;
}

function getSetting_(key) {
  return PropertiesService.getUserProperties().getProperty(key) || '';
}

function setSetting_(key, value) {
  PropertiesService.getUserProperties().setProperty(key, value || '');
}

function buildOnboardingCard_() {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(ADDON_TITLE).setSubtitle('Connect your workspace'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(
        'Connect this add-on to your Narrative Agent workspace to start scoring drafts against your huddle canon.'))
      .addWidget(CardService.newTextButton()
        .setText('Open setup')
        .setOnClickAction(CardService.newAction().setFunctionName('showSetupDialog'))))
    .build();
}

function showSetupDialog() {
  const html = HtmlService.createHtmlOutputFromFile('Setup')
    .setWidth(420).setHeight(320);
  DocumentApp.getUi().showModalDialog(html, ADDON_TITLE + ' — Setup');
}

function buildHomepageCard_() {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(ADDON_TITLE))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(
        'Open the harness to score your draft against your team\'s huddle canon.'))
      .addWidget(CardService.newTextButton()
        .setText('Open harness')
        .setOnClickAction(CardService.newAction().setFunctionName('openSidebar'))))
    .build();
}
