#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, NamedTuple
import logging

# Configure logging
logging.basicConfig(
    format='[%(levelname)s] %(message)s',
    level=logging.INFO
)
log = logging.getLogger(__name__)

# Define binaries to check
BINARIES_TO_CHECK = {
    'node': ['node', 'npm', 'npx'],
    'yarn': ['yarn', 'yarnpkg'],
    'pm2': ['pm2'],
    'pnpm': ['pnpm'],
    'typescript': ['tsc', 'tsserver'],
    'ts-node': ['ts-node']
}

BINARY_PATHS = [
    '/usr/local/bin',
    '/usr/bin'
]

class SymlinkInfo(NamedTuple):
    """Information about a symlink"""
    path: Path
    target: Path
    resolved_target: Path
    exists: bool
    base_dir: Path

class ValidationResult(NamedTuple):
    """Result of symlink group validation"""
    is_valid: bool
    reason: Optional[str] = None
    details: List[SymlinkInfo] = []
    expected_base_dir: Optional[Path] = None

def get_all_paths() -> List[Path]:
    """Get all paths to check"""
    paths = []
    for dir_path in BINARY_PATHS:
        for binaries in BINARIES_TO_CHECK.values():
            for binary in binaries:
                paths.append(Path(dir_path) / binary)
    return paths

def get_symlink_info(link_path: Path) -> Optional[SymlinkInfo]:
    """Get information about a symlink"""
    try:
        if not link_path.is_symlink():
            return None

        target = Path(os.readlink(link_path))
        resolved_target = (link_path.parent / target).resolve()
        exists = resolved_target.exists()
        base_dir = resolved_target.parent.parent  # Get parent of bin directory

        return SymlinkInfo(
            path=link_path,
            target=target,
            resolved_target=resolved_target,
            exists=exists,
            base_dir=base_dir
        )
    except Exception as e:
        log.debug(f"Error getting symlink info for {link_path}: {e}")
        return None

def group_symlinks_by_base_dir() -> Dict[Path, List[SymlinkInfo]]:
    """Group symlinks by their target base directories"""
    groups = {}
    for link_path in get_all_paths():
        info = get_symlink_info(Path(link_path))
        if info:
            if info.base_dir not in groups:
                groups[info.base_dir] = []
            groups[info.base_dir].append(info)
    return groups

def is_valid_group(group: List[SymlinkInfo]) -> ValidationResult:
    """Check if a group of symlinks is valid"""
    # Check if all targets exist
    broken_links = [info for info in group if not info.exists]
    if broken_links:
        log.warning("Found broken symlinks in group:")
        for info in broken_links:
            log.warning(f"  {info.path} -> {info.target} (target missing)")
        return ValidationResult(False, "broken_links", broken_links)

    # Check if all symlinks point to the same base directory
    base_dir = group[0].base_dir
    inconsistent_links = [info for info in group if info.base_dir != base_dir]
    if inconsistent_links:
        log.warning("Found inconsistent symlink targets:")
        for info in group:
            log.warning(f"  {info.path} -> {info.target}")
            log.warning(f"    Base directory: {info.base_dir}")
        log.warning(f"Expected base directory: {base_dir}")
        return ValidationResult(False, "inconsistent_targets", inconsistent_links, base_dir)

    log.info("All symlinks in group are valid:")
    for info in group:
        log.info(f"  {info.path} -> {info.target}")
    return ValidationResult(True, base_dir=base_dir)

def remove_group(group: List[SymlinkInfo], reason: str) -> bool:
    """Remove a group of symlinks"""
    all_removed = True
    log.warning("\nRemoving symlink group:")
    log.warning(f"Reason: {'Broken symlinks detected' if reason == 'broken_links' else 'Inconsistent target directories'}")
    
    for info in group:
        try:
            os.unlink(info.path)
            log.info(f"✓ Removed: {info.path} -> {info.target}")
        except Exception as e:
            log.error(f"✗ Failed to remove {info.path}: {e}")
            all_removed = False
    
    return all_removed

def cleanup_node_links():
    """Main cleanup function"""
    if os.geteuid() != 0:
        log.error("This script must be run as root")
        log.error("Please use: sudo python3 clean_invalid_node_links.py")
        sys.exit(1)

    log.info("Starting Node.js and related binary symlinks check...")
    log.info(f"Scanning directories: {', '.join(BINARY_PATHS)}")
    log.info("Checking binaries:\n  " + "\n  ".join(
        f"{key}: {', '.join(values)}" for key, values in BINARIES_TO_CHECK.items()
    ))

    groups = group_symlinks_by_base_dir()
    needs_cleanup = False
    all_removed = True
    summary = {
        'total': 0,
        'valid': 0,
        'removed': 0,
        'failed': 0
    }

    for base_dir, group in groups.items():
        log.info(f"\nAnalyzing symlinks in {base_dir}:")
        summary['total'] += len(group)

        validation = is_valid_group(group)
        if not validation.is_valid:
            needs_cleanup = True
            if not remove_group(group, validation.reason):
                all_removed = False
                summary['failed'] += len(group)
            else:
                summary['removed'] += len(group)
        else:
            log.info(f"✓ Keeping valid symlink group in {base_dir}")
            log.info("  Reason: All symlinks are valid and consistent")
            summary['valid'] += len(group)

    log.info("\nCleanup Summary:")
    log.info("================")
    log.info(f"Total symlinks checked: {summary['total']}")
    log.info(f"Valid symlinks kept: {summary['valid']}")
    if summary['removed'] > 0:
        log.warning(f"Symlinks removed: {summary['removed']}")
    if summary['failed'] > 0:
        log.error(f"Failed removals: {summary['failed']}")

    if not needs_cleanup:
        log.info("\nNo cleanup needed - all symlinks are valid.")
        return

    if not all_removed:
        log.error("\nSome symlinks could not be removed.")
        log.error("Please check permissions and try again.")
        sys.exit(1)

    log.info("\nCleanup completed successfully.")

if __name__ == '__main__':
    try:
        cleanup_node_links()
    except KeyboardInterrupt:
        log.error("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        log.error(f"Unexpected error: {e}")
        sys.exit(1) 