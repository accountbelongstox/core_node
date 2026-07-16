import os
import json
import subprocess
import logging
from typing import List, Dict, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class ApplicationsListParser:
    """
    Parser for ApplicationsList.ps1 PowerShell script output.
    Retrieves installed applications list for backup purposes.
    Uses file-based JSON exchange via ~/.core_node/pybackup/applications_list.json
    """

    def __init__(self, applications_list_script_path: str):
        """
        Initialize the parser with the path to ApplicationsList.ps1

        Args:
            applications_list_script_path: Absolute path to ApplicationsList.ps1
        """
        self.script_path = Path(applications_list_script_path)

        if not self.script_path.exists():
            raise FileNotFoundError(f"ApplicationsList.ps1 not found: {self.script_path}")

        username = os.environ.get('USERNAME', os.environ.get('USER', 'default'))
        core_node_dir = Path('D:/programing/Users') / username / '.core_node'
        self.json_exchange_file = core_node_dir / "pybackup" / "applications_list.json"

        logger.info(f"ApplicationsListParser initialized")
        logger.info(f"  Script: {self.script_path}")
        logger.info(f"  JSON exchange file: {self.json_exchange_file}")

    def get_applications_list(self) -> List[Dict[str, any]]:
        """
        Execute ApplicationsList.ps1 with -OutputApplicationsList parameter
        and read the JSON output from the exchange file.

        Returns:
            List of application dictionaries with keys:
            - Name: Application name
            - Exec: Executable name
            - PackageId: Package ID
            - Description: Description
            - InstallType: Installation type (winget, npm, etc.)
            - ForceToInstallDir: Whether force installed to custom directory
            - AppCustomInstallDir: Custom installation directory if specified
            - Category: Application category
        """
        try:
            command = [
                'powershell',
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-File', str(self.script_path),
                '-OutputApplicationsList'
            ]

            logger.info(f"Executing PowerShell script...")
            logger.debug(f"Command: {' '.join(command)}")

            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
                timeout=60
            )

            if result.returncode != 0:
                logger.error(f"PowerShell script failed with return code {result.returncode}")
                logger.error(f"stderr: {result.stderr}")
                return []

            if not self.json_exchange_file.exists():
                logger.error(f"JSON exchange file not created: {self.json_exchange_file}")
                return []

            logger.info(f"Reading JSON from: {self.json_exchange_file}")

            with open(self.json_exchange_file, 'r', encoding='utf-8-sig') as f:
                applications = json.load(f)

            logger.info(f"Successfully parsed {len(applications)} applications")

            return applications

        except subprocess.TimeoutExpired:
            logger.error("PowerShell script execution timed out")
            return []

        except subprocess.CalledProcessError as e:
            logger.error(f"PowerShell script execution failed: {e}")
            logger.error(f"stderr: {e.stderr}")
            return []

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from {self.json_exchange_file}: {e}")
            return []

        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return []

    def filter_applications_for_backup(
        self,
        applications: List[Dict[str, any]],
        base_applications_dir: str = r"D:\applications"
    ) -> List[Dict[str, str]]:
        """
        Filter applications and return their backup paths.

        Args:
            applications: List of application dictionaries from get_applications_list()
            base_applications_dir: Base directory where applications are installed

        Returns:
            List of dictionaries with:
            - name: Application name
            - source_path: Full path to application directory
            - exec: Executable name
            - category: Application category (DesktopCategory)
            - package_source: Package source collection (APPLICATIONS_PACKAGES, DEV_SOFTWARE_PACKAGES, COMMON_SOFTWARE_PACKAGES)
            - install_type: Installation type
            - description: Application description
        """
        backup_targets = []

        for app in applications:
            app_name = app.get('Name')
            if not app_name:
                continue

            if app.get('AppCustomInstallDir'):
                source_path = app.get('AppCustomInstallDir')
            else:
                source_path = os.path.join(base_applications_dir, app_name)

            if os.path.exists(source_path):
                backup_target = {
                    'name': app_name,
                    'source_path': source_path,
                    'exec': app.get('Exec', ''),
                    'category': app.get('Category', 'Uncategorized'),
                    'package_source': app.get('PackageSource', 'UNKNOWN'),
                    'install_type': app.get('InstallType', 'unknown'),
                    'description': app.get('Description', '')
                }
                backup_targets.append(backup_target)
                logger.debug(f"Added backup target: {app_name} ({app.get('PackageSource', 'UNKNOWN')}) at {source_path}")
            else:
                logger.debug(f"Skipping {app_name}: path does not exist: {source_path}")

        logger.info(f"Found {len(backup_targets)} applications to backup")
        return backup_targets


def get_applications_for_backup(
    applications_list_script: Optional[str] = None
) -> List[Dict[str, str]]:
    """
    Convenience function to get applications list for backup.

    Args:
        applications_list_script: Path to ApplicationsList.ps1
                                  If not provided, uses default location

    Returns:
        List of application backup targets
    """
    if not applications_list_script:
        current_file = Path(__file__).resolve()
        project_root = current_file.parent.parent.parent.parent.parent
        applications_list_script = project_root / "scripts" / "shells" / "win" / "win_common" / "ApplicationsList.ps1"

    parser = ApplicationsListParser(str(applications_list_script))
    applications = parser.get_applications_list()
    return parser.filter_applications_for_backup(applications)
