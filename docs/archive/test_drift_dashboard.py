#!/usr/bin/env python3
"""
Test script for Drift Analytics Dashboard

Tests all analytics endpoints and validates the dashboard functionality.

Usage:
    python test_drift_dashboard.py
"""
import requests
import json
from datetime import datetime

API_BASE = "http://localhost:8000"


def print_header(text):
    """Print formatted section header."""
    print(f"\n{'='*60}")
    print(f"  {text}")
    print('='*60)


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


def test_drift_scan():
    """Run a drift scan to generate data."""
    print_header("Running Drift Scan")
    print_info("This will create a snapshot for analytics...")

    try:
        response = requests.post(f"{API_BASE}/coherence/scan")
        response.raise_for_status()
        data = response.json()

        total = data.get("total", 0)
        print_success(f"Scan completed: {total} drift events found")

        if total > 0:
            print_info(f"  - Critical: {data.get('by_severity', {}).get('critical', 0)}")
            print_info(f"  - High: {data.get('by_severity', {}).get('high', 0)}")
            print_info(f"  - Medium: {data.get('by_severity', {}).get('medium', 0)}")
            print_info(f"  - Low: {data.get('by_severity', {}).get('low', 0)}")
        else:
            print_info("No drift detected! Your narrative is perfectly aligned.")

        return True
    except Exception as e:
        print_error(f"Drift scan failed: {e}")
        return False


def test_summary_endpoint():
    """Test /drift/analytics/summary endpoint."""
    print_header("Testing Summary Endpoint")

    try:
        response = requests.get(f"{API_BASE}/drift/analytics/summary")
        response.raise_for_status()
        data = response.json()

        print_success("Summary endpoint working")
        print_info(f"  Current Drift: {data.get('current_drift', 0)}")
        print_info(f"  Total Snapshots: {data.get('total_snapshots', 0)}")

        trend_7d = data.get('trend_7d', {})
        print_info(f"  7-Day Trend: {trend_7d.get('direction', 'unknown').upper()} ({trend_7d.get('change', 0):+d})")

        trend_30d = data.get('trend_30d', {})
        print_info(f"  30-Day Trend: {trend_30d.get('direction', 'unknown').upper()} ({trend_30d.get('change', 0):+d})")

        print_info(f"  Resolution Rate: {data.get('resolution_rate', 0):.1f}%")

        return True
    except Exception as e:
        print_error(f"Summary endpoint failed: {e}")
        return False


def test_timeseries_endpoint():
    """Test /drift/analytics/timeseries endpoint."""
    print_header("Testing Timeseries Endpoint")

    try:
        response = requests.get(f"{API_BASE}/drift/analytics/timeseries?days=30")
        response.raise_for_status()
        data = response.json()

        timeseries = data.get('data', [])
        print_success(f"Timeseries endpoint working ({len(timeseries)} data points)")

        if timeseries:
            latest = timeseries[-1]
            print_info(f"  Latest: {latest.get('date')} - {latest.get('total', 0)} events")
        else:
            print_info("  No timeseries data yet. Run more scans to build history.")

        return True
    except Exception as e:
        print_error(f"Timeseries endpoint failed: {e}")
        return False


def test_heatmap_endpoint():
    """Test /drift/analytics/heatmap endpoint."""
    print_header("Testing Heatmap Endpoint")

    try:
        response = requests.get(f"{API_BASE}/drift/analytics/heatmap")
        response.raise_for_status()
        data = response.json()

        documents = data.get('documents', [])
        max_drift = data.get('max_drift', 0)

        print_success(f"Heatmap endpoint working ({len(documents)} documents)")

        if documents:
            print_info(f"  Max drift: {max_drift} events")
            print_info("  Top 3 problematic documents:")
            for i, doc in enumerate(documents[:3], 1):
                path = doc.get('path', 'unknown')
                count = doc.get('drift_count', 0)
                pct = doc.get('percentage', 0)
                print_info(f"    {i}. {path}: {count} events ({pct:.1f}%)")
        else:
            print_info("  No document data yet.")

        return True
    except Exception as e:
        print_error(f"Heatmap endpoint failed: {e}")
        return False


