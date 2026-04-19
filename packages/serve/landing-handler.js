/**
 * Landing Page Handler
 * Handles URL analysis, GitHub repo detection, and guest mode
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { URL } = require('url');

/**
 * Validate and normalize URL
 */
function validateURL(urlString) {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Invalid protocol. Use http or https.' };
    }
    return { valid: true, url: url.toString() };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Check if a GitHub repository exists and has a narrative.yaml file
 */
async function checkGitHubRepo(owner, repo, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Narrative-Agent',
      'Accept': 'application/vnd.github.v3+json'
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    // Check for narrative.yaml in root
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/narrative.yaml`,
      method: 'GET',
      headers
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const content = JSON.parse(data);
          resolve({
            exists: true,
            hasNarrative: true,
            content: Buffer.from(content.content, 'base64').toString('utf-8')
          });
        } else if (res.statusCode === 404) {
          // Repo exists but no narrative.yaml
          checkRepoExists(owner, repo, headers)
            .then(exists => {
              resolve({
                exists,
                hasNarrative: false
              });
            })
            .catch(reject);
        } else {
          resolve({
            exists: false,
            hasNarrative: false,
            error: `GitHub API returned ${res.statusCode}`
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Check if a GitHub repository exists
 */
function checkRepoExists(owner, repo, headers) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}`,
      method: 'GET',
      headers
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {}); // Consume response
      res.on('end', () => {
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch and analyze a URL for narrative content
 */
async function analyzeURL(urlString) {
  const validation = validateURL(urlString);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return new Promise((resolve, reject) => {
    const url = new URL(validation.url);
    const protocol = url.protocol === 'https:' ? https : require('http');

    const req = protocol.get(validation.url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Narrative-Agent/1.0'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        analyzeURL(res.headers.location)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch URL: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        // Limit response size to 5MB
        if (data.length > 5 * 1024 * 1024) {
          req.abort();
          reject(new Error('Response too large'));
        }
      });

      res.on('end', () => {
        // Extract basic metadata
        const titleMatch = data.match(/<title[^>]*>(.*?)<\/title>/i);
        const descMatch = data.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);

        resolve({
          url: validation.url,
          title: titleMatch ? titleMatch[1].trim() : url.hostname,
          description: descMatch ? descMatch[1].trim() : '',
          contentLength: data.length,
          hasContent: true
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Load demo data
 */
async function loadDemoData(demoType) {
  const demos = {
    saas: {
      name: 'TechFlow SaaS',
      narrative: {
        core: {
          mission: 'Empowering teams to collaborate seamlessly',
          vision: 'A world where distance doesn\'t limit productivity',
          values: ['Transparency', 'Innovation', 'Customer Success']
        },
        messaging: {
          tagline: 'Work together, anywhere',
          elevator: 'TechFlow connects distributed teams with intuitive collaboration tools that just work.',
          boilerplate: 'TechFlow is the leading collaboration platform for modern teams...'
        }
      }
    },
    nonprofit: {
      name: 'Global Impact Foundation',
      narrative: {
        core: {
          mission: 'Creating lasting change in underserved communities',
          vision: 'A world where every child has access to quality education',
          values: ['Equity', 'Sustainability', 'Community']
        },
        messaging: {
          tagline: 'Education for every child',
          elevator: 'We build schools and train teachers in communities that need them most.',
          boilerplate: 'Global Impact Foundation has helped over 1 million children...'
        }
      }
    }
  };

  if (!demos[demoType]) {
    throw new Error('Demo not found');
  }

  return demos[demoType];
}

/**
 * Create a blank narrative template
 */
function createBlankTemplate() {
  return {
    name: 'Your Organization',
    narrative: {
      core: {
        mission: '',
        vision: '',
        values: []
      },
      messaging: {
        tagline: '',
        elevator: '',
        boilerplate: ''
      },
      audience: {
        primary: '',
        secondary: ''
      },
      voice: {
        tone: '',
        style: '',
        personality: ''
      }
    }
  };
}

/**
 * Express route handlers
 */
const handlers = {
  // Serve landing page
  landing: async (req, res) => {
    try {
      const landingPath = path.join(__dirname, 'landing-page.html');
      const content = await fs.readFile(landingPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.send(content);
    } catch (error) {
      res.status(500).send('Error loading landing page');
    }
  },

  // Analyze URL endpoint
  analyzeURL: async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const analysis = await analyzeURL(url);
      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  // Check GitHub repository
  checkGitHub: async (req, res) => {
    try {
      const { repo } = req.body;
      if (!repo) {
        return res.status(400).json({ error: 'Repository is required' });
      }

      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) {
        return res.status(400).json({ error: 'Invalid repository format' });
      }

      const token = req.session?.githubToken || null;
      const result = await checkGitHubRepo(owner, repoName, token);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  // Load demo
  loadDemo: async (req, res) => {
    try {
      const { type } = req.params;
      const demo = await loadDemoData(type);

      res.json({
        success: true,
        data: demo
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },

  // Create blank template
  createBlank: (req, res) => {
    const template = createBlankTemplate();
    res.json({
      success: true,
      data: template
    });
  },

  // AI status check
  aiStatus: (req, res) => {
    // Check if AI/LLM is configured
    const configured = process.env.OPENAI_API_KEY ||
                      process.env.ANTHROPIC_API_KEY ||
                      process.env.GROQ_API_KEY ||
                      false;

    res.json({
      configured: !!configured,
      provider: configured ? 'OpenAI/Anthropic/Groq' : null
    });
  }
};

module.exports = {
  handlers,
  validateURL,
  checkGitHubRepo,
  analyzeURL,
  loadDemoData,
  createBlankTemplate
};