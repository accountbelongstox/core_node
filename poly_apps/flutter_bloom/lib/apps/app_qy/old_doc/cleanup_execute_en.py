#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Code Cleanup Execution Script
Executes file cleanup operations based on analysis report
"""

import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime

# Set output encoding to UTF-8 for Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

class CodeCleanupExecutor:
    def __init__(self, base_path, report_path, dry_run=True):
        self.base_path = Path(base_path)
        self.report_path = Path(report_path)
        self.dry_run = dry_run
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "dry_run": dry_run,
            "actions": [],
            "summary": {
                "refactored_renamed": 0,
                "originals_deleted": 0,
                "backups_deleted": 0,
                "errors": 0
            }
        }

        # Load analysis report
        with open(self.report_path, 'r', encoding='utf-8') as f:
            self.report = json.load(f)

    def cleanup_refactored_files(self):
        """Clean up refactored files"""
        print("\n" + "="*80)
        print("Processing Refactored Files")
        print("="*80 + "\n")

        for rec in self.report["recommendations"]:
            if rec["type"] == "refactored_with_original":
                print(f"[Step 1] Processing refactored files with original versions ({rec['count']} files)")
                for file_info in rec["files"]:
                    self._process_refactored_with_original(file_info)

            elif rec["type"] == "refactored_without_original":
                print(f"\n[Step 2] Processing refactored files without original versions ({rec['count']} files)")
                for file_info in rec["files"]:
                    self._process_refactored_without_original(file_info)

    def _process_refactored_with_original(self, file_info):
        """Process refactored files that have corresponding original files"""
        refactored_path = self.base_path / file_info["refactored"]
        original_path = self.base_path / file_info["original"]

        try:
            action = {
                "type": "refactored_with_original",
                "refactored": str(refactored_path),
                "original": str(original_path),
                "steps": []
            }

            # Step 1: Delete original file
            if original_path.exists():
                if self.dry_run:
                    print(f"  [DRY-RUN] Will delete: {original_path.name}")
                    action["steps"].append(f"Delete original: {original_path.name}")
                else:
                    original_path.unlink()
                    print(f"  ✓ Deleted: {original_path.name}")
                    action["steps"].append(f"Deleted original: {original_path.name}")
                    self.results["summary"]["originals_deleted"] += 1

            # Step 2: Rename refactored file
            new_name = str(refactored_path).replace("_refactored_app_qy.dart", "_app_qy.dart")
            new_path = Path(new_name)

            if self.dry_run:
                print(f"  [DRY-RUN] Will rename: {refactored_path.name} -> {new_path.name}")
                action["steps"].append(f"Rename: {refactored_path.name} -> {new_path.name}")
            else:
                refactored_path.rename(new_path)
                print(f"  ✓ Renamed: {new_path.name}")
                action["steps"].append(f"Renamed: {new_path.name}")
                self.results["summary"]["refactored_renamed"] += 1

            action["status"] = "success" if not self.dry_run else "dry_run"
            self.results["actions"].append(action)

        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            action["status"] = "error"
            action["error"] = str(e)
            self.results["actions"].append(action)
            self.results["summary"]["errors"] += 1

    def _process_refactored_without_original(self, file_info):
        """Process refactored files without corresponding original files"""
        refactored_path = self.base_path / file_info["refactored"]

        try:
            action = {
                "type": "refactored_without_original",
                "refactored": str(refactored_path),
                "steps": []
            }

            # Rename file (remove _refactored suffix)
            new_name = str(refactored_path).replace("_refactored_app_qy.dart", "_app_qy.dart")
            new_path = Path(new_name)

            if self.dry_run:
                print(f"  [DRY-RUN] Will rename: {refactored_path.name} -> {new_path.name}")
                action["steps"].append(f"Rename: {refactored_path.name} -> {new_path.name}")
            else:
                refactored_path.rename(new_path)
                print(f"  ✓ Renamed: {new_path.name}")
                action["steps"].append(f"Renamed: {new_path.name}")
                self.results["summary"]["refactored_renamed"] += 1

            action["status"] = "success" if not self.dry_run else "dry_run"
            self.results["actions"].append(action)

        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            action["status"] = "error"
            action["error"] = str(e)
            self.results["actions"].append(action)
            self.results["summary"]["errors"] += 1

    def cleanup_backup_files(self):
        """Clean up backup files"""
        print("\n" + "="*80)
        print("Processing Backup Files")
        print("="*80 + "\n")

        for rec in self.report["recommendations"]:
            if rec["type"] == "backup_with_original":
                print(f"[Step 3] Deleting backup files ({rec['count']} files)")
                for file_info in rec["files"]:
                    self._process_backup_file(file_info)

    def _process_backup_file(self, file_info):
        """Process backup file"""
        # Find absolute path of backup file
        backup_relative = file_info["backup"]

        # Try to find in different base paths
        possible_bases = [
            self.base_path.parent.parent.parent / "assets" / "apps",
            self.base_path.parent.parent.parent / "assets" / "common",
            self.base_path.parent.parent.parent / "assets",
            self.base_path
        ]

        backup_path = None
        for base in possible_bases:
            potential_path = base / backup_relative
            if potential_path.exists():
                backup_path = potential_path
                break

        if not backup_path:
            # Try using relative path directly
            try:
                direct_path = Path(backup_relative)
                if direct_path.exists():
                    backup_path = direct_path
            except:
                pass

        if not backup_path:
            print(f"  ⚠ Skipped (not found): {backup_relative}")
            return

        try:
            action = {
                "type": "backup_file",
                "backup": str(backup_path),
                "steps": []
            }

            if self.dry_run:
                print(f"  [DRY-RUN] Will delete: {backup_path.name}")
                action["steps"].append(f"Delete backup: {backup_path.name}")
            else:
                backup_path.unlink()
                print(f"  ✓ Deleted: {backup_path.name}")
                action["steps"].append(f"Deleted backup: {backup_path.name}")
                self.results["summary"]["backups_deleted"] += 1

            action["status"] = "success" if not self.dry_run else "dry_run"
            self.results["actions"].append(action)

        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            action["status"] = "error"
            action["error"] = str(e)
            self.results["actions"].append(action)
            self.results["summary"]["errors"] += 1

    def save_results(self):
        """Save execution results"""
        mode = "DRY_RUN" if self.dry_run else "ACTUAL"
        result_path = self.base_path / f"CLEANUP_RESULTS_{mode}.json"

        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\nExecution results saved to: {result_path}")
        return result_path

    def print_summary(self):
        """Print summary"""
        mode = "[Dry Run]" if self.dry_run else "[Actual Execution]"
        print("\n" + "="*80)
        print(f"Cleanup Summary {mode}")
        print("="*80)
        print(f"  • Refactored files renamed: {self.results['summary']['refactored_renamed']}")
        print(f"  • Original files deleted: {self.results['summary']['originals_deleted']}")
        print(f"  • Backup files deleted: {self.results['summary']['backups_deleted']}")
        print(f"  • Errors: {self.results['summary']['errors']}")
        print("="*80 + "\n")

    def execute(self):
        """Execute cleanup"""
        mode = "Dry Run" if self.dry_run else "Actual Execution"
        print(f"\nStarting code cleanup ({mode})...\n")

        self.cleanup_refactored_files()
        self.cleanup_backup_files()
        self.save_results()
        self.print_summary()

        if self.dry_run:
            print("ℹ️  This was a dry run, no files were actually modified.")
            print("To execute for real, use the flag: --execute")
        else:
            print("✅ Cleanup complete!")

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Execute code cleanup operations')
    parser.add_argument('--execute', action='store_true', help='Actually execute (default is dry run)')
    args = parser.parse_args()

    base_path = Path(__file__).parent
    report_path = base_path / "CLEANUP_REPORT.json"

    if not report_path.exists():
        print("❌ Error: Analysis report file not found")
        print("Please run cleanup_analysis.py first to generate the report")
        return 1

    executor = CodeCleanupExecutor(base_path, report_path, dry_run=not args.execute)
    executor.execute()

    return 0

if __name__ == "__main__":
    sys.exit(main())
