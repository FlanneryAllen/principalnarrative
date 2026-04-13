"""
Cache Service for Analysis Results

Handles caching and retrieval of website analysis results to:
- Reduce API costs (especially for AI analysis)
- Speed up repeat analyses
- Enable historical tracking
"""

import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from pathlib import Path

from ..database import get_database


class CacheService:
    """Manages caching of analysis results"""

    def __init__(self, cache_duration_hours: int = 24):
        """
        Initialize cache service

        Args:
            cache_duration_hours: How long to keep cached results (default: 24 hours)
        """
        self.db = get_database()
        self.cache_duration = timedelta(hours=cache_duration_hours)

    def _generate_cache_key(self, url: str, analysis_type: str, **kwargs) -> str:
        """Generate unique cache key for URL and parameters"""
        # Include analysis type and relevant parameters
        cache_input = f"{url}|{analysis_type}|{kwargs.get('max_pages', 20)}|{kwargs.get('render_js', False)}"
        return hashlib.sha256(cache_input.encode()).hexdigest()

    def get_cached_result(
        self,
        url: str,
        analysis_type: str,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached analysis result if available and not expired

        Args:
            url: Website URL or path
            analysis_type: 'standard', 'ai', or 'competitive'
            **kwargs: Additional parameters (max_pages, render_js, etc.)

        Returns:
            Cached result dict or None if not found/expired
        """
        cache_key = self._generate_cache_key(url, analysis_type, **kwargs)

        cursor = self.db.conn.cursor()
        cursor.execute("""
            SELECT result_json, created_at, expires_at
            FROM analysis_cache
            WHERE url_hash = ? AND analysis_type = ?
        """, (cache_key, analysis_type))

        row = cursor.fetchone()

        if not row:
            return None

        # Check if expired
        expires_at = datetime.fromisoformat(row['expires_at']) if row['expires_at'] else None
        if expires_at and datetime.now() > expires_at:
            # Delete expired cache
            self.delete_cached_result(url, analysis_type, **kwargs)
            return None

        # Return cached result with metadata
        result = json.loads(row['result_json'])
        result['_cache_metadata'] = {
            'cached': True,
            'cached_at': row['created_at'],
            'expires_at': row['expires_at']
        }

        return result

    def save_result(
        self,
        url: str,
        analysis_type: str,
        result: Dict[str, Any],
        **kwargs
    ):
        """
        Save analysis result to cache

        Args:
            url: Website URL or path
            analysis_type: 'standard', 'ai', or 'competitive'
            result: Analysis result dictionary
            **kwargs: Additional parameters (max_pages, render_js, etc.)
        """
        cache_key = self._generate_cache_key(url, analysis_type, **kwargs)
        created_at = datetime.now()
        expires_at = created_at + self.cache_duration

        # Remove cache metadata if present
        result_copy = result.copy()
        result_copy.pop('_cache_metadata', None)

        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO analysis_cache
            (url_hash, url, analysis_type, result_json, created_at, expires_at, max_pages, render_js)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            cache_key,
            url,
            analysis_type,
            json.dumps(result_copy),
            created_at.isoformat(),
            expires_at.isoformat(),
            kwargs.get('max_pages', 20),
            kwargs.get('render_js', False)
        ))

        self.db.conn.commit()

        print(f"✅ Cached {analysis_type} analysis for {url}")

    def delete_cached_result(
        self,
        url: str,
        analysis_type: str,
        **kwargs
    ):
        """Delete cached result"""
        cache_key = self._generate_cache_key(url, analysis_type, **kwargs)

        cursor = self.db.conn.cursor()
        cursor.execute("""
            DELETE FROM analysis_cache
            WHERE url_hash = ? AND analysis_type = ?
        """, (cache_key, analysis_type))

        self.db.conn.commit()

    def clear_expired_cache(self):
        """Remove all expired cache entries"""
        cursor = self.db.conn.cursor()
        cursor.execute("""
            DELETE FROM analysis_cache
            WHERE expires_at IS NOT NULL AND expires_at < ?
        """, (datetime.now().isoformat(),))

        deleted = cursor.rowcount
        self.db.conn.commit()

        print(f"🗑️  Cleared {deleted} expired cache entries")
        return deleted

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        cursor = self.db.conn.cursor()

        # Total cached
        cursor.execute("SELECT COUNT(*) as total FROM analysis_cache")
        total = cursor.fetchone()['total']

        # By type
        cursor.execute("""
            SELECT analysis_type, COUNT(*) as count
            FROM analysis_cache
            GROUP BY analysis_type
        """)
        by_type = {row['analysis_type']: row['count'] for row in cursor.fetchall()}

        # Expired
        cursor.execute("""
            SELECT COUNT(*) as expired
            FROM analysis_cache
            WHERE expires_at IS NOT NULL AND expires_at < ?
        """, (datetime.now().isoformat(),))
        expired = cursor.fetchone()['expired']

        return {
            'total_cached': total,
            'by_type': by_type,
            'expired': expired,
            'active': total - expired
        }


# Singleton instance
_cache_service: Optional[CacheService] = None


def get_cache_service() -> CacheService:
    """Get or create cache service instance"""
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service


if __name__ == "__main__":
    # Test cache service
    print("🧪 Testing Cache Service\n")

    cache = CacheService()

    # Test caching
    test_url = "https://example.com"
    test_result = {
        "summary": {"total_claims": 10, "total_proof": 15},
        "claims": ["claim1", "claim2"],
        "proof": ["proof1", "proof2"]
    }

    # Save to cache
    cache.save_result(test_url, "standard", test_result, max_pages=20)

    # Retrieve from cache
    cached = cache.get_cached_result(test_url, "standard", max_pages=20)

    if cached:
        print("✅ Cache hit!")
        print(f"   Cached at: {cached['_cache_metadata']['cached_at']}")
        print(f"   Claims: {cached['summary']['total_claims']}")
    else:
        print("❌ Cache miss")

    # Get stats
    stats = cache.get_cache_stats()
    print(f"\n📊 Cache Stats:")
    print(f"   Total: {stats['total_cached']}")
    print(f"   Active: {stats['active']}")
    print(f"   Expired: {stats['expired']}")

    print("\n✅ Test complete")
