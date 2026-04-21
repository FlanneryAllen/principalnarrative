/**
 * Integration Tests
 * Test suite for harvest integrations
 */

const {
  createHarvester,
  getAvailableIntegrations,
  validateIntegrationConfig
} = require('./index');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

/**
 * Test configuration validation
 */
async function testConfigValidation() {
  console.log(`${colors.blue}Testing configuration validation...${colors.reset}`);

  const tests = [
    {
      name: 'Valid Airtable config',
      type: 'airtable',
      config: { apiKey: 'test_key', baseId: 'test_base' },
      expectValid: true
    },
    {
      name: 'Invalid Airtable config (missing baseId)',
      type: 'airtable',
      config: { apiKey: 'test_key' },
      expectValid: false
    },
    {
      name: 'Valid Salesforce config',
      type: 'salesforce',
      config: {
        instanceUrl: 'https://test.salesforce.com',
        clientId: 'test_client',
        clientSecret: 'test_secret',
        username: 'test_user',
        password: 'test_pass'
      },
      expectValid: true
    },
    {
      name: 'Valid HubSpot config with API key',
      type: 'hubspot',
      config: { apiKey: 'test_key' },
      expectValid: true
    },
    {
      name: 'Invalid HubSpot config (no credentials)',
      type: 'hubspot',
      config: {},
      expectValid: false
    },
    {
      name: 'Valid Webex config',
      type: 'webex',
      config: { accessToken: 'test_token' },
      expectValid: true
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = validateIntegrationConfig(test.type, test.config);

    if (result.valid === test.expectValid) {
      console.log(`  ${colors.green}✓${colors.reset} ${test.name}`);
      passed++;
    } else {
      console.log(`  ${colors.red}✗${colors.reset} ${test.name}`);
      console.log(`    Expected: ${test.expectValid}, Got: ${result.valid}`);
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.join(', ')}`);
      }
      failed++;
    }
  }

  console.log(`\nValidation tests: ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : ''}${failed} failed${colors.reset}\n`);
  return failed === 0;
}

/**
 * Test harvester creation
 */
async function testHarvesterCreation() {
  console.log(`${colors.blue}Testing harvester creation...${colors.reset}`);

  const types = ['airtable', 'salesforce', 'hubspot', 'pipedrive', 'webex'];
  let passed = 0;
  let failed = 0;

  for (const type of types) {
    try {
      const harvester = createHarvester(type);
      console.log(`  ${colors.green}✓${colors.reset} Created ${type} harvester`);
      passed++;
    } catch (error) {
      console.log(`  ${colors.red}✗${colors.reset} Failed to create ${type} harvester: ${error.message}`);
      failed++;
    }
  }

  // Test invalid type
  try {
    createHarvester('invalid_type');
    console.log(`  ${colors.red}✗${colors.reset} Should have thrown error for invalid type`);
    failed++;
  } catch (error) {
    console.log(`  ${colors.green}✓${colors.reset} Correctly rejected invalid type`);
    passed++;
  }

  console.log(`\nCreation tests: ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : ''}${failed} failed${colors.reset}\n`);
  return failed === 0;
}

/**
 * Test mock harvest operation
 */
async function testMockHarvest() {
  console.log(`${colors.blue}Testing mock harvest operation...${colors.reset}`);

  // Create a mock harvester with test data
  const MockHarvester = class extends require('./base-harvester') {
    async authenticate() {
      return true;
    }

    async fetchData(options) {
      return [
        { id: 1, text: 'Our mission is to revolutionize how teams collaborate.' },
        { id: 2, text: 'We are launching a new product feature next quarter.' },
        { id: 3, text: 'Customer feedback shows 90% satisfaction with our service.' }
      ];
    }

    async transformData(rawData) {
      return rawData.map(item => ({
        text: item.text,
        source: `mock:${item.id}`,
        sourceType: 'test_document',
        metadata: { id: item.id }
      }));
    }
  };

  try {
    const harvester = new MockHarvester();
    const result = await harvester.harvest();

    if (result.success && result.units.length > 0) {
      console.log(`  ${colors.green}✓${colors.reset} Mock harvest completed successfully`);
      console.log(`    - Records fetched: ${result.stats.recordsFetched}`);
      console.log(`    - Units extracted: ${result.stats.unitsExtracted}`);
      console.log(`    - API calls made: ${result.stats.apiCalls}`);
      return true;
    } else {
      console.log(`  ${colors.red}✗${colors.reset} Mock harvest failed`);
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.map(e => e.error).join(', ')}`);
      }
      return false;
    }
  } catch (error) {
    console.log(`  ${colors.red}✗${colors.reset} Mock harvest threw error: ${error.message}`);
    return false;
  }
}

/**
 * Test integration listing
 */
async function testIntegrationListing() {
  console.log(`${colors.blue}Testing integration listing...${colors.reset}`);

  const integrations = getAvailableIntegrations();

  if (integrations.length === 5) {
    console.log(`  ${colors.green}✓${colors.reset} Found all 5 integrations`);

    for (const integration of integrations) {
      console.log(`    - ${integration.icon} ${integration.name}: ${integration.description}`);
    }
    return true;
  } else {
    console.log(`  ${colors.red}✗${colors.reset} Expected 5 integrations, found ${integrations.length}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`\n${colors.yellow}=== Running Integration Tests ===${colors.reset}\n`);

  const results = [];

  // Run all test suites
  results.push(await testConfigValidation());
  results.push(await testHarvesterCreation());
  results.push(await testMockHarvest());
  results.push(await testIntegrationListing());

  // Summary
  const allPassed = results.every(r => r === true);

  console.log(`\n${colors.yellow}=== Test Summary ===${colors.reset}`);
  if (allPassed) {
    console.log(`${colors.green}All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}Some tests failed.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error(`${colors.red}Test runner error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { runTests };