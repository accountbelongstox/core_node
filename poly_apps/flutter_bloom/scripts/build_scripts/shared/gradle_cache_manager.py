#!/usr/bin/env python3
"""
Gradle Cache Manager - Cross-platform Gradle cache cleanup
Generates platform-specific commands for Gradle cache management
"""

import os
from pathlib import Path
from typing import List, Optional
from shared.data_exchange.unified_variable_system import unified_vars
from shared.shell_executor import shell_executor


class GradleCacheManager:
    """
    Manages Gradle cache cleanup operations
    Generates cross-platform commands for cache cleanup
    """

    def __init__(self):
        self.project_root = unified_vars.flutter_bloom_root
        self.android_dir = self.project_root / "android"

        # Platform-specific Gradle paths
        if shell_executor.is_windows:
            self.gradle_home = Path(os.environ.get('USERPROFILE', '')) / ".gradle"
            self.gradle_wrapper_base = self.gradle_home / "wrapper" / "dists"
        else:
            self.gradle_home = Path.home() / ".gradle"
            self.gradle_wrapper_base = self.gradle_home / "wrapper" / "dists"

        self.gradle_caches_dir = self.gradle_home / "caches"
        self.gradle_wrapper_dir = self.gradle_home / "wrapper"
        self.gradle_daemon_dir = self.gradle_home / "daemon"

    def get_gradle_executable(self) -> Optional[str]:
        """Find Gradle executable in wrapper distributions"""
        try:
            # Look for gradle executable in wrapper distributions
            if self.gradle_wrapper_base.exists():
                for gradle_dist in self.gradle_wrapper_base.glob("gradle-*-bin/*/gradle-*"):
                    gradle_bin = gradle_dist / "bin"
                    if shell_executor.is_windows:
                        gradle_exe = gradle_bin / "gradle.bat"
                    else:
                        gradle_exe = gradle_bin / "gradle"

                    if gradle_exe.exists():
                        return str(gradle_exe)
            return None
        except Exception:
            return None

    def generate_stop_gradle_daemons_command(self) -> str:
        """Generate command to stop Gradle daemons"""
        gradle_exe = self.get_gradle_executable()

        if gradle_exe:
            return f'"{gradle_exe}" --stop'
        else:
            # Fallback to system gradle if available
            if shell_executor.is_windows:
                return "gradle --stop 2>nul || echo Gradle not found, skipping daemon stop"
            else:
                return "gradle --stop 2>/dev/null || echo 'Gradle not found, skipping daemon stop'"

    def generate_flutter_clean_commands(self) -> List[str]:
        """Generate Flutter clean commands"""
        return [
            "echo 'Cleaning Flutter project...'",
            "flutter clean"
        ]

    def generate_remove_flutter_dirs_commands(self) -> List[str]:
        """Generate commands to remove Flutter build directories"""
        commands = [
            "echo 'Removing Flutter build directories...'"
        ]

        dirs_to_remove = [
            str(self.project_root / "build"),
            str(self.project_root / ".dart_tool")
        ]

        for dir_path in dirs_to_remove:
            commands.append(shell_executor.get_directory_remove_command(dir_path))

        return commands

    def generate_remove_android_dirs_commands(self) -> List[str]:
        """Generate commands to remove Android build directories"""
        commands = [
            "echo 'Removing Android build directories...'"
        ]

        android_dirs_to_remove = [
            str(self.android_dir / ".gradle"),
            str(self.android_dir / "build"),
            str(self.android_dir / "app" / "build")
        ]

        for dir_path in android_dirs_to_remove:
            commands.append(shell_executor.get_directory_remove_command(dir_path))

        return commands

    def generate_clean_gradle_cache_commands(self) -> List[str]:
        """Generate commands to clean Gradle global cache"""
        commands = [
            "echo 'Cleaning Gradle global cache...'"
        ]

        # Remove cache directory
        if self.gradle_caches_dir.exists():
            commands.append(
                shell_executor.get_directory_remove_command(str(self.gradle_caches_dir))
            )

        return commands

    def generate_clean_gradle_wrapper_commands(self) -> List[str]:
        """Generate commands to clean Gradle wrapper cache"""
        commands = [
            "echo 'Cleaning Gradle wrapper cache...'"
        ]

        if self.gradle_wrapper_dir.exists():
            commands.append(
                shell_executor.get_directory_remove_command(str(self.gradle_wrapper_dir))
            )

        return commands

    def generate_clean_gradle_daemon_commands(self) -> List[str]:
        """Generate commands to clean Gradle daemon directory"""
        commands = [
            "echo 'Cleaning Gradle daemon directory...'"
        ]

        if self.gradle_daemon_dir.exists():
            commands.append(
                shell_executor.get_directory_remove_command(str(self.gradle_daemon_dir))
            )

        return commands

    def generate_flutter_pub_get_commands(self) -> List[str]:
        """Generate Flutter pub get commands"""
        return [
            "echo 'Getting Flutter packages...'",
            "flutter pub get"
        ]

    def generate_complete_cleanup_script(self) -> str:
        """
        Generate complete Gradle cache cleanup script
        Returns: path to generated script
        """
        print("[INFO] Starting comprehensive Gradle cache cleanup...")

        all_commands = []

        # Header
        all_commands.append("echo '=========================================='")
        all_commands.append("echo 'Gradle Cache Cleanup'")
        all_commands.append("echo '=========================================='")
        all_commands.append("echo ''")

        # Stop Gradle daemons
        all_commands.append("echo 'Stopping Gradle daemons...'")
        all_commands.append(self.generate_stop_gradle_daemons_command())
        all_commands.append("echo ''")

        # Clean Flutter project
        all_commands.extend(self.generate_flutter_clean_commands())
        all_commands.append("echo ''")

        # Remove Flutter build directories
        all_commands.extend(self.generate_remove_flutter_dirs_commands())
        all_commands.append("echo ''")

        # Remove Android build directories
        all_commands.extend(self.generate_remove_android_dirs_commands())
        all_commands.append("echo ''")

        # Clean Gradle caches
        all_commands.extend(self.generate_clean_gradle_cache_commands())
        all_commands.append("echo ''")

        # Clean Gradle wrapper
        all_commands.extend(self.generate_clean_gradle_wrapper_commands())
        all_commands.append("echo ''")

        # Clean Gradle daemon
        all_commands.extend(self.generate_clean_gradle_daemon_commands())
        all_commands.append("echo ''")

        # Get Flutter packages
        all_commands.extend(self.generate_flutter_pub_get_commands())
        all_commands.append("echo ''")

        # Footer
        all_commands.append("echo '=========================================='")
        all_commands.append("echo 'Gradle cache cleanup completed!'")
        all_commands.append("echo 'You can now try building your project again.'")
        all_commands.append("echo '=========================================='")

        # Generate script
        if shell_executor.is_windows:
            script_path = shell_executor.generate_bat_file(
                commands=all_commands,
                title="Gradle Cache Cleanup",
                working_dir=str(self.project_root),
                pause_on_exit=True
            )
        else:
            script_path = shell_executor.generate_bash_script(
                commands=all_commands,
                title="Gradle Cache Cleanup",
                working_dir=str(self.project_root),
                pause_on_exit=False
            )

        print(f"[INFO] Gradle cleanup script generated: {script_path}")
        return script_path

    def prepare_cleanup_commands_for_shell(self) -> dict:
        """
        Prepare cleanup commands and save to variable system
        For shell scripts to execute
        """
        try:
            script_path = self.generate_complete_cleanup_script()

            # Save to variable system
            unified_vars.set_file_variable("GRADLE_CLEANUP_SCRIPT", script_path)

            return {
                "success": True,
                "script_path": script_path
            }

        except Exception as e:
            print(f"[ERROR] Failed to prepare Gradle cleanup: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Global instance
gradle_cache_manager = GradleCacheManager()
