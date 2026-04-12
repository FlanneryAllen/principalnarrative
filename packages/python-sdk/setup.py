"""
Setup script for narrative-sdk Python package
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text() if readme_file.exists() else ""

setup(
    name="narrative-sdk",
    version="0.1.0",
    description="Intent Engineering SDK for Python - Query organizational intent for AI agents",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Julie Allen",
    author_email="julie@narrative.engineering",
    url="https://github.com/your-org/narrative-agentv2",
    packages=find_packages(exclude=["tests", "examples"]),
    python_requires=">=3.8",
    install_requires=[
        # No external dependencies! Uses built-in sqlite3
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
        ]
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    keywords="ai agents intent organizational-intent governance constraints",
    project_urls={
        "Documentation": "https://github.com/your-org/narrative-agentv2",
        "Source": "https://github.com/your-org/narrative-agentv2",
        "Tracker": "https://github.com/your-org/narrative-agentv2/issues",
    },
)
