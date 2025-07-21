#!/usr/bin/env python3
"""
Setup script for MAVIS documentation dependencies.
This script installs the required packages for building and serving the documentation.
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and handle errors."""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"Error: {e.stderr}")
        return False

def main():
    """Main setup function."""
    print("🚀 Setting up MAVIS documentation dependencies...")
    
    # Check if we're in the right directory
    if not os.path.exists("mkdocs.yml"):
        print("❌ Error: mkdocs.yml not found. Please run this script from the docs/ directory.")
        sys.exit(1)
    
    # Install MkDocs and Material theme
    commands = [
        ("pip install mkdocs", "Installing MkDocs"),
        ("pip install mkdocs-material", "Installing Material theme"),
        ("pip install mkdocs-material-extensions", "Installing Material extensions"),
        ("pip install mkdocs-git-revision-date-localized-plugin", "Installing Git revision plugin"),
        ("pip install mkdocs-minify-plugin", "Installing Minify plugin"),
    ]
    
    success = True
    for command, description in commands:
        if not run_command(command, description):
            success = False
            break
    
    if success:
        print("\n✅ Documentation setup completed successfully!")
        print("\n📖 To start the documentation server:")
        print("   python -m mkdocs serve")
        print("\n🌐 Then open http://127.0.0.1:8000 in your browser")
        print("\n📦 To build for deployment:")
        print("   python -m mkdocs build")
    else:
        print("\n❌ Documentation setup failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main() 