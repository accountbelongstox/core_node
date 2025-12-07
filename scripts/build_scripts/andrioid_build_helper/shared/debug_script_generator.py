#!/usr/bin/env python3
"""
Debug Script Generator - Cross-platform debug script generation
Abstracts debug logic from PowerShell scripts to Python
Generates platform-specific debug scripts for Shell/PowerShell execution
"""

import os
from pathlib import Path
from typing import Dict, Optional, List
from shared.data_exchange.unified_variable_system import unified_vars
from shared.shell_executor import shell_executor


class DebugScriptGenerator:
    """
    Generates cross-platform debug scripts
    Abstracts logic from startDebugByXXX.ps1 scripts
    """

    def __init__(self):
        self.project_root = unified_vars.flutter_bloom_root
        self.script_dir = self.project_root / "scripts"
        self.dev_debug_dir = self.script_dir / "dev_debug"

        # Ensure dev_debug directory exists
        self.dev_debug_dir.mkdir(parents=True, exist_ok=True)

    def get_debug_config(self) -> Dict:
        """
        Load debug configuration from variable system
        Returns dict with all necessary debug parameters
        """
        selected_app = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_APP, "app_main")
        entry_file = unified_vars.get_file_variable(
            unified_vars.KEY_SELECTED_ENTRY_FILE,
            f"lib/apps/{selected_app}/main_{selected_app}.dart"
        )
        app_index = unified_vars.get_file_variable(unified_vars.KEY_APP_INDEX, "0")
        debug_port = unified_vars.get_file_variable(unified_vars.KEY_DEBUG_PORT, "10000")
        platform = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_PLATFORM, "web")

        return {
            "app": selected_app,
            "entry_file": entry_file,
            "app_index": app_index,
            "debug_port": debug_port,
            "platform": platform,
            "action": "Debug"
        }

    def generate_web_debug_script(self, config: Dict) -> str:
        """
        Generate Web debug script (matches startDebugByWeb.ps1 logic)
        """
        flutter_args = [
            "run",
            "-d web-server",
            f"--web-port {config['debug_port']}",
            "--web-hostname 0.0.0.0"
        ]

        if config["entry_file"]:
            flutter_args.append(f'-t "{config["entry_file"]}"')

        flutter_command = "flutter " + " ".join(flutter_args)

        if shell_executor.is_windows:
            # PowerShell script
            ps_commands = [
                '$ErrorActionPreference = "Continue"',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Write-Host "Flutter Bloom Web Debug Launcher" -ForegroundColor Cyan',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Write-Host "[INFO] App: {config["app"]}" -ForegroundColor Yellow',
                f'Write-Host "[INFO] Entry File: {config["entry_file"]}" -ForegroundColor Yellow',
                f'Write-Host "[INFO] Debug Port: {config["debug_port"]}" -ForegroundColor Yellow',
                f'Write-Host "[INFO] Platform: Web" -ForegroundColor Yellow',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Set-Location "{self.project_root}"',
                f'Write-Host "[INFO] Executing: {flutter_command}" -ForegroundColor Green',
                f'Write-Host "[INFO] Web server will be available at: http://localhost:{config["debug_port"]}" -ForegroundColor Green',
                f'Write-Host "[INFO] Press Ctrl+C to stop the debug server" -ForegroundColor Yellow',
                f'try {{',
                f'    {flutter_command}',
                f'    Write-Host "[INFO] Flutter command completed successfully" -ForegroundColor Green',
                f'}} catch {{',
                f'    Write-Host "[ERROR] Flutter command failed: $_" -ForegroundColor Red',
                f'}}',
                f'Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow',
                f'$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")'
            ]

            script_path = self.dev_debug_dir / "startDebugByWeb.ps1"
            script_path.write_text("\n".join(ps_commands), encoding='utf-8')

        else:
            # Bash script
            bash_commands = [
                'echo "========================================"',
                'echo "Flutter Bloom Web Debug Launcher"',
                'echo "========================================"',
                f'echo "[INFO] App: {config["app"]}"',
                f'echo "[INFO] Entry File: {config["entry_file"]}"',
                f'echo "[INFO] Debug Port: {config["debug_port"]}"',
                'echo "[INFO] Platform: Web"',
                'echo "========================================"',
                f'cd "{self.project_root}" || exit 1',
                f'echo "[INFO] Executing: {flutter_command}"',
                f'echo "[INFO] Web server will be available at: http://localhost:{config["debug_port"]}"',
                'echo "[INFO] Press Ctrl+C to stop the debug server"',
                flutter_command,
                'echo "[INFO] Flutter command completed"'
            ]

            script_path = self.dev_debug_dir / "startDebugByWeb.sh"
            script_path.write_text("#!/bin/bash\n\n" + "\n".join(bash_commands), encoding='utf-8')
            os.chmod(script_path, 0o755)

        return str(script_path)

    def generate_android_debug_script(self, config: Dict) -> str:
        """
        Generate Android debug script (matches startDebugByPhone.ps1 logic)
        """
        flutter_args = [
            "run",
            "--debug",
            f'-t "{config["entry_file"]}"'
        ]

        flutter_command = "flutter " + " ".join(flutter_args)

        if shell_executor.is_windows:
            # PowerShell script
            ps_commands = [
                '$ErrorActionPreference = "Continue"',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Write-Host "Flutter Bloom Android Debug Launcher" -ForegroundColor Cyan',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Write-Host "[INFO] App: {config["app"]}" -ForegroundColor Yellow',
                f'Write-Host "[INFO] Entry File: {config["entry_file"]}" -ForegroundColor Yellow',
                f'Write-Host "[INFO] Platform: Android" -ForegroundColor Yellow',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Set-Location "{self.project_root}"',
                '',
                '# Check for ADB devices',
                'Write-Host "[INFO] Checking for Android devices..." -ForegroundColor Cyan',
                '$adbDevices = @()',
                'try {',
                '    $adbOutput = & adb devices 2>$null',
                '    $adbDevices = $adbOutput | Where-Object { $_ -match "\\t" } | ForEach-Object {',
                '        $parts = $_ -split "\\t"',
                '        [PSCustomObject]@{',
                '            ID = $parts[0].Trim()',
                '            Status = $parts[1].Trim()',
                '        }',
                '    }',
                '} catch {',
                '    Write-Host "[WARNING] ADB not available" -ForegroundColor Yellow',
                '}',
                '',
                'if ($adbDevices.Count -gt 0) {',
                '    Write-Host "[INFO] Found $($adbDevices.Count) Android device(s)" -ForegroundColor Green',
                '    foreach ($device in $adbDevices) {',
                '        Write-Host "  - $($device.ID) ($($device.Status))" -ForegroundColor White',
                '    }',
                '} else {',
                '    Write-Host "[WARNING] No Android devices detected" -ForegroundColor Yellow',
                '    Write-Host "[INFO] Make sure USB debugging is enabled and device is connected" -ForegroundColor Yellow',
                '}',
                '',
                'Write-Host "[INFO] Starting Flutter for Android..." -ForegroundColor Green',
                f'Write-Host "[INFO] Executing: {flutter_command}" -ForegroundColor Cyan',
                'Write-Host "[DEBUG] Hot reload: press \'r\'" -ForegroundColor Yellow',
                'Write-Host "[DEBUG] Hot restart: press \'R\'" -ForegroundColor Yellow',
                'Write-Host "[DEBUG] Quit: press \'q\'" -ForegroundColor Yellow',
                '',
                'try {',
                f'    {flutter_command}',
                '    Write-Host "[INFO] Flutter command completed successfully" -ForegroundColor Green',
                '} catch {',
                '    Write-Host "[ERROR] Flutter command failed: $_" -ForegroundColor Red',
                '}',
                '',
                'Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow',
                '$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")'
            ]

            script_path = self.dev_debug_dir / "startDebugByPhone.ps1"
            script_path.write_text("\n".join(ps_commands), encoding='utf-8')

        else:
            # Bash script
            bash_commands = [
                'echo "========================================"',
                'echo "Flutter Bloom Android Debug Launcher"',
                'echo "========================================"',
                f'echo "[INFO] App: {config["app"]}"',
                f'echo "[INFO] Entry File: {config["entry_file"]}"',
                'echo "[INFO] Platform: Android"',
                'echo "========================================"',
                f'cd "{self.project_root}" || exit 1',
                '',
                '# Check for ADB devices',
                'echo "[INFO] Checking for Android devices..."',
                'if command -v adb &> /dev/null; then',
                '    adb_output=$(adb devices 2>/dev/null)',
                '    device_count=$(echo "$adb_output" | grep -c "\\tdevice$" || true)',
                '    ',
                '    if [ "$device_count" -gt 0 ]; then',
                '        echo "[INFO] Found $device_count Android device(s)"',
                '        echo "$adb_output" | grep "\\tdevice$" | while read line; do',
                '            echo "  - $line"',
                '        done',
                '    else',
                '        echo "[WARNING] No Android devices detected"',
                '        echo "[INFO] Make sure USB debugging is enabled and device is connected"',
                '    fi',
                'else',
                '    echo "[WARNING] ADB not available"',
                'fi',
                '',
                'echo "[INFO] Starting Flutter for Android..."',
                f'echo "[INFO] Executing: {flutter_command}"',
                'echo "[DEBUG] Hot reload: press \'r\'"',
                'echo "[DEBUG] Hot restart: press \'R\'"',
                'echo "[DEBUG] Quit: press \'q\'"',
                '',
                flutter_command,
                'echo "[INFO] Flutter command completed"'
            ]

            script_path = self.dev_debug_dir / "startDebugByPhone.sh"
            script_path.write_text("#!/bin/bash\n\n" + "\n".join(bash_commands), encoding='utf-8')
            os.chmod(script_path, 0o755)

        return str(script_path)

    def generate_ios_debug_script(self, config: Dict) -> str:
        """Generate iOS debug script"""
        flutter_command = f'flutter run --debug -t "{config["entry_file"]}"'

        if shell_executor.is_windows:
            ps_commands = [
                '$ErrorActionPreference = "Continue"',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Write-Host "Flutter Bloom iOS Debug Launcher" -ForegroundColor Cyan',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Set-Location "{self.project_root}"',
                f'Write-Host "[INFO] App: {config["app"]}" -ForegroundColor Yellow',
                f'Write-Host "[INFO] Entry File: {config["entry_file"]}" -ForegroundColor Yellow',
                f'{flutter_command}',
                f'$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")'
            ]

            script_path = self.dev_debug_dir / "startDebugByIOS.ps1"
            script_path.write_text("\n".join(ps_commands), encoding='utf-8')

        else:
            bash_commands = [
                'echo "========================================"',
                'echo "Flutter Bloom iOS Debug Launcher"',
                'echo "========================================"',
                f'cd "{self.project_root}" || exit 1',
                f'echo "[INFO] App: {config["app"]}"',
                f'echo "[INFO] Entry File: {config["entry_file"]}"',
                flutter_command
            ]

            script_path = self.dev_debug_dir / "startDebugByIOS.sh"
            script_path.write_text("#!/bin/bash\n\n" + "\n".join(bash_commands), encoding='utf-8')
            os.chmod(script_path, 0o755)

        return str(script_path)

    def generate_windows_debug_script(self, config: Dict) -> str:
        """Generate Windows desktop debug script"""
        flutter_command = f'flutter run -d windows --debug -t "{config["entry_file"]}"'

        if shell_executor.is_windows:
            ps_commands = [
                '$ErrorActionPreference = "Continue"',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Write-Host "Flutter Bloom Windows Debug Launcher" -ForegroundColor Cyan',
                f'Write-Host "========================================" -ForegroundColor Cyan',
                f'Set-Location "{self.project_root}"',
                f'Write-Host "[INFO] App: {config["app"]}" -ForegroundColor Yellow',
                f'Write-Host "[INFO] Entry File: {config["entry_file"]}" -ForegroundColor Yellow',
                f'{flutter_command}',
                f'$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")'
            ]

            script_path = self.dev_debug_dir / "startDebugByWindows.ps1"
            script_path.write_text("\n".join(ps_commands), encoding='utf-8')

        else:
            bash_commands = [
                'echo "========================================"',
                'echo "Flutter Bloom Linux Debug Launcher"',
                'echo "========================================"',
                f'cd "{self.project_root}" || exit 1',
                f'echo "[INFO] App: {config["app"]}"',
                f'echo "[INFO] Entry File: {config["entry_file"]}"',
                f'flutter run -d linux --debug -t "{config["entry_file"]}"'
            ]

            script_path = self.dev_debug_dir / "startDebugByLinux.sh"
            script_path.write_text("#!/bin/bash\n\n" + "\n".join(bash_commands), encoding='utf-8')
            os.chmod(script_path, 0o755)

        return str(script_path)

    def generate_debug_script_for_platform(self, platform: str) -> Optional[str]:
        """
        Generate debug script for specified platform
        Returns: path to generated script
        """
        config = self.get_debug_config()
        config["platform"] = platform

        platform_lower = platform.lower()

        if platform_lower in ["web", "web-server", "chrome"]:
            return self.generate_web_debug_script(config)
        elif platform_lower in ["android", "phone"]:
            return self.generate_android_debug_script(config)
        elif platform_lower == "ios":
            return self.generate_ios_debug_script(config)
        elif platform_lower in ["windows", "linux"]:
            return self.generate_windows_debug_script(config)
        else:
            print(f"[ERROR] Unknown platform: {platform}")
            return None

    def prepare_debug_script(self) -> dict:
        """
        Main entry point: prepare debug script based on variable system
        Returns dict with success status and script path
        """
        try:
            config = self.get_debug_config()
            platform = config["platform"]

            print(f"[INFO] Generating debug script for platform: {platform}")

            script_path = self.generate_debug_script_for_platform(platform)

            if not script_path:
                return {
                    "success": False,
                    "error": f"Failed to generate debug script for platform: {platform}"
                }

            # Save script path to variable system
            unified_vars.set_file_variable(unified_vars.KEY_SCRIPT_PATH, script_path)
            unified_vars.set_file_variable(unified_vars.KEY_DEBUG_SCRIPT_PATH, script_path)

            print(f"[SUCCESS] Debug script generated: {script_path}")

            return {
                "success": True,
                "script_path": script_path,
                "platform": platform,
                "config": config
            }

        except Exception as e:
            print(f"[ERROR] Failed to prepare debug script: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }


# Global instance
debug_script_generator = DebugScriptGenerator()
