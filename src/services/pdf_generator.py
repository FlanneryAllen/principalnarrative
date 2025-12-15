"""
PDF Report Generator

Generates professional PDF reports from narrative analysis results.
Supports standard analysis, AI-enhanced analysis, and competitive analysis.
"""

from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import io
import base64

try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False

try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False


class PDFGenerator:
    """Generates PDF reports from analysis data"""

    def __init__(self):
        """Initialize PDF generator"""
        if not WEASYPRINT_AVAILABLE:
            raise ImportError("WeasyPrint not installed. Install with: pip install weasyprint")

        self.font_config = FontConfiguration()

    def generate_standard_report(self, data: Dict[str, Any], website_name: str = "Website") -> bytes:
        """
        Generate PDF report for standard website analysis

        Args:
            data: Analysis results from WebsiteAnalyzer
            website_name: Name of the website

        Returns:
            PDF file as bytes
        """
        html = self._render_standard_template(data, website_name)
        return self._html_to_pdf(html)

    def generate_ai_report(self, data: Dict[str, Any], website_name: str = "Website") -> bytes:
        """
        Generate PDF report for AI-enhanced analysis

        Args:
            data: Analysis results from AINavrativeAnalyzer
            website_name: Name of the website

        Returns:
            PDF file as bytes
        """
        html = self._render_ai_template(data, website_name)
        return self._html_to_pdf(html)

    def generate_competitive_report(self, data: Dict[str, Any]) -> bytes:
        """
        Generate PDF report for competitive analysis

        Args:
            data: Analysis results from CompetitiveAnalyzer

        Returns:
            PDF file as bytes
        """
        html = self._render_competitive_template(data)
        return self._html_to_pdf(html)

    def _render_standard_template(self, data: Dict[str, Any], website_name: str) -> str:
        """Render HTML template for standard analysis"""

        # Generate charts as base64 images
        chart_img = self._generate_chart_image(
            labels=['Claims', 'Proof', 'Personas'],
            values=[
                data['summary']['total_claims'],
                data['summary']['total_proof'],
                data['summary']['total_personas']
            ],
            title='Narrative Metrics'
        )

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Website Narrative Analysis Report</title>
    <style>
        @page {{
            size: A4;
            margin: 2cm;
            @top-center {{
                content: "Narrative Analysis Report";
                font-size: 10pt;
                color: #64748b;
            }}
            @bottom-right {{
                content: "Page " counter(page) " of " counter(pages);
                font-size: 10pt;
                color: #64748b;
            }}
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1e293b;
        }}

        .header {{
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 3px solid #6366f1;
        }}

        .header h1 {{
            font-size: 28pt;
            margin: 0;
            color: #6366f1;
        }}

        .header .subtitle {{
            font-size: 14pt;
            color: #64748b;
            margin-top: 0.5rem;
        }}

        .header .date {{
            font-size: 10pt;
            color: #94a3b8;
            margin-top: 0.5rem;
        }}

        .summary-box {{
            background: #f8fafc;
            border-left: 4px solid #6366f1;
            padding: 1rem;
            margin: 2rem 0;
            page-break-inside: avoid;
        }}

        .summary-box h2 {{
            margin-top: 0;
            color: #6366f1;
        }}

        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin: 2rem 0;
        }}

        .stat-card {{
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 1rem;
            text-align: center;
        }}

        .stat-value {{
            font-size: 24pt;
            font-weight: bold;
            color: #6366f1;
        }}

        .stat-label {{
            font-size: 10pt;
            color: #64748b;
            margin-top: 0.5rem;
        }}

        .section {{
            margin: 2rem 0;
            page-break-inside: avoid;
        }}

        .section h2 {{
            color: #0f172a;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
        }}

        .claim-item, .proof-item, .persona-item {{
            background: #f8fafc;
            padding: 0.75rem;
            margin: 0.5rem 0;
            border-left: 3px solid #e2e8f0;
            font-size: 10pt;
        }}

        .claim-item {{
            border-left-color: #6366f1;
        }}

        .proof-item {{
            border-left-color: #10b981;
        }}

        .persona-item {{
            border-left-color: #f59e0b;
        }}

        .chart-container {{
            text-align: center;
            margin: 2rem 0;
            page-break-inside: avoid;
        }}

        .chart-container img {{
            max-width: 100%;
            height: auto;
        }}

        .footer {{
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 9pt;
            color: #94a3b8;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Website Narrative Analysis</h1>
        <div class="subtitle">{website_name}</div>
        <div class="date">Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</div>
    </div>

    <div class="summary-box">
        <h2>Executive Summary</h2>
        <p>
            This website contains <strong>{data['summary']['total_claims']} value propositions</strong>
            backed by <strong>{data['summary']['total_proof']} proof points</strong>,
            featuring <strong>{data['summary']['total_personas']} customer testimonials</strong>
            across <strong>{data['stats']['total_pages']} pages</strong>.
        </p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">{data['summary']['total_claims']}</div>
            <div class="stat-label">Total Claims</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{data['summary']['total_proof']}</div>
            <div class="stat-label">Proof Points</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{data['summary']['total_personas']}</div>
            <div class="stat-label">Testimonials</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{data['stats']['total_pages']}</div>
            <div class="stat-label">Pages Analyzed</div>
        </div>
    </div>

    <div class="chart-container">
        <img src="data:image/png;base64,{chart_img}" alt="Metrics Chart">
    </div>

    <div class="section">
        <h2>Value Propositions & Claims</h2>
        {''.join([f'<div class="claim-item"><strong>{claim["type"]}:</strong> {claim["text"]}<br><small>Location: {claim["location"]}</small></div>' for claim in data['claims'][:10]])}
        {f'<p style="color: #64748b; font-size: 10pt;">...and {len(data["claims"]) - 10} more claims</p>' if len(data['claims']) > 10 else ''}
    </div>

    <div class="section">
        <h2>Proof Points & Evidence</h2>
        {''.join([f'<div class="proof-item"><strong>{proof["type"]}:</strong> {proof["text"]}<br><small>Location: {proof["location"]}</small></div>' for proof in data['proof'][:10]])}
        {f'<p style="color: #64748b; font-size: 10pt;">...and {len(data["proof"]) - 10} more proof points</p>' if len(data['proof']) > 10 else ''}
    </div>

    <div class="section">
        <h2>Customer Testimonials</h2>
        {''.join([f'<div class="persona-item"><strong>{persona["name"]}</strong>, {persona["role"]} at {persona["company"]}<br>"{persona["quote"]}"</div>' for persona in data['personas'][:5]])}
        {f'<p style="color: #64748b; font-size: 10pt;">...and {len(data["personas"]) - 5} more testimonials</p>' if len(data['personas']) > 5 else ''}
        {'' if data['personas'] else '<p style="color: #64748b;">No customer testimonials found.</p>'}
    </div>

    <div class="footer">
        <p>Generated by Principal Narrative Analysis Tool</p>
        <p>🤖 Powered by Claude Code</p>
    </div>
</body>
</html>
"""
        return html

    def _render_ai_template(self, data: Dict[str, Any], website_name: str) -> str:
        """Render HTML template for AI-enhanced analysis"""

        # Generate chart
        chart_img = self._generate_chart_image(
            labels=['AI Claims', 'High Strength', 'Gaps'],
            values=[
                data['summary']['total_ai_claims'],
                data['summary']['high_strength_claims'],
                data['summary']['total_gaps']
            ],
            title='AI Analysis Metrics'
        )

        # Top gaps
        high_priority_gaps = [g for g in data['narrative_gaps'] if g['severity'] in ['high', 'critical']][:5]

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>AI-Enhanced Narrative Analysis Report</title>
    <style>
        @page {{
            size: A4;
            margin: 2cm;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1e293b;
        }}

        .header {{
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 3px solid #6366f1;
        }}

        .header h1 {{
            font-size: 28pt;
            margin: 0;
            color: #6366f1;
        }}

        .score-circle {{
            display: inline-block;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1, #22d3ee);
            color: white;
            font-size: 36pt;
            font-weight: bold;
            line-height: 120px;
            text-align: center;
            margin: 2rem auto;
        }}

        .section {{
            margin: 2rem 0;
            page-break-inside: avoid;
        }}

        .section h2 {{
            color: #0f172a;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 0.5rem;
        }}

        .gap-item {{
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 1rem;
            margin: 0.75rem 0;
        }}

        .gap-item.critical {{
            background: #fef2f2;
            border-left-color: #dc2626;
        }}

        .gap-item.high {{
            background: #fffbeb;
            border-left-color: #f59e0b;
        }}

        .recommendation {{
            background: #eff6ff;
            border-left: 4px solid #6366f1;
            padding: 0.75rem;
            margin: 0.5rem 0;
            font-size: 10pt;
        }}

        .chart-container {{
            text-align: center;
            margin: 2rem 0;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AI-Enhanced Narrative Analysis</h1>
        <div style="font-size: 14pt; color: #64748b; margin-top: 0.5rem;">{website_name}</div>
        <div style="font-size: 10pt; color: #94a3b8; margin-top: 0.5rem;">
            {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
        </div>
    </div>

    <div style="text-align: center; margin: 2rem 0;">
        <div class="score-circle">{round(data['overall_narrative_score'])}</div>
        <div style="font-size: 14pt; color: #64748b;">Overall Narrative Score</div>
    </div>

    <div style="background: #f8fafc; padding: 1rem; margin: 2rem 0;">
        <h2 style="margin-top: 0;">Executive Summary</h2>
        <p>
            AI analysis identified <strong>{data['summary']['total_ai_claims']} claims</strong>,
            with <strong>{data['summary']['high_strength_claims']} high-strength claims</strong>.
            Detected <strong>{data['summary']['total_gaps']} narrative gaps</strong>
            ({data['summary']['critical_gaps']} critical).
            Tone consistency: <strong>{round(data['tone_analysis']['consistency_score'])}%</strong>.
        </p>
    </div>

    <div class="chart-container">
        <img src="data:image/png;base64,{chart_img}" alt="AI Metrics">
    </div>

    <div class="section">
        <h2>🎯 Critical Narrative Gaps</h2>
        {''.join([f'''<div class="gap-item {gap['severity']}">
            <strong>[{gap['severity'].upper()}] {gap['gap_type'].replace('_', ' ').title()}</strong><br>
            {gap['description']}<br>
            <div style="margin-top: 0.5rem; color: #6366f1;"><strong>💡 {gap['recommendation']}</strong></div>
        </div>''' for gap in high_priority_gaps])}
        {'' if high_priority_gaps else '<p style="color: #64748b;">No critical gaps identified.</p>'}
    </div>

    <div class="section">
        <h2>🎭 Tone & Voice Analysis</h2>
        <p><strong>Primary Tone:</strong> {data['tone_analysis']['primary_tone'].title()}</p>
        <p><strong>Audience:</strong> {data['tone_analysis']['audience'].title()}</p>
        <p><strong>Emotion:</strong> {data['tone_analysis']['emotion'].title()}</p>
        <p><strong>Consistency Score:</strong> {round(data['tone_analysis']['consistency_score'])}%</p>
    </div>

    <div class="section">
        <h2>💡 Top Recommendations</h2>
        {''.join([f'<div class="recommendation">{i}. {rec}</div>' for i, rec in enumerate(data['recommendations'][:10], 1)])}
    </div>

    <div style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9pt; color: #94a3b8;">
        <p>AI-Powered Analysis by Principal Narrative</p>
        <p>🤖 Generated with Claude Code</p>
    </div>
</body>
</html>
"""
        return html

    def _render_competitive_template(self, data: Dict[str, Any]) -> str:
        """Render HTML template for competitive analysis"""

        # Generate comparison chart
        chart_img = self._generate_comparison_chart(data['sites'])

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Competitive Analysis Report</title>
    <style>
        @page {{
            size: A4 landscape;
            margin: 2cm;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1e293b;
        }}

        .header {{
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 3px solid #6366f1;
        }}

        .header h1 {{
            font-size: 28pt;
            margin: 0;
            color: #6366f1;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
        }}

        th {{
            background: #f8fafc;
            padding: 0.75rem;
            text-align: left;
            border-bottom: 2px solid #e2e8f0;
            font-size: 10pt;
        }}

        td {{
            padding: 0.75rem;
            border-bottom: 1px solid #e2e8f0;
            font-size: 10pt;
        }}

        .rank-1 {{ background: #dcfce7; color: #166534; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; }}
        .rank-2 {{ background: #fef3c7; color: #92400e; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; }}
        .rank-3 {{ background: #fee2e2; color: #991b1b; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; }}

        .gap-item {{
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 0.75rem;
            margin: 0.5rem 0;
            font-size: 10pt;
        }}

        .gap-item.high {{ border-left-color: #dc2626; }}
        .gap-item.medium {{ border-left-color: #f59e0b; background: #fffbeb; }}
        .gap-item.low {{ border-left-color: #10b981; background: #f0fdf4; }}

        .strength-item {{
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 0.75rem;
            margin: 0.5rem 0;
            font-size: 10pt;
        }}

        .chart-container {{
            text-align: center;
            margin: 2rem 0;
            page-break-inside: avoid;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Competitive Analysis Report</h1>
        <div style="font-size: 10pt; color: #94a3b8; margin-top: 0.5rem;">
            {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
        </div>
    </div>

    <div style="background: #f8fafc; padding: 1rem; margin: 2rem 0;">
        <h2 style="margin-top: 0;">Summary</h2>
        <p>
            Analyzed <strong>{data['summary']['total_sites']} websites</strong>.
            Your claims rank: <strong>#{data['summary']['your_rank_claims']}</strong>.
            Your proof rank: <strong>#{data['summary']['your_rank_proof']}</strong>.
            Identified <strong>{data['summary']['total_gaps']} competitive gaps</strong>
            ({data['summary']['high_priority_gaps']} high priority).
        </p>
    </div>

    <div class="chart-container">
        <img src="data:image/png;base64,{chart_img}" alt="Competitive Comparison">
    </div>

    <h2>Side-by-Side Comparison</h2>
    <table>
        <thead>
            <tr>
                <th>Site</th>
                <th>Claims</th>
                <th>Proof</th>
                <th>Testimonials</th>
                <th>Proof Ratio</th>
                <th>Pages</th>
            </tr>
        </thead>
        <tbody>
            {''.join([f'''<tr>
                <td><strong>{site['name']}</strong></td>
                <td>{site['total_claims']}</td>
                <td>{site['total_proof']}</td>
                <td>{site['total_personas']}</td>
                <td>{site['proof_ratio']}%</td>
                <td>{site['pages_analyzed']}</td>
            </tr>''' for site in data['sites']])}
        </tbody>
    </table>

    <h2 style="page-break-before: always;">🎯 Competitive Gaps</h2>
    {''.join([f'''<div class="gap-item {gap['priority']}">
        <strong>[{gap['priority'].upper()}] {gap['description']}</strong><br>
        <div style="margin-top: 0.25rem; color: #6366f1;">💡 {gap['recommendation']}</div>
    </div>''' for gap in data['gaps'][:10]])}
    {f'<p style="color: #64748b; font-size: 10pt;">...and {len(data["gaps"]) - 10} more gaps</p>' if len(data['gaps']) > 10 else ''}

    <h2>💪 Your Strengths</h2>
    {''.join([f'<div class="strength-item">✅ {strength}</div>' for strength in data['strengths']])}
    {'' if data['strengths'] else '<p style="color: #64748b;">No clear competitive advantages identified.</p>'}

    <h2>💡 Opportunities</h2>
    <ol style="font-size: 10pt;">
        {''.join([f'<li style="margin: 0.5rem 0;">{opp}</li>' for opp in data['opportunities'][:10]])}
    </ol>

    <div style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9pt; color: #94a3b8;">
        <p>Competitive Analysis by Principal Narrative</p>
        <p>🤖 Generated with Claude Code</p>
    </div>
</body>
</html>
"""
        return html

    def _generate_chart_image(self, labels: list, values: list, title: str) -> str:
        """Generate bar chart as base64 encoded image"""
        if not MATPLOTLIB_AVAILABLE:
            return ""

        fig, ax = plt.subplots(figsize=(8, 4))
        colors = ['#6366f1', '#10b981', '#f59e0b'][:len(labels)]
        ax.bar(labels, values, color=colors)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_ylabel('Count', fontsize=10)

        # Style
        ax.spines['top'].set_visible(False)
        ax.spines('right').set_visible(False)
        ax.grid(axis='y', alpha=0.3)

        # Save to bytes
        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        plt.close(fig)

        # Encode to base64
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        return img_base64

    def _generate_comparison_chart(self, sites: list) -> str:
        """Generate grouped bar chart for competitive comparison"""
        if not MATPLOTLIB_AVAILABLE:
            return ""

        import numpy as np

        site_names = [s['name'] for s in sites]
        claims = [s['total_claims'] for s in sites]
        proof = [s['total_proof'] for s in sites]
        personas = [s['total_personas'] for s in sites]

        x = np.arange(len(site_names))
        width = 0.25

        fig, ax = plt.subplots(figsize=(10, 5))
        ax.bar(x - width, claims, width, label='Claims', color='#6366f1')
        ax.bar(x, proof, width, label='Proof Points', color='#10b981')
        ax.bar(x + width, personas, width, label='Testimonials', color='#f59e0b')

        ax.set_xlabel('Websites', fontsize=10)
        ax.set_ylabel('Count', fontsize=10)
        ax.set_title('Competitive Comparison', fontsize=14, fontweight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(site_names, fontsize=9)
        ax.legend()
        ax.grid(axis='y', alpha=0.3)

        # Save to bytes
        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        plt.close(fig)

        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        return img_base64

    def _html_to_pdf(self, html: str) -> bytes:
        """Convert HTML string to PDF bytes"""
        html_obj = HTML(string=html)
        pdf_bytes = html_obj.write_pdf(font_config=self.font_config)
        return pdf_bytes


if __name__ == "__main__":
    # Test PDF generation
    print("🧪 Testing PDF Generator\n")

    # Sample data
    sample_data = {
        "summary": {
            "total_claims": 22,
            "total_proof": 24,
            "total_personas": 8
        },
        "stats": {
            "total_pages": 12
        },
        "claims": [
            {"type": "value_prop", "text": "Code review at the speed of commit", "location": "homepage"},
            {"type": "feature", "text": "Instant Review", "location": "features"}
        ],
        "proof": [
            {"type": "statistic", "text": "42% acceptance rate", "location": "homepage"},
            {"type": "testimonial", "text": "Saves us hours every week", "location": "testimonials"}
        ],
        "personas": [
            {"name": "John Doe", "role": "CTO", "company": "Tech Corp", "quote": "Amazing tool!"}
        ]
    }

    try:
        generator = PDFGenerator()
        pdf = generator.generate_standard_report(sample_data, "Test Website")

        # Save to file
        output_path = Path("test_report.pdf")
        output_path.write_bytes(pdf)

        print(f"✅ PDF generated successfully: {output_path}")
        print(f"   File size: {len(pdf) / 1024:.1f} KB")

    except Exception as e:
        print(f"❌ Error: {e}")
