/**
 * Integration Module Index
 * Exports all harvester classes and utilities
 */

const BaseHarvester = require('./base-harvester');
const AirtableHarvester = require('./airtable-harvester');
const CRMHarvester = require('./crm-harvester');
const WebexHarvester = require('./webex-harvester');

/**
 * Factory function to create harvester instances
 */
function createHarvester(type, config = {}) {
  switch (type.toLowerCase()) {
    case 'airtable':
      return new AirtableHarvester(config);

    case 'salesforce':
      return new CRMHarvester({ ...config, platform: 'salesforce' });

    case 'hubspot':
      return new CRMHarvester({ ...config, platform: 'hubspot' });

    case 'pipedrive':
      return new CRMHarvester({ ...config, platform: 'pipedrive' });

    case 'crm':
      // Default to salesforce if platform not specified
      return new CRMHarvester({ ...config, platform: config.platform || 'salesforce' });

    case 'webex':
      return new WebexHarvester(config);

    default:
      throw new Error(`Unknown harvester type: ${type}`);
  }
}

/**
 * Get list of available integrations
 */
function getAvailableIntegrations() {
  return [
    {
      id: 'airtable',
      name: 'Airtable',
      description: 'Extract narratives from Airtable bases and records',
      requiredCredentials: ['apiKey', 'baseId'],
      optionalCredentials: [],
      supportedFeatures: ['schema', 'filtering', 'batch'],
      icon: '📊'
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Extract narratives from Salesforce CRM data',
      requiredCredentials: ['instanceUrl', 'clientId', 'clientSecret', 'username', 'password'],
      optionalCredentials: ['securityToken'],
      supportedFeatures: ['soql', 'filtering', 'batch', 'custom_objects'],
      icon: '☁️'
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Extract narratives from HubSpot CRM data',
      requiredCredentials: [],
      optionalCredentials: ['apiKey', 'accessToken'],
      supportedFeatures: ['filtering', 'batch', 'properties'],
      icon: '🔧'
    },
    {
      id: 'pipedrive',
      name: 'Pipedrive',
      description: 'Extract narratives from Pipedrive CRM data',
      requiredCredentials: ['apiToken', 'companyDomain'],
      optionalCredentials: [],
      supportedFeatures: ['filtering', 'batch'],
      icon: '🎯'
    },
    {
      id: 'webex',
      name: 'Webex',
      description: 'Extract narratives from Webex meetings and conversations',
      requiredCredentials: ['accessToken'],
      optionalCredentials: ['refreshToken', 'clientId', 'clientSecret'],
      supportedFeatures: ['transcripts', 'chat', 'recordings', 'real-time'],
      icon: '🎥'
    }
  ];
}

/**
 * Validate integration configuration
 */
function validateIntegrationConfig(type, config) {
  const integrations = getAvailableIntegrations();
  const integration = integrations.find(i => i.id === type.toLowerCase());

  if (!integration) {
    return {
      valid: false,
      errors: [`Unknown integration type: ${type}`]
    };
  }

  const errors = [];

  // Check required credentials
  for (const cred of integration.requiredCredentials) {
    if (!config[cred] && !process.env[getEnvVarName(type, cred)]) {
      errors.push(`Missing required credential: ${cred}`);
    }
  }

  // Check at least one optional credential if no required ones
  if (integration.requiredCredentials.length === 0 &&
      integration.optionalCredentials.length > 0) {
    const hasOptional = integration.optionalCredentials.some(cred =>
      config[cred] || process.env[getEnvVarName(type, cred)]
    );

    if (!hasOptional) {
      errors.push(`At least one of these credentials required: ${integration.optionalCredentials.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get environment variable name for credential
 */
function getEnvVarName(type, credential) {
  const prefix = type.toUpperCase();
  const credName = credential.replace(/([A-Z])/g, '_$1').toUpperCase();
  return `${prefix}_${credName}`;
}

/**
 * Integration API endpoints handler
 */
async function handleIntegrationRequest(pathname, method, body, store) {
  // Parse the integration type from the pathname
  // Expected format: /api/harvest/{integration_type}
  const pathParts = pathname.split('/');
  const integrationType = pathParts[pathParts.length - 1];

  // Handle different endpoints
  if (pathname === '/api/integrations' && method === 'GET') {
    // List available integrations
    return {
      success: true,
      integrations: getAvailableIntegrations()
    };
  }

  if (pathname === '/api/integrations/test' && method === 'POST') {
    // Test integration connection
    const { type, config } = body;

    // Validate configuration
    const validation = validateIntegrationConfig(type, config);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      const harvester = createHarvester(type, config);
      const result = await harvester.testConnection();
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  if (pathname.startsWith('/api/harvest/') && method === 'POST') {
    // Run harvest operation
    const { config = {}, options = {} } = body;

    // Validate configuration
    const validation = validateIntegrationConfig(integrationType, config);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      const harvester = createHarvester(integrationType, config);
      const result = await harvester.harvest(options);

      if (result.success && store) {
        // Save harvested units to store
        const filename = `harvest-${integrationType}-${Date.now()}.yml`;
        await store.saveUnits(result.units, filename, {
          source: integrationType,
          harvestDate: new Date().toISOString(),
          stats: result.stats
        });

        return {
          ...result,
          savedTo: filename
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
        errors: [error.stack]
      };
    }
  }

  if (pathname === '/api/integrations/schema' && method === 'POST') {
    // Get integration schema (for Airtable)
    const { type, config } = body;

    if (type !== 'airtable') {
      return {
        success: false,
        message: 'Schema endpoint only available for Airtable'
      };
    }

    try {
      const harvester = createHarvester(type, config);
      await harvester.authenticate();
      const schema = await harvester.getSchema();
      return {
        success: true,
        schema
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  return {
    success: false,
    message: `Unknown endpoint: ${method} ${pathname}`
  };
}

module.exports = {
  BaseHarvester,
  AirtableHarvester,
  CRMHarvester,
  WebexHarvester,
  createHarvester,
  getAvailableIntegrations,
  validateIntegrationConfig,
  handleIntegrationRequest
};