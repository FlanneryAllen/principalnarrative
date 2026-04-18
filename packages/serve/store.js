/**
 * store.js — Storage Abstraction Layer for Narrative Agent
 *
 * Provides NarrativeStore base class with two implementations:
 *   - GitHubAdapter: wraps GitHub API calls (existing logic from web-app.js)
 *   - MemoryAdapter: in-memory store for testing, StoryMining, and non-git workflows
 *
 * Both return the same shape: { units: [], skills: {}, files: [], errors: [] }
 *
 * Zero external dependencies — Node.js stdlib + yaml only.
 */

'use strict';

const https = require('https');
const crypto = require('crypto');
const YAML = require('yaml');

// ============================================================================
// YAML Serializers (moved from web-app.js)
// ============================================================================

/**
 * Convert units array back to YAML for a canon file.
 */
function unitsToYaml(units, metadata = {}) {
  const doc = {
    version: metadata.version || '1.0',
    last_updated: new Date().toISOString().slice(0, 10),
    ...(metadata.owner ? { owner: metadata.owner } : {}),
    units: units.map(u => {
      const unit = { id: u.id, type: u.type, assertion: u.assertion };
      if (u.author) unit.author = u.author;
      if (u.authoredAt) unit.authored_at = u.authoredAt;
      if (u.scope) unit.scope = u.scope;
      if (u.tensionIntent) unit.tension_intent = u.tensionIntent;
      if (u.contestedBy && u.contestedBy.length > 0) unit.contested_by = u.contestedBy;
      if (u.intent && Object.keys(u.intent).length > 0) unit.intent = u.intent;
      if (u.evidence_required && u.evidence_required.length > 0) unit.evidence_required = u.evidence_required;
      unit.dependencies = u.dependencies || [];
      unit.confidence = u.confidence ?? 1.0;
      return unit;
    }),
  };
  return YAML.stringify(doc, { lineWidth: 120 });
}

/**
 * Convert skills data back to YAML for terminology files.
 */
function skillsToTerminologyYaml(skills) {
  const doc = {
    version: '1.0',
    last_updated: new Date().toISOString().slice(0, 10),
  };
  if (skills.brand) doc.brand = skills.brand;
  if (skills.products) doc.products = skills.products;
  if (skills.concepts) doc.concepts = skills.concepts;
  if (skills.terminology) {
    doc.terminology = {};
    if (skills.terminology.preferred) doc.terminology.preferred = skills.terminology.preferred;
    if (skills.terminology.forbidden) doc.terminology.forbidden = skills.terminology.forbidden;
  }
  return YAML.stringify(doc, { lineWidth: 120 });
}

function skillsToToneYaml(skills) {
  const doc = {
    version: '1.0',
    last_updated: new Date().toISOString().slice(0, 10),
    ...(skills.owner ? { owner: skills.owner } : {}),
  };
  if (skills.voice) doc.voice = skills.voice;
  if (skills.terminology) {
    doc.terminology = {};
    if (skills.terminology.preferred) doc.terminology.preferred = skills.terminology.preferred;
    if (skills.terminology.forbidden) doc.terminology.forbidden = skills.terminology.forbidden;
  }
  return YAML.stringify(doc, { lineWidth: 120 });
}

