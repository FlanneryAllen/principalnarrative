"""
AI-Powered Narrative Analyzer

Uses Claude API to provide deep narrative intelligence beyond pattern matching.
Extracts claims, identifies gaps, generates recommendations, analyzes tone, and scores value propositions.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

from .llm import get_llm_service

try:
    from .website_analyzer import WebsiteAnalyzer
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from website_analyzer import WebsiteAnalyzer


@dataclass
class AIClaim:
    """AI-extracted claim with enhanced metadata"""
    text: str
    type: str  # value_prop, feature, benefit, differentiator
    strength: float  # 0-100 score
    category: str  # product, pricing, team, etc.
    location: str
    has_proof: bool
    proof_strength: float  # 0-100
    recommendations: List[str]


@dataclass
class NarrativeGap:
    """Missing or weak narrative element"""
    gap_type: str  # missing_proof, weak_claim, tone_mismatch, etc.
    severity: str  # low, medium, high, critical
    description: str
    location: str
    recommendation: str
    impact: str


@dataclass
class ToneAnalysis:
    """Website tone and voice analysis"""
    primary_tone: str  # technical, conversational, formal, aspirational, etc.
    consistency_score: float  # 0-100
    audience: str  # technical, business, mixed
    emotion: str  # confident, cautious, bold, neutral
    variations: List[Dict[str, str]]  # Page-specific tone shifts
    recommendations: List[str]


@dataclass
class ValuePropScore:
    """Scoring for individual value proposition"""
    claim: str
    clarity_score: float  # 0-100: How clear is it?
    specificity_score: float  # 0-100: How specific?
    proof_score: float  # 0-100: How well supported?
    differentiation_score: float  # 0-100: How unique?
    overall_score: float  # 0-100: Overall strength
    strengths: List[str]
    weaknesses: List[str]
    improvement_suggestions: List[str]


@dataclass
class AIAnalysisResult:
    """Complete AI-enhanced narrative analysis"""
    ai_claims: List[AIClaim]
    narrative_gaps: List[NarrativeGap]
    tone_analysis: ToneAnalysis
    value_prop_scores: List[ValuePropScore]
    recommendations: List[str]
    overall_narrative_score: float  # 0-100
    summary: Dict[str, Any]


class AINavrativeAnalyzer:
    """AI-enhanced narrative analysis using Claude API"""

    def __init__(self, website_path: Path):
        """
        Initialize AI analyzer

        Args:
            website_path: Path to website directory or HTML file
        """
        self.website_path = Path(website_path)
        self.llm = get_llm_service()

        # Run basic analysis first
        self.base_analyzer = WebsiteAnalyzer(website_path)
        self.base_analysis = self.base_analyzer.analyze()

    def analyze(self) -> AIAnalysisResult:
        """
        Run complete AI-enhanced analysis

        Returns:
            AIAnalysisResult with all insights
        """
        if not self.llm.is_available:
            raise RuntimeError(
                "Claude API not available. Set ANTHROPIC_API_KEY environment variable."
            )

        print("🤖 Running AI-enhanced narrative analysis...")

        # Extract website content for AI analysis
        content = self._extract_content_for_ai()

        # Run AI analyses
        print("  🔍 Extracting AI-powered claims...")
        ai_claims = self._extract_ai_claims(content)

        print("  🎯 Identifying narrative gaps...")
        gaps = self._identify_narrative_gaps(content, ai_claims)

        print("  🎭 Analyzing tone and voice...")
        tone = self._analyze_tone(content)

        print("  ⭐ Scoring value propositions...")
        value_scores = self._score_value_props(ai_claims, content)

        print("  💡 Generating recommendations...")
        recommendations = self._generate_recommendations(ai_claims, gaps, tone, value_scores)

        # Calculate overall score
        overall_score = self._calculate_overall_score(ai_claims, gaps, tone, value_scores)

        # Generate summary
        summary = {
            "total_ai_claims": len(ai_claims),
            "high_strength_claims": len([c for c in ai_claims if c.strength >= 70]),
            "total_gaps": len(gaps),
            "critical_gaps": len([g for g in gaps if g.severity == "critical"]),
            "tone_consistency": tone.consistency_score,
            "avg_value_prop_score": sum(v.overall_score for v in value_scores) / len(value_scores) if value_scores else 0,
            "overall_narrative_score": overall_score
        }

        print(f"\n✅ AI Analysis complete! Overall score: {overall_score:.1f}/100")

        return AIAnalysisResult(
            ai_claims=ai_claims,
            narrative_gaps=gaps,
            tone_analysis=tone,
            value_prop_scores=value_scores,
            recommendations=recommendations,
            overall_narrative_score=overall_score,
            summary=summary
        )

    def _extract_content_for_ai(self) -> str:
        """Extract website content in format suitable for AI analysis"""
        content_parts = []

        # Add basic analysis summary
        content_parts.append("=== WEBSITE ANALYSIS ===\n")
        content_parts.append(f"Total pages analyzed: {self.base_analysis['stats']['total_pages']}\n")
        content_parts.append(f"Total claims found: {self.base_analysis['summary']['total_claims']}\n")
        content_parts.append(f"Total proof points: {self.base_analysis['summary']['total_proof']}\n\n")

        # Add claims
        content_parts.append("=== CLAIMS ===\n")
        for claim in self.base_analysis['claims'][:20]:  # Limit to avoid token overflow
            content_parts.append(f"- {claim['text']} (from {claim['location']})\n")
        content_parts.append("\n")

        # Add proof points
        content_parts.append("=== PROOF POINTS ===\n")
        for proof in self.base_analysis['proof'][:20]:
            content_parts.append(f"- [{proof['type']}] {proof['text']} (from {proof['location']})\n")
        content_parts.append("\n")

        # Add personas
        if self.base_analysis['personas']:
            content_parts.append("=== CUSTOMER PERSONAS ===\n")
            for persona in self.base_analysis['personas']:
                content_parts.append(f"- {persona['name']}, {persona['role']} at {persona['company']}\n")
                content_parts.append(f"  Quote: \"{persona['quote']}\"\n")
            content_parts.append("\n")

        return "".join(content_parts)

    def _extract_ai_claims(self, content: str) -> List[AIClaim]:
        """Use AI to extract and categorize claims with strength scoring"""

        system_prompt = """You are an expert at analyzing marketing and website messaging.

