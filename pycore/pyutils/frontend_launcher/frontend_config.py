"""
Frontend Configuration

Unified configuration for frontend launchers
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class FrontendConfig:
    """
    Frontend Configuration

    Attributes:
        app_name: Application name (e.g., 'pymatrix')
        port: Server port
        mode: Server mode ('dev' | 'production')
        skip_build: Skip build in production mode (use existing .output)
        force_rebuild: Force rebuild even if .output exists
        project_root: Project root directory
        show_output: Show compilation output in real-time
        health_check_timeout: Timeout for health check (seconds)
    """
    app_name: str
    port: int = 3000
    mode: str = 'production'  # 'dev' | 'production'
    skip_build: bool = False
    force_rebuild: bool = False
    project_root: Optional[Path] = None
    show_output: bool = True
    health_check_timeout: int = 120

    def __post_init__(self):
        """Validate configuration"""
        if self.mode not in ('dev', 'production'):
            raise ValueError(f"Invalid mode: {self.mode}. Must be 'dev' or 'production'")

        if self.skip_build and self.force_rebuild:
            raise ValueError("Cannot use skip_build and force_rebuild together")

        # Auto-detect project root if not provided
        if self.project_root is None:
            from pycore.pygvar import PROJECT_ROOT as PYCORE_PROJECT_ROOT
            self.project_root = Path(PYCORE_PROJECT_ROOT)
        else:
            self.project_root = Path(self.project_root)
