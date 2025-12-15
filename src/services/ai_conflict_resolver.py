"""
AI-Powered Conflict Resolver - Uses Claude to generate specific fix recommendations for drift.

Analyzes drift events and generates:
1. Specific code changes (with diffs)
2. Documentation updates (with exact text)
3. Priority rankings by business impact
4. Step-by-step resolution plans
"""
import os
import json
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime

from ..logging_config import get_logger
from ..models import DriftEvent, DriftSeverity, DriftType

logger = get_logger("services.ai_conflict_resolver")

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("Anthropic library not available - AI conflict resolution will be disabled")


@dataclass
class ResolutionRecommendation:
    """A specific recommendation for resolving drift."""
    drift_event_id: str
    priority: str  # "critical", "high", "medium", "low"
    business_impact: str
    resolution_type: str  # "code_change", "doc_update", "process_change"
    specific_action: str
    before_snippet: Optional[str]
    after_snippet: Optional[str]
    file_path: Optional[str]
    line_numbers: Optional[str]
    estimated_effort: str  # "5 minutes", "1 hour", "1 day", etc.
    rationale: str


@dataclass
class ResolutionPlan:
    """A comprehensive plan for resolving multiple drift events."""
    total_drifts: int
    recommendations: List[ResolutionRecommendation]
    priority_order: List[str]  # drift_event_ids in priority order
    estimated_total_effort: str
    quick_wins: List[str]  # drift_event_ids that are easy to fix
    summary: str


