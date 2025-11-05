"""File transfer and replacement helpers."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

try:
    from ..colors import Colors
except ImportError:
    from colors import Colors


class TransferMixin:
    """Operations for moving compressed assets around."""

    SOURCE_DIR: Path
    COMPRESS_DIR: Path

    def replace_original_files(self) -> None:
        """Overwrite originals with compressed counterparts."""

        print(f"\n{'='*60}")
        print("Replace Original Files with Compressed Versions")
        print(f"{'='*60}")
        print(f"\n{Colors.RED}WARNING: This will overwrite original files!{Colors.RESET}")
        print("Make sure you have backups before proceeding.\n")

        confirm = input("Confirm to continue? (yes/no): ").strip().lower()
        if confirm != "yes":
            print("Operation cancelled")
            return

        print(f"\nScanning compressed files in: {self.COMPRESS_DIR}")
        compressed_files = []
        for root, _dirs, files in os.walk(self.COMPRESS_DIR):
            for filename in files:
                compressed_path = Path(root) / filename
                rel_path = compressed_path.relative_to(self.COMPRESS_DIR)
                original_path = self.SOURCE_DIR / rel_path
                if original_path.exists():
                    compressed_files.append((compressed_path, original_path, rel_path))

        if not compressed_files:
            print("No compressed files found to replace.")
            return

        print(f"Found {len(compressed_files)} compressed files to replace\n")

        replaced = 0
        failed = 0
        for idx, (compressed_path, original_path, rel_path) in enumerate(
            compressed_files, 1
        ):
            print(f"[{idx}/{len(compressed_files)}] {rel_path}")
            try:
                original_size = original_path.stat().st_size
                compressed_size = compressed_path.stat().st_size
                shutil.copy2(str(compressed_path), str(original_path))

                print(f"  {Colors.GREEN}✓ Replaced{Colors.RESET}")
                print(f"    Original: {self._format_size(original_size)}")
                print(f"    Compressed: {self._format_size(compressed_size)}")
                print(f"    Saved: {self._format_size(original_size - compressed_size)}")
                replaced += 1
            except Exception as exc:  # pragma: no cover - filesystem defensive
                print(f"  {Colors.RED}✗ Failed: {exc}{Colors.RESET}")
                failed += 1

        print(f"\n{'='*60}")
        print("Replacement Summary")
        print(f"{'='*60}")
        print(f"  Total files: {len(compressed_files)}")
        print(f"  {Colors.GREEN}Replaced: {replaced}{Colors.RESET}")
        print(f"  {Colors.RED}Failed: {failed}{Colors.RESET}")
        print(f"{'='*60}\n")

    def copy_to_external_drive(self) -> None:
        """Copy source files to an external drive with deduplication support."""

        source_dir = self.SOURCE_DIR
        target_dir = Path(r"E:\Evidences")

        print(f"\n{'='*60}")
        print("Smart Copy to External Drive")
        print(f"{'='*60}")
        print(f"Source: {source_dir}")
        print(f"Target: {target_dir}")
        print(f"{'='*60}\n")

        if not target_dir.exists():
            print(f"{Colors.YELLOW}Target directory does not exist. Creating...{Colors.RESET}")
            target_dir.mkdir(parents=True, exist_ok=True)
            print(f"{Colors.GREEN}✓ Created: {target_dir}{Colors.RESET}\n")

        print("Step 1: Scanning source files...")
        all_files = []
        skipped_copy_files = []

        for root, _dirs, files in os.walk(source_dir):
            if "_tmp" in root or "_compress" in root:
                continue

            for filename in files:
                source_path = Path(root) / filename
                rel_path = source_path.relative_to(source_dir)
                if source_path.stem.endswith(" Copy"):
                    skipped_copy_files.append(rel_path)
                    continue
                all_files.append((source_path, rel_path))

        print(f"Found {len(all_files)} files to copy")
        print(f"Skipped {len(skipped_copy_files)} Windows ' Copy' files\n")

        if not all_files:
            print("No files to copy. Exiting.")
            return

        confirm = input(
            f"Start copying {len(all_files)} files? (yes/no, default: yes): "
        ).strip().lower()
        if confirm in {"no", "n"}:
            print("Operation cancelled")
            return

        print(f"\n{'='*60}")
        print("Copying files...")
        print(f"{'='*60}\n")

        copied = replaced = skipped = failed = 0
        for idx, (source_path, rel_path) in enumerate(all_files, 1):
            target_path = target_dir / rel_path
            try:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                if target_path.exists():
                    source_size = source_path.stat().st_size
                    target_size = target_path.stat().st_size
                    print(f"[{idx}/{len(all_files)}] {Colors.YELLOW}Exists:{Colors.RESET} {rel_path}")
                    print(f"  Source: {self._format_size(source_size)}")
                    print(f"  Target: {self._format_size(target_size)}")

                    if source_size == target_size:
                        print(f"  {Colors.CYAN}→ Same size, skipping{Colors.RESET}")
                        skipped += 1
                        continue
                    if target_size > source_size:
                        print(f"  {Colors.GREEN}→ Target larger, replacing with source{Colors.RESET}")
                        shutil.copy2(source_path, target_path)
                        replaced += 1
                    else:
                        print(f"  {Colors.MAGENTA}→ Source larger, keeping target{Colors.RESET}")
                        skipped += 1
                        continue
                else:
                    shutil.copy2(source_path, target_path)
                    copied += 1
            except Exception as exc:  # pragma: no cover - filesystem defensive
                print(f"[{idx}/{len(all_files)}] {Colors.RED}✗ Failed:{Colors.RESET} {rel_path}")
                print(f"  Error: {exc}")
                failed += 1

        print(f"\n{'='*60}")
        print("Copy completed")
        print(f"  - New files copied: {copied}")
        print(f"  - Files replaced: {replaced}")
        print(f"  - Files skipped (same size): {skipped}")
        print(f"  - Failed: {failed}")
        print(f"{'='*60}\n")

        print(f"{'='*60}")
        print("Step 2: Cleaning up Windows ' Copy' files in target...")
        print(f"{'='*60}\n")

        copy_files = []
        for root, _dirs, files in os.walk(target_dir):
            for filename in files:
                file_path = Path(root) / filename
                if file_path.stem.endswith(" Copy"):
                    copy_files.append(file_path)

        print(f"Found {len(copy_files)} Windows ' Copy' files in target directory")
        if not copy_files:
            print("No ' Copy' files to clean up.\n")
        else:
            deleted = renamed = 0
            for copy_file in copy_files:
                original_name = copy_file.stem.replace(" Copy", "") + copy_file.suffix
                original_path = copy_file.parent / original_name
                try:
                    if original_path.exists():
                        copy_file.unlink()
                        print(f"{Colors.GREEN}✓ Deleted:{Colors.RESET} {copy_file.relative_to(target_dir)}")
                        deleted += 1
                    else:
                        copy_file.rename(original_path)
                        print(f"{Colors.CYAN}→ Renamed:{Colors.RESET} {copy_file.relative_to(target_dir)}")
                        renamed += 1
                except Exception as exc:  # pragma: no cover - filesystem defensive
                    print(f"{Colors.RED}✗ Failed:{Colors.RESET} {copy_file.relative_to(target_dir)}")
                    print(f"  Error: {exc}")

            print(f"\nClean-up summary: deleted {deleted}, renamed {renamed}\n")

        print(f"{'='*60}")
        print("Step 3: Deduplicating target directory...")
        print(f"{'='*60}\n")

        dedup_confirm = input("Perform deduplication on E:\\Evidences? (yes/no, default: yes): ").strip().lower()
        if dedup_confirm not in {"no", "n"}:
            dedup_stats = self._deduplicate_directory(target_dir)
            print(f"\n{'='*60}")
            print("Deduplication completed")
            print(f"  - Duplicates replaced: {dedup_stats['replaced']}")
            print(f"  - Failed: {dedup_stats['failed']}")
            print(f"  - Space saved: {self._format_size(dedup_stats['saved'])}")
            print(f"{'='*60}\n")
        else:
            print("Deduplication skipped.\n")

        print(f"{Colors.GREEN}✓ Copy operations completed!{Colors.RESET}")
        print(f"Target directory: {target_dir}\n")