Extract ALL value propositions, claims, and benefits from the website content.

For each claim, provide:
- text: The actual claim
- type: value_prop, feature, benefit, or differentiator
- strength: 0-100 score (how compelling is this claim?)
- category: product, pricing, team, security, performance, etc.
- location: Where it appears
- has_proof: Is there supporting evidence?
- proof_strength: 0-100 (how strong is the evidence?)
- recommendations: List of ways to improve this claim

Return JSON:
{
  "claims": [
    {
      "text": "50% faster deployments",
      "type": "benefit",
      "strength": 85,
      "category": "performance",
      "location": "homepage",
      "has_proof": true,
      "proof_strength": 70,
      "recommendations": ["Add specific customer case study", "Show before/after metrics"]
    }
  ]
}"""

        user_prompt = f"""Analyze this website and extract all claims:

{content}

Return comprehensive JSON with all claims found."""

        try:
            response = self.llm.client.messages.create(
                model=self.llm.model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )

            content_text = response.content[0].text

            # Extract JSON
            if "```json" in content_text:
                content_text = content_text.split("```json")[1].split("```")[0]
            elif "```" in content_text:
                content_text = content_text.split("```")[1].split("```")[0]

            data = json.loads(content_text)

            return [AIClaim(**claim) for claim in data.get("claims", [])]

        except Exception as e:
            print(f"  ⚠️  AI claim extraction error: {e}")
            return []

    def _identify_narrative_gaps(self, content: str, ai_claims: List[AIClaim]) -> List[NarrativeGap]:
        """Identify missing or weak narrative elements"""

        system_prompt = """You are an expert at identifying gaps in marketing narratives.

Analyze the website content and identify:
- Missing proof points for claims
- Weak or vague claims
- Missing customer voices
- Tone inconsistencies
- Missing CTAs
- Unaddressed objections
- Missing social proof

For each gap, provide:
- gap_type: What's missing
- severity: low, medium, high, critical
- description: What the problem is
- location: Where it affects
- recommendation: How to fix it
- impact: Why it matters

Return JSON:
{
  "gaps": [
    {
      "gap_type": "missing_proof",
      "severity": "high",
      "description": "Claim about '50% faster' lacks supporting evidence",
      "location": "homepage hero",
      "recommendation": "Add case study or benchmark data",
      "impact": "Reduces credibility of main value prop"
    }
  ]
}"""

        claims_summary = "\n".join([f"- {c.text} (strength: {c.strength}, has_proof: {c.has_proof})" for c in ai_claims[:15]])

        user_prompt = f"""Identify narrative gaps in this website:

