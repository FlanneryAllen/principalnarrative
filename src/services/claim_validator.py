"""
Claim-to-Proof Validator

Validates that claims are backed by evidence and identifies unsupported claims.
"""

import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from difflib import SequenceMatcher


@dataclass
class ClaimValidation:
    """Validation result for a claim"""
    claim_text: str
    claim_type: str
    has_proof: bool
    proof_sources: List[str] = field(default_factory=list)
    confidence: float = 0.0
    recommendation: str = ""


class ClaimValidator:
    """Validates claims against proof points"""

    def __init__(self, claims: List[Dict], proof: List[Dict], stats: Dict[str, str]):
        self.claims = claims
        self.proof = proof
        self.stats = stats
        self.validations: List[ClaimValidation] = []

    def validate_all(self) -> Dict:
        """Validate all claims against available proof"""
        print("\n🔍 Validating claims against proof points...")

        for claim in self.claims:
            validation = self._validate_claim(claim)
            self.validations.append(validation)

        return self._generate_validation_report()

    def _validate_claim(self, claim: Dict) -> ClaimValidation:
        """Validate a single claim"""
        claim_text = claim['text'].lower()
        claim_type = claim['type']

        # Find matching proof
        proof_sources = []
        confidence = 0.0

        # Check for stats mentioned in claim
        for stat, context in self.stats.items():
            if stat.lower() in claim_text or self._find_stat_mention(claim_text, stat):
                proof_sources.append(f"Stat: {stat}")
                confidence = max(confidence, 0.9)

        # Check for testimonial backing
        for p in self.proof:
            if p['type'] == 'testimonial':
                similarity = self._text_similarity(claim_text, p['text'].lower())
                if similarity > 0.3:  # Some overlap
                    proof_sources.append(f"Testimonial: {p.get('source', 'Unknown')}")
                    confidence = max(confidence, 0.6)

        # Check for case study backing
        for p in self.proof:
            if p['type'] in ['case_study', 'statistic']:
                similarity = self._text_similarity(claim_text, p['text'].lower())
                if similarity > 0.2:
                    proof_sources.append(f"{p['type'].title()}: {p['location']}")
                    confidence = max(confidence, 0.7)

        # Generate recommendation
        recommendation = self._generate_recommendation(claim_type, bool(proof_sources), confidence)

        return ClaimValidation(
            claim_text=claim['text'],
            claim_type=claim_type,
            has_proof=bool(proof_sources),
            proof_sources=proof_sources,
            confidence=confidence,
            recommendation=recommendation
        )

    def _find_stat_mention(self, text: str, stat: str) -> bool:
        """Check if a stat is mentioned in different forms"""
        # Handle different formats: "47 seconds", "47s", "47-second"
        stat_clean = re.sub(r'[^\d.]', '', stat)

        # Look for number in text
        if stat_clean in text:
            return True

        # Look for written out versions
        patterns = [
            rf'\b{stat_clean}\s*(second|minute|hour|percent|%)',
            rf'\b{stat_clean}[-\s]*(second|minute|hour|percent|%)',
        ]

        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True

        return False

    def _text_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        return SequenceMatcher(None, text1, text2).ratio()

    def _generate_recommendation(self, claim_type: str, has_proof: bool, confidence: float) -> str:
        """Generate recommendation for claim"""
        if claim_type == "value_prop":
            if not has_proof:
                return "❌ Add proof: Value proposition needs supporting evidence (customer quote, stat, or case study)"
            elif confidence < 0.5:
                return "⚠️ Weak proof: Consider adding stronger evidence (specific metrics or customer testimonials)"
            else:
                return "✅ Well-supported: Value proposition has strong backing"

        elif claim_type == "feature":
            if not has_proof:
                return "💡 Optional: Feature claims benefit from usage stats or customer feedback"
            elif confidence >= 0.7:
                return "✅ Strong evidence: Feature claim well-demonstrated"
            else:
                return "✅ Mentioned: Feature has some supporting evidence"

        else:  # Other claim types
            if not has_proof:
                return "💡 Consider: Adding specific examples or data"
            else:
                return "✅ Supported: Claim has backing evidence"

    def _generate_validation_report(self) -> Dict:
        """Generate validation report"""
        total_claims = len(self.validations)
        claims_with_proof = sum(1 for v in self.validations if v.has_proof)
        value_props_unsupported = sum(
            1 for v in self.validations
            if v.claim_type == "value_prop" and not v.has_proof
        )

        print(f"  ✅ {claims_with_proof}/{total_claims} claims have proof")
        print(f"  ⚠️  {value_props_unsupported} value propositions need evidence")

        return {
            "summary": {
                "total_claims": total_claims,
                "claims_with_proof": claims_with_proof,
                "claims_without_proof": total_claims - claims_with_proof,
                "proof_ratio": claims_with_proof / total_claims if total_claims > 0 else 0,
                "value_props_unsupported": value_props_unsupported
            },
            "validations": [
                {
                    "claim": v.claim_text[:100],
                    "type": v.claim_type,
                    "has_proof": v.has_proof,
                    "proof_count": len(v.proof_sources),
                    "proof_sources": v.proof_sources,
                    "confidence": v.confidence,
                    "recommendation": v.recommendation
                }
                for v in self.validations
            ],
            "unsupported_claims": [
                {
                    "claim": v.claim_text,
                    "type": v.claim_type,
                    "recommendation": v.recommendation
                }
                for v in self.validations
                if not v.has_proof and v.claim_type in ["value_prop", "feature"]
            ]
        }


if __name__ == "__main__":
    import json
    from pathlib import Path

    # Load analysis data
    analysis_path = Path("/Users/julieallen/Desktop/codepilot-narrative-analysis.json")

    with open(analysis_path, 'r') as f:
        data = json.load(f)

    # Run validation
    validator = ClaimValidator(
        claims=data['claims'],
        proof=data['proof'],
        stats=data['stats']
    )

    validation_report = validator.validate_all()

    # Save validation report
    output_path = Path("/Users/julieallen/Desktop/codepilot-claim-validation.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(validation_report, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Validation report saved to: {output_path}")

    # Show key findings
    print("\n" + "="*60)
    print("🔍 CLAIM VALIDATION FINDINGS")
    print("="*60)

    summary = validation_report['summary']
    print(f"\n📊 Overall: {summary['proof_ratio']:.0%} of claims have supporting evidence")

    if validation_report['unsupported_claims']:
        print(f"\n⚠️  Unsupported Claims ({len(validation_report['unsupported_claims'])}):")
        for claim in validation_report['unsupported_claims'][:5]:
            print(f"  • [{claim['type']}] {claim['claim'][:80]}")
            print(f"    → {claim['recommendation']}")
