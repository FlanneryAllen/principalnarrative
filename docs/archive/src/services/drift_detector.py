"""
Drift Detection Engine - Automatically scans narrative layers for drift.

Detects 7 types of drift:
1. Semantic Drift - Documentation contradicts code/changes
2. Strategic Drift - Implementations violate strategic intent
3. Messaging Drift - Text contradicts messaging pillars/voice
4. Naming Drift - Terminology diverges from canonical system
5. Proof Drift - Claims diverge from verified statistics
6. Promise-Delivery Drift - Marketing claims features that don't exist
7. Opportunity-Silence Drift - Capabilities exist but aren't communicated
"""
import re
import json
from datetime import datetime, timedelta
from ..logging_config import get_logger

from typing import Optional
from pathlib import Path
import uuid

from ..config import settings
from ..models import (
    DriftEvent,
    DriftType,
    DriftSeverity,
    DriftStatus,
)
from .narrative import NarrativeService
from .semantic_drift_detector import SemanticDriftDetector


logger = get_logger("services.drift_detector")


class DriftDetector:
    """
    Drift Detection Engine that scans all narrative layers for inconsistencies.
    """

    def __init__(self, narrative_service: Optional[NarrativeService] = None):
        self.narrative = narrative_service or NarrativeService()
        self.detected_drifts: list[DriftEvent] = []
        self.semantic_detector = SemanticDriftDetector(narrative_service=self.narrative)

    def run_full_scan(self, include_semantic: bool = True) -> list[DriftEvent]:
        """
        Run a complete drift scan across all layers.

        Args:
            include_semantic: If True, includes semantic drift detection using embeddings
        """
        self.detected_drifts = []

        logger.info("Starting drift detection scan...")
        logger.info("-" * 50)

        # Run pattern-based detectors
        self._detect_naming_drift()
        self._detect_proof_drift()
        self._detect_promise_delivery_drift()
        self._detect_opportunity_silence_drift()
        self._detect_messaging_drift()
        self._detect_stale_content()

        # Run semantic drift detection (embedding-based)
        if include_semantic:
            logger.info("Running semantic drift detection (embedding-based)...")
            try:
                semantic_drifts = self.semantic_detector.run_semantic_scan()
                self.detected_drifts.extend(semantic_drifts)
                logger.info(f"  Found {len(semantic_drifts)} semantic drift events")
            except Exception as e:
                logger.error(f"Semantic drift detection failed: {e}", exc_info=True)

        logger.info("-" * 50)
        logger.info(f"Scan complete. Found {len(self.detected_drifts)} drift events.")

        return self.detected_drifts

    def _create_drift_event(
        self,
        drift_type: DriftType,
        severity: DriftSeverity,
        source_unit: str,
        description: str,
        target_unit: Optional[str] = None,
        suggested_resolution: Optional[str] = None
    ) -> DriftEvent:
        """Create a new drift event."""
        event = DriftEvent(
            id=f"drift-{uuid.uuid4().hex[:8]}",
            type=drift_type,
            severity=severity,
            detected_at=datetime.now(),
            source_unit=source_unit,
            target_unit=target_unit,
            description=description,
            suggested_resolution=suggested_resolution,
            status=DriftStatus.OPEN
        )
        self.detected_drifts.append(event)
        return event

    # =========================================================================
    # NAMING DRIFT DETECTOR
    # =========================================================================

    def _detect_naming_drift(self) -> list[DriftEvent]:
        """Detect naming violations across all content."""
        logger.info("Scanning for naming drift...")
        events = []

        forbidden_terms = self.narrative.get_forbidden_terms()
        if not forbidden_terms:
            logger.debug("  No forbidden terms defined, skipping.")
            return events

        all_units = self.narrative.get_all_units()

        for unit in all_units:
            if not unit.content:
                continue

            content_lower = unit.content.lower()

            for term_info in forbidden_terms:
                term = term_info.get('term', '').strip()
                if not term:
                    continue

                # Word boundary search
                pattern = r'\b' + re.escape(term.lower()) + r'\b'
                matches = re.findall(pattern, content_lower)

                if matches:
                    event = self._create_drift_event(
                        drift_type=DriftType.NAMING,
                        severity=DriftSeverity.LOW,
                        source_unit=unit.file_path,
                        target_unit="naming/terminology.md",
                        description=f"Uses forbidden term '{term}' ({len(matches)} occurrence(s)). Reason: {term_info.get('reason', 'Not allowed')}",
                        suggested_resolution=f"Replace '{term}' with '{term_info.get('alternative', 'approved alternative')}'"
                    )
                    events.append(event)
                    logger.debug(f"  [NAMING] {unit.file_path}: '{term}' found")

        logger.info(f"  Found {len(events)} naming drift events.")
        return events

    # =========================================================================
    # PROOF DRIFT DETECTOR
    # =========================================================================

    def _detect_proof_drift(self) -> list[DriftEvent]:
        """Detect claims that don't match proof metrics."""
        logger.info("Scanning for proof drift...")
        events = []

        metrics = self.narrative.get_proof_metrics()
        metric_values = {m.get('id'): m for m in metrics}

        # Build a lookup of verified values
        verified_numbers = {}
        for m in metrics:
            if m.get('verified') and m.get('value') is not None:
                verified_numbers[float(m['value'])] = m

        # Scan marketing and messaging content for numeric claims
        marketing_units = [
            u for u in self.narrative.get_all_units()
            if u.type.value in ['marketing', 'messaging']
        ]

        # Common claim patterns
        claim_patterns = [
            (r'(\d+(?:\.\d+)?)\s*x\s+(?:faster|better|more)', 'multiplier'),
            (r'(\d+(?:\.\d+)?)\s*%\s+(?:faster|reduction|improvement|increase)', 'percentage'),
            (r'(\d+(?:\.\d+)?)\s*(?:seconds?|sec)\b', 'time'),
            (r'(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*/?\s*(?:week|day|month)?', 'hours'),
        ]

        for unit in marketing_units:
            if not unit.content:
                continue

            for pattern, claim_type in claim_patterns:
                matches = re.findall(pattern, unit.content, re.IGNORECASE)

                for match in matches:
                    try:
                        num = float(match)
                    except ValueError:
                        continue

                    # Check if this number is backed by proof
                    found_proof = False
                    for verified_num, metric in verified_numbers.items():
                        # Allow 10% tolerance
                        if abs(verified_num - num) / max(verified_num, 1) < 0.1:
                            found_proof = True

                            # Check if proof is stale
                            verified_date = metric.get('verified_date')
                            if verified_date:
                                try:
                                    vdate = datetime.strptime(verified_date, '%Y-%m-%d')
                                    if datetime.now() - vdate > timedelta(days=settings.proof_max_age_days):
                                        event = self._create_drift_event(
                                            drift_type=DriftType.PROOF,
                                            severity=DriftSeverity.MEDIUM,
                                            source_unit=unit.file_path,
                                            target_unit=metric.get('_source_file', 'proof/'),
                                            description=f"Claim '{num}' references stale proof (verified {verified_date}, over {settings.proof_max_age_days} days ago)",
                                            suggested_resolution=f"Re-verify metric {metric.get('id')} before continuing to use this claim"
                                        )
                                        events.append(event)
                                        logger.debug(f"  [PROOF-STALE] {unit.file_path}: {num} is stale")
                                except ValueError:
                                    pass
                            break

                    if not found_proof and num > 1:  # Ignore small numbers
                        # Check if it's a common false positive (dates, versions, etc.)
                        if num > 100 and num < 3000:  # Likely a year
                            continue

                        event = self._create_drift_event(
                            drift_type=DriftType.PROOF,
                            severity=DriftSeverity.HIGH,
                            source_unit=unit.file_path,
                            target_unit="proof/",
                            description=f"Numeric claim '{num}' ({claim_type}) has no matching verified proof metric",
                            suggested_resolution="Add a verified metric to the proof layer or remove/adjust the claim"
                        )
                        events.append(event)
                        logger.debug(f"  [PROOF-MISSING] {unit.file_path}: {num} unverified")

        logger.info(f"  Found {len(events)} proof drift events.")
        return events

    # =========================================================================
    # PROMISE-DELIVERY DRIFT DETECTOR
    # =========================================================================

    def _detect_promise_delivery_drift(self) -> list[DriftEvent]:
        """Detect when marketing claims features that aren't shipped."""
        logger.info("Scanning for promise-delivery drift...")
        events = []

        features = self.narrative.get_feature_registry()
        if not features:
            logger.debug("  No feature registry found, skipping.")
            return events

        # Build feature status map
        feature_status = {}
        for f in features:
            name = f.get('name', '').lower()
            internal_id = f.get('internal_id', '').lower()
            status = f.get('status', '').lower()
            marketing_status = f.get('marketing_status', '').lower()

            feature_status[name] = {'status': status, 'marketing_status': marketing_status}
            if internal_id:
                feature_status[internal_id] = {'status': status, 'marketing_status': marketing_status}

        # Availability claim keywords
        availability_keywords = ['available', 'offers', 'includes', 'supports', 'provides', 'delivers', 'enables']

        # Scan marketing content
        marketing_units = [
            u for u in self.narrative.get_all_units()
            if u.type.value == 'marketing'
        ]

        for unit in marketing_units:
            if not unit.content:
                continue

            content_lower = unit.content.lower()

            for feature_name, info in feature_status.items():
                if feature_name in content_lower:
                    # Check if availability is implied
                    implies_available = any(kw in content_lower for kw in availability_keywords)

                    if implies_available:
                        status = info['status']

                        if status == 'planned':
                            event = self._create_drift_event(
                                drift_type=DriftType.PROMISE_DELIVERY,
                                severity=DriftSeverity.HIGH,
                                source_unit=unit.file_path,
                                target_unit="marketing/feature-descriptions.md",
                                description=f"Claims '{feature_name}' is available, but feature status is 'Planned' (not yet built)",
                                suggested_resolution=f"Remove reference to '{feature_name}' or clearly mark as 'coming soon'"
                            )
                            events.append(event)
                            logger.debug(f"  [PROMISE>DELIVERY] {unit.file_path}: '{feature_name}' claimed but Planned")

                        elif status == 'beta':
                            # Check if "beta" or "coming" qualifier exists
                            feature_context = content_lower[max(0, content_lower.find(feature_name)-50):content_lower.find(feature_name)+100]
                            if 'beta' not in feature_context and 'coming' not in feature_context and 'soon' not in feature_context:
                                event = self._create_drift_event(
                                    drift_type=DriftType.PROMISE_DELIVERY,
                                    severity=DriftSeverity.MEDIUM,
                                    source_unit=unit.file_path,
                                    target_unit="marketing/feature-descriptions.md",
                                    description=f"Claims '{feature_name}' availability without Beta qualifier",
                                    suggested_resolution="Add 'beta' or 'coming soon' qualifier, or wait for GA release"
                                )
                                events.append(event)
                                logger.debug(f"  [PROMISE>DELIVERY] {unit.file_path}: '{feature_name}' needs Beta qualifier")

        logger.info(f"  Found {len(events)} promise-delivery drift events.")
        return events

    # =========================================================================
    # OPPORTUNITY-SILENCE DRIFT DETECTOR
    # =========================================================================

    def _detect_opportunity_silence_drift(self) -> list[DriftEvent]:
        """Detect shipped features that aren't being marketed."""
        logger.info("Scanning for opportunity-silence drift...")
        events = []

        features = self.narrative.get_feature_registry()
        if not features:
            return events

        # Find shipped features with inactive marketing
        for f in features:
            status = f.get('status', '').lower()
            marketing_status = f.get('marketing_status', '').lower()
            name = f.get('name', '')

            if status == 'shipped' and marketing_status in ['not active', 'inactive', 'draft', '']:
                event = self._create_drift_event(
                    drift_type=DriftType.OPPORTUNITY_SILENCE,
                    severity=DriftSeverity.LOW,
                    source_unit="marketing/feature-descriptions.md",
                    description=f"Feature '{name}' is shipped but marketing status is '{marketing_status or 'not set'}' - potential missed marketing opportunity",
                    suggested_resolution=f"Consider activating marketing for '{name}' or document why it's intentionally not promoted"
                )
                events.append(event)
                logger.debug(f"  [OPPORTUNITY] '{name}' shipped but not marketed")

        # Check for strong proof not reflected in messaging
        metrics = self.narrative.get_proof_metrics()
        messaging_units = [u for u in self.narrative.get_all_units() if u.type.value == 'messaging']
        messaging_content = ' '.join([u.content or '' for u in messaging_units]).lower()

        for metric in metrics:
            # Look for significant improvements
            notes = metric.get('notes', '').lower()
            if 'improvement' in notes or 'down from' in notes or 'up from' in notes:
                metric_name = metric.get('name', '').lower()
                metric_id = metric.get('id', '')

                # Check if this improvement is mentioned in messaging
                if metric_name not in messaging_content and metric_id not in messaging_content:
                    event = self._create_drift_event(
                        drift_type=DriftType.OPPORTUNITY_SILENCE,
                        severity=DriftSeverity.LOW,
                        source_unit=metric.get('_source_file', 'proof/'),
                        target_unit="messaging/",
                        description=f"Metric '{metric.get('name')}' shows significant improvement (notes: {metric.get('notes')}) but isn't prominently featured in messaging",
                        suggested_resolution="Consider highlighting this improvement in messaging pillars or marketing content"
                    )
                    events.append(event)
                    logger.debug(f"  [OPPORTUNITY] Metric '{metric.get('name')}' improvement not in messaging")

        logger.info(f"  Found {len(events)} opportunity-silence drift events.")
        return events

    # =========================================================================
    # MESSAGING DRIFT DETECTOR
    # =========================================================================

    def _detect_messaging_drift(self) -> list[DriftEvent]:
        """Detect violations of messaging guidelines."""
        logger.info("Scanning for messaging drift...")
        events = []

        # Hyperbolic terms to flag (from voice.md "We Are Not")
        hyperbolic_terms = [
            ('revolutionary', 'fundamentally different approach'),
            ('game-changing', 'significant improvement'),
            ('10x', 'specific measured improvement'),
            ('best-in-class', 'cite specific metric'),
            ('world-class', 'cite specific metric'),
            ('automagically', 'automatically'),
        ]

        # "Replace humans" patterns to flag
        replace_patterns = [
            (r'replace\s+(?:developers?|engineers?|reviewers?|humans?)', 'augments/amplifies'),
            (r'eliminates?\s+(?:the\s+)?need\s+for\s+(?:human|developer)', 'reduces the burden on'),
            (r'no\s+(?:human|developer)\s+(?:needed|required)', 'minimal human oversight'),
        ]

        all_units = self.narrative.get_all_units()

        for unit in all_units:
            if not unit.content:
                continue

            content_lower = unit.content.lower()

            # Check hyperbolic terms
            for term, alternative in hyperbolic_terms:
                if term in content_lower:
                    event = self._create_drift_event(
                        drift_type=DriftType.MESSAGING,
                        severity=DriftSeverity.MEDIUM,
                        source_unit=unit.file_path,
                        target_unit="messaging/voice.md",
                        description=f"Uses hyperbolic term '{term}' - violates voice guidelines",
                        suggested_resolution=f"Replace '{term}' with '{alternative}' or specific provable claim"
                    )
                    events.append(event)
                    logger.debug(f"  [MESSAGING] {unit.file_path}: hyperbolic '{term}'")

            # Check replace patterns
            for pattern, alternative in replace_patterns:
                if re.search(pattern, content_lower):
                    event = self._create_drift_event(
                        drift_type=DriftType.MESSAGING,
                        severity=DriftSeverity.HIGH,
                        source_unit=unit.file_path,
                        target_unit="messaging/voice.md",
                        description=f"Contains 'replace humans' language - violates core value 'Team Amplification'",
                        suggested_resolution=f"Reframe using: '{alternative}'"
                    )
                    events.append(event)
                    logger.debug(f"  [MESSAGING] {unit.file_path}: 'replace humans' language")

        logger.info(f"  Found {len(events)} messaging drift events.")
        return events

    # =========================================================================
    # STALE CONTENT DETECTOR
    # =========================================================================

    def _detect_stale_content(self) -> list[DriftEvent]:
        """Detect content that hasn't been updated recently."""
        logger.info("Scanning for stale content...")
        events = []

        stale_threshold_days = 90
        all_units = self.narrative.get_all_units()

        for unit in all_units:
            updated = unit.frontmatter.get('updated') or unit.frontmatter.get('updated_at')
            if not updated:
                continue

            try:
                if isinstance(updated, str):
                    # Try various date formats
                    for fmt in ['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%SZ']:
                        try:
                            update_date = datetime.strptime(updated.split('T')[0], '%Y-%m-%d')
                            break
                        except ValueError:
                            continue
                    else:
                        continue
                else:
                    continue

                days_old = (datetime.now() - update_date).days

                if days_old > stale_threshold_days:
                    event = self._create_drift_event(
                        drift_type=DriftType.SEMANTIC,
                        severity=DriftSeverity.LOW,
                        source_unit=unit.file_path,
                        description=f"Content last updated {days_old} days ago ({updated}) - may be stale",
                        suggested_resolution=f"Review and update this document or confirm it's still accurate"
                    )
                    events.append(event)
                    logger.debug(f"  [STALE] {unit.file_path}: {days_old} days old")

            except Exception:
                continue

        logger.info(f"  Found {len(events)} stale content events.")
        return events

    # =========================================================================
    # REPORT GENERATION
    # =========================================================================

    def generate_report(self) -> str:
        """Generate a human-readable drift report."""
        lines = [
            "=" * 60,
            "NARRATIVE DRIFT DETECTION REPORT",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "=" * 60,
            "",
        ]

        if not self.detected_drifts:
            lines.append("No drift events detected. All clear!")
            return "\n".join(lines)

        # Group by severity
        by_severity = {
            DriftSeverity.CRITICAL: [],
            DriftSeverity.HIGH: [],
            DriftSeverity.MEDIUM: [],
            DriftSeverity.LOW: [],
        }

        for event in self.detected_drifts:
            by_severity[event.severity].append(event)

        # Summary
        lines.append("SUMMARY")
        lines.append("-" * 40)
        lines.append(f"Total drift events: {len(self.detected_drifts)}")
        lines.append(f"  Critical: {len(by_severity[DriftSeverity.CRITICAL])}")
        lines.append(f"  High:     {len(by_severity[DriftSeverity.HIGH])}")
        lines.append(f"  Medium:   {len(by_severity[DriftSeverity.MEDIUM])}")
        lines.append(f"  Low:      {len(by_severity[DriftSeverity.LOW])}")
        lines.append("")

        # Group by type
        by_type = {}
        for event in self.detected_drifts:
            by_type.setdefault(event.type.value, []).append(event)

        lines.append("BY TYPE")
        lines.append("-" * 40)
        for dtype, events in sorted(by_type.items()):
            lines.append(f"  {dtype}: {len(events)}")
        lines.append("")

        # Detailed events (high severity first)
        for severity in [DriftSeverity.CRITICAL, DriftSeverity.HIGH, DriftSeverity.MEDIUM, DriftSeverity.LOW]:
            events = by_severity[severity]
            if not events:
                continue

            lines.append(f"{severity.value.upper()} SEVERITY ({len(events)})")
            lines.append("-" * 40)

            for event in events:
                lines.append(f"[{event.type.value}] {event.source_unit}")
                lines.append(f"  {event.description}")
                if event.suggested_resolution:
                    lines.append(f"  -> {event.suggested_resolution}")
                lines.append("")

        return "\n".join(lines)

    def save_results(self, output_path: Optional[Path] = None) -> Path:
        """Save drift results to coherence/current.json."""
        if output_path is None:
            output_path = self.narrative.base_path / 'coherence' / 'current.json'

        # Load existing data
        if output_path.exists():
            data = json.loads(output_path.read_text(encoding='utf-8'))
        else:
            data = {}

        # Update drift events
        data['drift_events'] = [
            {
                'id': e.id,
                'type': e.type.value,
                'severity': e.severity.value,
                'detected_at': e.detected_at.isoformat(),
                'source_unit': e.source_unit,
                'target_unit': e.target_unit,
                'description': e.description,
                'suggested_resolution': e.suggested_resolution,
                'status': e.status.value
            }
            for e in self.detected_drifts
        ]

        data['last_full_scan'] = datetime.now().isoformat()
        data['updated'] = datetime.now().strftime('%Y-%m-%d')

        output_path.write_text(json.dumps(data, indent=2), encoding='utf-8')

        return output_path
