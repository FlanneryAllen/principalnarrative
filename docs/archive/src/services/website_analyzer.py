"""
Website Narrative Analyzer

Extracts narrative structure from marketing websites including:
- Value propositions and claims
- Proof points (stats, testimonials, case studies)
- Customer personas and pain points
- Messaging consistency
- Content gaps
"""

import re
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from bs4 import BeautifulSoup
from dataclasses import dataclass, field
import json

@dataclass
class Claim:
    """A claim or value proposition"""
    text: str
    location: str  # Where it appears (page, section)
    type: str  # "value_prop", "feature", "benefit", "stat"
    confidence: float = 0.0
    proof_sources: List[str] = field(default_factory=list)

@dataclass
class Proof:
    """Evidence supporting a claim"""
    text: str
    type: str  # "statistic", "testimonial", "case_study", "data"
    source: Optional[str] = None
    location: str = ""
    verified: bool = False

@dataclass
class Persona:
    """Customer persona or job-to-be-done"""
    name: str
    role: str
    pain_points: List[str] = field(default_factory=list)
    quote: Optional[str] = None
    company: Optional[str] = None

@dataclass
class NarrativeUnit:
    """A coherent piece of narrative (problem → solution → proof)"""
    title: str
    problem: str
    solution: str
    proof: List[Proof] = field(default_factory=list)
    location: str = ""

