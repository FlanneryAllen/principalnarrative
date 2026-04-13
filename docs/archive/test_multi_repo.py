#!/usr/bin/env python3
"""
Test script for Multi-Repository Support

Tests all multi-repo endpoints and validates the complete workflow.

Usage:
    python test_multi_repo.py
"""
import requests
import json
from datetime import datetime
import time

API_BASE = "http://localhost:8000"


def print_header(text):
    """Print formatted section header."""
    print(f"\n{'='*70}")
    print(f"  {text}")
    print('='*70)


def print_success(text):
    """Print success message."""
    print(f"✅ {text}")


def print_error(text):
    """Print error message."""
    print(f"❌ {text}")


def print_info(text):
    """Print info message."""
    print(f"ℹ️  {text}")


def test_health():
    """Test API health."""
    print_header("Testing API Health")
    try:
        response = requests.get(f"{API_BASE}/health")
        response.raise_for_status()
        print_success("API is healthy")
        return True
    except Exception as e:
        print_error(f"API health check failed: {e}")
        return False


def test_register_repositories():
    """Test repository registration."""
    print_header("Testing Repository Registration")

    # Sample repositories to register
    repos = [
        {
            "name": "auth-service",
            "type": "service",
            "mode": "central",
            "description": "User authentication and authorization service",
            "owner_team": "platform",
            "owner_contact": "platform@example.com",
            "central_repo_url": "https://github.com/example/applied-narrative.git",
            "tags": ["backend", "auth", "python"]
        },
        {
            "name": "frontend-app",
            "type": "frontend",
            "mode": "hybrid",
            "description": "Main web application",
            "owner_team": "product",
            "owner_contact": "product@example.com",
            "central_repo_url": "https://github.com/example/applied-narrative.git",
            "tags": ["frontend", "react", "typescript"]
        },
        {
            "name": "mobile-app",
            "type": "mobile",
            "mode": "central",
            "description": "iOS and Android mobile app",
            "owner_team": "mobile",
            "owner_contact": "mobile@example.com",
            "central_repo_url": "https://github.com/example/applied-narrative.git",
            "tags": ["mobile", "react-native"]
        },
        {
            "name": "data-pipeline",
            "type": "service",
            "mode": "hybrid",
            "description": "Data processing pipeline",
            "owner_team": "data",
            "owner_contact": "data@example.com",
            "central_repo_url": "https://github.com/example/applied-narrative.git",
            "tags": ["backend", "python", "data"]
        },
        {
            "name": "api-docs",
            "type": "docs",
            "mode": "standalone",
            "description": "API documentation site",
            "owner_team": "platform",
            "owner_contact": "platform@example.com",
            "tags": ["docs"]
        }
    ]

    registered_count = 0

    for repo in repos:
        try:
            response = requests.post(
                f"{API_BASE}/multi-repo/register",
                json=repo
            )

            if response.status_code == 200:
                print_success(f"Registered: {repo['name']} (type={repo['type']}, mode={repo['mode']})")
                registered_count += 1
            elif response.status_code == 400 and "already registered" in response.text.lower():
                print_info(f"Already registered: {repo['name']}")
                registered_count += 1
            else:
                print_error(f"Failed to register {repo['name']}: {response.text}")

        except Exception as e:
            print_error(f"Error registering {repo['name']}: {e}")

    print_info(f"Total repositories: {registered_count}/{len(repos)}")
    return registered_count > 0


def test_list_repositories():
    """Test listing repositories."""
    print_header("Testing List Repositories")

    try:
        # Test basic list
        response = requests.get(f"{API_BASE}/multi-repo/repositories")
        response.raise_for_status()
        data = response.json()

        total = data.get('total', 0)
        print_success(f"Listed {total} repositories")

        if total > 0:
            print_info("Repository breakdown:")
            for repo in data['repositories'][:5]:  # Show first 5
                print_info(f"  - {repo['name']}: {repo['type']} ({repo['mode']})")

        # Test filtered list (by type)
        response = requests.get(f"{API_BASE}/multi-repo/repositories?type=service")
        response.raise_for_status()
        services = response.json()
        print_success(f"Found {services['total']} service repositories")

        # Test filtered list (by mode)
        response = requests.get(f"{API_BASE}/multi-repo/repositories?mode=central")
        response.raise_for_status()
        central_repos = response.json()
        print_success(f"Found {central_repos['total']} repos using central narrative")

        return True

    except Exception as e:
        print_error(f"Failed to list repositories: {e}")
        return False


