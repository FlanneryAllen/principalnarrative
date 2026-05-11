/**
 * Skill loader — resolves a skill name to its manifest + handler module.
 *
 * Skills live in skills/<name>/ with SKILL.md (manifest) and index.js (handlers).
 * The loader is intentionally minimal: it does not sandbox skills, it just
 * resolves and caches them. Sandboxing is a future concern when we support
 * untrusted third-party skills.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const SKILLS_DIR = __dirname;
const cache = new Map();

/**
 * Parse the YAML frontmatter from a SKILL.md file.
 * Tiny parser — only supports the subset we need (key: value, key: [a, b]).
 */
function parseFrontmatter(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out = {};
  let currentKey = null;
  let currentList = null;
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const topLevel = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (topLevel) {
      const [, key, val] = topLevel;
      currentKey = key;
      currentList = null;
      if (val === '') {
        out[key] = {};
      } else if (val.startsWith('[') && val.endsWith(']')) {
        out[key] = val.slice(1, -1).split(',').map((s) => s.trim());
      } else {
        out[key] = val;
      }
    } else {
      const listItem = line.match(/^\s*-\s*(.+)$/);
      if (listItem && currentKey) {
        if (!Array.isArray(out[currentKey])) out[currentKey] = [];
        out[currentKey].push(listItem[1].trim());
      }
    }
  }
  return out;
}

/**
 * Load a skill by name. Returns { manifest, ...handlers }.
 */
function loadSkill(name) {
  if (cache.has(name)) return cache.get(name);

  const dir = path.join(SKILLS_DIR, name);
  const manifestPath = path.join(dir, 'SKILL.md');
  const indexPath = path.join(dir, 'index.js');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Skill not found: ${name} (no SKILL.md at ${manifestPath})`);
  }

  const md = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = parseFrontmatter(md);

  let mod = { manifest };
  if (fs.existsSync(indexPath)) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const handler = require(indexPath);
    mod = { ...handler, manifest: { ...manifest, ...(handler.manifest || {}) } };
  }

  cache.set(name, mod);
  return mod;
}

/**
 * List all bundled skills by reading the skills/ directory.
 */
function listSkills() {
  return fs.readdirSync(SKILLS_DIR)
    .filter((entry) => {
      const skillPath = path.join(SKILLS_DIR, entry);
      return fs.statSync(skillPath).isDirectory()
        && fs.existsSync(path.join(skillPath, 'SKILL.md'));
    })
    .map((name) => {
      try {
        const { manifest } = loadSkill(name);
        return { name, ...manifest };
      } catch {
        return { name, error: 'failed_to_load' };
      }
    });
}

module.exports = { loadSkill, listSkills, parseFrontmatter };