class WebsiteAnalyzer:
    """Analyzes website content to extract narrative structure"""

    def __init__(self, website_path: Path):
        self.website_path = Path(website_path)
        self.claims: List[Claim] = []
        self.proof: List[Proof] = []
        self.personas: List[Persona] = []
        self.narrative_units: List[NarrativeUnit] = []
        self.stats: Dict[str, str] = {}

    def analyze(self) -> Dict:
        """Run full analysis on website"""
        print(f"🔍 Analyzing website at: {self.website_path}")

        # Extract from main page
        self._extract_from_page(self.website_path / "index.html", "landing")

        # Extract from blog posts
        blog_dir = self.website_path / "blog"
        if blog_dir.exists():
            for blog_file in blog_dir.glob("*.html"):
                if blog_file.name != "index.html":
                    self._extract_from_page(blog_file, f"blog:{blog_file.stem}")

        return self._generate_report()

    def _extract_from_page(self, page_path: Path, location: str):
        """Extract narrative elements from a single page"""
        if not page_path.exists():
            print(f"⚠️  Page not found: {page_path}")
            return

        print(f"  📄 Analyzing: {page_path.name}")

        with open(page_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        # Extract title and main value prop
        h1 = soup.find('h1')
        if h1:
            self.claims.append(Claim(
                text=h1.get_text(strip=True),
                location=location,
                type="value_prop",
                confidence=1.0
            ))

        # Extract stats (numbers followed by % or units)
        self._extract_stats(soup, location)

        # Extract testimonials/quotes
        self._extract_testimonials(soup, location)

        # Extract features from feature sections
        self._extract_features(soup, location)

        # Extract narrative units (problem → solution → proof patterns)
        self._extract_narrative_units(soup, location)

    def _extract_stats(self, soup: BeautifulSoup, location: str):
        """Extract statistical claims"""
        # Look for stat patterns: numbers with %, hrs, s, x, +
        stat_patterns = [
            r'\b(\d+(?:\.\d+)?%)\b',  # Percentages
            r'\b(\d+(?:\.\d+)?hrs?)\b',  # Hours
            r'\b(\d+(?:\.\d+)?s)\b',  # Seconds
            r'\b(\d+\+)\b',  # 500+
            r'\b(\d+x)\b',  # 10x
        ]

        text = soup.get_text()
        for pattern in stat_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                stat_value = match.group(1)
                # Get surrounding context
                start = max(0, match.start() - 100)
                end = min(len(text), match.end() + 100)
                context = text[start:end].strip()

                self.stats[stat_value] = context
                self.proof.append(Proof(
                    text=context,
                    type="statistic",
                    location=location,
                    verified=True
                ))

    def _extract_testimonials(self, soup: BeautifulSoup, location: str):
        """Extract customer testimonials and quotes"""
        # Look for blockquotes
        for quote in soup.find_all('blockquote'):
            quote_text = quote.get_text(strip=True)

            # Try to find author info - often after "—" in quote
            author_info = None
            actual_quote = quote_text

            # Check if quote contains attribution (— Name, Role)
            if '—' in quote_text:
                parts = quote_text.split('—', 1)
                actual_quote = parts[0].strip()
                author_info = parts[1].strip() if len(parts) > 1 else None

            # Parse persona from quote if we have author info
            if author_info:
                self._parse_persona_from_quote(actual_quote, author_info, location)

            self.proof.append(Proof(
                text=actual_quote,
                type="testimonial",
                source=author_info,
                location=location,
                verified=True
            ))

    def _parse_persona_from_quote(self, quote: str, author_info: str, location: str):
        """Parse persona information from testimonial"""
        # Extract name, role, company from author info
        # Format: "Name, Role at Company" or "Name - Role at Company"

        name = "Unknown"
        role = ""
        company = ""

        # Try to parse "Name, Role at Company" or "Name - Role at Company"
        if 'at' in author_info:
            # Split by 'at' to get company
            parts = author_info.split('at', 1)
            name_and_role = parts[0].strip()
            company = parts[1].strip()

            # Split name and role by comma or dash
            if ',' in name_and_role:
                name_parts = name_and_role.split(',', 1)
                name = name_parts[0].strip()
                role = name_parts[1].strip() if len(name_parts) > 1 else ""
            elif '-' in name_and_role:
                name_parts = name_and_role.split('-', 1)
                name = name_parts[0].strip()
                role = name_parts[1].strip() if len(name_parts) > 1 else ""
            else:
                name = name_and_role
        elif ',' in author_info:
            # Just "Name, Role" without company
            parts = author_info.split(',', 1)
            name = parts[0].strip()
            role = parts[1].strip() if len(parts) > 1 else ""
        else:
            # Just name
            name = author_info.strip()

        persona = Persona(
            name=name,
            role=role,
            quote=quote,
            company=company
        )
        self.personas.append(persona)

    def _extract_features(self, soup: BeautifulSoup, location: str):
        """Extract feature claims"""
        # Look for feature sections
        for section in soup.find_all(['div', 'section'], class_=lambda x: x and 'feature' in x.lower()):
            h3 = section.find('h3')
            p = section.find('p')

            if h3 and p:
                self.claims.append(Claim(
                    text=f"{h3.get_text(strip=True)}: {p.get_text(strip=True)}",
                    location=location,
                    type="feature",
                    confidence=0.9
                ))

    def _extract_narrative_units(self, soup: BeautifulSoup, location: str):
        """Extract problem → solution → proof narrative patterns"""
        # Look for sections with h2 headers (typically indicate narrative structure)
        for h2 in soup.find_all('h2'):
            section_title = h2.get_text(strip=True)

            # Get content until next h2
            content_elements = []
            for sibling in h2.find_next_siblings():
                if sibling.name == 'h2':
                    break
                content_elements.append(sibling)

            # Look for problem indicators
            problem_indicators = ['problem', 'challenge', 'issue', 'bottleneck', 'pain', 'struggle']
            solution_indicators = ['solution', 'approach', 'how', 'fix', 'answer']

            title_lower = section_title.lower()

            if any(ind in title_lower for ind in problem_indicators + solution_indicators):
                # Extract text content
                content_text = ' '.join([elem.get_text(strip=True) for elem in content_elements])

                # Try to identify problem and solution
                problem = ""
                solution = ""

                if any(ind in title_lower for ind in problem_indicators):
                    problem = content_text[:500]  # First part is problem
                elif any(ind in title_lower for ind in solution_indicators):
                    solution = content_text[:500]  # First part is solution

                if problem or solution:
                    self.narrative_units.append(NarrativeUnit(
                        title=section_title,
                        problem=problem,
                        solution=solution,
                        location=location
                    ))

    def _generate_report(self) -> Dict:
        """Generate analysis report"""
        print(f"\n✅ Analysis complete!")
        print(f"  📊 Found {len(self.claims)} claims")
        print(f"  🎯 Found {len(self.proof)} proof points")
        print(f"  👤 Found {len(self.personas)} personas")
        print(f"  📖 Found {len(self.narrative_units)} narrative units")
        print(f"  📈 Found {len(self.stats)} statistics")

        return {
            "summary": {
                "total_claims": len(self.claims),
                "total_proof": len(self.proof),
                "total_personas": len(self.personas),
                "total_narrative_units": len(self.narrative_units),
                "total_stats": len(self.stats)
            },
            "claims": [
                {
                    "text": c.text,
                    "type": c.type,
                    "location": c.location,
                    "confidence": c.confidence
                } for c in self.claims
            ],
            "proof": [
                {
                    "text": p.text[:200] + "..." if len(p.text) > 200 else p.text,
                    "type": p.type,
                    "source": p.source,
                    "location": p.location
                } for p in self.proof
            ],
            "personas": [
                {
                    "name": p.name,
                    "role": p.role,
                    "company": p.company,
                    "quote": p.quote[:100] + "..." if p.quote and len(p.quote) > 100 else p.quote
                } for p in self.personas
            ],
            "stats": self.stats,
            "narrative_units": [
                {
                    "title": nu.title,
                    "problem": nu.problem[:200] + "..." if len(nu.problem) > 200 else nu.problem,
                    "solution": nu.solution[:200] + "..." if len(nu.solution) > 200 else nu.solution,
                    "location": nu.location
                } for nu in self.narrative_units
            ]
        }

    def save_report(self, output_path: Path, include_validation: bool = True):
        """Save analysis report to JSON with optional validation"""
        report = self._generate_report()

        # Add validation if requested
        if include_validation:
            try:
                from .claim_validator import ClaimValidator
                from .consistency_checker import ConsistencyChecker
            except ImportError:
                # Fall back to absolute import when running as script
                import sys
                from pathlib import Path
                sys.path.insert(0, str(Path(__file__).parent))
                from claim_validator import ClaimValidator
                from consistency_checker import ConsistencyChecker

            # Run claim validation
            validator = ClaimValidator(
                claims=report['claims'],
                proof=report['proof'],
                stats=report['stats']
            )
            validation_report = validator.validate_all()
            report['claim_validation'] = validation_report

            # Run consistency check
            checker = ConsistencyChecker(
                claims=report['claims'],
                proof=report['proof'],
                stats=report['stats']
            )
            consistency_report = checker.check_all()
            report['consistency'] = consistency_report

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"\n💾 Report saved to: {output_path}")
        return report


if __name__ == "__main__":
    # Test on codepilot-example-website
    website_path = Path("/Users/julieallen/Desktop/codepilot-example-website")

    analyzer = WebsiteAnalyzer(website_path)
    report = analyzer.analyze()

    # Save report
    output_path = Path("/Users/julieallen/Desktop/codepilot-narrative-analysis.json")
    analyzer.save_report(output_path)

    print("\n" + "="*60)
    print("📊 KEY FINDINGS")
    print("="*60)

    print(f"\n🎯 Top Claims:")
    for claim in report['claims'][:5]:
        print(f"  • [{claim['type']}] {claim['text'][:80]}")

    print(f"\n📈 Key Stats:")
    for stat, context in list(report['stats'].items())[:5]:
        print(f"  • {stat}: {context[:80]}...")

    print(f"\n👤 Customer Personas:")
    for persona in report['personas']:
        print(f"  • {persona['name']} - {persona['role']} at {persona['company']}")