def test_get_repository_details():
    """Test getting repository details."""
    print_header("Testing Get Repository Details")

    try:
        # Get details for auth-service
        response = requests.get(f"{API_BASE}/multi-repo/repositories/auth-service")
        response.raise_for_status()
        repo = response.json()

        print_success(f"Retrieved details for: {repo['name']}")
        print_info(f"  Type: {repo['type']}")
        print_info(f"  Mode: {repo['mode']}")
        print_info(f"  Owner: {repo['owner']['team']}")
        print_info(f"  Tags: {', '.join(repo['tags'])}")

        if repo.get('central_repository'):
            print_info(f"  Central URL: {repo['central_repository']['url']}")

        return True

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print_info("Repository not found (expected if not registered)")
            return True
        print_error(f"Failed to get repository details: {e}")
        return False
    except Exception as e:
        print_error(f"Error getting repository details: {e}")
        return False


def test_heartbeat():
    """Test repository heartbeat."""
    print_header("Testing Repository Heartbeat")

    try:
        response = requests.post(f"{API_BASE}/multi-repo/heartbeat/auth-service")
        response.raise_for_status()

        print_success("Heartbeat recorded for auth-service")
        return True

    except Exception as e:
        print_error(f"Failed to record heartbeat: {e}")
        return False


def test_organization_summary():
    """Test organization summary endpoint."""
    print_header("Testing Organization Summary")

    try:
        response = requests.get(f"{API_BASE}/multi-repo/organization/summary")
        response.raise_for_status()
        data = response.json()

        print_success("Retrieved organization summary")
        print_info(f"  Total Repositories: {data.get('total_repositories', 0)}")
        print_info(f"  Active Repositories: {data.get('active_repositories', 0)}")
        print_info(f"  Average Coherence: {data.get('average_coherence_score', 0)}")

        by_type = data.get('repositories_by_type', {})
        if by_type:
            print_info("  Repositories by Type:")
            for repo_type, count in by_type.items():
                print_info(f"    - {repo_type}: {count}")

        by_mode = data.get('repositories_by_mode', {})
        if by_mode:
            print_info("  Repositories by Mode:")
            for mode, count in by_mode.items():
                print_info(f"    - {mode}: {count}")

        drift_summary = data.get('drift_summary', {})
        if drift_summary:
            print_info(f"  Total Drift Events: {drift_summary.get('total_drift_events', 0)}")

        return True

    except Exception as e:
        print_error(f"Failed to get organization summary: {e}")
        return False


def test_top_drift_repositories():
    """Test top drift repositories endpoint."""
    print_header("Testing Top Drift Repositories")

    try:
        response = requests.get(f"{API_BASE}/multi-repo/organization/top-drift?limit=5")
        response.raise_for_status()
        data = response.json()

        repos = data.get('top_drift_repositories', [])
        print_success(f"Retrieved top {len(repos)} repositories by drift")

        if repos:
            print_info("Top problematic repositories:")
            for i, repo in enumerate(repos, 1):
                print_info(f"  {i}. {repo['name']}: {repo['total_drift']} drift events (coherence: {repo['coherence_score']})")
        else:
            print_info("No repositories with drift metrics yet")

        return True

    except Exception as e:
        print_error(f"Failed to get top drift repositories: {e}")
        return False


def test_sync_status():
    """Test sync status endpoint."""
    print_header("Testing Sync Status")

    try:
        response = requests.get(f"{API_BASE}/multi-repo/sync-status")
        response.raise_for_status()
        data = response.json()

        print_success("Retrieved sync status")
        print_info(f"  Central Mode: {data.get('is_central_mode', False)}")
        print_info(f"  Last Sync: {data.get('last_sync', 'Never')}")
        print_info(f"  Needs Sync: {data.get('needs_sync', False)}")
        print_info(f"  Total Documents: {data.get('total_documents', 0)}")
        print_info(f"  Conflicts: {data.get('conflicts', 0)}")

        return True

    except Exception as e:
        print_error(f"Failed to get sync status: {e}")
        return False


