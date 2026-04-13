/**
 * Test Story Signal to Intent Unit conversion
 */

const { StorySignalMiner } = require('./dist/story-signal');
const fs = require('fs');

async function test() {
  // Clean up test DB
  const testDbPath = '/tmp/test-signal.db';
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const miner = new StorySignalMiner(testDbPath, {
    autoConvertThreshold: 85,
    requireReview: false, // Auto-convert for testing
  });

  console.log('🧪 Testing Story Signal → Intent Unit conversion\n');

  // Test 1: Capture a high-value story signal
  console.log('1️⃣ Capturing high-value story (score > 85)...');
  const highValueStory = {
    story: 'We need to be the most trusted healthcare infrastructure provider, focusing on patient data security above all else',
    source: 'slack://leadership-channel',
    dimensions: {
      resonance: 18,    // Very emotionally compelling
      relevance: 20,    // Extremely relevant to strategy
      rarity: 15,       // Somewhat unique positioning
      relatability: 17, // Stakeholders understand this well
      riskReward: 19,   // High potential impact
    },
    tags: ['healthcare', 'security', 'trust'],
    context: {
      speaker: 'ceo',
      channel: 'leadership',
      timestamp: '2026-04-11T10:00:00Z',
    },
  };

  const score1 = miner.calculateScore(highValueStory.dimensions);
  console.log(`   📊 Score: ${score1}/100`);

  const result1 = await miner.processSignal(highValueStory);
  console.log(`   ✅ Converted: ${result1.shouldConvert}`);
  if (result1.intentUnit) {
    console.log(`   📝 Intent Unit ID: ${result1.intentUnit.id}`);
    console.log(`   🎯 Assertion: ${result1.intentUnit.assertion}`);
    console.log(`   🔒 Type: ${result1.intentUnit.type}`);
  }

  // Test 2: Capture a low-value story signal
  console.log('\n2️⃣ Capturing low-value story (score < 85)...');
  const lowValueStory = {
    story: 'Someone mentioned we should update the logo color',
    source: 'slack://random',
    dimensions: {
      resonance: 5,     // Not very compelling
      relevance: 8,     // Somewhat relevant
      rarity: 10,       // Fairly common suggestion
      relatability: 12, // Easy to understand
      riskReward: 6,    // Low impact
    },
    tags: ['branding'],
  };

  const score2 = miner.calculateScore(lowValueStory.dimensions);
  console.log(`   📊 Score: ${score2}/100`);

  const result2 = await miner.processSignal(lowValueStory);
  console.log(`   ✅ Converted: ${result2.shouldConvert}`);

  // Test 3: Manual conversion with custom options
  console.log('\n3️⃣ Manual conversion with custom options...');
  const manualStory = {
    story: 'All authentication must use OAuth 2.0 with multi-factor authentication',
    source: 'meeting://security-review',
    dimensions: {
      resonance: 16,
      relevance: 19,
      rarity: 12,
      relatability: 15,
      riskReward: 18,
    },
    tags: ['security', 'authentication'],
  };

  const intentUnit = await miner.convertToIntentUnit(manualStory, {
    id: 'operational_auth_oauth',
    type: 'operational',
    assertion: 'All authentication must use OAuth 2.0 with MFA',
    objective: 'Implement secure, modern authentication',
    constraints: {
      code: {
        required_libraries: ['passport', '@auth0/auth0-react'],
        required_patterns: ['mfa', 'oauth2'],
        forbidden_patterns: ['basic_auth'],
      },
    },
  });

  console.log(`   ✅ Created: ${intentUnit.id}`);
  console.log(`   📝 Assertion: ${intentUnit.assertion}`);
  console.log(`   🎯 Objective: ${intentUnit.intent.objective}`);
  console.log(`   🔒 Constraints: ${JSON.stringify(intentUnit.intent.constraints, null, 2)}`);

  // Test 4: Signal statistics
  console.log('\n4️⃣ Signal statistics...');
  const stats = miner.getSignalStats();
  console.log(`   📊 Total converted: ${stats.totalConverted}`);
  console.log(`   📊 Average score: ${stats.averageScore.toFixed(2)}`);
  console.log(`   📊 Highest score: ${stats.highestScore}`);
  console.log(`   📊 Lowest score: ${stats.lowestScore}`);

  // Test 5: Get all converted signals
  console.log('\n5️⃣ Listing all converted signals...');
  const converted = miner.getConvertedSignals();
  console.log(`   📋 Total: ${converted.length} signals`);
  converted.forEach(unit => {
    console.log(`      - ${unit.id} (score: ${unit.signal?.score}, type: ${unit.type})`);
  });

  miner.close();
  console.log('\n✅ All tests passed!\n');
}

test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
