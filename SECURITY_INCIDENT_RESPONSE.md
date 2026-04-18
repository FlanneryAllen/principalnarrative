# 🚨 SECURITY INCIDENT RESPONSE PLAN

**Date**: 2026-04-18
**Severity**: CRITICAL
**Status**: IMMEDIATE ACTION REQUIRED

## Executive Summary

A comprehensive security audit has revealed **9 critical/high severity vulnerabilities** in the Narrative Agent application. The most severe issue is storing API keys in browser localStorage, which combined with XSS vulnerabilities creates a perfect storm for complete account compromise.

## Attack Scenario (Worst Case)

1. Attacker exploits any of 30+ XSS vulnerabilities
2. JavaScript payload steals API keys from localStorage
3. Attacker uses stolen keys to make unlimited LLM API calls ($10,000+ damage)
4. CSRF attack forces victim to harvest attacker-controlled URLs
5. Malicious content delivers more XSS payloads
6. Full compromise of victim's narrative data and GitHub repos

## Immediate Actions Required (Within 24 Hours)

### Phase 1: Stop the Bleeding (2 hours)

```javascript
// TEMPORARY FIX - Deploy immediately to app.html
// Line 2870 - Disable localStorage API key storage
function saveLLMConfig() {
  alert('LLM configuration temporarily disabled for security update. Please check back in 24 hours.');
  return false;
}
```

### Phase 2: Critical Patches (4 hours)

1. **Remove API Key Storage from Client**
   - Move to server-side encrypted storage
   - Use session-only storage as temporary measure
   - Clear all existing localStorage data

2. **Fix XSS Vulnerabilities**
   - Replace ALL innerHTML with textContent or createElement
   - Add input sanitization using DOMPurify
   - Escape all user data in templates

3. **Add CSRF Protection**
   - Generate CSRF tokens on session creation
   - Validate on all POST/PUT/DELETE requests
   - Add X-CSRF-Token header to all fetch calls

## Deployment Checklist

- [ ] Deploy Phase 1 temporary fix immediately
- [ ] Alert all users about security update
- [ ] Clear all localStorage data from production
- [ ] Deploy Phase 2 patches
- [ ] Run security scanner on patched version
- [ ] Monitor for exploitation attempts

## Code Changes Required

### 1. Server-Side Key Storage (web-app.js)
```javascript
// Add new endpoint for secure key storage
if (pathname === '/api/user/llm-config' && req.method === 'POST') {
  if (!session) {
    json(res, 401, { error: 'Not authenticated' });
    return;
  }

  const { provider, apiKey } = body;

  // Encrypt with user-specific key
  const encrypted = encryptApiKey(apiKey, session.sessionId);
  session.llmConfig = { provider, encryptedApiKey: encrypted };

  json(res, 200, { saved: true });
  return;
}
```

### 2. XSS Fix Example (app.html)
```javascript
// BEFORE (vulnerable):
div.innerHTML = `<span>${userData}</span>`;

// AFTER (safe):
const span = document.createElement('span');
span.textContent = userData;
div.appendChild(span);
```

### 3. CSRF Token Implementation
```javascript
// Generate on session creation
const csrfToken = crypto.randomBytes(32).toString('hex');
session.csrfToken = csrfToken;

// Validate on requests
if (!validateCSRF(req, session)) {
  json(res, 403, { error: 'Invalid CSRF token' });
  return;
}
```

## Testing Plan

1. **Security Testing**
   - Run OWASP ZAP scanner
   - Test XSS payloads manually
   - Verify CSRF protection
   - Check for API key leakage

2. **Regression Testing**
   - Verify harvest functionality still works
   - Test LLM integration (with new storage)
   - Check all tabs and features

## Communication Plan

### User Notification (Send Immediately)
```
Subject: Important Security Update - Action Required

We've identified and are fixing security vulnerabilities in the Narrative Agent.

Immediate Actions:
1. We've temporarily disabled LLM configuration
2. Please rotate any API keys you've used with the app
3. Service will be fully restored within 24 hours

We take security seriously and apologize for any inconvenience.
```

## Post-Incident Actions

1. **Security Audit**
   - Full penetration test by third party
   - Code review of all endpoints
   - Security training for team

2. **Process Improvements**
   - Implement security checks in CI/CD
   - Add automated security scanning
   - Create security checklist for features

3. **Documentation**
   - Update security guidelines
   - Create threat model
   - Document security architecture

## Metrics to Track

- Time to patch: Target < 24 hours
- User impact: Monitor for exploitation
- API costs: Check for abuse patterns
- Error rates: Monitor after deployment

## Lessons Learned

1. **Never store sensitive data in localStorage**
2. **Always escape user input**
3. **CSRF protection is mandatory**
4. **Security review before shipping**
5. **Rate limiting on expensive operations**

## Contact for Questions

- Security Lead: [Your Name]
- Status Updates: Check #security channel
- Report Issues: security@narrativeagent.ai

---

**This document should be treated as CONFIDENTIAL**