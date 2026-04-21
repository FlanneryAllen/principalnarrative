/**
 * CRM Harvester
 * Extracts narrative units from CRM systems (Salesforce, HubSpot, Pipedrive)
 */

const BaseHarvester = require('./base-harvester');

class CRMHarvester extends BaseHarvester {
  constructor(config = {}) {
    super({
      ...config,
      rateLimit: { requestsPerSecond: 10 }
    });

    this.platform = config.platform || 'salesforce'; // salesforce, hubspot, pipedrive
    this.credentials = this.loadCredentials(config);
    this.accessToken = null;
  }

  /**
   * Load platform-specific credentials
   */
  loadCredentials(config) {
    switch (this.platform) {
      case 'salesforce':
        return {
          instanceUrl: config.instanceUrl || process.env.SALESFORCE_INSTANCE_URL,
          clientId: config.clientId || process.env.SALESFORCE_CLIENT_ID,
          clientSecret: config.clientSecret || process.env.SALESFORCE_CLIENT_SECRET,
          username: config.username || process.env.SALESFORCE_USERNAME,
          password: config.password || process.env.SALESFORCE_PASSWORD,
          securityToken: config.securityToken || process.env.SALESFORCE_SECURITY_TOKEN
        };

      case 'hubspot':
        return {
          apiKey: config.apiKey || process.env.HUBSPOT_API_KEY,
          accessToken: config.accessToken || process.env.HUBSPOT_ACCESS_TOKEN
        };

      case 'pipedrive':
        return {
          apiToken: config.apiToken || process.env.PIPEDRIVE_API_TOKEN,
          companyDomain: config.companyDomain || process.env.PIPEDRIVE_COMPANY_DOMAIN
        };

      default:
        throw new Error(`Unsupported CRM platform: ${this.platform}`);
    }
  }

  /**
   * Authenticate with CRM platform
   */
  async authenticate() {
    console.log(`[CRMHarvester] Authenticating with ${this.platform}...`);

    switch (this.platform) {
      case 'salesforce':
        await this.authenticateSalesforce();
        break;
      case 'hubspot':
        await this.authenticateHubSpot();
        break;
      case 'pipedrive':
        await this.authenticatePipedrive();
        break;
    }

    console.log(`[CRMHarvester] Authentication successful`);
  }

