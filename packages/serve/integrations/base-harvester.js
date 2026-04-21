/**
 * Base Harvester Class
 * Abstract base class for all integration harvesters
 * Provides common functionality for data extraction, transformation, and narrative mining
 */

const https = require('https');
const http = require('http');

class BaseHarvester {
  constructor(config = {}) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit || { requestsPerSecond: 10 });
    this.errors = [];
    this.stats = {
      recordsFetched: 0,
      unitsExtracted: 0,
      apiCalls: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Authenticate with the external service
   * Must be implemented by subclasses
   */
  async authenticate() {
    throw new Error('authenticate() must be implemented by subclass');
  }

  /**
   * Fetch raw data from the external service
   * Must be implemented by subclasses
   */
  async fetchData(options = {}) {
    throw new Error('fetchData() must be implemented by subclass');
  }

  /**
   * Transform platform-specific data to standard format
   * Must be implemented by subclasses
   */
  async transformData(rawData) {
    throw new Error('transformData() must be implemented by subclass');
  }

  /**
   * Main harvest method - orchestrates the full pipeline
   */
  async harvest(options = {}) {
    this.stats.startTime = new Date();

    try {
      // Step 1: Authenticate
      console.log(`[${this.constructor.name}] Authenticating...`);
      await this.authenticate();

      // Step 2: Fetch data
      console.log(`[${this.constructor.name}] Fetching data...`);
      const rawData = await this.fetchData(options);
      this.stats.recordsFetched = Array.isArray(rawData) ? rawData.length : 1;

      // Step 3: Transform data
      console.log(`[${this.constructor.name}] Transforming data...`);
      const transformedData = await this.transformData(rawData);

      // Step 4: Extract narrative units
      console.log(`[${this.constructor.name}] Extracting narrative units...`);
      const units = await this.extractNarrativeUnits(transformedData, options);
      this.stats.unitsExtracted = units.length;

      // Step 5: Enrich with metadata
      console.log(`[${this.constructor.name}] Enriching units with metadata...`);
      const enrichedUnits = await this.enrichUnits(units, options);

      this.stats.endTime = new Date();

      return {
        success: true,
        units: enrichedUnits,
        stats: this.stats,
        errors: this.errors
      };
    } catch (error) {
      this.stats.endTime = new Date();
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        units: [],
        stats: this.stats,
        errors: this.errors
      };
    }
  }

  /**
   * Extract narrative units from transformed data
   * Uses StoryMining engine (rule-based or LLM)
   */
  async extractNarrativeUnits(data, options = {}) {
    const { mineNarrativeUnits } = require('../storymining.js');
    const { llmMineNarrativeUnits } = require('../storymining-llm.js');

    const allUnits = [];
    const items = Array.isArray(data) ? data : [data];

    for (const item of items) {
      if (!item.text) continue;

      let units;
      if (options.useLLM && (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)) {
        // Use LLM-enhanced mining
        const result = await llmMineNarrativeUnits(item.text, {
          sourceType: item.sourceType || 'business_document',
          metadata: item.metadata || {}
        });
        units = result.candidates || result.units || result || [];
      } else {
        // Use rule-based mining
        const result = mineNarrativeUnits(item.text, {
          enableDependencyDetection: true,
          enableGapAnalysis: true
        });
        units = result.candidates || result.units || result || [];
      }

      // Ensure units is an array
      if (!Array.isArray(units)) {
        units = [];
      }

      // Add source information to each unit
      units.forEach(unit => {
        unit.source = item.source || 'integration_harvest';
        unit.sourceMetadata = item.metadata || {};
        unit.harvestedAt = new Date().toISOString();
      });

      allUnits.push(...units);
    }

    return allUnits;
  }

  /**
   * Enrich units with additional metadata
   */
  async enrichUnits(units, options = {}) {
    return units.map(unit => ({
      ...unit,
      integration: this.constructor.name.replace('Harvester', '').toLowerCase(),
      harvestOptions: options,
      harvestStats: {
        totalRecords: this.stats.recordsFetched,
        totalUnits: this.stats.unitsExtracted,
        apiCalls: this.stats.apiCalls
      }
    }));
  }

  /**
   * Make HTTP/HTTPS request with error handling and retries
   */
  async makeRequest(url, options = {}) {
    await this.rateLimiter.waitForSlot();
    this.stats.apiCalls++;

    const maxRetries = options.maxRetries || 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this._doRequest(url, options);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[${this.constructor.name}] Retry ${attempt}/${maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Internal request implementation
   */
  _doRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'NarrativeAgent-Harvester/1.0',
          ...options.headers
        }
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Sleep utility for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch process items with concurrency control
   */
  async batchProcess(items, processor, batchSize = 5) {
    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item).catch(err => ({ error: err.message })))
      );
      results.push(...batchResults);

      // Progress update
      const progress = Math.min(100, Math.round((i + batch.length) / items.length * 100));
      console.log(`[${this.constructor.name}] Progress: ${progress}% (${i + batch.length}/${items.length})`);
    }

    return results;
  }
}

/**
 * Simple rate limiter
 */
class RateLimiter {
  constructor(config = {}) {
    this.requestsPerSecond = config.requestsPerSecond || 10;
    this.minInterval = 1000 / this.requestsPerSecond;
    this.lastRequestTime = 0;
  }

  async waitForSlot() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const delay = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }
}

module.exports = BaseHarvester;