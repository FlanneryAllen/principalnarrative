/**
 * Landing Page Integration
 * Add these routes to web-app.js to handle the new landing page
 */

const fs = require('fs');
const path = require('path');
const { handlers } = require('./landing-handler');

/**
 * Add landing page routes to the existing web-app.js router
 * Insert these routes in the handleRequest function before the auth routes
 */
const landingRoutes = `
    // ============================================================
    // Landing Page Routes (no auth required)
    // ============================================================

    // Serve the new landing page for unauthenticated users
    if (pathname === '/' && req.method === 'GET' && !session) {
      const landingPath = path.join(__dirname, 'landing-page.html');
      if (fs.existsSync(landingPath)) {
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600'
        });
        res.end(fs.readFileSync(landingPath, 'utf-8'));
      } else {
        // Fallback to original app.html
        const dashboardPath = path.join(__dirname, 'app.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(dashboardPath, 'utf-8'));
      }
      return;
    }

    // API endpoint for URL analysis
    if (pathname === '/api/analyze-url' && req.method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch (err) {
        json(res, 413, { error: err.message });
        return;
      }

      const { url } = body || {};
      if (!url) {
        json(res, 400, { error: 'URL is required' });
        return;
      }

      try {
        const { analyzeURL } = require('./landing-handler');
        const analysis = await analyzeURL(url);

        // Create a guest session if needed
        if (!session) {
          const sessionId = createSessionId();
          const csrfToken = createCSRFToken();
          sessions.set(sessionId, {
            githubToken: null,
            csrfToken: csrfToken,
            user: {
              login: 'guest',
              name: 'Guest User',
              avatar_url: '',
              id: 0,
            },
            connectedRepos: new Set(),
            rateLimit: { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW },
            harvestRateLimit: { count: 0, resetAt: Date.now() + HARVEST_RATE_LIMIT_WINDOW },
          });
          setSessionCookie(res, sessionId);
        }

        json(res, 200, {
          success: true,
          data: analysis,
          redirect: \`/app?url=\${encodeURIComponent(url)}&mode=analyze\`
        });
      } catch (error) {
        json(res, 400, {
          success: false,
          error: error.message
        });
      }
      return;
    }

    // API endpoint for GitHub repo check
    if (pathname === '/api/check-github' && req.method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch (err) {
        json(res, 413, { error: err.message });
        return;
      }

      const { repo } = body || {};
      if (!repo) {
        json(res, 400, { error: 'Repository is required' });
        return;
      }

      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) {
        json(res, 400, { error: 'Invalid repository format. Use: owner/repository' });
        return;
      }

      try {
        const { checkGitHubRepo } = require('./landing-handler');
        const token = session?.githubToken || null;
        const result = await checkGitHubRepo(owner, repoName, token);

        json(res, 200, {
          success: true,
          data: result,
          redirect: result.hasNarrative ?
            \`/app?repo=\${encodeURIComponent(repo)}&mode=github\` :
            null
        });
      } catch (error) {
        json(res, 400, {
          success: false,
          error: error.message
        });
      }
      return;
    }

    // API endpoint for loading demo data
    if (pathname.startsWith('/api/demo/') && req.method === 'GET') {
      const demoType = pathname.slice('/api/demo/'.length);

      try {
        const { loadDemoData } = require('./landing-handler');
        const demo = await loadDemoData(demoType);

        // Create a guest session for demo
        if (!session) {
          const sessionId = createSessionId();
          const csrfToken = createCSRFToken();
          sessions.set(sessionId, {
            githubToken: null,
            csrfToken: csrfToken,
            user: {
              login: 'demo-user',
              name: 'Demo User',
              avatar_url: '',
              id: 0,
            },
            connectedRepos: new Set(),
            rateLimit: { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW },
            harvestRateLimit: { count: 0, resetAt: Date.now() + HARVEST_RATE_LIMIT_WINDOW },
          });
          setSessionCookie(res, sessionId);
        }

        json(res, 200, {
          success: true,
          data: demo,
          redirect: \`/app?demo=\${demoType}&mode=guest\`
        });
      } catch (error) {
        json(res, 404, {
          success: false,
          error: error.message
        });
      }
      return;
    }

    // API endpoint for creating blank template
    if (pathname === '/api/blank-template' && req.method === 'GET') {
      const { createBlankTemplate } = require('./landing-handler');
      const template = createBlankTemplate();

      // Create a guest session
      if (!session) {
        const sessionId = createSessionId();
        const csrfToken = createCSRFToken();
        sessions.set(sessionId, {
          githubToken: null,
          csrfToken: csrfToken,
          user: {
            login: 'guest',
            name: 'Guest User',
            avatar_url: '',
            id: 0,
          },
          connectedRepos: new Set(),
          rateLimit: { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW },
          harvestRateLimit: { count: 0, resetAt: Date.now() + HARVEST_RATE_LIMIT_WINDOW },
        });
        setSessionCookie(res, sessionId);
      }

      json(res, 200, {
        success: true,
        data: template,
        redirect: '/app?mode=blank'
      });
      return;
    }

    // AI/LLM status check (public endpoint)
    if (pathname === '/api/ai/status' && req.method === 'GET') {
      const configured = !!(
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GROQ_API_KEY ||
        session?.llmConfig
      );

      json(res, 200, {
        configured,
        provider: configured ? 'Available' : null
      });
      return;
    }

    // Redirect authenticated users from landing to app
    if (pathname === '/landing' && req.method === 'GET' && session) {
      redirect(res, '/');
      return;
    }
`;

/**
 * Instructions for integration:
 *
 * 1. Open web-app.js
 * 2. Find the handleRequest function
 * 3. Add the landing routes BEFORE the auth routes
 * 4. Add this import at the top of the file:
 *    const { analyzeURL, checkGitHubRepo, loadDemoData, createBlankTemplate } = require('./landing-handler');
 *
 * The routes handle:
 * - Serving landing page to unauthenticated users
 * - URL analysis with guest session creation
 * - GitHub repo checking (with or without auth)
 * - Demo data loading
 * - Blank template creation
 * - AI/LLM status checking
 *
 * All routes create guest sessions when needed so users can try the app
 * without signing in with GitHub.
 */

module.exports = {
  landingRoutes
};