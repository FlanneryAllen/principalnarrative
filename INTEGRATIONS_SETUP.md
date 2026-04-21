# Harvest Integrations Setup Guide

## Overview

The Harvest Integrations extend StoryMining capabilities beyond URL harvesting to extract narrative units from organizational data sources including Airtable, CRM systems (Salesforce, HubSpot, Pipedrive), and collaboration platforms (Webex).

## Quick Start

### 1. Environment Setup

Create or update your `.env` file with the necessary credentials for your integrations:

```bash
# Airtable
AIRTABLE_API_KEY=your_api_key_here
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Salesforce
SALESFORCE_INSTANCE_URL=https://your-instance.salesforce.com
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret
SALESFORCE_USERNAME=your_username
SALESFORCE_PASSWORD=your_password
SALESFORCE_SECURITY_TOKEN=your_security_token  # Optional

# HubSpot (use either API Key OR Access Token)
HUBSPOT_API_KEY=your_api_key
# OR
HUBSPOT_ACCESS_TOKEN=your_access_token

# Pipedrive
PIPEDRIVE_API_TOKEN=your_api_token
PIPEDRIVE_COMPANY_DOMAIN=your-company  # Just the subdomain part

# Webex
WEBEX_ACCESS_TOKEN=your_access_token
WEBEX_REFRESH_TOKEN=your_refresh_token  # Optional for auto-refresh
WEBEX_CLIENT_ID=your_client_id  # Optional for OAuth
WEBEX_CLIENT_SECRET=your_client_secret  # Optional for OAuth
```

### 2. Testing Your Setup

Run the integration tests to verify everything is configured correctly:

```bash
npm run test:integrations
```

### 3. Starting the Server

Start the web application with integration support:

```bash
npm run web
# OR
npm start
```

The server will be available at `http://localhost:3000`

## API Usage

### List Available Integrations

```bash
curl http://localhost:3000/api/integrations
```

Response:
```json
{
  "success": true,
  "integrations": [
    {
      "id": "airtable",
      "name": "Airtable",
      "description": "Extract narratives from Airtable bases and records",
      "requiredCredentials": ["apiKey", "baseId"],
      "supportedFeatures": ["schema", "filtering", "batch"],
      "icon": "📊"
    },
    // ... other integrations
  ]
}
```

### Test Integration Connection

```bash
curl -X POST http://localhost:3000/api/integrations/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "airtable",
    "config": {
      "apiKey": "your_api_key",
      "baseId": "your_base_id"
    }
  }'
```

### Harvest from Airtable

```bash
curl -X POST http://localhost:3000/api/harvest/airtable \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "config": {
      "apiKey": "your_api_key",
      "baseId": "your_base_id"
    },
    "options": {
      "tables": ["Product Roadmap", "Customer Feedback"],
      "fields": ["Description", "Notes", "Strategic Context"],
      "maxRecords": 100,
      "dateFilter": {
        "field": "Last Modified",
        "after": "2024-01-01"
      }
    }
  }'
```

### Harvest from Salesforce

```bash
curl -X POST http://localhost:3000/api/harvest/salesforce \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "config": {
      "instanceUrl": "https://your-instance.salesforce.com",
      "clientId": "your_client_id",
      "clientSecret": "your_client_secret",
      "username": "your_username",
      "password": "your_password"
    },
    "options": {
      "objects": ["Opportunity", "Account"],
      "fields": ["Description", "Next_Steps__c", "Executive_Summary__c"],
      "filters": {
        "Stage": ["Negotiation", "Closed Won"],
        "Amount": { "gt": 100000 }
      },
      "limit": 500
    }
  }'
```

### Harvest from HubSpot

```bash
curl -X POST http://localhost:3000/api/harvest/hubspot \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "config": {
      "apiKey": "your_api_key"
    },
    "options": {
      "objects": ["Deal", "Company", "Contact"],
      "fields": ["description", "notes"],
      "limit": 200
    }
  }'
```

### Harvest from Webex

```bash
curl -X POST http://localhost:3000/api/harvest/webex \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "config": {
      "accessToken": "your_access_token"
    },
    "options": {
      "roomId": "Y2lzY29zcGFyazovL3VzL1JPT00vXXXXXXXX",
      "dateRange": {
        "start": "2024-01-01",
        "end": "2024-12-31"
      },
      "includeTranscripts": true,
      "includeChat": true,
      "maxMessages": 500
    }
  }'
```

## Getting API Credentials

### Airtable

