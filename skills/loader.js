/**
 * Skill loader — resolves a skill name to its manifest + handler module.
 *
 * Skills live in skills/<name>/ with SKILL.md (manifest) and index.js (handlers).
 * Dependencies are declared in package.json and validated using semver.
 * The loader is intentionally minimal: it does not sandbox skills, it just
 * resolves and caches them. Sandboxing is a future concern when we support
 * untrusted third-party skills.
 */

'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Simple semver range matcher.
 * Supports ^, ~, exact versions, and >= operators.
 */
function satisfiesVersion(installed, required) {
  if (required === '*') return true;
  if (required === installed) return true;

  const parseVersion = (v) => v.split('.').map(Number);
  const installedParts = parseVersion(installed);

  // Handle ^ (caret) - allows changes that don't modify left-most non-zero digit
  if (required.startsWith('^')) {
    const requiredParts = parseVersion(required.slice(1));
    if (installedParts[0] !== requiredParts[0]) return false;
    if (installedParts[0] > 0) return installedParts >= requiredParts;
    if (installedParts[1] !== requiredParts[1]) return false;
    return installedParts[2] >= requiredParts[2];
  }

  // Handle ~ (tilde) - allows patch-level changes
  if (required.startsWith('~')) {
    const requiredParts = parseVersion(required.slice(1));
    return installedParts[0] === requiredParts[0] &&
           installedParts[1] === requiredParts[1] &&
           installedParts[2] >= requiredParts[2];
  }

  // Handle >= operator
  if (required.startsWith('>=')) {
    const requiredParts = parseVersion(required.slice(2).trim());
    return installedParts >= requiredParts;
  }

  return false;
}

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
 * Create a clear 4-part error message for missing or mismatched dependencies.
 * Following Fernando's requirement: which skill, which dep, what version, how to fix.
 */
function createDependencyError(skillName, depName, issue) {
  const parts = [
    `[1/4] Skill failed: ${skillName}`,
    `[2/4] Dependency issue: ${depName}`,
    `[3/4] ${issue}`,
    `[4/4] How to fix: Run 'npm install' in skills/${skillName}/ to resolve dependencies`
  ];
  return new Error(parts.join('\n       '));
}

/**
 * Validate and load dependencies for a skill based on its package.json.
 * Throws clear error if dependencies are missing or versions don't match.
 * Returns the loaded dependency skills.
 */
function resolveDependencies(skillName, dir, loadingStack = []) {
  const packagePath = path.join(dir, 'package.json');

  // If no package.json, no dependencies to resolve
  if (!fs.existsSync(packagePath)) {
    return {};
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  } catch (error) {
    throw createDependencyError(
      skillName,
      'package.json',
      `Failed to parse package.json: ${error.message}`
    );
  }

  const dependencies = pkg.dependencies || {};
  const loadedDeps = {};

  // Detect circular dependencies
  if (loadingStack.includes(skillName)) {
    const cycle = [...loadingStack, skillName].join(' -> ');
    throw new Error(`Circular dependency detected: ${cycle}`);
  }

  for (const [depPackageName, requiredVersion] of Object.entries(dependencies)) {
    // Convert @principal-skills/foo to just 'foo' for skill name lookup
    const depSkillName = depPackageName.startsWith('@principal-skills/')
      ? depPackageName.replace('@principal-skills/', '')
      : depPackageName;

    const depDir = path.join(SKILLS_DIR, depSkillName);
    const depPackagePath = path.join(depDir, 'package.json');
    const depManifestPath = path.join(depDir, 'SKILL.md');

    // Check if dependency skill exists
    if (!fs.existsSync(depManifestPath)) {
      throw createDependencyError(
        skillName,
        depSkillName,
        `Dependency not found (expected SKILL.md at ${depManifestPath})`
      );
    }

    // Check if dependency has package.json with version
    if (!fs.existsSync(depPackagePath)) {
      throw createDependencyError(
        skillName,
        depSkillName,
        `Dependency has no package.json (expected at ${depPackagePath})`
      );
    }

    let depPkg;
    try {
      depPkg = JSON.parse(fs.readFileSync(depPackagePath, 'utf-8'));
    } catch (error) {
      throw createDependencyError(
        skillName,
        depSkillName,
        `Failed to parse dependency package.json: ${error.message}`
      );
    }

    const installedVersion = depPkg.version;
    if (!installedVersion) {
      throw createDependencyError(
        skillName,
        depSkillName,
        `Dependency package.json has no version field`
      );
    }

    // Validate version constraint
    if (!satisfiesVersion(installedVersion, requiredVersion)) {
      throw createDependencyError(
        skillName,
        depSkillName,
        `Version mismatch: expected ${requiredVersion}, found ${installedVersion}`
      );
    }

    // Recursively load the dependency (fail-fast)
    loadedDeps[depSkillName] = loadSkill(depSkillName, [...loadingStack, skillName]);
  }

  return loadedDeps;
}

/**
 * Load a skill by name. Returns { manifest, ...handlers, dependencies }.
 * Validates and loads dependencies declared in package.json.
 * Fails fast if dependencies are missing or versions don't match.
 */
function loadSkill(name, loadingStack = []) {
  if (cache.has(name)) return cache.get(name);

  const dir = path.join(SKILLS_DIR, name);
  const manifestPath = path.join(dir, 'SKILL.md');
  const indexPath = path.join(dir, 'index.js');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Skill not found: ${name} (no SKILL.md at ${manifestPath})`);
  }

  const md = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = parseFrontmatter(md);

  // Validate and load dependencies BEFORE loading the skill handler (fail-fast)
  const dependencies = resolveDependencies(name, dir, loadingStack);

  let mod = { manifest, dependencies };
  if (fs.existsSync(indexPath)) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const handler = require(indexPath);
    mod = { ...handler, manifest: { ...manifest, ...(handler.manifest || {}) }, dependencies };
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
