#!/usr/bin/env python3

"""
Architecture Compliance Scanner
Scans Python files for violations of architecture rules:
1. Python must NOT execute commands
2. All command execution must be done by Shell scripts
"""

import re
from pathlib import Path
from typing import List, Dict, Tuple


class ComplianceScanner:
    """Scans Python files for command execution violations"""

    # Patterns that indicate command execution
    VIOLATION_PATTERNS = [
        (r'os\.system\s*\(', 'os.system() - Direct command execution'),
        (r'subprocess\.run\s*\(', 'subprocess.run() - Command execution'),
        (r'subprocess\.call\s*\(', 'subprocess.call() - Command execution'),
        (r'subprocess\.Popen\s*\(', 'subprocess.Popen() - Command execution'),
        (r'subprocess\.check_output\s*\(', 'subprocess.check_output() - Command execution'),
        (r'subprocess\.check_call\s*\(', 'subprocess.check_call() - Command execution'),
        (r'os\.popen\s*\(', 'os.popen() - Command execution'),
        (r'os\.spawn\w+\s*\(', 'os.spawn*() - Command execution'),
        (r'os\.exec\w+\s*\(', 'os.exec*() - Command execution'),
        (r'commands\.\w+\s*\(', 'commands module - Command execution (deprecated)'),
    ]

    # Allowed patterns (not violations)
    ALLOWED_PATTERNS = [
        r'#.*os\.system',  # Comments
        r'""".*os\.system.*"""',  # Docstrings
        r"'.*os\.system.*'",  # String literals
        r'".*os\.system.*"',  # String literals
    ]

    def __init__(self):
        self.violations = []
        self.scanned_files = []

    def scan_file(self, file_path: Path) -> List[Dict]:
        """
        Scans a single Python file for violations.

        Returns:
            List of violation dictionaries
        """
        violations = []

        try:
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')

            for line_num, line in enumerate(lines, start=1):
                # Skip comments and docstrings
                if self._is_allowed_context(line):
                    continue

                # Check for violations
                for pattern, description in self.VIOLATION_PATTERNS:
                    if re.search(pattern, line):
                        violations.append({
                            'file': str(file_path),
                            'line': line_num,
                            'code': line.strip(),
                            'pattern': pattern,
                            'description': description,
                            'severity': 'ERROR'
                        })

            self.scanned_files.append(str(file_path))

        except Exception as e:
            violations.append({
                'file': str(file_path),
                'line': 0,
                'code': '',
                'pattern': '',
                'description': f'Failed to scan file: {e}',
                'severity': 'WARNING'
            })

        return violations

    def _is_allowed_context(self, line: str) -> bool:
        """Check if line is in an allowed context (comment, string, etc.)"""

        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            return True

        # Skip comment lines
        if stripped.startswith('#'):
            return True

        # Skip lines that are regex pattern definitions (e.g., (r'pattern', 'description'))
        if stripped.startswith("(r'") or stripped.startswith('(r"'):
            return True

        # Skip lines in docstrings or example code
        if 'os.system(' in stripped and ('"""' in stripped or "Example" in stripped or "BEFORE" in stripped):
            return True

        # Skip lines that are building example strings (e.g., lines.append("example code"))
        if stripped.startswith('lines.append(') and ('os.system' in stripped or 'subprocess' in stripped):
            return True

        # Skip lines using 'commands' as a variable name (list), not the commands module
        # Pattern: commands.get(), commands.append(), etc. where commands is a dict/list
        if 'commands.' in stripped and ('return commands.' in stripped or 'commands.append' in stripped or 'commands.get' in stripped):
            return True

        return False

    def scan_directory(self, directory: Path, pattern: str = "*.py") -> List[Dict]:
        """Scans all Python files in a directory"""

        all_violations = []

        for file_path in directory.rglob(pattern):
            if file_path.is_file():
                file_violations = self.scan_file(file_path)
                all_violations.extend(file_violations)
                self.violations.extend(file_violations)

        return all_violations

    def generate_report(self) -> str:
        """Generates a human-readable compliance report"""

        lines = []
        lines.append("=" * 80)
        lines.append("ARCHITECTURE COMPLIANCE SCAN REPORT")
        lines.append("=" * 80)
        lines.append("")
        lines.append("Scanning for violations of architecture rules:")
        lines.append("  RULE 1: Python must NOT execute commands")
        lines.append("  RULE 2: All command execution must be done by Shell scripts")
        lines.append("")
        lines.append("=" * 80)
        lines.append("")

        if not self.violations:
            lines.append("✓ NO VIOLATIONS FOUND")
            lines.append("")
            lines.append(f"Scanned {len(self.scanned_files)} files:")
            for file_path in self.scanned_files:
                lines.append(f"  ✓ {file_path}")
        else:
            lines.append(f"✗ FOUND {len(self.violations)} VIOLATION(S)")
            lines.append("")

            # Group violations by file
            by_file = {}
            for violation in self.violations:
                file_path = violation['file']
                if file_path not in by_file:
                    by_file[file_path] = []
                by_file[file_path].append(violation)

            for file_path, file_violations in by_file.items():
                lines.append("-" * 80)
                lines.append(f"File: {file_path}")
                lines.append("-" * 80)

                for v in file_violations:
                    lines.append(f"  Line {v['line']}: {v['severity']}")
                    lines.append(f"    Pattern: {v['pattern']}")
                    lines.append(f"    Issue: {v['description']}")
                    lines.append(f"    Code: {v['code']}")
                    lines.append("")

            lines.append("=" * 80)
            lines.append("RECOMMENDED FIXES")
            lines.append("=" * 80)
            lines.append("")
            lines.append("For each violation:")
            lines.append("  1. Remove command execution from Python")
            lines.append("  2. Return command string to Shell script")
            lines.append("  3. Let Shell script execute the command")
            lines.append("")
            lines.append("Example:")
            lines.append("")
            lines.append("  BEFORE (Python executes):")
            lines.append("    os.system('ls -la')")
            lines.append("")
            lines.append("  AFTER (Python returns, Shell executes):")
            lines.append("    Python: return 'ls -la'")
            lines.append("    Shell: COMMAND=$(python script.py)")
            lines.append("           eval $COMMAND")
            lines.append("")

        lines.append("=" * 80)
        lines.append(f"Total files scanned: {len(self.scanned_files)}")
        lines.append(f"Total violations: {len(self.violations)}")
        lines.append("=" * 80)

        return "\n".join(lines)


