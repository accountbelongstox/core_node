"""Frontend Controller

Manages Nuxt frontend lifecycle for Matrix application

Uses pycore.pyutils.frontend_launcher for unified frontend management
"""

from pathlib import Path
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.frontend_launcher import NuxtLauncher, FrontendConfig


class FrontendController:
    """
    Frontend Controller

    Manages Nuxt frontend lifecycle using unified launcher
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        frontend_port: int = 38007,
        mode: str = "production",
        skip_build: bool = False,
        force_rebuild: bool = False
    ):
        """
        Initialize frontend controller

        Args:
            project_root: Project root directory
            frontend_port: Frontend server port
            mode: Server mode ('dev' | 'production')
            skip_build: Skip build in production mode (use existing build)
            force_rebuild: Force rebuild even if build exists
        """
        if project_root is None:
            # Auto-detect: pyapps/matrix -> core_node
            self.project_root = Path(__file__).parent.parent.parent.parent
        else:
            self.project_root = Path(project_root)

        # Create frontend configuration
        self.config = FrontendConfig(
            app_name='pymatrix',
            port=frontend_port,
            mode=mode,
            skip_build=skip_build,
            force_rebuild=force_rebuild,
            project_root=self.project_root,
            show_output=True,
            health_check_timeout=120
        )

        # Create Nuxt launcher
        self.launcher = NuxtLauncher(config=self.config)

        ColorPrint.green("[FrontendController] Initialized")
        ColorPrint.blue(f"[FrontendController] Mode: {mode}")
        ColorPrint.blue(f"[FrontendController] Port: {frontend_port}")
        if mode == "production":
            ColorPrint.blue(f"[FrontendController] Skip Build: {skip_build}")
            ColorPrint.blue(f"[FrontendController] Force Rebuild: {force_rebuild}")

    def start_and_wait(self, timeout: int = 120) -> bool:
        """
        Start frontend and wait for ready

        Args:
            timeout: Maximum wait time in seconds

        Returns:
            True if started and ready
        """
        ColorPrint.white("")
        ColorPrint.blue("=" * 79)
        ColorPrint.blue(" PHASE 1: FRONTEND PREPARATION")
        ColorPrint.blue("=" * 79)
        ColorPrint.white("")

        # Update timeout if provided
        self.config.health_check_timeout = timeout

        # Start and wait for ready
        success = self.launcher.start_and_wait()

        if success:
            ColorPrint.white("")
            ColorPrint.green("=" * 79)
            ColorPrint.green(" FRONTEND READY")
            ColorPrint.green("=" * 79)
            if self.config.mode == "production":
                ColorPrint.green(f"  Mode: Production (Static Build)")
                ColorPrint.green(f"  Output Dir: {self.launcher.get_output_dir()}")
                ColorPrint.green(f"  Static Dir: {self.launcher.get_static_dir()}")
                ColorPrint.green(f"  Will be served by backend (unified port)")
            else:
                ColorPrint.green(f"  Mode: Development (Dev Server)")
                ColorPrint.green(f"  URL: {self.launcher.get_url()}")
            ColorPrint.green("=" * 79)
            ColorPrint.white("")
        else:
            ColorPrint.red("[FrontendController] Frontend preparation failed")

        return success

    def get_static_dir(self) -> Optional[Path]:
        """
        Get static files directory (production mode only)

        Returns:
            Path to static directory or None
        """
        return self.launcher.get_static_dir()

    def get_output_dir(self) -> Optional[Path]:
        """
        Get build output directory (production mode only)

        Returns:
            Path to .output directory or None
        """
        return self.launcher.get_output_dir()

    def stop(self):
        """Stop frontend"""
        self.launcher.stop()
        ColorPrint.yellow("[FrontendController] Frontend stopped")

    def is_running(self) -> bool:
        """Check if frontend is running"""
        return self.launcher.is_running()

    def is_ready(self) -> bool:
        """Check if frontend is ready"""
        return self.launcher.is_ready()

    def get_url(self) -> str:
        """Get frontend URL"""
        return self.launcher.get_url()