class AIConflictResolver:
    """
    Uses Claude AI to analyze drift and generate actionable fix recommendations.

    Capabilities:
    - Analyze semantic conflicts and suggest reconciliation
    - Generate specific code changes to fix doc-code drift
    - Propose documentation updates with exact text
    - Prioritize fixes by business impact
    - Estimate effort and identify quick wins
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize with optional API key (falls back to env var)."""
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.client = None
        self.model = "claude-sonnet-4-20250514"

        if ANTHROPIC_AVAILABLE and self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)

    @property
    def is_available(self) -> bool:
        """Check if AI resolution is available."""
        return self.client is not None

    def resolve_drift_events(
        self,
        drift_events: List[DriftEvent],
        context: Optional[Dict[str, Any]] = None
    ) -> ResolutionPlan:
        """
        Analyze drift events and generate a comprehensive resolution plan.

        Args:
            drift_events: List of detected drift events
            context: Optional context (codebase info, business priorities, etc.)

        Returns:
            Complete resolution plan with prioritized recommendations
        """
        if not self.is_available:
            logger.warning("AI conflict resolver not available (no API key)")
            return self._fallback_plan(drift_events)

        if not drift_events:
            return ResolutionPlan(
                total_drifts=0,
                recommendations=[],
                priority_order=[],
                estimated_total_effort="0 minutes",
                quick_wins=[],
                summary="No drift detected. All clear!"
            )

        logger.info(f"Analyzing {len(drift_events)} drift events with AI...")

        # Prepare drift events for AI analysis
        drift_data = self._prepare_drift_data(drift_events)

        # Generate resolution plan using Claude
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                system=self._get_system_prompt(),
                messages=[{
                    "role": "user",
                    "content": self._get_user_prompt(drift_data, context)
                }]
            )

            # Parse AI response
            ai_response = response.content[0].text
            plan = self._parse_resolution_plan(ai_response, drift_events)

            logger.info(f"Generated {len(plan.recommendations)} recommendations")
            return plan

        except Exception as e:
            logger.error(f"AI resolution failed: {e}", exc_info=True)
            return self._fallback_plan(drift_events)

    def resolve_single_drift(
        self,
        drift_event: DriftEvent,
        include_code_context: bool = True
    ) -> ResolutionRecommendation:
        """
        Generate a detailed recommendation for a single drift event.

        Args:
            drift_event: The drift event to resolve
            include_code_context: If True, read actual file content for context

        Returns:
            Specific resolution recommendation
        """
        if not self.is_available:
            return self._fallback_recommendation(drift_event)

        # Get file context if requested
        file_context = ""
        if include_code_context and drift_event.source_unit:
            file_context = self._read_file_context(drift_event.source_unit)

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                system="""You are an expert technical writer and software architect helping resolve documentation drift.

Your job: Analyze a drift event and provide a SPECIFIC, ACTIONABLE fix recommendation.

Include:
1. What's wrong (root cause)
2. Exact changes needed (code diff or doc text)
3. Why this matters (business impact)
4. How long it will take
5. File path and line numbers if applicable

Be specific. Give exact text to add/remove. Provide before/after snippets.""",
                messages=[{
                    "role": "user",
                    "content": f"""Analyze this drift event and provide a specific fix:

**Drift Event:**
- ID: {drift_event.id}
- Type: {drift_event.type.value}
- Severity: {drift_event.severity.value}
- Source: {drift_event.source_unit}
- Target: {drift_event.target_unit or 'N/A'}
- Description: {drift_event.description}
- Current suggestion: {drift_event.suggested_resolution or 'None'}

{'**File Context:**' if file_context else ''}
{file_context if file_context else ''}

Respond in JSON format:
{{
  "priority": "critical|high|medium|low",
  "business_impact": "explanation of why this matters",
  "resolution_type": "code_change|doc_update|process_change",
  "specific_action": "exact step-by-step instructions",
  "before_snippet": "current text/code (if applicable)",
  "after_snippet": "updated text/code (if applicable)",
  "file_path": "file to modify",
  "line_numbers": "e.g., '42-45' or 'N/A'",
  "estimated_effort": "e.g., '5 minutes', '1 hour'",
  "rationale": "why this is the best fix"
}}"""
                }]
            )

            ai_response = response.content[0].text
            return self._parse_single_recommendation(ai_response, drift_event)

        except Exception as e:
            logger.error(f"Single drift resolution failed: {e}", exc_info=True)
            return self._fallback_recommendation(drift_event)

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def _get_system_prompt(self) -> str:
        """Get the system prompt for batch drift resolution."""
        return """You are an expert technical writer and software architect specializing in documentation quality and code-documentation alignment.

Your job: Analyze multiple drift events and create a comprehensive resolution plan.

For each drift event, provide:
1. **Priority**: critical, high, medium, or low (based on business impact)
2. **Business Impact**: Why this drift matters for the organization
3. **Resolution Type**: code_change, doc_update, or process_change
4. **Specific Action**: Exact steps to fix (with code/text snippets)
5. **Estimated Effort**: Realistic time estimate (5 min, 1 hr, 1 day, etc.)
6. **Rationale**: Why this is the best approach

Also identify:
- **Quick Wins**: Easy fixes that provide immediate value
- **Priority Order**: Which drifts to fix first (by business impact)
- **Total Effort**: Overall time investment needed

Be specific. Provide exact text changes, not vague suggestions.
Focus on high-impact, low-effort fixes first."""

    def _get_user_prompt(
        self,
        drift_data: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Generate user prompt for drift resolution."""
        context_str = ""
        if context:
            context_str = f"""
**Project Context:**
{json.dumps(context, indent=2)}
"""

        drift_list = "\n\n".join([
            f"""**Drift #{i+1}** (ID: {d['id']})
- Type: {d['type']}
- Severity: {d['severity']}
- Source: {d['source_unit']}
- Target: {d.get('target_unit', 'N/A')}
- Description: {d['description']}
- Current suggestion: {d.get('suggested_resolution', 'None')}"""
            for i, d in enumerate(drift_data)
        ])

        return f"""Analyze these drift events and create a resolution plan.
{context_str}

**Drift Events ({len(drift_data)} total):**

{drift_list}

Respond in JSON format:
{{
  "recommendations": [
    {{
      "drift_event_id": "...",
      "priority": "critical|high|medium|low",
      "business_impact": "...",
      "resolution_type": "code_change|doc_update|process_change",
      "specific_action": "...",
      "before_snippet": "..." or null,
      "after_snippet": "..." or null,
      "file_path": "..." or null,
      "line_numbers": "..." or null,
      "estimated_effort": "...",
      "rationale": "..."
    }}
  ],
  "priority_order": ["drift_id_1", "drift_id_2", ...],
  "quick_wins": ["drift_id_x", "drift_id_y"],
  "estimated_total_effort": "...",
  "summary": "Overall assessment and key insights"
}}"""

    def _prepare_drift_data(self, drift_events: List[DriftEvent]) -> List[Dict[str, Any]]:
        """Convert drift events to dict format for AI."""
        return [{
            "id": event.id,
            "type": event.type.value,
            "severity": event.severity.value,
            "source_unit": event.source_unit,
            "target_unit": event.target_unit,
            "description": event.description,
            "suggested_resolution": event.suggested_resolution,
            "detected_at": event.detected_at.isoformat() if event.detected_at else None
        } for event in drift_events]

    def _parse_resolution_plan(
        self,
        ai_response: str,
        drift_events: List[DriftEvent]
    ) -> ResolutionPlan:
        """Parse AI response into ResolutionPlan."""
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_text = ai_response
            if "```json" in ai_response:
                json_text = ai_response.split("```json")[1].split("```")[0].strip()
            elif "```" in ai_response:
                json_text = ai_response.split("```")[1].split("```")[0].strip()

            data = json.loads(json_text)

            recommendations = [
                ResolutionRecommendation(
                    drift_event_id=rec["drift_event_id"],
                    priority=rec["priority"],
                    business_impact=rec["business_impact"],
                    resolution_type=rec["resolution_type"],
                    specific_action=rec["specific_action"],
                    before_snippet=rec.get("before_snippet"),
                    after_snippet=rec.get("after_snippet"),
                    file_path=rec.get("file_path"),
                    line_numbers=rec.get("line_numbers"),
                    estimated_effort=rec["estimated_effort"],
                    rationale=rec["rationale"]
                )
                for rec in data["recommendations"]
            ]

            return ResolutionPlan(
                total_drifts=len(drift_events),
                recommendations=recommendations,
                priority_order=data.get("priority_order", []),
                estimated_total_effort=data.get("estimated_total_effort", "Unknown"),
                quick_wins=data.get("quick_wins", []),
                summary=data.get("summary", "")
            )

        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}", exc_info=True)
            return self._fallback_plan(drift_events)

    def _parse_single_recommendation(
        self,
        ai_response: str,
        drift_event: DriftEvent
    ) -> ResolutionRecommendation:
        """Parse AI response for single drift."""
        try:
            # Extract JSON
            json_text = ai_response
            if "```json" in ai_response:
                json_text = ai_response.split("```json")[1].split("```")[0].strip()
            elif "```" in ai_response:
                json_text = ai_response.split("```")[1].split("```")[0].strip()

            data = json.loads(json_text)

            return ResolutionRecommendation(
                drift_event_id=drift_event.id,
                priority=data["priority"],
                business_impact=data["business_impact"],
                resolution_type=data["resolution_type"],
                specific_action=data["specific_action"],
                before_snippet=data.get("before_snippet"),
                after_snippet=data.get("after_snippet"),
                file_path=data.get("file_path"),
                line_numbers=data.get("line_numbers"),
                estimated_effort=data["estimated_effort"],
                rationale=data["rationale"]
            )

        except Exception as e:
            logger.error(f"Failed to parse single recommendation: {e}", exc_info=True)
            return self._fallback_recommendation(drift_event)

    def _read_file_context(self, file_path: str, max_lines: int = 50) -> str:
        """Read file content for context (limited to avoid token overflow)."""
        try:
            from pathlib import Path
            from ..config import settings

            full_path = settings.narrative_base_path.parent / file_path
            if not full_path.exists():
                return ""

            lines = full_path.read_text(encoding='utf-8').split('\n')
            if len(lines) > max_lines:
                return '\n'.join(lines[:max_lines]) + f"\n... ({len(lines) - max_lines} more lines)"

            return '\n'.join(lines)

        except Exception as e:
            logger.debug(f"Could not read file {file_path}: {e}")
            return ""

    def _fallback_plan(self, drift_events: List[DriftEvent]) -> ResolutionPlan:
        """Generate a basic plan when AI is unavailable."""
        recommendations = [
            self._fallback_recommendation(event)
            for event in drift_events
        ]

        # Sort by severity
        severity_order = {
            DriftSeverity.CRITICAL: 0,
            DriftSeverity.HIGH: 1,
            DriftSeverity.MEDIUM: 2,
            DriftSeverity.LOW: 3
        }
        sorted_events = sorted(drift_events, key=lambda e: severity_order.get(e.severity, 999))

        return ResolutionPlan(
            total_drifts=len(drift_events),
            recommendations=recommendations,
            priority_order=[e.id for e in sorted_events],
            estimated_total_effort="Unknown (AI unavailable)",
            quick_wins=[],
            summary="Basic resolution plan (AI-enhanced recommendations unavailable)"
        )

    def _fallback_recommendation(self, drift_event: DriftEvent) -> ResolutionRecommendation:
        """Generate a basic recommendation when AI is unavailable."""
        return ResolutionRecommendation(
            drift_event_id=drift_event.id,
            priority=drift_event.severity.value,
            business_impact="Impact assessment unavailable (AI offline)",
            resolution_type="manual_review",
            specific_action=drift_event.suggested_resolution or "Review and resolve manually",
            before_snippet=None,
            after_snippet=None,
            file_path=drift_event.source_unit,
            line_numbers=None,
            estimated_effort="Unknown",
            rationale="AI-powered analysis unavailable"
        )

    def export_resolution_plan(
        self,
        plan: ResolutionPlan,
        format: str = "markdown"
    ) -> str:
        """
        Export resolution plan in various formats.

        Args:
            plan: The resolution plan
            format: "markdown", "json", or "html"

        Returns:
            Formatted plan as string
        """
        if format == "json":
            return json.dumps({
                "total_drifts": plan.total_drifts,
                "estimated_total_effort": plan.estimated_total_effort,
                "quick_wins": plan.quick_wins,
                "summary": plan.summary,
                "recommendations": [
                    {
                        "drift_event_id": rec.drift_event_id,
                        "priority": rec.priority,
                        "business_impact": rec.business_impact,
                        "resolution_type": rec.resolution_type,
                        "specific_action": rec.specific_action,
                        "file_path": rec.file_path,
                        "estimated_effort": rec.estimated_effort
                    }
                    for rec in plan.recommendations
                ]
            }, indent=2)

        elif format == "markdown":
            lines = [
                "# Drift Resolution Plan",
                "",
                f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                f"**Total Drifts:** {plan.total_drifts}",
                f"**Estimated Effort:** {plan.estimated_total_effort}",
                "",
                "## Summary",
                "",
                plan.summary,
                "",
            ]

            if plan.quick_wins:
                lines.extend([
                    "## 🎯 Quick Wins (Fix These First!)",
                    "",
                    f"These {len(plan.quick_wins)} issues can be resolved quickly for immediate impact:",
                    ""
                ])
                for drift_id in plan.quick_wins:
                    rec = next((r for r in plan.recommendations if r.drift_event_id == drift_id), None)
                    if rec:
                        lines.append(f"- **{rec.file_path}**: {rec.specific_action} ({rec.estimated_effort})")
                lines.append("")

            lines.extend([
                "## 📋 All Recommendations",
                "",
            ])

            for i, rec in enumerate(plan.recommendations, 1):
                priority_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵"}.get(rec.priority, "⚪")

                lines.extend([
                    f"### {i}. {priority_emoji} {rec.file_path or 'General'}",
                    "",
                    f"**Priority:** {rec.priority.upper()}",
                    f"**Effort:** {rec.estimated_effort}",
                    f"**Type:** {rec.resolution_type}",
                    "",
                    f"**Business Impact:**",
                    rec.business_impact,
                    "",
                    f"**Action Required:**",
                    rec.specific_action,
                    ""
                ])

                if rec.before_snippet and rec.after_snippet:
                    lines.extend([
                        "**Before:**",
                        "```",
                        rec.before_snippet,
                        "```",
                        "",
                        "**After:**",
                        "```",
                        rec.after_snippet,
                        "```",
                        ""
                    ])

                lines.extend([
                    f"**Why:** {rec.rationale}",
                    "",
                    "---",
                    ""
                ])

            return "\n".join(lines)

        else:
            return f"Unsupported format: {format}"