def scan_laravel_servermanager(servermanager_path: Path) -> Tuple[bool, List[str]]:
    """
    Scans Laravel ServerManager for compliance with Rule 2:
    ServerManager should ONLY manage nginx reverse proxy and systemd services
    """

    violations = []
    compliant = True

    # Patterns that ServerManager should NOT contain
    forbidden_patterns = [
        (r'Process::run\s*\(\s*["\']rm\s+', 'Filesystem cleanup - should be done by Shell'),
        (r'Process::run\s*\(\s*["\']mkdir\s+', 'Directory creation - should be done by Shell'),
        (r'Process::run\s*\(\s*["\']cp\s+', 'File copying - should be done by Shell'),
        (r'Process::run\s*\(\s*["\']ln\s+', 'Symlink creation - should be done by Shell'),
        (r'Process::run\s*\(\s*["\']pnpm\s+', 'Package manager - should be done by Shell'),
        (r'Process::run\s*\(\s*["\']npm\s+', 'Package manager - should be done by Shell'),
        (r'Process::run\s*\(\s*["\']yarn\s+', 'Package manager - should be done by Shell'),
        (r'factoryPath', 'Build path management - should be done by Shell'),
    ]

    # Patterns that ServerManager SHOULD contain (allowed)
    allowed_patterns = [
        r'Process::run\s*\(\s*["\']systemctl\s+',
        r'Process::run\s*\(\s*["\']nginx\s+-t',
        r'Process::run\s*\(\s*["\']systemctl\s+reload\s+nginx',
        r'file_put_contents.*\.service',
        r'file_put_contents.*nginx',
    ]

    try:
        if not servermanager_path.exists():
            return False, [f"ServerManager file not found: {servermanager_path}"]

        content = servermanager_path.read_text(encoding='utf-8')
        lines = content.split('\n')

        for line_num, line in enumerate(lines, start=1):
            for pattern, description in forbidden_patterns:
                if re.search(pattern, line):
                    violations.append(
                        f"Line {line_num}: {description}\n"
                        f"  Code: {line.strip()}\n"
                        f"  Fix: Remove this operation from ServerManager, handle in Shell script"
                    )
                    compliant = False

    except Exception as e:
        violations.append(f"Error scanning ServerManager: {e}")
        compliant = False

    return compliant, violations


if __name__ == "__main__":
    import sys

    script_dir = Path(__file__).parent
    build_scripts_dir = script_dir.parent

    print("Starting Architecture Compliance Scan...")
    print("")

    # Scan 1: Python command execution
    print("=" * 80)
    print("SCAN 1: Python Command Execution Violations")
    print("=" * 80)
    print("")

    scanner = ComplianceScanner()
    scanner.scan_directory(script_dir, "*.py")

    report = scanner.generate_report()
    print(report)

    # Scan 2: Laravel ServerManager
    print("")
    print("=" * 80)
    print("SCAN 2: Laravel ServerManager Compliance")
    print("=" * 80)
    print("")

    servermanager_path = build_scripts_dir.parent / "poly_apps" / "laravel_main" / "app" / "Console" / "Commands" / "ServerManagerV1NuxtAppCommand.php"

    if servermanager_path.exists():
        compliant, violations = scan_laravel_servermanager(servermanager_path)

        if compliant:
            print("✓ ServerManager is compliant")
            print("  - Only manages nginx reverse proxy")
            print("  - Only manages systemd services")
        else:
            print("✗ ServerManager has violations:")
            print("")
            for violation in violations:
                print(violation)
                print("")

            print("RECOMMENDED ACTION:")
            print("  See SERVERMANAGER_REFACTORING_GUIDE.md for detailed instructions")
    else:
        print(f"⚠ ServerManager not found at: {servermanager_path}")
        print("  Skipping ServerManager compliance check")

    # Exit code
    sys.exit(0 if not scanner.violations else 1)
