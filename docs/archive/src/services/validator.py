"""
Service for validating claims against the narrative layer.
"""
import re
from typing import Optional, Any
from datetime import datetime, timedelta

from ..config import settings
from ..models import (
    ValidateRequest,
    ValidationResult,
    ProofReference,
    DriftType
)
from .narrative import NarrativeService


class ValidatorService:
    """Service for validating claims against proof and narrative constraints."""

    def __init__(self, narrative_service: Optional[NarrativeService] = None):
        self.narrative = narrative_service or NarrativeService()

    def validate(self, request: ValidateRequest) -> ValidationResult:
        """Validate a claim against the narrative layer."""
        claim = request.claim
        issues = []
        suggestions = []
        drift_risks = []
        proof_refs = []
        confidence = 1.0

        # Check for forbidden terms
        forbidden_issues = self._check_forbidden_terms(claim)
        if forbidden_issues:
            issues.extend(forbidden_issues['issues'])
            suggestions.extend(forbidden_issues['suggestions'])
            drift_risks.append(f"{DriftType.NAMING.value}: Uses forbidden terminology")
            confidence -= 0.2 * len(forbidden_issues['issues'])

        # Check for numeric claims that need proof
        if request.require_proof:
            numeric_results = self._check_numeric_claims(claim)
            if numeric_results['unverified_claims']:
                issues.extend(numeric_results['issues'])
                suggestions.extend(numeric_results['suggestions'])
                drift_risks.append(f"{DriftType.PROOF.value}: Numeric claim without proof backing")
                confidence -= 0.3
            proof_refs.extend(numeric_results['proof_refs'])

        # Check feature claims against feature registry
        feature_results = self._check_feature_claims(claim)
        if feature_results['issues']:
            issues.extend(feature_results['issues'])
            suggestions.extend(feature_results['suggestions'])
            drift_risks.append(f"{DriftType.PROMISE_DELIVERY.value}: Feature availability mismatch")
            confidence -= 0.25

        # Check messaging alignment
        messaging_results = self._check_messaging_alignment(claim)
        if messaging_results['issues']:
            issues.extend(messaging_results['issues'])
            suggestions.extend(messaging_results['suggestions'])
            drift_risks.append(f"{DriftType.MESSAGING.value}: Messaging guideline violation")
            confidence -= 0.15

        # Clamp confidence
        confidence = max(0.0, min(1.0, confidence))

        return ValidationResult(
            valid=len(issues) == 0,
            confidence=confidence,
            claim=claim,
            issues=issues,
            suggestions=suggestions,
            proof_references=proof_refs,
            drift_risks=drift_risks
        )

    def _check_forbidden_terms(self, claim: str) -> dict[str, Any]:
        """Check claim for forbidden terminology."""
        result = {'issues': [], 'suggestions': []}

        forbidden_terms = self.narrative.get_forbidden_terms()
        claim_lower = claim.lower()

        for term_info in forbidden_terms:
            term = term_info.get('term', '').strip()
            if not term:
                continue

            # Check for the forbidden term (case-insensitive, word boundary)
            pattern = r'\b' + re.escape(term.lower()) + r'\b'
            if re.search(pattern, claim_lower):
                result['issues'].append(
                    f"Uses forbidden term '{term}': {term_info.get('reason', 'Not allowed')}"
                )
                alternative = term_info.get('alternative', '').strip()
                if alternative:
                    result['suggestions'].append(f"Replace '{term}' with '{alternative}'")

        return result

    def _check_numeric_claims(self, claim: str) -> dict[str, Any]:
        """Check numeric claims against proof metrics."""
        result = {
            'issues': [],
            'suggestions': [],
            'proof_refs': [],
            'unverified_claims': []
        }

        # Find numeric patterns in claim
        # Matches: 47 seconds, 73%, 2x, 4.2 hours, etc.
        numeric_patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:seconds?|sec|s)\b',
            r'(\d+(?:\.\d+)?)\s*%',
            r'(\d+(?:\.\d+)?)\s*x\b',
            r'(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b',
            r'(\d+(?:\.\d+)?)\s*(?:times?)\s+(?:faster|slower|better|more)',
        ]

        found_numbers = []
        for pattern in numeric_patterns:
            matches = re.findall(pattern, claim, re.IGNORECASE)
            found_numbers.extend(matches)

        if not found_numbers:
            return result

        # Get proof metrics
        metrics = self.narrative.get_proof_metrics()

        # Try to match claim numbers to metrics
        for num_str in found_numbers:
            try:
                num = float(num_str)
            except ValueError:
                continue

            matched = False
            for metric in metrics:
                metric_value = metric.get('value')
                if metric_value is None:
                    continue

                # Check if the claim number matches or is close to a metric
                try:
                    metric_num = float(metric_value)
                    # Allow 10% tolerance for matching
                    if abs(metric_num - num) / max(metric_num, 1) < 0.1:
                        matched = True
                        verified = metric.get('verified', False)
                        verified_date = metric.get('verified_date')

                        # Check if proof is stale
                        is_stale = False
                        if verified_date:
                            try:
                                vdate = datetime.strptime(verified_date, '%Y-%m-%d')
                                if datetime.now() - vdate > timedelta(days=settings.proof_max_age_days):
                                    is_stale = True
                            except ValueError:
                                pass

                        result['proof_refs'].append(ProofReference(
                            id=metric.get('id', 'unknown'),
                            name=metric.get('name', 'Unknown Metric'),
                            value=metric_value,
                            unit=metric.get('unit', ''),
                            verified=verified and not is_stale,
                            verified_date=verified_date,
                            measurement_date=metric.get('measurement_date')
                        ))

                        if not verified:
                            result['issues'].append(
                                f"Claim uses unverified metric '{metric.get('name')}'"
                            )
                            result['suggestions'].append(
                                f"Get metric {metric.get('id')} verified before using in external claims"
                            )
                        elif is_stale:
                            result['issues'].append(
                                f"Proof for '{metric.get('name')}' is stale (verified {verified_date})"
                            )
                            result['suggestions'].append(
                                f"Re-verify metric {metric.get('id')} - last verified over {settings.proof_max_age_days} days ago"
                            )
                        break
                except (ValueError, TypeError):
                    continue

            if not matched:
                result['unverified_claims'].append(num_str)
                result['issues'].append(
                    f"Numeric claim '{num_str}' has no matching proof metric"
                )
                result['suggestions'].append(
                    "Add a verified metric to the proof layer or adjust the claim"
                )

        return result

    def _check_feature_claims(self, claim: str) -> dict[str, Any]:
        """Check if feature claims match feature registry status."""
        result = {'issues': [], 'suggestions': []}

        features = self.narrative.get_feature_registry()
        claim_lower = claim.lower()

        # Keywords that indicate availability claims
        availability_keywords = ['available', 'supports', 'includes', 'offers', 'provides', 'has']

        for feature in features:
            feature_name = feature.get('name', '').lower()
            status = feature.get('status', '').lower()
            marketing_status = feature.get('marketing_status', '').lower()

            if not feature_name:
                continue

            # Check if feature is mentioned in claim
            if feature_name in claim_lower:
                # Check if claim implies availability
                implies_available = any(kw in claim_lower for kw in availability_keywords)

                if implies_available:
                    if status == 'planned':
                        result['issues'].append(
                            f"Claim implies '{feature.get('name')}' is available, but status is 'Planned'"
                        )
                        result['suggestions'].append(
                            f"Remove reference to '{feature.get('name')}' or mark as 'coming soon'"
                        )
                    elif status == 'beta' and 'coming' not in claim_lower:
                        result['issues'].append(
                            f"'{feature.get('name')}' is in Beta - should not claim general availability"
                        )
                        result['suggestions'].append(
                            "Add 'beta' or 'coming soon' qualifier, or wait for GA release"
                        )

        return result

    def _check_messaging_alignment(self, claim: str) -> dict[str, Any]:
        """Check claim alignment with messaging guidelines."""
        result = {'issues': [], 'suggestions': []}

        claim_lower = claim.lower()

        # Check for hyperbolic language (from voice.md "We Are Not")
        hyperbolic_terms = ['revolutionary', 'game-changing', '10x', 'best-in-class', 'world-class']
        for term in hyperbolic_terms:
            if term in claim_lower:
                result['issues'].append(
                    f"Uses hyperbolic term '{term}' - violates voice guidelines"
                )
                result['suggestions'].append(
                    f"Replace '{term}' with specific, provable claim"
                )

        # Check for "replace" language (core value violation)
        replace_patterns = [
            r'replace\s+(?:developers?|engineers?|reviewers?|humans?)',
            r'(?:eliminates?|removes?)\s+(?:the\s+)?need\s+for\s+(?:human|developer)',
        ]
        for pattern in replace_patterns:
            if re.search(pattern, claim_lower):
                result['issues'].append(
                    "Implies replacing humans - violates 'Team Amplification' value"
                )
                result['suggestions'].append(
                    "Reframe as 'augments', 'amplifies', or 'assists' human reviewers"
                )

        return result

    def quick_validate(self, claim: str) -> tuple[bool, list[str]]:
        """Quick validation returning just valid/invalid and issues."""
        result = self.validate(ValidateRequest(claim=claim))
        return result.valid, result.issues