def test_types_endpoint():
    """Test /drift/analytics/types endpoint."""
    print_header("Testing Types Endpoint")

    try:
        response = requests.get(f"{API_BASE}/drift/analytics/types")
        response.raise_for_status()
        data = response.json()

        types = data.get('types', [])
        total = data.get('total', 0)

        print_success(f"Types endpoint working ({len(types)} drift types)")

        if types:
            print_info(f"  Total: {total} events")
            for drift_type in types:
                type_name = drift_type.get('type', 'unknown')
                count = drift_type.get('count', 0)
                pct = drift_type.get('percentage', 0)
                print_info(f"    - {type_name}: {count} ({pct:.1f}%)")

        return True
    except Exception as e:
        print_error(f"Types endpoint failed: {e}")
        return False


def test_severity_endpoint():
    """Test /drift/analytics/severity endpoint."""
    print_header("Testing Severity Endpoint")

    try:
        response = requests.get(f"{API_BASE}/drift/analytics/severity")
        response.raise_for_status()
        data = response.json()

        current = data.get('current', {})
        changes = data.get('changes', {})

        print_success("Severity endpoint working")
        print_info("  Current severity breakdown:")
        for severity in ['critical', 'high', 'medium', 'low']:
            count = current.get(severity, 0)
            change = changes.get(severity, 0)
            change_str = f"({change:+d})" if change != 0 else ""
            print_info(f"    - {severity}: {count} {change_str}")

        return True
    except Exception as e:
        print_error(f"Severity endpoint failed: {e}")
        return False


def test_trends_endpoint():
    """Test /drift/analytics/trends endpoint."""
    print_header("Testing Trends Endpoint")

    for period in ['7d', '30d', '90d']:
        try:
            response = requests.get(f"{API_BASE}/drift/analytics/trends?period={period}")
            response.raise_for_status()
            data = response.json()

            direction = data.get('trend_direction', 'unknown')
            change = data.get('total_change', 0)
            resolution = data.get('resolution_rate', 0)

            print_success(f"{period} trend: {direction.upper()} ({change:+d})")
            print_info(f"  Resolution rate: {resolution:.1f}%")

            problematic = data.get('most_problematic_docs', [])
            if problematic:
                print_info(f"  Most problematic: {problematic[0]}")

        except Exception as e:
            print_error(f"Trends endpoint ({period}) failed: {e}")
            return False

    return True


def test_dashboard_html():
    """Test that dashboard HTML loads."""
    print_header("Testing Dashboard HTML")

    try:
        response = requests.get(f"{API_BASE}/drift-dashboard")
        response.raise_for_status()

        html = response.text
        if 'Drift Analytics Dashboard' in html and 'Chart.js' in html:
            print_success("Dashboard HTML loads correctly")
            print_info(f"  Dashboard URL: {API_BASE}/drift-dashboard")
            print_info("  Open in browser to view interactive charts")
            return True
        else:
            print_error("Dashboard HTML missing expected content")
            return False

    except Exception as e:
        print_error(f"Dashboard HTML failed: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("  Drift Analytics Dashboard Test Suite")
    print("="*60)
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  API: {API_BASE}")
    print("="*60)

    results = []

    # Run tests in order
    results.append(("Health Check", test_health()))
    results.append(("Drift Scan", test_drift_scan()))
    results.append(("Summary Endpoint", test_summary_endpoint()))
    results.append(("Timeseries Endpoint", test_timeseries_endpoint()))
    results.append(("Heatmap Endpoint", test_heatmap_endpoint()))
    results.append(("Types Endpoint", test_types_endpoint()))
    results.append(("Severity Endpoint", test_severity_endpoint()))
    results.append(("Trends Endpoint", test_trends_endpoint()))
    results.append(("Dashboard HTML", test_dashboard_html()))

    # Summary
    print_header("Test Summary")
    passed = sum(1 for _, success in results if success)
    total = len(results)

    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status}: {name}")

    print("\n" + "="*60)
    print(f"  Results: {passed}/{total} tests passed")

    if passed == total:
        print_success("All tests passed!")
        print_info(f"\n  🎉 Dashboard ready at: {API_BASE}/drift-dashboard\n")
    else:
        print_error(f"{total - passed} test(s) failed")

    print("="*60 + "\n")

    return passed == total


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
