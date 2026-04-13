#!/bin/bash
# Test the Principal Narrative API endpoints
# Run this after starting the API with ./run.sh

BASE_URL="http://localhost:8000"

echo "====================================="
echo "Principal Narrative API Test Suite"
echo "====================================="
echo ""

# Health check
echo "1. Health Check"
echo "---------------"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

# Query all messaging units
echo "2. Query Messaging Units"
echo "------------------------"
curl -s "$BASE_URL/context/query?type=messaging" | python3 -m json.tool
echo ""

# Get proof metrics
echo "3. Get Verified Proof Metrics"
echo "-----------------------------"
curl -s "$BASE_URL/proof/metrics?verified_only=true" | python3 -m json.tool
echo ""

# Validate a GOOD claim
echo "4. Validate Good Claim (should pass)"
echo "-------------------------------------"
curl -s -X POST "$BASE_URL/context/validate" \
  -H "Content-Type: application/json" \
  -d '{"claim": "CodePilot delivers reviews in 47 seconds", "require_proof": true}' \
  | python3 -m json.tool
echo ""

# Validate a BAD claim (forbidden term)
echo "5. Validate Bad Claim - Forbidden Term"
echo "---------------------------------------"
curl -s -X POST "$BASE_URL/context/validate" \
  -H "Content-Type: application/json" \
  -d '{"claim": "CodePilot is a revolutionary AI bot that replaces developers", "require_proof": false}' \
  | python3 -m json.tool
echo ""

# Validate a BAD claim (unproven metric)
echo "6. Validate Bad Claim - Unproven Metric"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/context/validate" \
  -H "Content-Type: application/json" \
  -d '{"claim": "CodePilot is 10x faster than competitors", "require_proof": true}' \
  | python3 -m json.tool
echo ""

# Get coherence score
echo "7. Get Coherence Score"
echo "----------------------"
curl -s "$BASE_URL/coherence/score" | python3 -m json.tool
echo ""

# Get open drift events
echo "8. Get Open Drift Events"
echo "------------------------"
curl -s "$BASE_URL/coherence/drift?status=open" | python3 -m json.tool
echo ""

# Check naming
echo "9. Check Naming Violations"
echo "--------------------------"
curl -s "$BASE_URL/naming/check?text=Our%20Code%20Pilot%20bot%20is%20revolutionary" | python3 -m json.tool
echo ""

# Get features
echo "10. Get Shipped Features"
echo "------------------------"
curl -s "$BASE_URL/features?status=shipped" | python3 -m json.tool
echo ""

echo "====================================="
echo "Test Complete!"
echo "====================================="
echo ""
echo "Try the interactive docs at: $BASE_URL/docs"