CONTENT:
{content}

AI-EXTRACTED CLAIMS:
{claims_summary}

Return JSON with all gaps found."""

        try:
            response = self.llm.client.messages.create(
                model=self.llm.model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )

            content_text = response.content[0].text

            if "```json" in content_text:
                content_text = content_text.split("```json")[1].split("```")[0]
            elif "```" in content_text:
                content_text = content_text.split("```")[1].split("```")[0]

            data = json.loads(content_text)

            return [NarrativeGap(**gap) for gap in data.get("gaps", [])]

        except Exception as e:
            print(f"  ⚠️  Gap identification error: {e}")
            return []

    def _analyze_tone(self, content: str) -> ToneAnalysis:
        """Analyze tone and voice consistency"""

        system_prompt = """You are an expert at analyzing brand voice and tone.

Analyze the website's tone across all pages:
- primary_tone: Overall tone (technical, conversational, formal, aspirational, bold, etc.)
- consistency_score: 0-100 (how consistent is tone across pages?)
- audience: Who is this for? (technical, business, mixed)
- emotion: Dominant emotion (confident, cautious, bold, neutral, friendly, etc.)
- variations: List page-specific tone shifts
- recommendations: How to improve tone consistency

Return JSON:
{
  "primary_tone": "conversational",
  "consistency_score": 75,
  "audience": "technical",
  "emotion": "confident",
  "variations": [
    {"page": "homepage", "tone": "bold and aspirational"},
    {"page": "pricing", "tone": "more cautious and detailed"}
  ],
  "recommendations": ["Make pricing page match homepage confidence", "Add more personality to blog posts"]
}"""

        user_prompt = f"""Analyze the tone and voice of this website:

{content}

Return JSON with complete tone analysis."""

        try:
            response = self.llm.client.messages.create(
                model=self.llm.model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )

            content_text = response.content[0].text

            if "```json" in content_text:
                content_text = content_text.split("```json")[1].split("```")[0]
            elif "```" in content_text:
                content_text = content_text.split("```")[1].split("```")[0]

            data = json.loads(content_text)

            return ToneAnalysis(**data)

        except Exception as e:
            print(f"  ⚠️  Tone analysis error: {e}")
            # Return default
            return ToneAnalysis(
                primary_tone="unknown",
                consistency_score=0,
                audience="unknown",
                emotion="unknown",
                variations=[],
                recommendations=["AI analysis unavailable"]
            )

    def _score_value_props(self, ai_claims: List[AIClaim], content: str) -> List[ValuePropScore]:
        """Score individual value propositions"""

        # Focus on main value props (high strength claims)
        value_props = [c for c in ai_claims if c.type in ["value_prop", "differentiator"] and c.strength >= 60][:10]

        if not value_props:
            return []

        system_prompt = """You are an expert at evaluating value propositions.

For each value proposition, score it on:
- clarity_score: 0-100 (Is it immediately clear what this means?)
- specificity_score: 0-100 (Is it specific or vague?)
- proof_score: 0-100 (Is there strong supporting evidence?)
- differentiation_score: 0-100 (Is it unique or generic?)
- overall_score: 0-100 (Overall strength)

Also provide:
- strengths: What's good about this claim
- weaknesses: What's weak about it
- improvement_suggestions: Specific ways to improve

Return JSON:
{
  "scores": [
    {
      "claim": "50% faster deployments",
      "clarity_score": 90,
      "specificity_score": 80,
      "proof_score": 60,
      "differentiation_score": 70,
      "overall_score": 75,
      "strengths": ["Specific percentage", "Clear benefit"],
      "weaknesses": ["Needs case study", "Compared to what?"],
      "improvement_suggestions": ["Add customer testimonial", "Specify baseline comparison"]
    }
  ]
}"""

        value_props_list = "\n".join([f"- {vp.text}" for vp in value_props])

        user_prompt = f"""Score these value propositions:

{value_props_list}

Context:
{content[:2000]}

