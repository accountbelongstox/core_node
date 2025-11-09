#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mouse Coordinate Display Tool
Shows real-time mouse coordinates in a floating window
Press 'Esc' to exit
"""

import sys
from pathlib import Path
import tkinter as tk
from tkinter import ttk
import pyautogui
import threading
import time

# Add project paths
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from share.game_interface_data import get_d4_interface_data
from providor.common_imports import ColorPrint


class MouseCoordinateDisplay:
    """Real-time mouse coordinate display window"""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("鼠标坐标显示")

        # Window configuration
        self.root.attributes('-topmost', True)  # Always on top
        self.root.attributes('-alpha', 0.9)     # Slightly transparent
        self.root.overrideredirect(True)        # No window decorations

        # Position window at top-right corner
        screen_width = self.root.winfo_screenwidth()
        window_width = 400
        window_height = 250
        x_position = screen_width - window_width - 20
        y_position = 20
        self.root.geometry(f'{window_width}x{window_height}+{x_position}+{y_position}')

        # Configure style
        style = ttk.Style()
        style.configure('Title.TLabel', font=('Arial', 10, 'bold'), background='#2c3e50', foreground='white')
        style.configure('Info.TLabel', font=('Courier', 9), background='#34495e', foreground='#ecf0f1')

        # Main frame
        main_frame = tk.Frame(self.root, bg='#2c3e50', padx=10, pady=5)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title with close button
        title_frame = tk.Frame(main_frame, bg='#2c3e50')
        title_frame.pack(fill=tk.X, pady=(0, 10))

        title_label = tk.Label(
            title_frame,
            text="🖱️ 鼠标坐标监控",
            font=('Arial', 11, 'bold'),
            bg='#2c3e50',
            fg='white'
        )
        title_label.pack(side=tk.LEFT)

        close_button = tk.Button(
            title_frame,
            text="✕",
            font=('Arial', 10, 'bold'),
            bg='#e74c3c',
            fg='white',
            bd=0,
            padx=8,
            pady=2,
            command=self.close_window,
            cursor='hand2'
        )
        close_button.pack(side=tk.RIGHT)

        # Info frame
        info_frame = tk.Frame(main_frame, bg='#34495e', padx=10, pady=10)
        info_frame.pack(fill=tk.BOTH, expand=True)

        # Screen coordinate
        self.screen_coord_label = tk.Label(
            info_frame,
            text="屏幕坐标: (0, 0)",
            font=('Courier', 10, 'bold'),
            bg='#34495e',
            fg='#3498db',
            anchor='w'
        )
        self.screen_coord_label.pack(fill=tk.X, pady=(0, 8))

        # Game coordinate
        self.game_coord_label = tk.Label(
            info_frame,
            text="游戏坐标: (0, 0)",
            font=('Courier', 10),
            bg='#34495e',
            fg='#2ecc71',
            anchor='w'
        )
        self.game_coord_label.pack(fill=tk.X, pady=(0, 8))

        # Standard resolution coordinate
        self.standard_coord_label = tk.Label(
            info_frame,
            text="标准坐标: (0, 0)",
            font=('Courier', 10),
            bg='#34495e',
            fg='#f39c12',
            anchor='w'
        )
        self.standard_coord_label.pack(fill=tk.X, pady=(0, 8))

        # Window info
        self.window_info_label = tk.Label(
            info_frame,
            text="窗口信息: 未检测",
            font=('Courier', 8),
            bg='#34495e',
            fg='#95a5a6',
            anchor='w',
            justify=tk.LEFT
        )
        self.window_info_label.pack(fill=tk.X, pady=(5, 0))

        # Status bar
        status_frame = tk.Frame(main_frame, bg='#2c3e50')
        status_frame.pack(fill=tk.X, pady=(10, 0))

        status_label = tk.Label(
            status_frame,
            text="按 Esc 退出",
            font=('Arial', 8),
            bg='#2c3e50',
            fg='#7f8c8d'
        )
        status_label.pack()

        # State
        self.running = True
        self.d4_data = None

        # Bind keyboard
        self.root.bind('<Escape>', lambda e: self.close_window())

        # Make window draggable
        title_frame.bind('<Button-1>', self.start_move)
        title_frame.bind('<B1-Motion>', self.on_move)
        title_label.bind('<Button-1>', self.start_move)
        title_label.bind('<B1-Motion>', self.on_move)

        self._drag_data = {"x": 0, "y": 0}

    def start_move(self, event):
        """Start dragging window"""
        self._drag_data["x"] = event.x
        self._drag_data["y"] = event.y

    def on_move(self, event):
        """Move window"""
        x = self.root.winfo_x() + event.x - self._drag_data["x"]
        y = self.root.winfo_y() + event.y - self._drag_data["y"]
        self.root.geometry(f"+{x}+{y}")

    def close_window(self):
        """Close window and stop tracking"""
        self.running = False
        self.root.destroy()

    def update_coordinates(self):
        """Update coordinate display"""
        while self.running:
            try:
                # Get mouse position
                screen_x, screen_y = pyautogui.position()

                # Get D4 window info
                self.d4_data = get_d4_interface_data()

                # Calculate game coordinates
                game_coord_text = "游戏坐标: N/A"
                standard_coord_text = "标准坐标: N/A"
                window_info_text = "窗口信息: 未检测到游戏窗口"

                if self.d4_data.window_offset and self.d4_data.game_window_size:
                    window_offset_x, window_offset_y = self.d4_data.window_offset
                    game_window_w, game_window_h = self.d4_data.game_window_size

                    # Calculate game coordinate (relative to game window)
                    game_x = screen_x - window_offset_x
                    game_y = screen_y - window_offset_y

                    # Check if mouse is inside game window
                    if 0 <= game_x < game_window_w and 0 <= game_y < game_window_h:
                        game_coord_text = f"游戏坐标: ({game_x}, {game_y})"

                        # Calculate standard resolution coordinate
                        if self.d4_data.is_windowed_mode():
                            # In windowed mode, scale to standard resolution
                            from share.game_interface_data import (
                                D4_STANDARD_RESOLUTION_WIDTH,
                                D4_STANDARD_RESOLUTION_HEIGHT,
                                WINDOW_BORDER_LEFT,
                                WINDOW_BORDER_RIGHT,
                                TITLE_BAR_HEIGHT,
                                WINDOW_BORDER_BOTTOM
                            )

                            # Remove borders to get client area
                            client_width = game_window_w - WINDOW_BORDER_LEFT - WINDOW_BORDER_RIGHT
                            client_height = game_window_h - TITLE_BAR_HEIGHT - WINDOW_BORDER_BOTTOM

                            # Adjust game coordinate to client area
                            client_x = game_x - WINDOW_BORDER_LEFT
                            client_y = game_y - TITLE_BAR_HEIGHT

                            if 0 <= client_x < client_width and 0 <= client_y < client_height:
                                # Scale to standard resolution
                                standard_x = int(client_x * D4_STANDARD_RESOLUTION_WIDTH / client_width)
                                standard_y = int(client_y * D4_STANDARD_RESOLUTION_HEIGHT / client_height)
                                standard_coord_text = f"标准坐标: ({standard_x}, {standard_y})"
                            else:
                                standard_coord_text = "标准坐标: (边框区域)"
                        else:
                            # Fullscreen mode
                            standard_coord_text = f"标准坐标: ({game_x}, {game_y}) [全屏]"
                    else:
                        game_coord_text = "游戏坐标: (窗口外)"
                        standard_coord_text = "标准坐标: (窗口外)"

                    # Window info
                    window_info_text = (
                        f"窗口信息:\n"
                        f"  偏移: ({window_offset_x}, {window_offset_y})\n"
                        f"  大小: {game_window_w}x{game_window_h}\n"
                        f"  模式: {'窗口' if self.d4_data.is_windowed_mode() else '全屏'}"
                    )

                # Update labels
                self.root.after(0, lambda: self.screen_coord_label.config(
                    text=f"屏幕坐标: ({screen_x}, {screen_y})"
                ))
                self.root.after(0, lambda: self.game_coord_label.config(text=game_coord_text))
                self.root.after(0, lambda: self.standard_coord_label.config(text=standard_coord_text))
                self.root.after(0, lambda: self.window_info_label.config(text=window_info_text))

            except Exception as e:
                ColorPrint.red(f"[MouseCoordinate] Error updating coordinates: {e}")

            # Update interval
            time.sleep(0.05)  # 20 FPS

    def run(self):
        """Run the display window"""
        # Start coordinate update thread
        update_thread = threading.Thread(target=self.update_coordinates, daemon=True)
        update_thread.start()

        # Run GUI main loop
        try:
            self.root.mainloop()
        except KeyboardInterrupt:
            self.close_window()


def main():
    """Main entry point"""
    ColorPrint.blue("\n=== 鼠标坐标监控工具 ===")
    ColorPrint.gray("启动实时坐标显示窗口...")
    ColorPrint.gray("按 Esc 键退出\n")

    try:
        display = MouseCoordinateDisplay()
        display.run()
    except Exception as e:
        ColorPrint.red(f"\n错误: {e}")
        import traceback
        traceback.print_exc()

    ColorPrint.green("\n已退出坐标监控工具")


if __name__ == "__main__":
    main()
