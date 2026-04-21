/**
 * Airtable Harvester
 * Extracts narrative units from Airtable bases
 */

const BaseHarvester = require('./base-harvester');

class AirtableHarvester extends BaseHarvester {
  constructor(config = {}) {
    super({
      ...config,
      rateLimit: { requestsPerSecond: 5 } // Airtable rate limit
    });

    this.apiKey = config.apiKey || process.env.AIRTABLE_API_KEY;
    this.baseId = config.baseId || process.env.AIRTABLE_BASE_ID;
    this.apiUrl = 'https://api.airtable.com/v0';
  }

  /**
   * Authenticate with Airtable
   */
  async authenticate() {
    if (!this.apiKey) {
      throw new Error('Airtable API key is required');
    }
    if (!this.baseId) {
      throw new Error('Airtable base ID is required');
    }

    // Test authentication by fetching base schema
    try {
      await this.makeRequest(`${this.apiUrl}/meta/bases/${this.baseId}/tables`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      console.log('[AirtableHarvester] Authentication successful');
    } catch (error) {
      throw new Error(`Airtable authentication failed: ${error.message}`);
    }
  }

  /**
   * Fetch data from Airtable
   */
  async fetchData(options = {}) {
    const {
      tables = [],
      fields = [],
      view,
      filterByFormula,
      maxRecords = 1000,
      dateFilter
    } = options;

    const allRecords = [];

    // If no tables specified, fetch all tables
    const tablesToFetch = tables.length > 0 ? tables : await this.getAllTables();

    for (const table of tablesToFetch) {
      console.log(`[AirtableHarvester] Fetching from table: ${table}`);

      const records = await this.fetchTableRecords(table, {
        fields,
        view,
        filterByFormula: this.buildFilterFormula(filterByFormula, dateFilter),
        maxRecords
      });

      allRecords.push(...records);
    }

    return allRecords;
  }

  /**
   * Get all tables in the base
   */
  async getAllTables() {
    const response = await this.makeRequest(`${this.apiUrl}/meta/bases/${this.baseId}/tables`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    return response.tables.map(table => table.name);
  }

  /**
   * Fetch records from a specific table
   */
  async fetchTableRecords(tableName, options = {}) {
    const records = [];
    let offset = null;

    const params = new URLSearchParams();
    if (options.fields?.length > 0) {
      options.fields.forEach(field => params.append('fields[]', field));
    }
    if (options.view) {
      params.append('view', options.view);
    }
    if (options.filterByFormula) {
      params.append('filterByFormula', options.filterByFormula);
    }
    if (options.maxRecords) {
      params.append('maxRecords', options.maxRecords.toString());
    }

    do {
      if (offset) {
        params.set('offset', offset);
      }

      const url = `${this.apiUrl}/${this.baseId}/${encodeURIComponent(tableName)}?${params.toString()}`;

      const response = await this.makeRequest(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      records.push(...response.records);
      offset = response.offset;

    } while (offset && records.length < (options.maxRecords || 1000));

    return records.map(record => ({
      id: record.id,
      table: tableName,
      fields: record.fields,
      createdTime: record.createdTime
    }));
  }

  /**
   * Build Airtable filter formula
   */
  buildFilterFormula(baseFormula, dateFilter) {
    const formulas = [];

    if (baseFormula) {
      formulas.push(baseFormula);
    }

    if (dateFilter && dateFilter.field && dateFilter.after) {
      formulas.push(`IS_AFTER({${dateFilter.field}}, '${dateFilter.after}')`);
    }

    if (formulas.length === 0) return null;
    if (formulas.length === 1) return formulas[0];
    return `AND(${formulas.join(', ')})`;
  }

  /**
   * Transform Airtable data to standard format
   */
  async transformData(rawData) {
    const transformed = [];

    for (const record of rawData) {
      const textParts = [];
      const metadata = {
        recordId: record.id,
        table: record.table,
        createdAt: record.createdTime
      };

      // Extract text from all fields
      for (const [fieldName, fieldValue] of Object.entries(record.fields || {})) {
        if (typeof fieldValue === 'string' && fieldValue.length > 50) {
          // Long text fields are likely narrative content
          textParts.push(`${fieldName}: ${fieldValue}`);
        } else if (Array.isArray(fieldValue)) {
          // Handle array fields (multi-select, attachments, etc.)
          const stringValues = fieldValue
            .filter(v => typeof v === 'string' || (v && v.filename))
            .map(v => v.filename || v);

          if (stringValues.length > 0) {
            metadata[fieldName] = stringValues;
          }
        } else if (fieldValue !== null && fieldValue !== undefined) {
          // Store other fields as metadata
          metadata[fieldName] = fieldValue;
        }
      }

      if (textParts.length > 0) {
        transformed.push({
          text: textParts.join('\n\n'),
          source: `airtable:${record.table}:${record.id}`,
          sourceType: this.detectSourceType(record.table, textParts),
          metadata
        });
      }
    }

    return transformed;
  }

  /**
   * Detect source type based on table name and content
   */
  detectSourceType(tableName, textParts) {
    const tableNameLower = tableName.toLowerCase();
    const combinedText = textParts.join(' ').toLowerCase();

    // Check table name patterns
    if (tableNameLower.includes('roadmap') || tableNameLower.includes('feature')) {
      return 'product_roadmap';
    }
    if (tableNameLower.includes('feedback') || tableNameLower.includes('review')) {
      return 'customer_feedback';
    }
    if (tableNameLower.includes('strategy') || tableNameLower.includes('plan')) {
      return 'strategy_document';
    }
    if (tableNameLower.includes('meeting') || tableNameLower.includes('notes')) {
      return 'meeting_notes';
    }
    if (tableNameLower.includes('update') || tableNameLower.includes('status')) {
      return 'status_update';
    }

    // Check content patterns
    if (combinedText.includes('customer') || combinedText.includes('user')) {
      return 'customer_feedback';
    }
    if (combinedText.includes('strategy') || combinedText.includes('vision')) {
      return 'strategy_document';
    }
    if (combinedText.includes('product') || combinedText.includes('feature')) {
      return 'product_document';
    }

    return 'business_document';
  }

  /**
   * Get schema information for UI/configuration
   */
  async getSchema() {
    const response = await this.makeRequest(`${this.apiUrl}/meta/bases/${this.baseId}/tables`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    return {
      tables: response.tables.map(table => ({
        id: table.id,
        name: table.name,
        description: table.description,
        fields: table.fields.map(field => ({
          id: field.id,
          name: field.name,
          type: field.type,
          description: field.description
        })),
        views: table.views.map(view => ({
          id: view.id,
          name: view.name,
          type: view.type
        }))
      }))
    };
  }

  /**
   * Test connection to Airtable
   */
  async testConnection() {
    try {
      await this.authenticate();
      const tables = await this.getAllTables();
      return {
        success: true,
        message: `Successfully connected to Airtable base with ${tables.length} tables`,
        tables
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = AirtableHarvester;