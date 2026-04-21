# Harvest Integrations Framework

## Overview
The Harvest Integrations extend StoryMining beyond URL harvest to extract narrative units from organizational data sources like Airtable, CRM systems, and collaboration platforms.

## Architecture

### Core Components

1. **Base Harvester Class** (`base-harvester.js`)
   - Abstract interface for all harvesters
   - Standardized data extraction pipeline
   - Rate limiting and error handling
   - Batch processing support

2. **Integration Adapters**
   - `airtable-harvester.js` - Airtable bases and records
   - `crm-harvester.js` - Salesforce, HubSpot, Pipedrive
   - `webex-harvester.js` - Webex meeting transcripts and chat
   - `slack-harvester.js` - Slack conversations and threads

3. **Data Transformers**
   - Convert platform-specific formats to narrative units
   - Extract metadata (author, timestamp, context)
   - Handle attachments and rich content

## Integration Points

### 1. Airtable Integration
**Use Cases:**
- Product roadmap narratives
- Customer feedback mining
- Strategic initiative tracking
- Team updates and reports

**Data Sources:**
- Base records with long-text fields
- Comments and attachments
- Form submissions
- View descriptions

### 2. CRM Integration
**Use Cases:**
- Sales narrative extraction
- Customer success stories
- Deal progression narratives
- Account planning documents

**Data Sources:**
- Opportunity descriptions
- Account notes
- Activity logs
- Email threads
- Call transcripts

### 3. Webex Integration
**Use Cases:**
- Meeting transcript mining
- Decision documentation
- Action item extraction
- Strategic discussion capture

**Data Sources:**
- Meeting recordings (transcribed)
- Chat messages
- Shared documents
- Whiteboard sessions

## Configuration

Each integration requires specific credentials in `.env`:

```env
# Airtable
AIRTABLE_API_KEY=your_api_key
AIRTABLE_BASE_ID=your_base_id

# Salesforce
SALESFORCE_INSTANCE_URL=https://your-instance.salesforce.com
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret
SALESFORCE_USERNAME=your_username
SALESFORCE_PASSWORD=your_password
SALESFORCE_SECURITY_TOKEN=your_token

# HubSpot
HUBSPOT_API_KEY=your_api_key

# Webex
WEBEX_ACCESS_TOKEN=your_access_token
WEBEX_REFRESH_TOKEN=your_refresh_token
WEBEX_CLIENT_ID=your_client_id
WEBEX_CLIENT_SECRET=your_client_secret

# Slack
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your_signing_secret
```

## API Endpoints

New endpoints added to `web-app.js`:

### Harvest Endpoints
- `POST /api/harvest/airtable` - Harvest from Airtable base
- `POST /api/harvest/crm` - Harvest from CRM
- `POST /api/harvest/webex` - Harvest from Webex
- `POST /api/harvest/slack` - Harvest from Slack

### Configuration Endpoints
- `GET /api/integrations` - List available integrations
- `POST /api/integrations/test` - Test integration connection
- `GET /api/integrations/schema` - Get data schema for integration

## Usage Examples

### Airtable Harvest
```javascript
POST /api/harvest/airtable
{
  "baseId": "appXXXXXXXXXXXXXX",
  "tables": ["Product Roadmap", "Customer Feedback"],
  "fields": ["Description", "Notes", "Strategic Context"],
  "dateFilter": {
    "field": "Last Modified",
    "after": "2024-01-01"
  }
}
```

### CRM Harvest
```javascript
POST /api/harvest/crm
{
  "platform": "salesforce",
  "objects": ["Opportunity", "Account"],
  "fields": ["Description", "Next Steps", "Executive Summary"],
  "filters": {
    "Stage": ["Negotiation", "Closed Won"],
    "Amount": { "gt": 100000 }
  }
}
```

### Webex Harvest
```javascript
POST /api/harvest/webex
{
  "roomId": "Y2lzY29zcGFyazovL3VzL1JPT00vXXXXXXXX",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "includeTranscripts": true,
  "includeChat": true
}
```

## Data Flow

1. **Authentication** - Validate API credentials
2. **Fetch** - Retrieve data from platform API
3. **Transform** - Convert to intermediate format
4. **Extract** - Mine narrative units using StoryMining
5. **Enrich** - Add metadata and context
6. **Store** - Save to narrative repository
7. **Analyze** - Run algebra metrics

## Rate Limiting

Each integration respects platform-specific rate limits:
- Airtable: 5 requests/second
- Salesforce: 100,000 API calls/day
- HubSpot: 100 requests/10 seconds
- Webex: 600 requests/minute
- Slack: 50+ requests/minute (varies by method)

## Error Handling

- Automatic retry with exponential backoff
- Graceful degradation on API failures
- Detailed error logging
- Partial success handling for batch operations

## Security Considerations

- All credentials stored as environment variables
- OAuth 2.0 preferred where available
- Token refresh automation
- Minimal permission scopes requested
- Data encryption in transit
- No sensitive data logged

## Extensibility

To add a new integration:

1. Create harvester class extending `BaseHarvester`
2. Implement required methods:
   - `authenticate()`
   - `fetchData(options)`
   - `transformData(rawData)`
   - `extractUnits(data)`
3. Add configuration schema
4. Register endpoints in web-app.js
5. Update documentation

## Testing

Run integration tests:
```bash
npm run test:integrations
```

Test individual harvesters:
```bash
npm run test:harvester -- --integration=airtable
```

## Monitoring

Integration metrics tracked:
- Total records harvested
- Narrative units extracted
- API calls made
- Error rates
- Processing time
- Data volume

Access metrics at `/api/integrations/metrics`