def test_conflicts():
    """Test conflicts endpoint."""
    print_header("Testing Conflicts Check")

    try:
        response = requests.get(f"{API_BASE}/multi-repo/conflicts")
        response.raise_for_status()
        data = response.json()

        conflict_count = data.get('total_conflicts', 0)

        if conflict_count == 0:
            print_success("No conflicts detected")
        else:
            print_info(f"Found {conflict_count} conflicts")
            for conflict in data.get('conflicts', [])[:3]:  # Show first 3
                print_info(f"  - {conflict['path']}: {conflict['newer']} version is newer")

        return True

    except Exception as e:
        print_error(f"Failed to check conflicts: {e}")
        return False


def test_scan_repositories():
    """Test scanning all repositories."""
    print_header("Testing Repository Scan")

    print_info("This may take a moment...")

    try:
        response = requests.post(f"{API_BASE}/multi-repo/scan")
        response.raise_for_status()
        data = response.json()

        total_repos = data.get('total_repositories', 0)
        summary = data.get('summary', {})
        total_drift = summary.get('total_drift_events', 0)
        repos_with_drift = summary.get('repositories_with_drift', 0)
        drift_free = summary.get('drift_free_repositories', 0)

        print_success(f"Scanned {total_repos} repositories")
        print_info(f"  Total Drift Events: {total_drift}")
        print_info(f"  Repositories with Drift: {repos_with_drift}")
        print_info(f"  Drift-Free Repositories: {drift_free}")

        if total_drift > 0:
            print_info("Sample drift events:")
            repos = data.get('repositories', {})
            shown = 0
            for repo_name, events in repos.items():
                if events and shown < 3:
                    for event in events[:2]:  # Show 2 events per repo
                        print_info(f"  - {repo_name}: {event.get('description', 'No description')}")
                        shown += 1
                        if shown >= 3:
                            break

        return True

    except Exception as e:
        print_error(f"Failed to scan repositories: {e}")
        return False


def test_dashboard_html():
    """Test that dashboard HTML loads."""
    print_header("Testing Multi-Repo Dashboard HTML")

    try:
        response = requests.get(f"{API_BASE}/multi-repo-dashboard")
        response.raise_for_status()

        html = response.text
        if 'Organization Narrative Dashboard' in html and 'chart.js' in html.lower():
            print_success("Dashboard HTML loads correctly")
            print_info(f"  Dashboard URL: {API_BASE}/multi-repo-dashboard")
            print_info("  Open in browser to view interactive dashboard")
            return True
        else:
            print_error("Dashboard HTML missing expected content")
            return False

    except Exception as e:
        print_error(f"Failed to load dashboard HTML: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("  Multi-Repository Support Test Suite")
    print("="*70)
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  API: {API_BASE}")
    print("="*70)

    results = []

    # Run tests in order
    results.append(("Health Check", test_health()))

    if not results[0][1]:
        print_error("\n⚠️  API is not running! Start it with: ./run.sh")
        return False

    results.append(("Register Repositories", test_register_repositories()))
    results.append(("List Repositories", test_list_repositories()))
    results.append(("Get Repository Details", test_get_repository_details()))
    results.append(("Record Heartbeat", test_heartbeat()))
    results.append(("Organization Summary", test_organization_summary()))
    results.append(("Top Drift Repositories", test_top_drift_repositories()))
    results.append(("Sync Status", test_sync_status()))
    results.append(("Check Conflicts", test_conflicts()))
    results.append(("Scan Repositories", test_scan_repositories()))
    results.append(("Dashboard HTML", test_dashboard_html()))

    # Summary
    print_header("Test Summary")
    passed = sum(1 for _, success in results if success)
    total = len(results)

    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status}: {name}")

    print("\n" + "="*70)
    print(f"  Results: {passed}/{total} tests passed")

    if passed == total:
        print_success("All tests passed!")
        print_info(f"\n  🎉 Multi-repo system ready!")
        print_info(f"  📊 Dashboard: {API_BASE}/multi-repo-dashboard")
        print_info(f"  📚 Docs: MULTI_REPO.md\n")
    else:
        print_error(f"{total - passed} test(s) failed")

    print("="*70 + "\n")

    return passed == total


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
