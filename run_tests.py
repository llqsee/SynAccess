#!/usr/bin/env python3
"""
Enhanced test runner script for MAVIS project.
Runs both frontend (Jest) and backend (pytest) tests with comprehensive reporting.
"""

import subprocess
import sys
import os
import argparse
import json
import time
from pathlib import Path

def run_frontend_tests(args):
    """Run frontend Jest tests with enhanced options."""
    print("Running Frontend Tests (Jest)...")
    print("=" * 50)
    
    original_dir = os.getcwd()
    
    try:
        os.chdir('frontend')
        
        # Build Jest command with options
        cmd = ['npm', 'test', '--', '--watchAll=false', '--passWithNoTests']
        
        # Set CI environment variable to prevent watch mode
        env = os.environ.copy()
        env['CI'] = 'true'
        
        if args.coverage:
            cmd.append('--coverage')
        
        if args.verbose:
            cmd.append('--verbose')
        
        if args.ci:
            cmd.extend(['--ci', '--maxWorkers=2'])
        
        if args.pattern:
            cmd.extend(['--testNamePattern', args.pattern])
        
        if args.bail:
            cmd.append('--bail')
        
        # Use shell=True on Windows to properly handle npm command
        is_windows = os.name == 'nt'
        result = subprocess.run(cmd, capture_output=False, text=True, env=env, shell=is_windows)
        return result.returncode == 0
        
    except Exception as e:
        print(f"Frontend tests failed: {e}")
        return False
    finally:
        os.chdir(original_dir)

def run_backend_tests(args):
    """Run backend pytest tests with enhanced options."""
    print("Running Backend Tests (pytest)...")
    print("=" * 50)
    
    try:
        cmd = ['python', '-m', 'pytest', 'backend/tests/']
        
        if args.verbose:
            cmd.append('-v')        
        
        if args.coverage:
            cmd.extend(['--cov=backend', '--cov-report=term-missing', '--cov-report=html'])            
        
        if args.pattern:
            cmd.extend(['-k', args.pattern])
        
        if args.bail:
            cmd.append('--maxfail=1')
        
        if args.markers:
            cmd.extend(['-m', args.markers])
        
        if args.parallel:
            cmd.extend(['-n', str(args.parallel)])
        
        result = subprocess.run(cmd, capture_output=False, text=True)
        return result.returncode == 0
        
    except Exception as e:
        print(f"Backend tests failed: {e}")
        return False

def run_lint_checks():
    """Run code quality checks."""
    print("Running Code Quality Checks...")
    print("=" * 50)
    
    checks = [
        (['python', '-m', 'black', '--check', 'backend/'], 'Black formatting'),
        (['python', '-m', 'flake8', 'backend/'], 'Flake8 linting'),
        (['python', '-m', 'isort', '--check-only', 'backend/'], 'Import sorting'),
    ]
    
    results = {}
    
    for cmd, name in checks:
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            results[name] = result.returncode == 0
            if result.returncode != 0:
                print(f"{name} failed:")
                print(result.stdout)
                print(result.stderr)
            else:
                print(f"{name} passed")
        except Exception as e:
            print(f"{name} error: {e}")
            results[name] = False
    
    return all(results.values())

def generate_test_report(frontend_success, backend_success, lint_success, args):
    """Generate comprehensive test report."""
    print("\nTest Results Summary")
    print("=" * 50)
    
    # Summary
    print(f"Frontend Tests: {'PASSED' if frontend_success else 'FAILED'}")
    print(f"Backend Tests:  {'PASSED' if backend_success else 'FAILED'}")
    
    if args.lint:
        print(f"Code Quality:   {'PASSED' if lint_success else 'FAILED'}")
    
    # Coverage information
    if args.coverage:
        print("\nCoverage Reports Generated:")
        print("Frontend: frontend/coverage/lcov-report/index.html")
        print("Backend:  backend/htmlcov/index.html")
    
    # Overall status
    overall_success = frontend_success and backend_success
    if args.lint:
        overall_success = overall_success and lint_success
    
    print(f"\nOverall Result: {'ALL TESTS PASSED' if overall_success else 'SOME TESTS FAILED'}")
    
    return overall_success

def main():
    """Main test runner function with enhanced options."""
    parser = argparse.ArgumentParser(description='MAVIS Enhanced Test Runner')
    parser.add_argument('--frontend', action='store_true', help='Run only frontend tests')
    parser.add_argument('--backend', action='store_true', help='Run only backend tests')
    parser.add_argument('--coverage', action='store_true', help='Generate coverage reports')
    parser.add_argument('--lint', action='store_true', help='Run code quality checks')
    parser.add_argument('--ci', action='store_true', help='Run in CI mode')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--pattern', help='Test pattern to match')
    parser.add_argument('--markers', help='Pytest markers to run')
    parser.add_argument('--bail', action='store_true', help='Stop on first failure')
    parser.add_argument('--parallel', type=int, help='Number of parallel workers for pytest')
    
    args = parser.parse_args()
    
    # Set defaults
    if not (args.frontend or args.backend):
        args.frontend = True
        args.backend = True
    
    print("MAVIS Enhanced Test Suite")
    print("=" * 50)
    
    start_time = time.time()
    
    # Run tests
    frontend_success = True
    backend_success = True
    lint_success = True
    
    if args.frontend:
        frontend_success = run_frontend_tests(args)
    
    if args.backend:
        backend_success = run_backend_tests(args)
    
    if args.lint:
        lint_success = run_lint_checks()
    
    # Generate report
    overall_success = generate_test_report(frontend_success, backend_success, lint_success, args)
    
    # Execution time
    execution_time = time.time() - start_time
    print(f"\nTotal execution time: {execution_time:.2f} seconds")
    
    if overall_success:
        print("\nAll tests passed!")
        sys.exit(0)
    else:
        print("\nSome tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main() 