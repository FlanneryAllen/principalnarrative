import React, { useEffect, useRef } from 'react';

// Landing Page Component with embedded HTML
const LandingPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Add the styles to the document head
      const styleId = 'landing-page-styles';
      if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.innerHTML = styles;
        document.head.appendChild(styleElement);
      }

      // Add the HTML content
      containerRef.current.innerHTML = htmlContent;

      // Add event listeners
      const addEventListeners = () => {
        // Tab switching
        window.switchTab = (tab: string, event: Event) => {
          // Update buttons
          document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
          });
          if (event && event.target) {
            (event.target as Element).closest('.tab-btn')?.classList.add('active');
          }

          // Update panels
          document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
          });
          document.getElementById(`${tab}-panel`)?.classList.add('active');
        };

        // URL Analysis
        window.analyzeURL = () => {
          const input = document.getElementById('urlInput') as HTMLInputElement;
          if (input) {
            const url = input.value.trim();
            if (url) {
              showLoading('Analyzing ' + url + '...');
              setTimeout(hideLoading, 2000);
            }
          }
        };

        // GitHub Connection
        window.connectGitHub = () => {
          const input = document.getElementById('githubRepo') as HTMLInputElement;
          if (input) {
            const repo = input.value.trim();
            if (repo) {
              showLoading('Connecting to ' + repo + '...');
              setTimeout(hideLoading, 2000);
            }
          }
        };

        window.authenticateGitHub = () => {
          showLoading('Redirecting to GitHub...');
          setTimeout(hideLoading, 1500);
        };

        window.loadDemo = (type: string) => {
          showLoading('Loading ' + type + ' demo...');
          setTimeout(hideLoading, 1500);
        };

        window.startBlank = () => {
          showLoading('Creating blank canvas...');
          setTimeout(hideLoading, 1000);
        };

        const showLoading = (text: string) => {
          const overlay = document.getElementById('loadingOverlay');
          const textEl = document.getElementById('loadingText');
          if (overlay) {
            overlay.classList.add('show');
          }
          if (textEl && text) {
            textEl.textContent = text;
          }
        };

        const hideLoading = () => {
          const overlay = document.getElementById('loadingOverlay');
          if (overlay) {
            overlay.classList.remove('show');
          }
        };
      };

      addEventListeners();

      // Auto-focus
      setTimeout(() => {
        const input = document.getElementById('urlInput') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    }

    // Cleanup
    return () => {
      const styleElement = document.getElementById('landing-page-styles');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  return <div ref={containerRef} style={{ minHeight: '100vh', background: '#0a1628' }} />;
};

// Embedded HTML content
const htmlContent = `
<div class="bg-grid"></div>
<div class="container">
  <!-- Header -->
  <div class="header">
    <div class="logo">
      <div class="logo-icon">N</div>
      <div class="logo-text">Narrative Agent</div>
    </div>
    <h1 class="title">Align Your Organization's Story</h1>
    <p class="subtitle">
      Analyze your narrative consistency across all touchpoints.
      Ensure every team member tells the same compelling story.
    </p>
  </div>

  <!-- Main Input Section -->
  <div class="main-input-section">
    <!-- Tab Navigation -->
    <div class="input-tabs">
      <button class="tab-btn active" onclick="switchTab('url', event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
        </svg>
        Website URL
      </button>
      <button class="tab-btn" onclick="switchTab('github', event)">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
        GitHub Repo
      </button>
      <button class="tab-btn" onclick="switchTab('guest', event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Try Demo
      </button>
    </div>

    <!-- Tab Panels -->
    <!-- URL Panel -->
    <div id="url-panel" class="tab-panel active">
      <div class="url-input-group">
        <input
          type="url"
          id="urlInput"
          class="url-input"
          placeholder="https://yourcompany.com"
          onkeypress="if(event.key === 'Enter') analyzeURL()"
        />
        <button class="analyze-btn" onclick="analyzeURL()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          Analyze
        </button>
      </div>
      <div id="url-error" class="error-message"></div>
    </div>

    <!-- GitHub Panel -->
    <div id="github-panel" class="tab-panel">
      <div class="github-options">
        <div class="github-input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          <input
            type="text"
            id="githubRepo"
            class="github-input"
            placeholder="owner/repository"
            onkeypress="if(event.key === 'Enter') connectGitHub()"
          />
        </div>
        <button class="github-auth-btn" onclick="authenticateGitHub()">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          Sign in with GitHub
        </button>
      </div>
      <div id="github-error" class="error-message"></div>
    </div>

    <!-- Guest/Demo Panel -->
    <div id="guest-panel" class="tab-panel">
      <div class="guest-options">
        <div class="demo-cards">
          <div class="demo-card" onclick="loadDemo('saas')">
            <div class="demo-title">
              <div class="demo-icon">S</div>
              SaaS Startup
            </div>
            <div class="demo-desc">
              Explore a B2B SaaS company's narrative structure with product messaging and customer stories.
            </div>
          </div>
          <div class="demo-card" onclick="loadDemo('nonprofit')">
            <div class="demo-title">
              <div class="demo-icon">N</div>
              Non-Profit
            </div>
            <div class="demo-desc">
              See how mission-driven organizations align their impact stories across stakeholders.
            </div>
          </div>
        </div>
        <button class="create-blank-btn" onclick="startBlank()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M12 4v16m8-8H4"/>
          </svg>
          Start with Blank Canvas
        </button>
      </div>
    </div>
  </div>

  <!-- Features -->
  <div class="features">
    <div class="feature-card">
      <div class="feature-icon">Σ</div>
      <div class="feature-title">Compose</div>
      <div class="feature-desc">Generate stakeholder-specific views from your unified narrative.</div>
    </div>
    <div class="feature-card">
      <div class="feature-icon">δ</div>
      <div class="feature-title">Drift Detection</div>
      <div class="feature-desc">Monitor when teams deviate from core messaging.</div>
    </div>
    <div class="feature-card">
      <div class="feature-icon">∞</div>
      <div class="feature-title">Coherence Score</div>
      <div class="feature-desc">Measure narrative consistency across all channels.</div>
    </div>
    <div class="feature-card">
      <div class="feature-icon">λ</div>
      <div class="feature-title">Story Mining</div>
      <div class="feature-desc">Extract and analyze narrative patterns from your content.</div>
    </div>
  </div>
</div>

<!-- Status Section -->
<div class="status-section">
  <div class="status-badge">
    <span class="status-dot connected" id="aiStatus"></span>
    <span>AI Ready</span>
  </div>
</div>

<!-- Loading Overlay -->
<div class="loading-overlay" id="loadingOverlay">
  <div class="loading-content">
    <div class="loading-spinner"></div>
    <div class="loading-text" id="loadingText">Analyzing narrative structure...</div>
  </div>
</div>
`;

// Embedded styles
const styles = `
.landing-page-container * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.bg-grid {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
  background-size: 50px 50px;
  animation: drift 20s linear infinite;
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
}

@keyframes drift {
  from { transform: translate(0, 0); }
  to { transform: translate(50px, 50px); }
}

.container {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 60px 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', -apple-system, sans-serif;
  color: #e2e8f0;
  z-index: 1;
}

.header {
  text-align: center;
  margin-bottom: 60px;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.logo-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #d4872c, #e8a04a);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 24px;
  color: white;
  box-shadow: 0 4px 16px rgba(212,135,44,0.15);
}

.logo-text {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #d4872c;
}

.title {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 18px;
  color: #94a3b8;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
}

.main-input-section {
  width: 100%;
  max-width: 600px;
  margin-bottom: 40px;
}

.input-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: #0f1f38;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: 'Inter', -apple-system, sans-serif;
}

.tab-btn:hover {
  color: #e2e8f0;
  background: rgba(255,255,255,0.03);
}

.tab-btn.active {
  background: #d4872c;
  color: white;
  box-shadow: 0 2px 8px rgba(212,135,44,0.15);
}

.tab-btn svg {
  width: 18px;
  height: 18px;
}

.tab-panel {
  display: none;
  animation: fadeIn 0.3s ease;
}

.tab-panel.active {
  display: block;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.url-input-group {
  position: relative;
}

.url-input {
  width: 100%;
  padding: 20px 24px;
  padding-right: 140px;
  background: #0f1f38;
  border: 2px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  color: #e2e8f0;
  font-size: 16px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  outline: none;
  transition: all 0.2s ease;
}

.url-input:focus {
  border-color: #d4872c;
  background: #152544;
  box-shadow: 0 0 0 3px rgba(212,135,44,0.15);
}

.url-input::placeholder {
  color: #64748b;
}

.analyze-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  padding: 12px 24px;
  background: #d4872c;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Inter', -apple-system, sans-serif;
}

.analyze-btn:hover {
  background: #e8a04a;
}

.analyze-btn svg {
  width: 16px;
  height: 16px;
}

.github-options,
.guest-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.github-input-group {
  position: relative;
}

.github-input {
  width: 100%;
  padding: 16px 20px;
  padding-left: 48px;
  background: #0f1f38;
  border: 2px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  color: #e2e8f0;
  font-size: 15px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  outline: none;
  transition: all 0.2s ease;
}

.github-input:focus {
  border-color: #d4872c;
  background: #152544;
  box-shadow: 0 0 0 3px rgba(212,135,44,0.15);
}

.input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  pointer-events: none;
}

.github-auth-btn {
  padding: 16px 24px;
  background: #152544;
  border: 2px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  color: #e2e8f0;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: 'Inter', -apple-system, sans-serif;
}

.github-auth-btn:hover {
  background: #1a2d4a;
  border-color: rgba(255,255,255,0.1);
  transform: translateY(-1px);
}

.github-auth-btn svg {
  width: 20px;
  height: 20px;
}

.demo-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.demo-card {
  background: #0f1f38;
  border: 2px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.demo-card:hover {
  border-color: #d4872c;
  transform: translateY(-2px);
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
}

.demo-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #d4872c, #e8a04a);
  transform: scaleX(0);
  transition: transform 0.2s ease;
}

.demo-card:hover::before {
  transform: scaleX(1);
}

.demo-title {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.demo-desc {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}

.demo-icon {
  width: 24px;
  height: 24px;
  background: rgba(212,135,44,0.15);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d4872c;
  font-weight: bold;
  font-size: 14px;
}

.create-blank-btn {
  padding: 20px;
  background: linear-gradient(135deg, #152544, #0f1f38);
  border: 2px dashed rgba(255,255,255,0.06);
  border-radius: 12px;
  color: #94a3b8;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: 'Inter', -apple-system, sans-serif;
}

.create-blank-btn:hover {
  border-color: #d4872c;
  color: #e2e8f0;
  background: #1a2d4a;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  margin-top: 80px;
  padding-top: 40px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.feature-card {
  text-align: center;
  padding: 24px;
  background: #0f1f38;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255,255,255,0.1);
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
}

.feature-icon {
  width: 48px;
  height: 48px;
  background: rgba(212,135,44,0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  font-size: 24px;
  color: #d4872c;
  font-weight: bold;
}

.feature-title {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 8px;
}

.feature-desc {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}

.status-section {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 100;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #152544;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 24px;
  font-size: 12px;
  color: #94a3b8;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.connected {
  background: #34d399;
}

.status-dot.error {
  background: #f87171;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 22, 40, 0.95);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-overlay.show {
  display: flex;
}

.loading-content {
  text-align: center;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255,255,255,0.06);
  border-top-color: #d4872c;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 16px;
  color: #94a3b8;
}

.error-message {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(248,113,113,0.15);
  border: 1px solid #f87171;
  border-radius: 8px;
  color: #f87171;
  font-size: 14px;
  display: none;
}

.error-message.show {
  display: block;
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

@media (max-width: 768px) {
  .title {
    font-size: 36px;
  }

  .subtitle {
    font-size: 16px;
  }

  .input-tabs {
    flex-direction: column;
  }

  .tab-btn {
    width: 100%;
  }

  .features {
    grid-template-columns: 1fr;
  }

  .demo-cards {
    grid-template-columns: 1fr;
  }
}
`;

// TypeScript declarations for window functions
declare global {
  interface Window {
    switchTab: (tab: string, event: Event) => void;
    analyzeURL: () => void;
    connectGitHub: () => void;
    authenticateGitHub: () => void;
    loadDemo: (type: string) => void;
    startBlank: () => void;
  }
}

export default LandingPage;