  /**
   * Salesforce authentication (OAuth2 password flow)
   */
  async authenticateSalesforce() {
    const { instanceUrl, clientId, clientSecret, username, password, securityToken } = this.credentials;

    if (!instanceUrl || !clientId || !clientSecret || !username || !password) {
      throw new Error('Missing required Salesforce credentials');
    }

    const tokenUrl = `${instanceUrl}/services/oauth2/token`;
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username: username,
      password: password + (securityToken || '')
    });

    const response = await this.makeRequest(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    this.accessToken = response.access_token;
    this.credentials.instanceUrl = response.instance_url || instanceUrl;
  }

  /**
   * HubSpot authentication
   */
  async authenticateHubSpot() {
    const { apiKey, accessToken } = this.credentials;

    if (!apiKey && !accessToken) {
      throw new Error('HubSpot API key or access token is required');
    }

    // Test authentication
    const testUrl = accessToken
      ? 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1'
      : `https://api.hubapi.com/crm/v3/objects/contacts?limit=1&hapikey=${apiKey}`;

    await this.makeRequest(testUrl, {
      headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}
    });

    this.accessToken = accessToken || apiKey;
  }

  /**
   * Pipedrive authentication
   */
  async authenticatePipedrive() {
    const { apiToken, companyDomain } = this.credentials;

    if (!apiToken || !companyDomain) {
      throw new Error('Pipedrive API token and company domain are required');
    }

    // Test authentication
    const testUrl = `https://${companyDomain}.pipedrive.com/api/v1/users/me?api_token=${apiToken}`;
    await this.makeRequest(testUrl);

    this.accessToken = apiToken;
  }

  /**
   * Fetch data from CRM
   */
  async fetchData(options = {}) {
    const {
      objects = ['Opportunity', 'Account', 'Contact'],
      fields = [],
      filters = {},
      limit = 500,
      dateRange
    } = options;

    const allData = [];

    for (const objectType of objects) {
      console.log(`[CRMHarvester] Fetching ${objectType} records...`);

      const records = await this.fetchObjectRecords(objectType, {
        fields,
        filters,
        limit,
        dateRange
      });

      allData.push(...records);
    }

    return allData;
  }

  /**
   * Fetch records for specific object type
   */
  async fetchObjectRecords(objectType, options = {}) {
    switch (this.platform) {
      case 'salesforce':
        return this.fetchSalesforceRecords(objectType, options);
      case 'hubspot':
        return this.fetchHubSpotRecords(objectType, options);
      case 'pipedrive':
        return this.fetchPipedriveRecords(objectType, options);
      default:
        return [];
    }
  }

  /**
   * Fetch Salesforce records using SOQL
   */
  async fetchSalesforceRecords(objectType, options = {}) {
    const { fields = [], filters = {}, limit = 500, dateRange } = options;

    // Build SOQL query
    const selectFields = fields.length > 0
      ? fields.join(', ')
      : 'Id, Name, Description, CreatedDate, LastModifiedDate';

    let whereConditions = [];

    // Add filters
    for (const [field, value] of Object.entries(filters)) {
      if (typeof value === 'object' && value.gt) {
        whereConditions.push(`${field} > ${value.gt}`);
      } else if (typeof value === 'object' && value.lt) {
        whereConditions.push(`${field} < ${value.lt}`);
      } else if (Array.isArray(value)) {
        const values = value.map(v => `'${v}'`).join(', ');
        whereConditions.push(`${field} IN (${values})`);
      } else {
        whereConditions.push(`${field} = '${value}'`);
      }
    }

    // Add date range filter
    if (dateRange) {
      if (dateRange.start) {
        whereConditions.push(`CreatedDate >= ${dateRange.start}T00:00:00Z`);
      }
      if (dateRange.end) {
        whereConditions.push(`CreatedDate <= ${dateRange.end}T23:59:59Z`);
      }
    }

    const whereClause = whereConditions.length > 0
      ? ` WHERE ${whereConditions.join(' AND ')}`
      : '';

    const soql = `SELECT ${selectFields} FROM ${objectType}${whereClause} LIMIT ${limit}`;

    const queryUrl = `${this.credentials.instanceUrl}/services/data/v57.0/query?q=${encodeURIComponent(soql)}`;

    const response = await this.makeRequest(queryUrl, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    return response.records.map(record => ({
      id: record.Id,
      objectType,
      platform: 'salesforce',
      data: record
    }));
  }

  /**
   * Fetch HubSpot records
   */
  async fetchHubSpotRecords(objectType, options = {}) {
    const { fields = [], limit = 500 } = options;

    // Map object types to HubSpot endpoints
    const objectMap = {
      'Opportunity': 'deals',
      'Account': 'companies',
      'Contact': 'contacts',
      'Deal': 'deals',
      'Company': 'companies'
    };

    const hubspotObject = objectMap[objectType] || objectType.toLowerCase();

    const params = new URLSearchParams({
      limit: limit.toString()
    });

    if (fields.length > 0) {
      params.append('properties', fields.join(','));
    }

    const apiKeyParam = this.credentials.apiKey && !this.credentials.accessToken
      ? `&hapikey=${this.credentials.apiKey}`
      : '';

    const url = `https://api.hubapi.com/crm/v3/objects/${hubspotObject}?${params.toString()}${apiKeyParam}`;

    const response = await this.makeRequest(url, {
      headers: this.credentials.accessToken
        ? { 'Authorization': `Bearer ${this.credentials.accessToken}` }
        : {}
    });

    return response.results.map(record => ({
      id: record.id,
      objectType,
      platform: 'hubspot',
      data: record.properties
    }));
  }

  /**
   * Fetch Pipedrive records
   */
  async fetchPipedriveRecords(objectType, options = {}) {
    const { limit = 500 } = options;

    // Map object types to Pipedrive endpoints
    const objectMap = {
      'Opportunity': 'deals',
      'Account': 'organizations',
      'Contact': 'persons',
      'Deal': 'deals',
      'Organization': 'organizations',
      'Person': 'persons'
    };

    const pipedriveObject = objectMap[objectType] || objectType.toLowerCase();

    const url = `https://${this.credentials.companyDomain}.pipedrive.com/api/v1/${pipedriveObject}?api_token=${this.accessToken}&limit=${limit}`;

    const response = await this.makeRequest(url);

    if (!response.success) {
      throw new Error(`Pipedrive API error: ${response.error}`);
    }

    return (response.data || []).map(record => ({
      id: record.id,
      objectType,
      platform: 'pipedrive',
      data: record
    }));
  }

  /**
   * Transform CRM data to standard format
   */
  async transformData(rawData) {
    const transformed = [];

    for (const record of rawData) {
      const textParts = [];
      const metadata = {
        recordId: record.id,
        objectType: record.objectType,
        platform: record.platform
      };

      // Extract narrative fields based on platform
      const narrativeFields = this.getNarrativeFields(record);

      for (const [fieldName, fieldValue] of Object.entries(narrativeFields)) {
        if (typeof fieldValue === 'string' && fieldValue.trim().length > 0) {
          textParts.push(`${this.formatFieldName(fieldName)}: ${fieldValue}`);
        }
      }

      // Add other fields to metadata
      for (const [key, value] of Object.entries(record.data)) {
        if (!narrativeFields[key] && value !== null && value !== undefined) {
          metadata[key] = value;
        }
      }

      if (textParts.length > 0) {
        transformed.push({
          text: textParts.join('\n\n'),
          source: `${record.platform}:${record.objectType}:${record.id}`,
          sourceType: this.detectSourceType(record.objectType, textParts),
          metadata
        });
      }
    }

    return transformed;
  }

  /**
   * Get narrative fields based on object type and platform
   */
  getNarrativeFields(record) {
    const fields = {};
    const data = record.data;

    // Common narrative fields across platforms
    const narrativeFieldNames = [
      'description', 'Description', 'description__c',
      'notes', 'Notes', 'notes__c',
      'summary', 'Summary', 'executive_summary__c',
      'next_steps', 'NextSteps', 'next_steps__c',
      'use_case', 'UseCase', 'use_case__c',
      'business_value', 'BusinessValue', 'business_value__c',
      'challenges', 'Challenges', 'challenges__c',
      'solutions', 'Solutions', 'solutions__c',
      'comments', 'Comments', 'internal_notes__c',
      'details', 'Details', 'opportunity_details__c'
    ];

    for (const fieldName of narrativeFieldNames) {
      if (data[fieldName]) {
        fields[fieldName] = data[fieldName];
      }
    }

    // Platform-specific fields
    switch (record.platform) {
      case 'salesforce':
        if (data.Name) fields.Name = data.Name;
        if (data.CloseDate) metadata.closeDate = data.CloseDate;
        if (data.Amount) metadata.amount = data.Amount;
        break;

      case 'hubspot':
        if (data.dealname) fields.dealName = data.dealname;
        if (data.content) fields.content = data.content;
        if (data.hs_object_description) fields.description = data.hs_object_description;
        break;

      case 'pipedrive':
        if (data.name) fields.name = data.name;
        if (data.notes) fields.notes = data.notes;
        if (data.summary) fields.summary = data.summary;
        break;
    }

    return fields;
  }

  /**
   * Format field name for display
   */
  formatFieldName(fieldName) {
    return fieldName
      .replace(/__c$/, '')
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Detect source type based on object type and content
   */
  detectSourceType(objectType, textParts) {
    const objectLower = objectType.toLowerCase();
    const combinedText = textParts.join(' ').toLowerCase();

    if (objectLower.includes('opportunity') || objectLower.includes('deal')) {
      return 'sales_opportunity';
    }
    if (objectLower.includes('account') || objectLower.includes('company')) {
      return 'account_plan';
    }
    if (objectLower.includes('contact') || objectLower.includes('person')) {
      return 'contact_notes';
    }
    if (objectLower.includes('case') || objectLower.includes('ticket')) {
      return 'support_ticket';
    }
    if (objectLower.includes('lead')) {
      return 'lead_qualification';
    }

    // Content-based detection
    if (combinedText.includes('proposal') || combinedText.includes('quote')) {
      return 'sales_proposal';
    }
    if (combinedText.includes('strategy') || combinedText.includes('plan')) {
      return 'strategic_plan';
    }
    if (combinedText.includes('feedback') || combinedText.includes('review')) {
      return 'customer_feedback';
    }

    return 'crm_record';
  }

  /**
   * Test CRM connection
   */
  async testConnection() {
    try {
      await this.authenticate();

      // Fetch a small sample to verify connection
      const sample = await this.fetchObjectRecords('Contact', { limit: 1 });

      return {
        success: true,
        message: `Successfully connected to ${this.platform}`,
        platform: this.platform
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        platform: this.platform
      };
    }
  }
}

module.exports = CRMHarvester;