1. Go to [Airtable Account Settings](https://airtable.com/account)
2. Click on "API" in the left sidebar
3. Under "Personal access tokens", click "Create new token"
4. Give your token a name and select the scopes:
   - `data.records:read` - Read records
   - `schema.bases:read` - Read base schema
5. Add your specific bases to the token's access list
6. Copy the generated token (starts with `pat...`)
7. Find your Base ID by going to your base and checking the URL: `airtable.com/appXXXXXXXXXXXXXX`

### Salesforce

1. Create a Connected App:
   - Go to Setup → Apps → App Manager
   - Click "New Connected App"
   - Enable OAuth Settings
   - Add OAuth Scopes: `api`, `refresh_token`
   - Save and note the Client ID and Client Secret

2. Get your Security Token:
   - Go to Settings → Personal → Reset My Security Token
   - Check your email for the new token

3. Your instance URL is your Salesforce domain (e.g., `https://mycompany.my.salesforce.com`)

### HubSpot

**Option 1: API Key (Simple)**
1. Go to Settings → Integrations → API Key
2. Generate or copy your API key

**Option 2: Private App (Recommended)**
1. Go to Settings → Integrations → Private Apps
2. Create a new private app
3. Set required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.companies.read`
   - `crm.objects.deals.read`
4. Copy the access token

### Pipedrive

1. Go to Settings → Personal → API
2. Copy your personal API token
3. Note your company domain from the URL: `https://YOUR-COMPANY.pipedrive.com`

### Webex

1. Go to [Webex Developer Portal](https://developer.webex.com)
2. Create a new integration or bot
3. For OAuth integrations:
   - Note the Client ID and Client Secret
   - Set redirect URI to `http://localhost:3000/auth/webex/callback`
4. For personal access token:
   - Go to Getting Started → Your Personal Access Token
   - Copy the token (valid for 12 hours for testing)

## Architecture

### Components

```
packages/serve/integrations/
├── README.md                 # Integration documentation
├── index.js                  # Main module exports
├── base-harvester.js        # Abstract base class
├── airtable-harvester.js    # Airtable implementation
├── crm-harvester.js         # Multi-CRM implementation
├── webex-harvester.js       # Webex implementation
└── test-integrations.js     # Test suite

packages/serve/
├── integration-routes.js    # HTTP route handlers
└── web-app.js              # Main server (updated with routes)
```

### Data Flow

1. **Authentication** - Validate API credentials
2. **Fetch** - Retrieve data from external API
3. **Transform** - Convert to standard format
4. **Extract** - Mine narrative units using StoryMining
5. **Enrich** - Add metadata and context
6. **Store** - Save to narrative repository
7. **Analyze** - Run algebra metrics

### Extending the Framework

To add a new integration:

1. Create a new harvester class:

```javascript
// packages/serve/integrations/custom-harvester.js
const BaseHarvester = require('./base-harvester');

class CustomHarvester extends BaseHarvester {
  async authenticate() {
    // Implement authentication
  }

  async fetchData(options) {
    // Implement data fetching
  }

  async transformData(rawData) {
    // Transform to standard format
  }
}

module.exports = CustomHarvester;
```

2. Register in index.js:

```javascript
// Add to createHarvester function
case 'custom':
  return new CustomHarvester(config);

// Add to getAvailableIntegrations
{
  id: 'custom',
  name: 'Custom Integration',
  description: 'Your description',
  requiredCredentials: ['apiKey'],
  supportedFeatures: ['feature1', 'feature2'],
  icon: '🔧'
}
```

3. Test your integration:

```bash
npm run test:integrations
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify credentials in .env file
   - Check API token expiration
   - Ensure proper scopes/permissions

2. **Rate Limiting**
   - Integrations respect platform rate limits
   - Automatic retry with exponential backoff
   - Check platform-specific limits in documentation

3. **Empty Results**
   - Verify data exists in source system
   - Check date filters and field names
   - Review filter criteria

4. **Connection Timeouts**
   - Check network connectivity
   - Verify API endpoint URLs
   - Try smaller batch sizes

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=integrations npm run web
```

### Support

For issues or questions:
1. Check the integration test output: `npm run test:integrations`
2. Review server logs for detailed error messages
3. Consult platform-specific API documentation
4. File an issue on the project repository

## Security Best Practices

1. **Never commit credentials** - Always use environment variables
2. **Use minimal scopes** - Only request necessary permissions
3. **Rotate tokens regularly** - Update credentials periodically
4. **Monitor usage** - Track API calls and data access
5. **Encrypt sensitive data** - Use HTTPS for all API calls
6. **Audit access logs** - Review integration activity

## Performance Optimization

1. **Batch Operations** - Process multiple records together
2. **Caching** - Reuse authenticated sessions
3. **Pagination** - Handle large datasets incrementally
4. **Filtering** - Fetch only necessary data
5. **Concurrent Requests** - Parallelize independent operations
6. **Rate Limit Management** - Respect platform limits

## Next Steps

1. Configure your integrations in `.env`
2. Test connections with `npm run test:integrations`
3. Start harvesting narrative units from your data sources
4. Monitor extraction quality and adjust filters as needed
5. Set up scheduled harvests for continuous updates
6. Integrate with your CI/CD pipeline for automated checks