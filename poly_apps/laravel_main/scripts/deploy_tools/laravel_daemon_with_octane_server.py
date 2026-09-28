#!/usr/bin/env python3
"""
Laravel Octane File Watcher Daemon
Monitors Laravel application files and automatically restarts Octane services on changes.

This is a development tool for auto-reloading during active development.
For production, use the standard 48h auto-restart timer.
"""

import os
import sys
import time
import subprocess
import logging
from pathlib import Path
from datetime import datetime
from collections import defaultdict

try:
    import inotify.adapters
    import inotify.constants
except ImportError:
    print("Error: python3-inotify package is required")
    print("Install with: sudo apt install python3-inotify")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).parent.absolute()
LARAVEL_ROOT = SCRIPT_DIR.parent.parent
CORE_NODE_ROOT = LARAVEL_ROOT.parent.parent
OCTANE_MANAGER_SCRIPT = CORE_NODE_ROOT / "scripts/shells/linux/common/octane_service_manager.sh"

WATCH_EXTENSIONS = {'.php', '.blade.php', '.json', '.yaml', '.yml'}
WATCH_DIRS = ['app', 'config', 'routes', 'database', 'resources']
IGNORE_DIRS = {'vendor', 'node_modules', 'storage', 'bootstrap/cache', 'public/build'}

DEBOUNCE_SECONDS = 2
LOG_FILE = LARAVEL_ROOT / "storage/logs/octane_watcher.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class OctaneWatcher:
    def __init__(self, laravel_root: Path):
        self.laravel_root = laravel_root
        self.last_restart_time = 0
        self.pending_changes = defaultdict(set)

    def should_watch_file(self, filepath: str) -> bool:
        path = Path(filepath)

        if any(ignored in path.parts for ignored in IGNORE_DIRS):
            return False

        if path.suffix in WATCH_EXTENSIONS:
            return True

        return False

    def get_octane_services(self) -> list:
        try:
            result = subprocess.run(
                ['bash', str(OCTANE_MANAGER_SCRIPT), 'list'],
                capture_output=True,
                text=True,
                check=False
            )

            services = []
            for line in result.stdout.strip().split('\n'):
                line = line.strip()
                if line and line.startswith('octane-'):
                    services.append(line)

            return services
        except Exception as e:
            logger.error(f"Failed to get Octane services: {e}")
            return []

    def restart_octane_services(self):
        current_time = time.time()

        if current_time - self.last_restart_time < DEBOUNCE_SECONDS:
            logger.debug("Restart request debounced (too soon)")
            return

        self.last_restart_time = current_time

        services = self.get_octane_services()

        if not services:
            logger.warning("No Octane services found to restart")
            return

        logger.info(f"Restarting {len(services)} Octane service(s)...")

        for service in services:
            try:
                result = subprocess.run(
                    ['sudo', 'systemctl', 'restart', service],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode == 0:
                    logger.info(f"✓ Restarted {service}")
                else:
                    logger.error(f"✗ Failed to restart {service}: {result.stderr}")
            except Exception as e:
                logger.error(f"✗ Error restarting {service}: {e}")

        self.pending_changes.clear()

    def watch(self):
        logger.info("="*60)
        logger.info("Laravel Octane File Watcher Daemon Started")
        logger.info(f"Laravel Root: {self.laravel_root}")
        logger.info(f"Watching: {', '.join(WATCH_DIRS)}")
        logger.info(f"Extensions: {', '.join(WATCH_EXTENSIONS)}")
        logger.info(f"Debounce: {DEBOUNCE_SECONDS}s")
        logger.info("="*60)

        watch_paths = []
        for watch_dir in WATCH_DIRS:
            full_path = self.laravel_root / watch_dir
            if full_path.exists():
                watch_paths.append(str(full_path))
                logger.info(f"Watching: {full_path}")

        i = inotify.adapters.InotifyTrees(
            watch_paths,
            mask=inotify.constants.IN_MODIFY | inotify.constants.IN_CREATE | inotify.constants.IN_DELETE
        )

        logger.info("File watcher initialized. Monitoring for changes...")

        try:
            for event in i.event_gen(yield_nones=False):
                (_, type_names, path, filename) = event

                if not filename:
                    continue

                full_path = os.path.join(path, filename)

                if not self.should_watch_file(full_path):
                    continue

                event_type = ', '.join(type_names)
                logger.info(f"Change detected: {event_type} - {full_path}")

                self.pending_changes[path].add(filename)

                self.restart_octane_services()

        except KeyboardInterrupt:
            logger.info("Watcher stopped by user")
        except Exception as e:
            logger.error(f"Watcher error: {e}", exc_info=True)
        finally:
            logger.info("Laravel Octane File Watcher Daemon Stopped")


def main():
    if not LARAVEL_ROOT.exists():
        logger.error(f"Laravel root not found: {LARAVEL_ROOT}")
        sys.exit(1)

    if not OCTANE_MANAGER_SCRIPT.exists():
        logger.error(f"Octane manager script not found: {OCTANE_MANAGER_SCRIPT}")
        sys.exit(1)

    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    watcher = OctaneWatcher(LARAVEL_ROOT)
    watcher.watch()


if __name__ == '__main__':
    main()
