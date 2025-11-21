"""
Service for reading and parsing narrative files.
"""
import json
import re
from pathlib import Path
from typing import Optional, Any
import yaml

from ..config import settings
from ..models import NarrativeType, NarrativeUnit, QueryRequest


class NarrativeService:
    """Service for reading and querying narrative units."""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or settings.narrative_base_path

    def _parse_frontmatter(self, content: str) -> tuple[dict[str, Any], str]:
        """Parse YAML frontmatter from markdown content."""
        frontmatter = {}
        body = content

        # Match YAML frontmatter between --- markers
        match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', content, re.DOTALL)
        if match:
            try:
                frontmatter = yaml.safe_load(match.group(1)) or {}
            except yaml.YAMLError:
                frontmatter = {}
            body = match.group(2)

        return frontmatter, body

    def _read_markdown_file(self, file_path: Path) -> Optional[NarrativeUnit]:
        """Read and parse a markdown narrative file."""
        try:
            content = file_path.read_text(encoding='utf-8')
            frontmatter, body = self._parse_frontmatter(content)

            # Determine type from frontmatter or path
            narrative_type = frontmatter.get('type')
            if narrative_type:
                try:
                    narrative_type = NarrativeType(narrative_type)
                except ValueError:
                    narrative_type = NarrativeType.STRATEGY  # default

            # Get relative path from base
            rel_path = file_path.relative_to(self.base_path)

            return NarrativeUnit(
                file_path=str(rel_path),
                type=narrative_type or self._infer_type_from_path(file_path),
                subtype=frontmatter.get('subtype'),
                version=frontmatter.get('version'),
                status=frontmatter.get('status'),
                updated=frontmatter.get('updated'),
                tags=frontmatter.get('tags', []),
                content=body,
                frontmatter=frontmatter
            )
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            return None

    def _read_json_file(self, file_path: Path) -> Optional[NarrativeUnit]:
        """Read and parse a JSON narrative file."""
        try:
            content = file_path.read_text(encoding='utf-8')
            data = json.loads(content)

            # Determine type from data or path
            narrative_type = data.get('type')
            if narrative_type:
                try:
                    narrative_type = NarrativeType(narrative_type)
                except ValueError:
                    narrative_type = self._infer_type_from_path(file_path)

            rel_path = file_path.relative_to(self.base_path)

            return NarrativeUnit(
                file_path=str(rel_path),
                type=narrative_type or self._infer_type_from_path(file_path),
                subtype=data.get('subtype'),
                version=data.get('version'),
                status='active',  # JSON files are typically active data
                updated=data.get('updated'),
                tags=data.get('tags', []),
                content=content,
                frontmatter=data
            )
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            return None

    def _infer_type_from_path(self, file_path: Path) -> NarrativeType:
        """Infer narrative type from file path."""
        parts = file_path.relative_to(self.base_path).parts

        if parts:
            first_dir = parts[0].lower()
            type_map = {
                'strategy': NarrativeType.STRATEGY,
                'messaging': NarrativeType.MESSAGING,
                'naming': NarrativeType.NAMING,
                'marketing': NarrativeType.MARKETING,
                'proof': NarrativeType.PROOF,
                'story': NarrativeType.STORY,
                'constraints': NarrativeType.CONSTRAINTS,
                'definitions': NarrativeType.DEFINITIONS,
                'coherence': NarrativeType.COHERENCE,
            }
            return type_map.get(first_dir, NarrativeType.STRATEGY)

        return NarrativeType.STRATEGY

    def get_all_units(self) -> list[NarrativeUnit]:
        """Get all narrative units from the file system."""
        units = []

        # Scan for markdown and JSON files
        for pattern in ['**/*.md', '**/*.json']:
            for file_path in self.base_path.glob(pattern):
                # Skip hidden directories and meta files
                if any(part.startswith('.') for part in file_path.parts):
                    continue

                if file_path.suffix == '.md':
                    unit = self._read_markdown_file(file_path)
                elif file_path.suffix == '.json':
                    unit = self._read_json_file(file_path)
                else:
                    continue

                if unit:
                    units.append(unit)

        return units

    def query(self, request: QueryRequest) -> list[NarrativeUnit]:
        """Query narrative units based on filters."""
        units = self.get_all_units()
        results = []

        for unit in units:
            # Filter by type
            if request.type and unit.type != request.type:
                continue

            # Filter by subtype
            if request.subtype and unit.subtype != request.subtype:
                continue

            # Filter by status
            if request.status and unit.status != request.status:
                continue

            # Filter by tags (any match)
            if request.tags:
                if not any(tag in unit.tags for tag in request.tags):
                    continue

            # Full-text search
            if request.search:
                search_lower = request.search.lower()
                content_lower = (unit.content or '').lower()
                if search_lower not in content_lower:
                    continue

            results.append(unit)

        return results

    def get_unit_by_path(self, file_path: str) -> Optional[NarrativeUnit]:
        """Get a specific narrative unit by file path."""
        full_path = self.base_path / file_path

        if not full_path.exists():
            return None

        if full_path.suffix == '.md':
            return self._read_markdown_file(full_path)
        elif full_path.suffix == '.json':
            return self._read_json_file(full_path)

        return None

    def get_proof_metrics(self) -> list[dict[str, Any]]:
        """Get all proof metrics from the proof layer."""
        metrics = []

        proof_path = self.base_path / 'proof'
        if not proof_path.exists():
            return metrics

        for json_file in proof_path.glob('**/*.json'):
            try:
                data = json.loads(json_file.read_text(encoding='utf-8'))
                if 'metrics' in data:
                    for metric in data['metrics']:
                        metric['_source_file'] = str(json_file.relative_to(self.base_path))
                        metrics.append(metric)
            except Exception:
                continue

        return metrics

    def get_forbidden_terms(self) -> list[dict[str, str]]:
        """Get forbidden terms from naming layer."""
        naming_unit = self.get_unit_by_path('naming/terminology.md')
        if not naming_unit or not naming_unit.content:
            return []

        # Parse forbidden terms table from markdown
        terms = []
        in_forbidden_section = False
        in_table = False

        for line in naming_unit.content.split('\n'):
            if '## Forbidden Terms' in line:
                in_forbidden_section = True
                continue

            if in_forbidden_section:
                if line.startswith('##'):
                    break
                if '|' in line and 'Forbidden' not in line and '---' not in line:
                    parts = [p.strip() for p in line.split('|')]
                    if len(parts) >= 4:
                        terms.append({
                            'term': parts[1],
                            'reason': parts[2],
                            'alternative': parts[3]
                        })

        return terms

    def get_feature_registry(self) -> list[dict[str, Any]]:
        """Get feature registry from marketing layer."""
        features = []
        marketing_unit = self.get_unit_by_path('marketing/feature-descriptions.md')

        if not marketing_unit or not marketing_unit.content:
            return features

        # Parse features from markdown (simplified)
        current_feature = {}
        for line in marketing_unit.content.split('\n'):
            if line.startswith('### ') and not line.startswith('### Feature'):
                if current_feature:
                    features.append(current_feature)
                current_feature = {'name': line.replace('### ', '').strip()}
            elif line.startswith('- **Internal ID**:'):
                current_feature['internal_id'] = line.split(':', 1)[1].strip()
            elif line.startswith('- **Status**:'):
                current_feature['status'] = line.split(':', 1)[1].strip()
            elif line.startswith('- **Marketing Status**:'):
                current_feature['marketing_status'] = line.split(':', 1)[1].strip()

        if current_feature:
            features.append(current_feature)

        return features
