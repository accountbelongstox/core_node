"""Integrity checking helpers."""

from __future__ import annotations

import shutil
import os
from pathlib import Path

try:
    from ..colors import Colors
except ImportError:
    from colors import Colors


class IntegrityMixin:
    """Detect and quarantine corrupted media assets."""

    VIDEO_EXTENSIONS: set[str]

    def detect_corrupted_videos(self) -> None:
        """Scan a directory tree for corrupted videos and isolate them."""

        print(f"\n{'='*60}")
        print("Detect Corrupted Videos")
        print(f"{'='*60}\n")

        primary_dir_input = input("Primary directory (default: D:\\.tmp\\BaiduNetdiskDownload): ").strip()
        primary_dir = Path(primary_dir_input) if primary_dir_input else Path(r"D:\.tmp\BaiduNetdiskDownload")

        secondary_dir_input = input("Secondary directory (default: E:\\Evidences): ").strip()
        secondary_dir = Path(secondary_dir_input) if secondary_dir_input else Path(r"E:\Evidences")

        if not primary_dir.exists():
            print(f"{Colors.RED}Error: Primary directory does not exist: {primary_dir}{Colors.RESET}")
            return

        if not self._check_ffmpeg():
            print(f"{Colors.RED}Error: ffmpeg/ffprobe not available in PATH{Colors.RESET}")
            return

        primary_quarantine = primary_dir / "_corrupted_videos"
        primary_quarantine.mkdir(parents=True, exist_ok=True)

        secondary_quarantine = None
        if secondary_dir.exists():
            secondary_quarantine = secondary_dir / "_corrupted_videos"
            secondary_quarantine.mkdir(parents=True, exist_ok=True)
            print(f"Secondary directory enabled: {secondary_dir}")
        else:
            print(f"{Colors.YELLOW}Secondary directory not found; skipping secondary moves.{Colors.RESET}")

        videos = []
        for root, _dirs, files in os.walk(primary_dir):
            if any(skip in root for skip in ["_tmp", "_compress", "_corrupted_videos"]):
                continue
            for filename in files:
                path = Path(root) / filename
                if path.suffix.lower() in self.VIDEO_EXTENSIONS:
                    videos.append(path)

        print(f"Found {len(videos)} video files.\n")
        if not videos:
            return

        confirm = input(f"Start checking {len(videos)} videos? (yes/no, default: yes): ").strip().lower()
        if confirm in {"no", "n"}:
            print("Operation cancelled.")
            return

        corrupted = 0
        moved_secondary = 0

        for idx, video_path in enumerate(videos, 1):
            rel_path = video_path.relative_to(primary_dir)
            print(f"[{idx}/{len(videos)}] Checking: {rel_path}")

            valid = self._verify_file(video_path)
            if valid:
                continue

            corrupted += 1
            target_path = primary_quarantine / rel_path
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(video_path, target_path)
            print(f"  {Colors.RED}✗ Moved to quarantine: {target_path}{Colors.RESET}")

            if secondary_quarantine:
                secondary_candidate = secondary_dir / rel_path
                if secondary_candidate.exists():
                    secondary_target = secondary_quarantine / rel_path
                    secondary_target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(secondary_candidate, secondary_target)
                    moved_secondary += 1
                    print(f"  {Colors.YELLOW}→ Secondary copy moved: {secondary_target}{Colors.RESET}")

        print(f"\n{'='*60}")
        print("Integrity scan complete")
        print(f"  Corrupted videos: {corrupted}")
        if secondary_quarantine:
            print(f"  Secondary moves: {moved_secondary}")
        print(f"{'='*60}\n")