Return JSON with scores for each."""

        try:
            response = self.llm.client.messages.create(
                model=self.llm.model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )

            content_text = response.content[0].text

            if "```json" in content_text:
                content_text = content_text.split("```json")[1].split("```")[0]
            elif "```" in content_text:
                content_text = content_text.split("```")[1].split("```")[0]

            data = json.loads(content_text)

            return [ValuePropScore(**score) for score in data.get("scores", [])]

        except Exception as e:
            print(f"  ⚠️  Value prop scoring error: {e}")
            return []

    def _generate_recommendations(
        self,
        ai_claims: List[AIClaim],
        gaps: List[NarrativeGap],
        tone: ToneAnalysis,
        value_scores: List[ValuePropScore]
    ) -> List[str]:
        """Generate top-level actionable recommendations"""

        recommendations = []

        # From gaps
        critical_gaps = [g for g in gaps if g.severity in ["critical", "high"]]
        for gap in critical_gaps[:5]:
            recommendations.append(f"[{gap.severity.upper()}] {gap.recommendation}")

        # From tone
        recommendations.extend(tone.recommendations[:3])

        # From value prop scores
        weak_props = [v for v in value_scores if v.overall_score < 60]
        for prop in weak_props[:3]:
            recommendations.append(f"Strengthen '{prop.claim[:50]}...': {prop.improvement_suggestions[0] if prop.improvement_suggestions else 'Add more proof'}")

        # From claims
        unproven_claims = [c for c in ai_claims if not c.has_proof and c.strength >= 60]
        if len(unproven_claims) > 3:
            recommendations.append(f"Add proof points for {len(unproven_claims)} high-strength claims")

        return recommendations[:10]  # Top 10

    def _calculate_overall_score(
        self,
        ai_claims: List[AIClaim],
        gaps: List[NarrativeGap],
        tone: ToneAnalysis,
        value_scores: List[ValuePropScore]
    ) -> float:
        """Calculate overall narrative strength score (0-100)"""

        # Claim strength (30%)
        avg_claim_strength = sum(c.strength for c in ai_claims) / len(ai_claims) if ai_claims else 0
        claim_score = avg_claim_strength * 0.3

        # Gap penalty (30%)
        gap_penalty = len([g for g in gaps if g.severity == "critical"]) * 10
        gap_penalty += len([g for g in gaps if g.severity == "high"]) * 5
        gap_penalty += len([g for g in gaps if g.severity == "medium"]) * 2
        gap_score = max(0, 100 - gap_penalty) * 0.3

        # Tone consistency (20%)
        tone_score = tone.consistency_score * 0.2

        # Value prop strength (20%)
        avg_vp_score = sum(v.overall_score for v in value_scores) / len(value_scores) if value_scores else 50
        vp_score = avg_vp_score * 0.2

        return min(100, claim_score + gap_score + tone_score + vp_score)


# Helper function to convert dataclasses to dict for JSON serialization
def to_dict(obj):
    """Convert dataclass to dict recursively"""
    if hasattr(obj, '__dict__'):
        return {k: to_dict(v) for k, v in obj.__dict__.items()}
    elif isinstance(obj, list):
        return [to_dict(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: to_dict(v) for k, v in obj.items()}
    else:
        return obj


if __name__ == "__main__":
    # Test with CodePilot example
    test_path = Path("/Users/julieallen/Desktop/codepilot-example-website")

    if test_path.exists():
        print(f"🧪 Testing AI Narrative Analyzer with: {test_path}\n")

        analyzer = AINavrativeAnalyzer(test_path)
        result = analyzer.analyze()

        print("\n" + "="*60)
        print("AI ANALYSIS RESULTS")
        print("="*60)
        print(f"\n📊 Overall Narrative Score: {result.overall_narrative_score:.1f}/100\n")

        print(f"🔍 AI-Extracted Claims: {len(result.ai_claims)}")
        for claim in result.ai_claims[:5]:
            print(f"  - [{claim.type}] {claim.text} (strength: {claim.strength:.0f})")

        print(f"\n🎯 Narrative Gaps: {len(result.narrative_gaps)}")
        for gap in result.narrative_gaps[:5]:
            print(f"  - [{gap.severity}] {gap.description}")

        print(f"\n🎭 Tone Analysis:")
        print(f"  - Primary: {result.tone_analysis.primary_tone}")
        print(f"  - Consistency: {result.tone_analysis.consistency_score:.0f}/100")
        print(f"  - Audience: {result.tone_analysis.audience}")

        print(f"\n⭐ Value Prop Scores:")
        for score in result.value_prop_scores[:3]:
            print(f"  - {score.claim[:60]}... = {score.overall_score:.0f}/100")

        print(f"\n💡 Top Recommendations:")
        for i, rec in enumerate(result.recommendations[:5], 1):
            print(f"  {i}. {rec}")
    else:
        print(f"❌ Test path not found: {test_path}")
