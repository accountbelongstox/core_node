# -*- coding: utf-8 -*-
"""
WindowLauncher class - grid-layout launcher for terminal/editor windows.

Extracted from launcher.py (modular split per AGENTS.md 800-line rule). Owns the
OS-agnostic grid math (calculate_window_layout, calculate_ubuntu_count) and the
launch_windows / launch_editors entry points that delegate to the
platform-specific terminal/editor backends (WindowsTerminalLauncher /
LinuxTerminalLauncher, EditorLauncher).
"""

import sys
from pathlib import Path

from pycore.pyutils.launcher.linux_screen_manager import LinuxScreenManager
from pycore.pyutils.launcher.linux_terminal_launcher import LinuxTerminalLauncher

from pycore.pyutils.launcher.char_size_measurer import CharSizeMeasurer



# Add project root to Python path to enable pycore imports. Same bootstrap as
# launcher.py so this module is importable standalone (matches the established
# pattern in pycore/pyutils/desktop/universal_shortcut.py).
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import platform

from pycore.pyutils.launcher.screen_manager import ScreenManager
from pycore.pyutils.launcher.ratio_calculator import RatioCalculator
from pycore.pyutils.launcher.wt_launcher import WindowsTerminalLauncher
from pycore.pyutils.launcher.editor_launcher import EditorLauncher
from pycore.pyutils.launcher.script_generator import ScriptGenerator
from pycore.pyutils.launcher.launch_guard import (
    compute_terminal_deficit,
    count_open_terminals,
    is_app_running,
    resolve_launch_path,
)
from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.app_finder import AppFinder
from pycore.pyutils.common.process_manager import ProcessManager


