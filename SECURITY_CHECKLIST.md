# 🔒 Security Checklist for Every Feature

**Use this checklist BEFORE committing any code**

## Pre-Development
- [ ] Threat model created for feature
- [ ] Security requirements documented
- [ ] Authentication/authorization plan reviewed
- [ ] Data sensitivity classified

## During Development

### Input Handling
- [ ] All user inputs validated
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (output encoding)
- [ ] Path traversal prevented
- [ ] Command injection prevented

### Authentication & Session
- [ ] Strong password requirements
- [ ] Session tokens cryptographically secure
- [ ] Session timeout implemented
- [ ] CSRF tokens on state changes
- [ ] Rate limiting on auth endpoints

### Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] TLS for data in transit
- [ ] No sensitive data in URLs
- [ ] No sensitive data in localStorage
- [ ] PII handling compliant

### API Security
- [ ] Authentication required
- [ ] Authorization checked
- [ ] Rate limiting implemented
- [ ] Input validation complete
- [ ] Error messages sanitized

### Client-Side Security
- [ ] No secrets in JavaScript
- [ ] CSP headers configured
- [ ] DOM manipulation safe (no innerHTML with user data)
- [ ] Third-party libraries verified
- [ ] SRI for CDN resources

## Pre-Commit

### Code Review
- [ ] No hardcoded secrets
- [ ] No debug code left
- [ ] No commented-out security code
- [ ] Dependencies up-to-date
- [ ] Security warnings addressed

### Testing
- [ ] Security tests written
- [ ] Edge cases tested
- [ ] Error handling tested
- [ ] Authentication tested
- [ ] Authorization tested

### Documentation
- [ ] Security considerations documented
- [ ] API authentication documented
- [ ] Error codes documented
- [ ] Rate limits documented
- [ ] Migration guide if breaking changes

## Pre-Deploy

### Security Scanning
- [ ] Static analysis passed (ESLint security)
- [ ] Dependency scan passed (npm audit)
- [ ] Secret scan passed
- [ ] OWASP scan passed
- [ ] Penetration test (if major feature)

### Configuration
- [ ] Environment variables set
- [ ] Security headers configured
- [ ] HTTPS enforced
- [ ] Logging configured
- [ ] Monitoring configured

### Incident Preparation
- [ ] Rollback plan ready
- [ ] Monitoring alerts set
- [ ] Error tracking configured
- [ ] Security team notified (if needed)
- [ ] User communication prepared (if needed)

## Post-Deploy

### Monitoring
- [ ] Error rates normal
- [ ] Performance acceptable
- [ ] Security alerts reviewed
- [ ] User feedback monitored
- [ ] Logs reviewed for anomalies

### Documentation
- [ ] Deployment documented
- [ ] Known issues tracked
- [ ] Security advisories updated
- [ ] Team knowledge shared
- [ ] Lessons learned captured

---

## Red Flags - STOP if you see these:

🚨 **Storing passwords in plaintext**
🚨 **API keys in client-side code**
🚨 **eval() or Function() with user input**
🚨 **innerHTML with user data**
🚨 **SQL concatenation with user input**
🚨 **Disabled security features for convenience**
🚨 **Outdated dependencies with known vulnerabilities**
🚨 **Missing authentication on endpoints**
🚨 **Same error for wrong username vs wrong password**
🚨 **Sensitive data in git history**

## Quick Security Fixes

```javascript
// ❌ INSECURE
element.innerHTML = userData;
localStorage.setItem('apiKey', key);
query = "SELECT * FROM users WHERE id=" + userId;

// ✅ SECURE
element.textContent = userData;
// Store encrypted on server, never client
query = "SELECT * FROM users WHERE id=?", [userId];
```

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [Mozilla Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Security Headers](https://securityheaders.com/)
- [SSL Labs](https://www.ssllabs.com/ssltest/)

## Emergency Contacts

- Security Team: security@company.com
- On-Call: [PagerDuty]
- CTO: [Contact]
- Legal: [Contact]

---

**Remember**: It's better to delay a feature than to ship a vulnerability.

**When in doubt**: Ask for security review.

**Golden Rule**: Never trust user input. Ever.