// ============================================================================
// GitHub HTTP Helpers (moved from web-app.js)
// ============================================================================

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function githubGet(apiPath, token) {
  return httpsRequest({
    hostname: 'api.github.com',
    path: apiPath,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'NarrativeAgent/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
}

function githubPost(hostname, apiPath, data, headers = {}) {
  const { URLSearchParams } = require('url');
  const postData = typeof data === 'string' ? data : new URLSearchParams(data).toString();
  return httpsRequest({
    hostname,
    path: apiPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'application/json',
      'User-Agent': 'NarrativeAgent/1.0',
      ...headers,
    },
  }, postData);
}

/**
 * Write a file to a GitHub repo via the Contents API (create or update).
 * Handles getting the current SHA for updates automatically.
 */
async function githubPutFile(owner, repo, filePath, content, message, token) {
  const existing = await githubGet(`/repos/${owner}/${repo}/contents/${filePath}`, token);
  const sha = existing.status === 200 ? existing.body.sha : undefined;

  const body = JSON.stringify({
    message,
    content: Buffer.from(content).toString('base64'),
    ...(sha ? { sha } : {}),
  });

  return httpsRequest({
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/contents/${filePath}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'NarrativeAgent/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  }, body);
}

/**
 * Fetch .narrative/ canon and skills from a GitHub repo via the Contents API.
 * Returns { units, skills, files, errors }.
 */
async function fetchRepoCanon(owner, repo, token) {
  const result = { units: [], skills: {}, files: [], errors: [] };

  async function listDir(dirPath) {
    const res = await githubGet(`/repos/${owner}/${repo}/contents/${dirPath}`, token);
    if (res.status === 404) return [];
    if (res.status !== 200) {
      result.errors.push({ file: dirPath, error: `GitHub API ${res.status}` });
      return [];
    }
    return Array.isArray(res.body) ? res.body : [];
  }

  async function getFileContent(filePath) {
    const res = await githubGet(`/repos/${owner}/${repo}/contents/${filePath}`, token);
    if (res.status !== 200) {
      result.errors.push({ file: filePath, error: `GitHub API ${res.status}` });
      return null;
    }
    if (res.body.encoding === 'base64' && res.body.content) {
      return Buffer.from(res.body.content, 'base64').toString('utf-8');
    }
    result.errors.push({ file: filePath, error: 'Unexpected encoding' });
    return null;
  }

  const canonFiles = await listDir('.narrative/canon');
  for (const file of canonFiles) {
    if (!file.name.match(/\.ya?ml$/)) continue;
    const content = await getFileContent(file.path);
    if (!content) continue;
    result.files.push(file.path);
    try {
      const parsed = YAML.parse(content);
      if (parsed?.units) {
        for (const unit of parsed.units) {
          result.units.push({
            id: unit.id,
            type: unit.type,
            assertion: (unit.assertion || '').trim(),
            author: unit.author || null,
            authoredAt: unit.authored_at || null,
            scope: unit.scope || null,
            tensionIntent: unit.tension_intent || null,
            contestedBy: unit.contested_by || [],
            intent: unit.intent || {},
            dependencies: unit.dependencies || [],
            confidence: unit.confidence ?? 1.0,
            evidence_required: unit.evidence_required || [],
            source_file: file.name,
          });
        }
      }
    } catch (err) {
      result.errors.push({ file: file.path, error: err.message });
    }
  }

  const skillFiles = await listDir('.narrative/skills');
  for (const file of skillFiles) {
    if (!file.name.match(/\.ya?ml$/)) continue;
    const content = await getFileContent(file.path);
    if (!content) continue;
    result.files.push(file.path);
    try {
      const parsed = YAML.parse(content);
      if (parsed?.voice) result.skills.voice = parsed.voice;
      if (parsed?.terminology) result.skills.terminology = parsed.terminology;
      if (parsed?.brand) result.skills.brand = parsed.brand;
      if (parsed?.products) result.skills.products = parsed.products;
    } catch (err) {
      result.errors.push({ file: file.path, error: err.message });
    }
  }

  return result;
}

// ============================================================================
// NarrativeStore — Base Class
// ============================================================================

class NarrativeStore {
  /**
   * Load the canon (units + skills) from this store.
   * @returns {Promise<{units: Array, skills: Object, files: Array, errors: Array}>}
   */
  async load() {
    throw new Error('NarrativeStore.load() must be implemented by subclass');
  }

  /**
   * Save units to a specific canon file.
   * @param {Array} units - The units to save
   * @param {string} filename - Target filename (e.g. 'core-story.yml')
   * @param {Object} metadata - Optional metadata (owner, version, commitMessage)
   * @returns {Promise<{saved: boolean, file: string, sha?: string}>}
   */
  async saveUnits(units, filename, metadata = {}) {
    throw new Error('NarrativeStore.saveUnits() must be implemented by subclass');
  }

  /**
   * Save skills (terminology or tone).
   * @param {string} type - 'terminology' or 'tone'
   * @param {Object} data - Skills data to save
   * @returns {Promise<{saved: boolean, file: string}>}
   */
  async saveSkills(type, data) {
    throw new Error('NarrativeStore.saveSkills() must be implemented by subclass');
  }

  /**
   * Run full wizard setup (create initial canon + skills files).
   * @param {Object} wizardData - { coreStory, positioning, brand, products, forbidden, voicePrinciples, owner }
   * @returns {Promise<{files: Array, errors: Array}>}
   */
  async setup(wizardData) {
    throw new Error('NarrativeStore.setup() must be implemented by subclass');
  }

  /**
   * Get store info.
   * @returns {{type: string, name: string}}
   */
  getInfo() {
    throw new Error('NarrativeStore.getInfo() must be implemented by subclass');
  }
}

// ============================================================================
// GitHubAdapter — wraps existing GitHub API calls
// ============================================================================

class GitHubAdapter extends NarrativeStore {
  constructor(owner, repo, token) {
    super();
    this.owner = owner;
    this.repo = repo;
    this.token = token;
  }

  async load() {
    return fetchRepoCanon(this.owner, this.repo, this.token);
  }

  async saveUnits(units, filename, metadata = {}) {
    const file = filename || 'canon.yml';
    const filePath = `.narrative/canon/${file}`;
    const yamlContent = unitsToYaml(units, metadata);
    const message = metadata.commitMessage || `Update ${file} via Narrative Agent`;

    const putRes = await githubPutFile(this.owner, this.repo, filePath, yamlContent, message, this.token);
    if (putRes.status !== 200 && putRes.status !== 201) {
      throw new Error(`GitHub API error: ${putRes.status}`);
    }

    return {
      saved: true,
      file: filePath,
      sha: putRes.body?.content?.sha,
    };
  }

  async saveSkills(type, data) {
    let filePath, yamlContent;
    if (type === 'terminology') {
      filePath = '.narrative/skills/terminology.yml';
      yamlContent = skillsToTerminologyYaml(data);
    } else if (type === 'tone') {
      filePath = '.narrative/skills/tone-of-voice.yml';
      yamlContent = skillsToToneYaml(data);
    } else {
      throw new Error(`Unknown skills type: ${type}`);
    }

    const message = `Update ${type} skills via Narrative Agent`;
    const putRes = await githubPutFile(this.owner, this.repo, filePath, yamlContent, message, this.token);
    if (putRes.status !== 200 && putRes.status !== 201) {
      throw new Error(`GitHub API error: ${putRes.status}`);
    }

    return { saved: true, file: filePath };
  }

  async setup(wizardData) {
    const { coreStory, positioning, brand, products, forbidden, voicePrinciples, owner: canonOwner } = wizardData;
    const results = { files: [], errors: [] };

    // 1. Save core-story.yml
    const coreYaml = unitsToYaml(coreStory, { owner: canonOwner });
    try {
      const r = await githubPutFile(this.owner, this.repo, '.narrative/canon/core-story.yml', coreYaml, 'Initialize core story via Narrative Agent', this.token);
      if (r.status === 200 || r.status === 201) results.files.push('core-story.yml');
      else results.errors.push({ file: 'core-story.yml', error: `Status ${r.status}` });
    } catch (err) { results.errors.push({ file: 'core-story.yml', error: err.message }); }

    // 2. Save positioning.yml (if provided)
    if (positioning && positioning.length > 0) {
      const posYaml = unitsToYaml(positioning, { owner: canonOwner });
      try {
        const r = await githubPutFile(this.owner, this.repo, '.narrative/canon/positioning.yml', posYaml, 'Initialize positioning via Narrative Agent', this.token);
        if (r.status === 200 || r.status === 201) results.files.push('positioning.yml');
        else results.errors.push({ file: 'positioning.yml', error: `Status ${r.status}` });
      } catch (err) { results.errors.push({ file: 'positioning.yml', error: err.message }); }
    }

    // 3. Save terminology.yml
    const termsData = {
      brand: brand || { company_name: '', never: [] },
      products: products || [],
      terminology: { forbidden: forbidden || [] },
    };
    const termsYaml = skillsToTerminologyYaml(termsData);
    try {
      const r = await githubPutFile(this.owner, this.repo, '.narrative/skills/terminology.yml', termsYaml, 'Initialize terminology via Narrative Agent', this.token);
      if (r.status === 200 || r.status === 201) results.files.push('terminology.yml');
      else results.errors.push({ file: 'terminology.yml', error: `Status ${r.status}` });
    } catch (err) { results.errors.push({ file: 'terminology.yml', error: err.message }); }

    // 4. Save tone-of-voice.yml
    const toneData = {
      owner: canonOwner,
      voice: {
        name: brand?.company_name ? `${brand.company_name} Voice` : 'Brand Voice',
        summary: 'Confident without being loud. Technical without being cold.',
        principles: voicePrinciples || [],
      },
      terminology: { forbidden: forbidden || [] },
    };
    const toneYaml = skillsToToneYaml(toneData);
    try {
      const r = await githubPutFile(this.owner, this.repo, '.narrative/skills/tone-of-voice.yml', toneYaml, 'Initialize tone of voice via Narrative Agent', this.token);
      if (r.status === 200 || r.status === 201) results.files.push('tone-of-voice.yml');
      else results.errors.push({ file: 'tone-of-voice.yml', error: `Status ${r.status}` });
    } catch (err) { results.errors.push({ file: 'tone-of-voice.yml', error: err.message }); }

    return results;
  }

  getInfo() {
    return { type: 'git', name: `${this.owner}/${this.repo}` };
  }
}

// ============================================================================
// MemoryAdapter — in-memory store with full CRUD
// ============================================================================

class MemoryAdapter extends NarrativeStore {
  constructor(name = 'memory-workspace') {
    super();
    this.name = name;
    this.id = crypto.randomBytes(8).toString('hex');
    this._units = [];
    this._skills = {};
    this._files = [];
    this._created = new Date().toISOString();
  }

  async load() {
    return {
      units: [...this._units],
      skills: JSON.parse(JSON.stringify(this._skills)),
      files: [...this._files],
      errors: [],
    };
  }

  async saveUnits(units, filename, metadata = {}) {
    const file = filename || 'canon.yml';

    // Remove existing units from the same file, then add the new ones
    this._units = this._units.filter(u => u.source_file !== file);
    for (const u of units) {
      this._units.push({
        id: u.id,
        type: u.type,
        assertion: (u.assertion || '').trim(),
        author: u.author || null,
        authoredAt: u.authoredAt || null,
        scope: u.scope || null,
        tensionIntent: u.tensionIntent || null,
        contestedBy: u.contestedBy || [],
        intent: u.intent || {},
        dependencies: u.dependencies || [],
        confidence: u.confidence ?? 1.0,
        evidence_required: u.evidence_required || [],
        source_file: file,
      });
    }

    if (!this._files.includes(file)) this._files.push(file);

    return { saved: true, file };
  }

  async saveSkills(type, data) {
    let file;
    if (type === 'terminology') {
      file = 'terminology.yml';
      if (data.brand) this._skills.brand = data.brand;
      if (data.products) this._skills.products = data.products;
      if (data.terminology) this._skills.terminology = { ...this._skills.terminology, ...data.terminology };
    } else if (type === 'tone') {
      file = 'tone-of-voice.yml';
      if (data.voice) this._skills.voice = data.voice;
      if (data.terminology) this._skills.terminology = { ...this._skills.terminology, ...data.terminology };
    } else {
      throw new Error(`Unknown skills type: ${type}`);
    }

    if (!this._files.includes(file)) this._files.push(file);
    return { saved: true, file };
  }

  async setup(wizardData) {
    const { coreStory, positioning, brand, products, forbidden, voicePrinciples, owner: canonOwner } = wizardData;
    const results = { files: [], errors: [] };

    // 1. Core story units
    if (coreStory && coreStory.length > 0) {
      await this.saveUnits(coreStory, 'core-story.yml', { owner: canonOwner });
      results.files.push('core-story.yml');
    }

    // 2. Positioning units
    if (positioning && positioning.length > 0) {
      await this.saveUnits(positioning, 'positioning.yml', { owner: canonOwner });
      results.files.push('positioning.yml');
    }

    // 3. Terminology skills
    await this.saveSkills('terminology', {
      brand: brand || { company_name: '', never: [] },
      products: products || [],
      terminology: { forbidden: forbidden || [] },
    });
    results.files.push('terminology.yml');

    // 4. Tone skills
    await this.saveSkills('tone', {
      owner: canonOwner,
      voice: {
        name: brand?.company_name ? `${brand.company_name} Voice` : 'Brand Voice',
        summary: 'Confident without being loud. Technical without being cold.',
        principles: voicePrinciples || [],
      },
      terminology: { forbidden: forbidden || [] },
    });
    results.files.push('tone-of-voice.yml');

    return results;
  }

  getInfo() {
    return { type: 'memory', name: this.name };
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Classes
  NarrativeStore,
  GitHubAdapter,
  MemoryAdapter,
  // YAML serializers
  unitsToYaml,
  skillsToTerminologyYaml,
  skillsToToneYaml,
  // GitHub HTTP helpers (needed by web-app.js for non-store operations)
  httpsRequest,
  githubGet,
  githubPost,
  githubPutFile,
  fetchRepoCanon,
};