class WindowLauncher:
    """Main launcher class for managing window grid layout"""

    def __init__(self, grid_columns=None, grid_rows=None,
                 measured_columns=None, measured_rows=None,
                 measured_width_px=None, measured_height_px=None,
                 calibration_actual_height=None, calibration_term_rows=None,
                 window_chrome_title_bar_px=None, window_chrome_horizontal_px=None,
                 window_chrome_content_scale=None,
                 window_chrome_gap_horizontal_px=None, window_chrome_gap_vertical_px=None):
        """
        Initialize window launcher.

        Args:
            grid_columns, grid_rows: Grid size.
            measured_columns, measured_rows, measured_width_px, measured_height_px: Ratio calibration.
            calibration_actual_height, calibration_term_rows: Height calibration.
            window_chrome_title_bar_px: Reserve px for title bar (default 56).
            window_chrome_horizontal_px: Reserve px for horizontal chrome (default 24).
            window_chrome_content_scale: Scale content so window fits in cell, 0-1 (default 0.78). See WT_LAYOUT_REFERENCE.md.
            window_chrome_gap_horizontal_px: Inter-column gap in px so adjacent windows do not touch (default 16).
            window_chrome_gap_vertical_px: Inter-row gap in px so adjacent windows do not touch (default 24).
        """
        # Use provided values or defaults (3x2 grid, standard measurements)
        self.grid_columns = grid_columns or 3
        self.grid_rows = grid_rows or 2

        # Use provided calibration or defaults
        self.calibration_actual_height = calibration_actual_height or 485
        self.calibration_term_rows = calibration_term_rows or 32
        # WT --size is content only; full window has title bar + padding. Reserve + scale so each window fits in cell.
        self.window_chrome_title_bar_px = window_chrome_title_bar_px if window_chrome_title_bar_px is not None else 56
        self.window_chrome_horizontal_px = window_chrome_horizontal_px if window_chrome_horizontal_px is not None else 24
        self.window_chrome_content_scale = window_chrome_content_scale if window_chrome_content_scale is not None else 0.78
        # Inter-cell gaps: subtracted from the screen before grid division, then re-added
        # as a step between cell origins, so adjacent windows sit gap-px apart.
        self.gap_horizontal_px = window_chrome_gap_horizontal_px if window_chrome_gap_horizontal_px is not None else 16
        self.gap_vertical_px = window_chrome_gap_vertical_px if window_chrome_gap_vertical_px is not None else 24

        # If calibration provided, adjust measured values dynamically
        if self.calibration_actual_height and self.calibration_term_rows:
            # Recalculate measured height based on calibration
            adjusted_measured_height = self.calibration_actual_height
            adjusted_measured_rows = self.calibration_term_rows
        else:
            adjusted_measured_height = measured_height_px or 485
            adjusted_measured_rows = measured_rows or 32

        # Initialize ratio calculator
        self.ratio_calc = RatioCalculator(
            measured_columns or 67,
            adjusted_measured_rows,
            measured_width_px or 510,
            adjusted_measured_height
        )

        # Script generator (used by the editor launcher + the Windows backend).
        self.script_generator = ScriptGenerator()

        # Screen detection + the terminal backend are platform-specific; the grid
        # MATH above is OS-agnostic. Windows: Win32 screen + Windows Terminal (wt.exe).
        # Linux: xrandr/wlr-randr screen + a native-emulator grid on X11, or a
        # kitty/tmux multiplexer on Wayland (which forbids clients from positioning
        # their own windows). The Linux backend mirrors the WindowsTerminalLauncher
        # and ScreenManager interfaces, so the rest of this class is unchanged.
        if platform.system() == "Linux":
            self.screen_manager = LinuxScreenManager()
            self.wt_launcher = LinuxTerminalLauncher()
        else:
            self.screen_manager = ScreenManager()
            self.wt_launcher = WindowsTerminalLauncher(self.script_generator)
        self.editor_launcher = EditorLauncher(self.script_generator)

    def _ensure_char_size_measured(self):
        """Resolve char_width/char_height to real measured values (Windows Terminal).

        On Windows, dynamic per-cell measurement is OPT-IN
        (PYCORE_LAUNCHER_RECALIBRATE=1, or a previously cached result): by default
        it is skipped so no calibration windows flash, matching the Linux path.
        When a measurement/cache is available it supersedes the config calibration
        (whose legacy term_rows=270 made char_height ~1.8px/row, ~10x too small, so
        every window overflowed the screen vertically). On Linux, when opted out,
        or if measurement fails, keep the config ratio but sanitize
        physically-impossible values so the old overflow can never recur.

        Runs at most once per instance (guarded by _char_size_resolved); the
        cache makes repeat calls instant.
        """
        if getattr(self, '_char_size_resolved', False):
            return
        self._char_size_resolved = True

        if platform.system() == "Windows":
            try:
                measured = CharSizeMeasurer.measure()
                if measured:
                    char_width, char_height, source = measured
                    self.ratio_calc = RatioCalculator.from_char_size(
                        char_width, char_height, source)
                    # Real char_height is exact -> drop the config calibration override.
                    self.calibration_actual_height = None
                    self.calibration_term_rows = None
                    return
            except Exception as e:
                print(f"Warning: dynamic char-size measurement failed ({e}); "
                      f"using config fallback ratios.")

        # Fallback: sanitize physically-impossible char_height from bogus config
        # (e.g. legacy term_rows=270 -> 1.8px/row). Monospace line height is
        # ~1.7-2.0x the advance width, so derive a sane height from the width.
        if self.ratio_calc.char_height < 4.0:
            sane_height = self.ratio_calc.char_width * 2.0
            print(f"Warning: config char_height {self.ratio_calc.char_height:.3f}px/row is "
                  f"physically impossible; using {sane_height:.3f}px/row (2.0x char_width). "
                  f"Run on Windows for an exact measurement.")
            self.ratio_calc.char_height = sane_height
            self.ratio_calc.row_ratio = f"{sane_height:.4f}px per row (sanitized)"
            self.calibration_actual_height = None
            self.calibration_term_rows = None

    def calculate_window_layout(self, screen_x, screen_y, screen_width, screen_height):
        """
        Calculate window positions and sizes for grid layout.

        WT semantics (Microsoft Learn - command-line arguments):
        - Screen and --pos: PIXELS. Screen is pixel size (e.g. 3840x2160). --pos x,y is window
          top-left position in pixels.
        - --size c,r: CHARACTER CELLS (columns c, rows r), NOT pixels. Content area in pixels
          = c * px_per_column + r * px_per_row (depends on profile font). Full window = content
          + title bar + padding. So we reserve window_chrome pixels and compute c,r from
          (cell_px - chrome) to avoid overlap.

        Returns:
            list: List of tuples (x, y, term_cols, term_rows, actual_width, actual_height)
        """
        # Resolve real char_width/char_height (dynamic measurement on Windows,
        # sanitized config fallback otherwise) before any cell math.
        self._ensure_char_size_measured()

        columns = self.grid_columns
        rows = self.grid_rows
        gap_x = self.gap_horizontal_px
        gap_y = self.gap_vertical_px

        # Step 1: Cell size from screen division, reserving inter-cell gaps so
        # adjacent windows never touch (avoids the "squeezed together" overlap).
        target_window_width = (screen_width - (columns - 1) * gap_x) // columns
        target_window_height = (screen_height - (rows - 1) * gap_y) // rows
        # Step 1b: Reserve chrome then scale content so full window stays inside cell (avoids overlap).
        content_width = max(80, int((target_window_width - self.window_chrome_horizontal_px) * self.window_chrome_content_scale))
        content_height = max(40, int((target_window_height - self.window_chrome_title_bar_px) * self.window_chrome_content_scale))

        # Step 2: Compute columns and rows so (content_px + chrome) fits in cell -> no overlap
        calibration_height = None
        if hasattr(self, 'calibration_actual_height') and self.calibration_actual_height:
            calibration_height = self.calibration_actual_height

        term_columns, term_rows, actual_width, actual_height = \
            self.ratio_calc.calculate_term_size(
                content_width,
                content_height,
                calibration_height_px=calibration_height,
                calibration_term_rows=self.calibration_term_rows if calibration_height else None,
            )

        # Step 2b: Shrink cols/rows if estimated full window (content + chrome) exceeds cell.
        char_height = (calibration_height / self.calibration_term_rows
                       if calibration_height and self.calibration_term_rows
                       else self.ratio_calc.char_height)
        char_width = self.ratio_calc.char_width
        while term_rows > 10:
            if actual_height + self.window_chrome_title_bar_px <= target_window_height:
                break
            term_rows -= 1
            actual_height = term_rows * char_height
        while term_columns > 10:
            if actual_width + self.window_chrome_horizontal_px <= target_window_width:
                break
            term_columns -= 1
            actual_width = term_columns * char_width

        # Step 3: Print calculation and WT/screen correspondence
        ratio_info = self.ratio_calc.get_info()
        print(f"\nCalculation steps:")
        print(f"  WT/screen: --pos = pixels (window top-left); --size = character cells (cols,rows); content px = cols*px_per_col + rows*px_per_row.")
        print(f"  Char-size source: {ratio_info.get('source', 'config measurement')}")
        print(f"  Column pixel ratio: {ratio_info['column_ratio']}")
        print(f"  Row pixel ratio: {ratio_info['row_ratio']}")
        print(f"  Step 1 - Cell size (px): Screen {screen_width}x{screen_height} / Grid {columns}x{rows} (gaps {gap_x}x{gap_y}px) = {target_window_width}x{target_window_height}px")
        print(f"  Step 1b - Content target (chrome {self.window_chrome_horizontal_px}px H, {self.window_chrome_title_bar_px}px V; scale {self.window_chrome_content_scale}): {content_width}x{content_height}px")
        print(f"  Step 2 - Terminal size (character cells):")
        print(f"    Columns: {content_width}px / {self.ratio_calc.char_width:.4f}px-per-column = {term_columns} columns")
        print(f"    Rows: {content_height}px / {self.ratio_calc.char_height:.4f}px-per-row = {term_rows} rows")
        print(f"  Step 3 - Content size (px):")
        print(f"    Width: {term_columns} cols * {self.ratio_calc.char_width:.4f} px/col = {actual_width:.1f}px")
        print(f"    Height: {term_rows} rows * {self.ratio_calc.char_height:.4f} px/row = {actual_height:.1f}px")
        print(f"  Result: --size \"{term_columns},{term_rows}\" (character cells) -> content {actual_width:.1f}x{actual_height:.1f}px; add chrome so window fits in {target_window_width}x{target_window_height}px cell.\n")

        windows = []
        # Step between cell origins = cell size + gap, so windows sit gap-px apart on both axes.
        cell_step_x = target_window_width + gap_x
        cell_step_y = target_window_height + gap_y
        for row in range(rows):
            for col in range(columns):
                x = screen_x + (col * cell_step_x)
                y = screen_y + (row * cell_step_y)
                windows.append((x, y, term_columns, term_rows, actual_width, actual_height))

        return windows

    def calculate_ubuntu_count(self, total_windows):
        """
        Calculate number of Ubuntu terminals to launch

        Args:
            total_windows: Total number of windows

        Returns:
            int: Number of Ubuntu terminals (2 for small grids; 0 for 4x3/12+
                 so the full grid is pure Windows Terminal)
        """
        # "Ubuntu terminals" here means WSL inside Windows Terminal - a Windows-only
        # concept. On Linux every window is a native terminal, so reserve none.
        if platform.system() != "Windows":
            return 0
        # 4x3 (12) grid is pure Windows Terminal (no WSL reservation); smaller
        # grids still reserve 2 Ubuntu terminals as before.
        if total_windows >= 12:
            return 0
        elif total_windows >= 2:
            return 2
        else:
            return 0

    def launch_windows(self, delay=0.2, limit=None):
        """
        Launch windows in grid layout (Windows Terminal and Ubuntu terminals)

        Args:
            delay: Delay between window launches in seconds
            limit: When set, launch only the first ``limit`` cells of the grid
                (row-major). Used to "top up" a partially-filled grid -- open just
                the missing terminals to reach the target count. None = auto-detect
                open terminals and launch only the deficit (idempotent).

        Returns:
            list: List of created batch file paths
        """
        grid_total = self.grid_columns * self.grid_rows

        if limit is None:
            open_terminals = count_open_terminals()
            limit = compute_terminal_deficit(
                self.grid_columns, self.grid_rows, open_terminals)
            if limit <= 0:
                print(
                    f"\nSkipping terminal grid ({open_terminals} already open, "
                    f"target {grid_total}).")
                return []
            if open_terminals > 0:
                print(
                    f"\n{open_terminals} terminals open; launching {limit} more "
                    f"to reach {grid_total}.")
        elif limit <= 0:
            print(f"\nSkipping terminal grid (limit=0, target {grid_total}).")
            return []

        # Get screen dimensions
        screen_x, screen_y, screen_width, screen_height = self.screen_manager.get_screen_dimensions()

        # Calculate window layout (all cells, including Ubuntu positions)
        windows = self.calculate_window_layout(screen_x, screen_y, screen_width, screen_height)

        # Prepare windows config for launcher
        windows_config = [(x, y, term_cols, term_rows) for x, y, term_cols, term_rows, _, _ in windows]

        # Top-up cap: launch only the first `limit` cells (the deficit), so a grid
        # that already has some terminals open is completed rather than duplicated.
        if limit is not None and limit >= 0:
            windows_config = windows_config[:limit]

        # Counts follow the (possibly capped) config, not the full grid.
        total_windows = len(windows_config)
        ubuntu_count = self.calculate_ubuntu_count(total_windows)

        # Launch Windows Terminal and Ubuntu windows
        bat_files = self.wt_launcher.launch_windows(windows_config, delay, ubuntu_count)

        wt_count = total_windows - ubuntu_count
        print(f"\nAll {total_windows} terminal windows launched:")
        print(f"  - {wt_count} Windows Terminal windows")
        if ubuntu_count > 0:
            print(f"  - {ubuntu_count} Ubuntu terminals")

        return bat_files

    def launch_editors(self, app_name, delay=0.2, file_paths=None):
        """
        Launch editor windows (chrome/vscode/antigravity) in grid layout

        Args:
            app_name: Application name ('chrome', 'vscode', 'antigravity')
            delay: Delay between window launches in seconds
            file_paths: Optional list of file paths to open (one per window)

        Returns:
            list: List of created batch file paths
        """
        app_key = app_name.lower()
        process_manager = ProcessManager()
        app_finder = AppFinder()
        app_config = ConfigManager().get_app_config(app_key)
        app_path = resolve_launch_path(app_key, app_config, app_finder)
        if is_app_running(app_key, process_manager, app_finder, exe_path=app_path):
            print(f"\nSkipping {app_key} editor grid (already running).")
            return []

        # Get screen dimensions
        screen_x, screen_y, screen_width, screen_height = self.screen_manager.get_screen_dimensions()

        # Calculate window layout (using pixel dimensions for editors)
        target_window_width = screen_width // self.grid_columns
        target_window_height = screen_height // self.grid_rows

        windows_config = []
        for row in range(self.grid_rows):
            for col in range(self.grid_columns):
                x = screen_x + (col * target_window_width)
                y = screen_y + (row * target_window_height)
                file_path = file_paths[col + row * self.grid_columns] if file_paths and col + row * self.grid_columns < len(file_paths) else None
                if file_path:
                    windows_config.append((x, y, target_window_width, target_window_height, file_path))
                else:
                    windows_config.append((x, y, target_window_width, target_window_height))

        # Launch editor windows
        if app_name.lower() == 'chrome':
            return self.editor_launcher.launch_chrome(windows_config, delay)
        elif app_name.lower() == 'vscode':
            return self.editor_launcher.launch_vscode(windows_config, delay)
        elif app_name.lower() == 'antigravity':
            return self.editor_launcher.launch_antigravity(windows_config, delay)
        else:
            raise ValueError(f"Unknown app name: {app_name}")
