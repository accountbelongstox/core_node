#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Code Cleanup Analysis Script
Analyzes duplicate files and backup files, generates cleanup recommendations
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

# Set output encoding to UTF-8 for Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

class CodeCleanupAnalyzer:
    def __init__(self, base_path):
        self.base_path = Path(base_path)
        self.refactored_files = []
        self.backup_files = []
        self.original_files = []
        self.cleanup_report = {
            "timestamp": datetime.now().isoformat(),
            "refactored_files": [],
            "backup_files": [],
            "recommendations": []
        }

    def find_refactored_files(self):
        """Find all refactored files"""
        print("Scanning for refactored files...")
        for file in self.base_path.rglob("*_refactored_app_qy.dart"):
            self.refactored_files.append(file)

            # Check if corresponding original file exists
            original_name = str(file).replace("_refactored_app_qy.dart", "_app_qy.dart")
            original_path = Path(original_name)

            exists = original_path.exists()
            self.cleanup_report["refactored_files"].append({
                "refactored": str(file.relative_to(self.base_path)),
                "original": str(original_path.relative_to(self.base_path)) if exists else None,
                "has_original": exists,
                "size_kb": round(file.stat().st_size / 1024, 2)
            })

        print(f"Found {len(self.refactored_files)} refactored files")

    def find_backup_files(self):
        """Find all backup files"""
        print("Scanning for backup files...")

        # Search for backup files in multiple directories
        search_paths = [
            self.base_path,
            self.base_path.parent.parent.parent / "assets" / "apps" / "app_qy",
            self.base_path.parent.parent.parent / "assets" / "common"
        ]

        for search_path in search_paths:
            if not search_path.exists():
                continue

            for file in search_path.rglob("*.backup.*"):
                self.backup_files.append(file)

                # Check if corresponding original file exists
                original_name = str(file).replace(".backup.", ".")
                original_path = Path(original_name)

                exists = original_path.exists()
                self.cleanup_report["backup_files"].append({
                    "backup": str(file.relative_to(search_path.parent)),
                    "original": str(original_path.relative_to(search_path.parent)) if exists else None,
                    "has_original": exists,
                    "size_kb": round(file.stat().st_size / 1024, 2)
                })

        print(f"Found {len(self.backup_files)} backup files")

    def generate_recommendations(self):
        """Generate cleanup recommendations"""
        print("\nGenerating cleanup recommendations...")

        # Strategy 1: Handle refactored files
        refactored_with_original = [f for f in self.cleanup_report["refactored_files"] if f["has_original"]]
        refactored_without_original = [f for f in self.cleanup_report["refactored_files"] if not f["has_original"]]

        if refactored_with_original:
            self.cleanup_report["recommendations"].append({
                "type": "refactored_with_original",
                "count": len(refactored_with_original),
                "action": "Delete old original files, rename refactored versions to original names",
                "reason": "Refactored versions are the new improved versions and should replace the old ones",
                "files": refactored_with_original
            })

        if refactored_without_original:
            self.cleanup_report["recommendations"].append({
                "type": "refactored_without_original",
                "count": len(refactored_without_original),
                "action": "Rename refactored files to standard names (remove _refactored suffix)",
                "reason": "These files have no corresponding old version, can use standard naming directly",
                "files": refactored_without_original
            })

        # Strategy 2: Handle backup files
        backup_with_original = [f for f in self.cleanup_report["backup_files"] if f["has_original"]]
        backup_without_original = [f for f in self.cleanup_report["backup_files"] if not f["has_original"]]

        if backup_with_original:
            self.cleanup_report["recommendations"].append({
                "type": "backup_with_original",
                "count": len(backup_with_original),
                "action": "Delete backup files (original files exist)",
                "reason": "Original files exist, backup files can be safely deleted",
                "files": backup_with_original
            })

        if backup_without_original:
            self.cleanup_report["recommendations"].append({
                "type": "backup_without_original",
                "count": len(backup_without_original),
                "action": "Warning: These backup files have no corresponding original files, needs manual review",
                "reason": "Original files may have been deleted or renamed",
                "files": backup_without_original
            })

        # Statistics
        total_refactored = len(self.cleanup_report["refactored_files"])
        total_backup = len(self.cleanup_report["backup_files"])

        print(f"\nStatistics:")
        print(f"   - Refactored files: {total_refactored}")
        print(f"     • With original: {len(refactored_with_original)}")
        print(f"     • Without original: {len(refactored_without_original)}")
        print(f"   - Backup files: {total_backup}")
        print(f"     • With original: {len(backup_with_original)}")
        print(f"     • Without original: {len(backup_without_original)}")

    def save_report(self):
        """Save report"""
        report_path = self.base_path / "CLEANUP_REPORT.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(self.cleanup_report, f, indent=2, ensure_ascii=False)

        print(f"\nReport saved to: {report_path}")
        return report_path

    def print_summary(self):
        """Print summary"""
        print("\n" + "="*80)
        print("Cleanup Recommendations Summary")
        print("="*80)

        for rec in self.cleanup_report["recommendations"]:
            print(f"\n[{rec['type']}]")
            print(f"  Count: {rec['count']} files")
            print(f"  Action: {rec['action']}")
            print(f"  Reason: {rec['reason']}")

        print("\n" + "="*80)

def main():
    base_path = Path(__file__).parent
    analyzer = CodeCleanupAnalyzer(base_path)

    print("Starting code cleanup analysis...\n")

    analyzer.find_refactored_files()
    analyzer.find_backup_files()
    analyzer.generate_recommendations()
    analyzer.save_report()
    analyzer.print_summary()

    print("\nAnalysis complete!")

if __name__ == "__main__":
    main()
