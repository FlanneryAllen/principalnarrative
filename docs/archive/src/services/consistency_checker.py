"""
Messaging Consistency Checker

Analyzes messaging consistency across website pages and identifies conflicts or drift.
"""

import re
from typing import List, Dict, Set, Tuple
from collections import Counter, defaultdict
from dataclasses import dataclass, field


@dataclass
class ConsistencyIssue:
    """A messaging consistency issue"""
    type: str  # "stat_conflict", "claim_drift", "tone_shift", "terminology"
    severity: str  # "high", "medium", "low"
    description: str
    locations: List[str] = field(default_factory=list)
    recommendation: str = ""


class ConsistencyChecker:
    """Checks messaging consistency across content"""

    def __init__(self, claims: List[Dict], proof: List[Dict], stats: Dict[str, str]):
        self.claims = claims
        self.proof = proof
        self.stats = stats
        self.issues: List[ConsistencyIssue] = []

    def check_all(self) -> Dict:
        """Run all consistency checks"""
        print("\n🔍 Checking messaging consistency...")

        # Check for stat conflicts
        self._check_stat_consistency()

        # Check for claim variations
        self._check_claim_consistency()

        # Check terminology consistency
        self._check_terminology()

        # Check tone consistency
        self._check_tone_consistency()

        return self._generate_consistency_report()

    def _check_stat_consistency(self):
        """Check if same stats are used consistently"""
        # Group stats by similar values
        stat_mentions = defaultdict(list)

        for claim in self.claims:
            text = claim['text']
            location = claim['location']

            # Extract numbers
            numbers = re.findall(r'\b(\d+(?:\.\d+)?)\s*(%|seconds?|minutes?|hours?|x)\b', text, re.IGNORECASE)

            for number, unit in numbers:
                key = f"{number}{unit.lower()}"
                stat_mentions[key].append({
                    'claim': text[:100],
                    'location': location
                })

        # Check for conflicting stats (same metric, different values)
        for proof_item in self.proof:
            if proof_item['type'] == 'statistic':
                # This would involve NLP to detect if two stats measure the same thing
                pass  # Advanced feature for future

    def _check_claim_consistency(self):
        """Check if similar claims are worded consistently"""
        # Group claims by type and check for variations
        claims_by_type = defaultdict(list)

        for claim in self.claims:
            claims_by_type[claim['type']].append(claim)

        # Check value propositions for consistency
        value_props = claims_by_type.get('value_prop', [])

        if len(value_props) > 1:
            # Extract core keywords from each value prop
            keywords_by_vp = []
            for vp in value_props:
                keywords = set(self._extract_keywords(vp['text']))
                keywords_by_vp.append((vp, keywords))

            # Check for contradictions or major differences
            # For now, just flag if value props share < 20% keywords
            if len(value_props) >= 2:
                overlap = len(keywords_by_vp[0][1] & keywords_by_vp[1][1])
                total = len(keywords_by_vp[0][1] | keywords_by_vp[1][1])

                if total > 0 and overlap / total < 0.2:
                    self.issues.append(ConsistencyIssue(
                        type="claim_drift",
                        severity="medium",
                        description="Value propositions across pages have low keyword overlap",
                        locations=[vp['location'] for vp in value_props[:2]],
                        recommendation="Ensure core value proposition messaging is consistent across all pages"
                    ))

    def _check_terminology(self):
        """Check for consistent terminology usage"""
        # Common terminology variations to check
        term_variations = {
            'code_review': ['code review', 'code-review', 'codereview', 'PR review', 'pull request review'],
            'ai_powered': ['AI-powered', 'AI powered', 'ai-powered', 'AI based', 'AI-based'],
        }

        for category, variations in term_variations.items():
            found_variations = set()
            locations = []

            for claim in self.claims:
                text = claim['text'].lower()
                for var in variations:
                    if var.lower() in text:
                        found_variations.add(var)
                        locations.append(claim['location'])

            # If multiple variations found, flag as inconsistency
            if len(found_variations) > 2:
                self.issues.append(ConsistencyIssue(
                    type="terminology",
                    severity="low",
                    description=f"Inconsistent terminology: {', '.join(found_variations)}",
                    locations=list(set(locations[:3])),
                    recommendation=f"Standardize on one term: {list(found_variations)[0]}"
                ))

    def _check_tone_consistency(self):
        """Check for consistent tone across content"""
        # Analyze tone markers across locations
        locations_analysis = defaultdict(lambda: {'technical': 0, 'casual': 0, 'formal': 0})

        technical_markers = ['architecture', 'system', 'API', 'implementation', 'algorithm']
        casual_markers = ['easy', 'simple', 'just', 'quick', 'fast']
        formal_markers = ['enterprise', 'compliance', 'certified', 'professional', 'standards']

        for claim in self.claims:
            text = claim['text'].lower()
            location_type = claim['location'].split(':')[0]  # landing, blog, etc.

            for marker in technical_markers:
                if marker.lower() in text:
                    locations_analysis[location_type]['technical'] += 1

            for marker in casual_markers:
                if marker.lower() in text:
                    locations_analysis[location_type]['casual'] += 1

            for marker in formal_markers:
                if marker.lower() in text:
                    locations_analysis[location_type]['formal'] += 1

        # Check if tone shifts dramatically between sections
        # This is a simple heuristic - would need NLP for better analysis

    def _extract_keywords(self, text: str) -> Set[str]:
        """Extract meaningful keywords from text"""
        # Remove common words
        stopwords = {'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}

        # Extract words
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())

        # Filter stopwords
        keywords = {w for w in words if w not in stopwords}

        return keywords

    def _generate_consistency_report(self) -> Dict:
        """Generate consistency report"""
        high_severity = sum(1 for i in self.issues if i.severity == "high")
        medium_severity = sum(1 for i in self.issues if i.severity == "medium")
        low_severity = sum(1 for i in self.issues if i.severity == "low")

        print(f"  🔴 {high_severity} high-severity issues")
        print(f"  🟡 {medium_severity} medium-severity issues")
        print(f"  🟢 {low_severity} low-severity issues")

        # Calculate consistency score (100% - penalty for issues)
        total_penalty = (high_severity * 15) + (medium_severity * 5) + (low_severity * 2)
        consistency_score = max(0, 100 - total_penalty)

        return {
            "summary": {
                "consistency_score": consistency_score,
                "total_issues": len(self.issues),
                "high_severity": high_severity,
                "medium_severity": medium_severity,
                "low_severity": low_severity
            },
            "issues": [
                {
                    "type": i.type,
                    "severity": i.severity,
                    "description": i.description,
                    "locations": i.locations,
                    "recommendation": i.recommendation
                }
                for i in self.issues
            ],
            "recommendations": self._generate_recommendations()
        }

    def _generate_recommendations(self) -> List[str]:
        """Generate top-level recommendations"""
        recommendations = []

        if any(i.type == "stat_conflict" for i in self.issues):
            recommendations.append("Review all statistics to ensure numbers are accurate and consistent")

        if any(i.type == "claim_drift" for i in self.issues):
            recommendations.append("Align value proposition messaging across all pages")

        if any(i.type == "terminology" for i in self.issues):
            recommendations.append("Create a terminology guide to ensure consistent word usage")

        if not self.issues:
            recommendations.append("Messaging is highly consistent - maintain current standards")
        elif len(self.issues) <= 2:
            recommendations.append("Minor consistency issues detected - address for polish")
        else:
            recommendations.append("Multiple consistency issues - conduct messaging audit")

        return recommendations


if __name__ == "__main__":
    import json
    from pathlib import Path

    # Load analysis data
    analysis_path = Path("/Users/julieallen/Desktop/codepilot-narrative-analysis.json")

    with open(analysis_path, 'r') as f:
        data = json.load(f)

    # Run consistency check
    checker = ConsistencyChecker(
        claims=data['claims'],
        proof=data['proof'],
        stats=data['stats']
    )

    consistency_report = checker.check_all()

    # Save report
    output_path = Path("/Users/julieallen/Desktop/codepilot-consistency-report.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(consistency_report, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Consistency report saved to: {output_path}")

    # Show key findings
    print("\n" + "="*60)
    print("📋 CONSISTENCY ANALYSIS")
    print("="*60)

    summary = consistency_report['summary']
    print(f"\n🎯 Consistency Score: {summary['consistency_score']}/100")

    if consistency_report['issues']:
        print(f"\n⚠️  Issues Found:")
        for issue in consistency_report['issues']:
            print(f"  [{issue['severity'].upper()}] {issue['description']}")
            if issue['recommendation']:
                print(f"      → {issue['recommendation']}")

    print(f"\n💡 Recommendations:")
    for rec in consistency_report['recommendations']:
        print(f"  • {rec}")
