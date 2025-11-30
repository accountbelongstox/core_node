"""
Software Installation Monitor
A tool for monitoring filesystem and registry changes during software installation
"""

__version__ = "1.0.0"
__author__ = "Installation Monitor Team"

from .filesystem_monitor import FilesystemMonitor, create_filesystem_monitor
from .registry_monitor import RegistryMonitor, create_registry_monitor
from .monitor_orchestrator import InstallationMonitor
from .software_packager import SoftwarePackager, package_software

__all__ = [
    'FilesystemMonitor',
    'RegistryMonitor',
    'InstallationMonitor',
    'SoftwarePackager',
    'create_filesystem_monitor',
    'create_registry_monitor',
    'package_software',
]
