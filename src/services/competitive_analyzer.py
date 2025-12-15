"""
Competitive Analysis Service

Analyzes multiple websites side-by-side for competitive intelligence.
Compares claims, proof, personas, consistency, and identifies gaps.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import asyncio
from concurrent.futures import ThreadPoolExecutor

from .website_analyzer import WebsiteAnalyzer
from .url_fetcher import URLFetcher
from .js_fetcher import JSFetcher


@dataclass
class SiteComparison:
    """Comparison data for a single website"""
    name: str
    url: str
    total_claims: int
    total_proof: int
    total_personas: int
    proof_ratio: float
    consistency_score: int
    pages_analyzed: int
    top_claims: List[str]
    missing_proof_types: List[str]
    unique_strengths: List[str]


@dataclass
class CompetitiveGap:
    """Gap between your site and competitors"""
    gap_type: str  # missing_claim, weaker_proof, fewer_personas, etc.
    description: str
    competitor: str
    your_value: Any
    their_value: Any
    recommendation: str
    priority: str  # low, medium, high


@dataclass
class CompetitiveAnalysis:
    """Complete competitive analysis results"""
    sites: List[SiteComparison]
    gaps: List[CompetitiveGap]
    strengths: List[str]
    opportunities: List[str]
    summary: Dict[str, Any]


class CompetitiveAnalyzer:
    """Analyzes multiple websites for competitive comparison"""

    def __init__(self, max_pages: int = 20, render_js: bool = False):
        """
        Initialize competitive analyzer

        Args:
            max_pages: Max pages to download per site
            render_js: Use JavaScript rendering (slower)
        """
        self.max_pages = max_pages
        self.render_js = render_js
        self.fetchers: List[Any] = []

    def analyze_sites(self, sites: List[Dict[str, str]]) -> CompetitiveAnalysis:
        """
        Analyze multiple sites for competitive comparison

        Args:
            sites: List of {name, url} dicts

        Returns:
            CompetitiveAnalysis with comparison data
        """
        print(f"🔍 Analyzing {len(sites)} sites for competitive comparison...")

        # Analyze each site
        site_results = []
        for site in sites:
            print(f"\n📊 Analyzing: {site['name']}")
            try:
                result = self._analyze_single_site(site['name'], site['url'])
                site_results.append(result)
            except Exception as e:
                print(f"  ❌ Error analyzing {site['name']}: {e}")
                # Add placeholder with error
                site_results.append(SiteComparison(
                    name=site['name'],
                    url=site['url'],
                    total_claims=0,
                    total_proof=0,
                    total_personas=0,
                    proof_ratio=0.0,
                    consistency_score=0,
                    pages_analyzed=0,
                    top_claims=[],
                    missing_proof_types=[],
                    unique_strengths=[]
                ))

        # Clean up fetchers
        self._cleanup()

        # Compare sites
        print(f"\n🔬 Comparing sites...")
        gaps = self._identify_gaps(site_results)
        strengths = self._identify_strengths(site_results)
        opportunities = self._identify_opportunities(site_results, gaps)

        # Generate summary
        summary = self._generate_summary(site_results, gaps)

        print(f"\n✅ Competitive analysis complete!")
        print(f"   Sites analyzed: {len(site_results)}")
        print(f"   Gaps identified: {len(gaps)}")
        print(f"   Opportunities: {len(opportunities)}")

        return CompetitiveAnalysis(
            sites=site_results,
            gaps=gaps,
            strengths=strengths,
            opportunities=opportunities,
            summary=summary
        )

    def _analyze_single_site(self, name: str, url: str) -> SiteComparison:
        """Analyze a single website"""
        # Determine if URL or local path
        is_url = url.startswith(('http://', 'https://'))

        website_path = None
        fetcher = None

        try:
            if is_url:
                print(f"  🌐 Fetching from URL...")
                if self.render_js:
                    fetcher = JSFetcher(max_pages=self.max_pages, headless=True)
                    website_path = fetcher.fetch_website_sync(url)
                else:
                    fetcher = URLFetcher(max_pages=self.max_pages)
                    website_path = fetcher.fetch_website(url)
                self.fetchers.append(fetcher)
            else:
                website_path = Path(url)

            # Run analysis
            print(f"  📈 Analyzing content...")
            analyzer = WebsiteAnalyzer(website_path)
            analysis = analyzer.analyze()

            # Extract comparison metrics
            total_claims = analysis['summary']['total_claims']
            total_proof = analysis['summary']['total_proof']
            total_personas = analysis['summary']['total_personas']

            proof_ratio = (total_proof / total_claims * 100) if total_claims > 0 else 0

            # Get top claims
            top_claims = [c['text'] for c in analysis['claims'][:5]]

            # Identify missing proof types
            proof_types = set(p['type'] for p in analysis['proof'])
            all_proof_types = {'statistic', 'testimonial', 'case_study', 'certification', 'award'}
            missing_proof_types = list(all_proof_types - proof_types)

            # Placeholder for unique strengths (would need AI to truly determine)
            unique_strengths = []
            if total_personas > 3:
                unique_strengths.append("Strong customer voice")
            if proof_ratio > 100:
                unique_strengths.append("Proof-heavy narrative")
            if total_claims > 15:
                unique_strengths.append("Comprehensive value propositions")

            print(f"  ✅ Complete: {total_claims} claims, {total_proof} proof points")

            return SiteComparison(
                name=name,
                url=url,
                total_claims=total_claims,
                total_proof=total_proof,
                total_personas=total_personas,
                proof_ratio=round(proof_ratio, 1),
                consistency_score=95,  # Placeholder - would come from consistency checker
                pages_analyzed=analysis['stats']['total_pages'],
                top_claims=top_claims,
                missing_proof_types=missing_proof_types,
                unique_strengths=unique_strengths
            )

        except Exception as e:
            print(f"  ❌ Error: {e}")
            raise

    def _identify_gaps(self, sites: List[SiteComparison]) -> List[CompetitiveGap]:
        """Identify gaps between your site (first) and competitors"""
        if len(sites) < 2:
            return []

        gaps = []
        your_site = sites[0]  # First site is "yours"
        competitors = sites[1:]

        for comp in competitors:
            # Claim gap
            if comp.total_claims > your_site.total_claims:
                gap_size = comp.total_claims - your_site.total_claims
                gaps.append(CompetitiveGap(
                    gap_type="fewer_claims",
                    description=f"{comp.name} has {gap_size} more claims than you",
                    competitor=comp.name,
                    your_value=your_site.total_claims,
                    their_value=comp.total_claims,
                    recommendation=f"Expand value proposition coverage to match {comp.name}",
                    priority="high" if gap_size > 10 else "medium"
                ))

            # Proof gap
            if comp.total_proof > your_site.total_proof:
                gap_size = comp.total_proof - your_site.total_proof
                gaps.append(CompetitiveGap(
                    gap_type="fewer_proof_points",
                    description=f"{comp.name} has {gap_size} more proof points",
                    competitor=comp.name,
                    your_value=your_site.total_proof,
                    their_value=comp.total_proof,
                    recommendation=f"Add more statistics, testimonials, or case studies",
                    priority="high" if gap_size > 15 else "medium"
                ))

            # Persona gap
            if comp.total_personas > your_site.total_personas:
                gap_size = comp.total_personas - your_site.total_personas
                gaps.append(CompetitiveGap(
                    gap_type="fewer_personas",
                    description=f"{comp.name} showcases {gap_size} more customer testimonials",
                    competitor=comp.name,
                    your_value=your_site.total_personas,
                    their_value=comp.total_personas,
                    recommendation=f"Add customer testimonials to build trust",
                    priority="high" if gap_size > 3 else "low"
                ))

            # Proof ratio gap
            if comp.proof_ratio > your_site.proof_ratio + 20:
                gaps.append(CompetitiveGap(
                    gap_type="weaker_proof_ratio",
                    description=f"{comp.name} has stronger proof-to-claim ratio ({comp.proof_ratio}% vs {your_site.proof_ratio}%)",
                    competitor=comp.name,
                    your_value=f"{your_site.proof_ratio}%",
                    their_value=f"{comp.proof_ratio}%",
                    recommendation="Back more claims with evidence",
                    priority="high"
                ))

            # Missing proof types
            comp_proof_types = set(all_proof_types) - set(comp.missing_proof_types)
            your_proof_types = set(all_proof_types) - set(your_site.missing_proof_types)
            missing = comp_proof_types - your_proof_types

            if missing:
                all_proof_types = {'statistic', 'testimonial', 'case_study', 'certification', 'award'}
                proof_type_names = {
                    'statistic': 'statistics',
                    'testimonial': 'testimonials',
                    'case_study': 'case studies',
                    'certification': 'certifications',
                    'award': 'awards'
                }
                missing_names = [proof_type_names.get(t, t) for t in missing]

                gaps.append(CompetitiveGap(
                    gap_type="missing_proof_types",
                    description=f"{comp.name} uses {', '.join(missing_names)} but you don't",
                    competitor=comp.name,
                    your_value=list(your_proof_types),
                    their_value=list(comp_proof_types),
                    recommendation=f"Add {', '.join(missing_names)} to diversify social proof",
                    priority="medium"
                ))

        return gaps

    def _identify_strengths(self, sites: List[SiteComparison]) -> List[str]:
        """Identify your competitive strengths"""
        if len(sites) < 2:
            return []

        strengths = []
        your_site = sites[0]
        competitors = sites[1:]

        # More claims than average
        avg_claims = sum(s.total_claims for s in competitors) / len(competitors)
        if your_site.total_claims > avg_claims:
            strengths.append(f"More comprehensive value propositions ({your_site.total_claims} vs avg {avg_claims:.0f})")

        # More proof than average
        avg_proof = sum(s.total_proof for s in competitors) / len(competitors)
        if your_site.total_proof > avg_proof:
            strengths.append(f"Stronger evidence base ({your_site.total_proof} vs avg {avg_proof:.0f})")

        # More personas
        avg_personas = sum(s.total_personas for s in competitors) / len(competitors)
        if your_site.total_personas > avg_personas:
            strengths.append(f"More customer testimonials ({your_site.total_personas} vs avg {avg_personas:.0f})")

        # Better proof ratio
        avg_ratio = sum(s.proof_ratio for s in competitors) / len(competitors)
        if your_site.proof_ratio > avg_ratio:
            strengths.append(f"Better proof-to-claim ratio ({your_site.proof_ratio}% vs avg {avg_ratio:.0f}%)")

        return strengths

    def _identify_opportunities(self, sites: List[SiteComparison], gaps: List[CompetitiveGap]) -> List[str]:
        """Identify opportunities based on gaps"""
        opportunities = []

        # High priority gaps become opportunities
        high_priority_gaps = [g for g in gaps if g.priority == "high"]

        for gap in high_priority_gaps[:5]:  # Top 5
            opportunities.append(gap.recommendation)

        # Look for common competitor strengths
        if len(sites) > 2:
            competitors = sites[1:]

            # If all competitors have more personas
            if all(c.total_personas > sites[0].total_personas for c in competitors):
                opportunities.append("Industry standard: Add customer testimonials section")

            # If all competitors have certain proof types
            all_proof_types = {'statistic', 'testimonial', 'case_study', 'certification', 'award'}
            for proof_type in all_proof_types:
                if all(proof_type not in c.missing_proof_types for c in competitors):
                    if proof_type in sites[0].missing_proof_types:
                        proof_names = {
                            'statistic': 'statistics',
                            'testimonial': 'testimonials',
                            'case_study': 'case studies',
                            'certification': 'certifications',
                            'award': 'awards'
                        }
                        opportunities.append(f"All competitors use {proof_names[proof_type]} - consider adding")

        return opportunities[:10]  # Top 10

    def _generate_summary(self, sites: List[SiteComparison], gaps: List[CompetitiveGap]) -> Dict[str, Any]:
        """Generate summary statistics"""
        return {
            "total_sites": len(sites),
            "your_rank_claims": self._get_rank(sites, 'total_claims'),
            "your_rank_proof": self._get_rank(sites, 'total_proof'),
            "your_rank_personas": self._get_rank(sites, 'total_personas'),
            "total_gaps": len(gaps),
            "high_priority_gaps": len([g for g in gaps if g.priority == "high"]),
            "avg_competitor_claims": round(sum(s.total_claims for s in sites[1:]) / len(sites[1:])) if len(sites) > 1 else 0,
            "avg_competitor_proof": round(sum(s.total_proof for s in sites[1:]) / len(sites[1:])) if len(sites) > 1 else 0,
        }

    def _get_rank(self, sites: List[SiteComparison], metric: str) -> int:
        """Get rank of first site (yours) for a given metric"""
        sorted_sites = sorted(sites, key=lambda s: getattr(s, metric), reverse=True)
        for i, site in enumerate(sorted_sites):
            if site.name == sites[0].name:
                return i + 1
        return len(sites)

    def _cleanup(self):
        """Clean up temporary directories from fetchers"""
        for fetcher in self.fetchers:
            try:
                fetcher.cleanup()
            except:
                pass
        self.fetchers = []


def to_dict(obj):
    """Convert dataclass to dict recursively"""
    if hasattr(obj, '__dataclass_fields__'):
        return {k: to_dict(v) for k, v in asdict(obj).items()}
    elif isinstance(obj, list):
        return [to_dict(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: to_dict(v) for k, v in obj.items()}
    else:
        return obj


if __name__ == "__main__":
    # Test competitive analysis
    print("🧪 Testing Competitive Analyzer\n")

    sites = [
        {"name": "Your Site", "url": "/Users/julieallen/Desktop/codepilot-example-website"},
        {"name": "Competitor A", "url": "https://example.com"},
    ]

    analyzer = CompetitiveAnalyzer(max_pages=5)
    result = analyzer.analyze_sites(sites)

    print("\n" + "="*60)
    print("COMPETITIVE ANALYSIS RESULTS")
    print("="*60)

    print("\n📊 Site Comparison:")
    for site in result.sites:
        print(f"\n  {site.name}:")
        print(f"    Claims: {site.total_claims}")
        print(f"    Proof: {site.total_proof}")
        print(f"    Personas: {site.total_personas}")
        print(f"    Proof Ratio: {site.proof_ratio}%")

    print(f"\n🔍 Gaps Identified: {len(result.gaps)}")
    for gap in result.gaps[:5]:
        print(f"  [{gap.priority.upper()}] {gap.description}")
        print(f"    → {gap.recommendation}")

    print(f"\n💪 Your Strengths:")
    for strength in result.strengths:
        print(f"  ✅ {strength}")

    print(f"\n💡 Opportunities:")
    for opp in result.opportunities[:5]:
        print(f"  • {opp}")
