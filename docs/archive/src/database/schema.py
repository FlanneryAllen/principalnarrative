"""
Database Schema for Narrative Analysis Caching and History

SQLite database for:
- Caching analysis results
- Historical tracking
- Trend analysis
"""

import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional


class Database:
    """SQLite database manager"""

    def __init__(self, db_path: Optional[Path] = None):
        """Initialize database connection"""
        if db_path is None:
            db_path = Path(__file__).parent.parent.parent / "data" / "narrative_analysis.db"

        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.conn = None
        self.connect()
        self.initialize_schema()

    def connect(self):
        """Connect to database"""
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row  # Return rows as dicts

    def initialize_schema(self):
        """Create tables if they don't exist"""
        cursor = self.conn.cursor()

        # Analysis cache table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url_hash TEXT NOT NULL,
                url TEXT NOT NULL,
                analysis_type TEXT NOT NULL,
                result_json TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                expires_at TIMESTAMP,
                max_pages INTEGER,
                render_js BOOLEAN,
                UNIQUE(url_hash, analysis_type)
            )
        """)

        # Historical analysis snapshots
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url_hash TEXT NOT NULL,
                url TEXT NOT NULL,
                analysis_type TEXT NOT NULL,
                result_json TEXT NOT NULL,
                snapshot_date TIMESTAMP NOT NULL,

                -- Key metrics for quick queries
                total_claims INTEGER,
                total_proof INTEGER,
                total_personas INTEGER,
                proof_ratio REAL,
                consistency_score INTEGER,
                overall_score REAL,

                -- Additional metadata
                pages_analyzed INTEGER,
                max_pages INTEGER,
                render_js BOOLEAN,

                INDEX(url_hash, snapshot_date),
                INDEX(snapshot_date)
            )
        """)

        # Competitive analysis history
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS competitive_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                comparison_hash TEXT NOT NULL,
                site_names TEXT NOT NULL,
                result_json TEXT NOT NULL,
                snapshot_date TIMESTAMP NOT NULL,

                -- Summary metrics
                total_sites INTEGER,
                your_rank_claims INTEGER,
                your_rank_proof INTEGER,
                total_gaps INTEGER,
                high_priority_gaps INTEGER,

                INDEX(comparison_hash, snapshot_date),
                INDEX(snapshot_date)
            )
        """)

        # Batch analysis jobs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS batch_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL,
                total_urls INTEGER NOT NULL,
                completed_urls INTEGER DEFAULT 0,
                failed_urls INTEGER DEFAULT 0,
                created_at TIMESTAMP NOT NULL,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                error_message TEXT,

                INDEX(job_id),
                INDEX(status),
                INDEX(created_at)
            )
        """)

        # Batch analysis results
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS batch_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                url TEXT NOT NULL,
                status TEXT NOT NULL,
                result_json TEXT,
                error_message TEXT,
                analyzed_at TIMESTAMP,

                -- Key metrics
                total_claims INTEGER,
                total_proof INTEGER,
                total_personas INTEGER,

                FOREIGN KEY(job_id) REFERENCES batch_jobs(job_id),
                INDEX(job_id),
                INDEX(status)
            )
        """)

        self.conn.commit()

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


# Singleton instance
_db_instance: Optional[Database] = None


def get_database() -> Database:
    """Get or create database instance"""
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance


if __name__ == "__main__":
    # Test database creation
    print("🧪 Testing database schema...")
    db = Database(Path("test_narrative.db"))
    print(f"✅ Database created: {db.db_path}")
    print(f"✅ Tables initialized")

    # Show tables
    cursor = db.conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"\nTables created:")
    for table in tables:
        print(f"  - {table[0]}")

    db.close()

    # Clean up test database
    Path("test_narrative.db").unlink()
    print("\n✅ Test complete")
