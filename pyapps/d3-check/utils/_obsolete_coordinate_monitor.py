#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WeChat QR Code Login Interface with Hidden Coordinate Monitoring Functionality

HIDDEN FEATURES (for developers):
- F2: Record current mouse position as coordinate
- F3: Start/stop monitoring selected coordinate (auto-selects last if none selected)
- Monitoring area: 90x30px around the coordinate
- Click settings button (⚙️) to access coordinate list interface
- All coordinates and monitoring states are saved to configuration file
"""

import tkinter as tk
from tkinter import messagebox
import threading
import time
import win32api
import win32con
import win32gui
import ctypes
from ctypes import wintypes
from PIL import Image, ImageTk
import json
import os

class CoordinateMonitor:
    def __init__(self):
        self.recorded_coords = []
        self.monitored_coords = []
        self.is_monitoring = False
        self.monitor_thread = None
        self.root = None
        
        # Prevent repeated key presses
        self.last_f2_press = 0
        self.last_f3_press = 0
        
        # Prevent multiple dialogs from opening at the same time
        self.warning_window_active = False
        
        # Windows hook for global monitoring
        self.hook_id = None
        self.user32 = ctypes.windll.user32
        self.kernel32 = ctypes.windll.kernel32
        
        # Define hook callback function
        self.hook_callback = None
        
        # Configuration file path
        self.config_file = "coordinate_monitor_config.json"
        
        # Load configuration on startup
        self._load_config()
        
    def _load_config(self):
        """Load configuration from file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    
                # Load recorded coordinates
                if 'recorded_coords' in config:
                    self.recorded_coords = config['recorded_coords']
                    
                # Load monitored coordinates
                if 'monitored_coords' in config:
                    self.monitored_coords = config['monitored_coords']
                    
                print(f"Configuration loaded: {len(self.recorded_coords)} recorded coordinates, {len(self.monitored_coords)} monitored coordinates")
            else:
                print("No configuration file found, starting with empty coordinates")
        except Exception as e:
            print(f"Error loading configuration: {e}")
            
    def _save_config(self):
        """Save configuration to file"""
        try:
            config = {
                'recorded_coords': self.recorded_coords,
                'monitored_coords': self.monitored_coords
            }
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
                
            print(f"Configuration saved: {len(self.recorded_coords)} recorded coordinates, {len(self.monitored_coords)} monitored coordinates")
        except Exception as e:
            print(f"Error saving configuration: {e}")
        
    def start_monitoring(self):
        """Start monitoring mouse clicks"""
        if self.is_monitoring:
            return
        self.is_monitoring = True
        print("Starting monitoring thread...")
        
        # Set up Windows hook for global mouse monitoring
        self._setup_global_hook()
        
        self.monitor_thread = threading.Thread(target=self._monitor_input, daemon=True)
        self.monitor_thread.start()
        print("Monitoring thread started successfully")
        
    def stop_monitoring(self):
        """Stop monitoring"""
        self.is_monitoring = False
        
        # Clean up Windows hook
        self._cleanup_global_hook()
        
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1)
    
    def _setup_global_hook(self):
        """Set up Windows global mouse hook"""
        try:
            # Define the hook callback function
            HOOKPROC = ctypes.WINFUNCTYPE(ctypes.c_int, ctypes.c_int, wintypes.WPARAM, ctypes.POINTER(ctypes.c_void_p))
            
            def mouse_hook_callback(nCode, wParam, lParam):
                if nCode >= 0:
                    if wParam == 0x0201:  # WM_LBUTTONDOWN
                        # Get mouse position
                        cursor_pos = win32api.GetCursorPos()
                        x, y = cursor_pos
                        
                        # Only process if we have monitored coordinates
                        if self.monitored_coords:
                            print(f"Hook: Click detected at ({x}, {y})")
                            print("Monitoring areas:")
                            for i, (target_x, target_y) in enumerate(self.monitored_coords, 1):
                                in_area = (abs(x - target_x) <= 45 and abs(y - target_y) <= 15)
                                print(f"  Target {i}: ({target_x}, {target_y}) - In 90x30px area: {in_area}")
                            
                            # Check if the click is within monitored area
                            self._check_monitored_coordinates(x, y)
                
                # Call the next hook
                return self.user32.CallNextHookEx(self.hook_id, nCode, wParam, lParam)
            
            # Store the callback to prevent garbage collection
            self.hook_callback = HOOKPROC(mouse_hook_callback)
            
            # Install the hook with proper error handling
            self.hook_id = self.user32.SetWindowsHookExA(
                14,  # WH_MOUSE_LL
                self.hook_callback,
                self.kernel32.GetModuleHandleW(None),
                0
            )
            
            if self.hook_id:
                print("Global mouse hook installed successfully")
            else:
                # Fallback to polling method if hook fails
                print("Failed to install global mouse hook, using polling method")
                self.hook_id = None
                
        except Exception as e:
            print(f"Error setting up global hook: {e}")
            # Fallback to polling method
            self.hook_id = None
    
    def _cleanup_global_hook(self):
        """Clean up Windows global mouse hook"""
        try:
            if self.hook_id:
                self.user32.UnhookWindowsHookEx(self.hook_id)
                self.hook_id = None
                print("Global mouse hook removed")
        except Exception as e:
            print(f"Error cleaning up global hook: {e}")
            
    def _monitor_input(self):
        """Thread function to monitor keyboard and mouse input with global hook"""
        print("Monitoring thread is running...")
        while self.is_monitoring:
            try:
                current_time = time.time()
                
                # Check for F2 key press to record coordinates
                if win32api.GetAsyncKeyState(0x71) & 0x8000:  # VK_F2 = 0x71
                    if current_time - self.last_f2_press > 0.3:  # Prevent repeated triggers
                        self.last_f2_press = current_time
                        cursor_pos = win32api.GetCursorPos()
                        x, y = cursor_pos
                        
                        # Record coordinates
                        self.recorded_coords.append((x, y))
                        print(f"Recorded coordinate: ({x}, {y})")
                        
                        # Save configuration after recording new coordinate
                        self._save_config()
                        
                        # Update GUI
                        if self.root:
                            self.root.after(0, lambda: self.status_label.config(text=f"QR code scanned successfully"))
                            # Update coordinate list if it exists
                            if hasattr(self, 'coord_listbox') and self.coord_listbox:
                                self.coord_listbox.insert(tk.END, f"({x}, {y})")
                
                # Check for F3 key press to toggle monitoring state
                if win32api.GetAsyncKeyState(0x72) & 0x8000:  # VK_F3 = 0x72
                    if current_time - self.last_f3_press > 0.3:  # Prevent repeated triggers
                        self.last_f3_press = current_time
                        self._toggle_monitoring()
                
                # Monitor mouse clicks using polling method if hook is not available
                if not self.hook_id:
                    self._poll_mouse_clicks()
                else:
                    # Process Windows messages to keep hook active
                    self.user32.GetMessageA(ctypes.byref(ctypes.c_void_p()), 0, 0, 0)
                    
                time.sleep(0.001)  # 1ms interval for very fast response
                
            except Exception as e:
                print(f"Monitoring thread error: {e}")
                time.sleep(0.1)
    
    def _poll_mouse_clicks(self):
        """Poll for mouse clicks as fallback method"""
        try:
            # Check for left mouse button click
            current_state = win32api.GetAsyncKeyState(win32con.VK_LBUTTON)
            
            # Check if button is pressed (high bit set) and wasn't pressed before
            if current_state & 0x8000:
                if not hasattr(self, '_left_button_pressed') or not self._left_button_pressed:
                    self._left_button_pressed = True
                    cursor_pos = win32api.GetCursorPos()
                    x, y = cursor_pos
                    
                    # Only print and process if we have monitored coordinates
                    if self.monitored_coords:
                        print(f"Polling: Click detected at ({x}, {y})")
                        print("Monitoring areas:")
                        for i, (target_x, target_y) in enumerate(self.monitored_coords, 1):
                            in_area = (abs(x - target_x) <= 45 and abs(y - target_y) <= 15)
                            print(f"  Target {i}: ({target_x}, {target_y}) - In 90x30px area: {in_area}")
                        
                        self._check_monitored_coordinates(x, y)
            else:
                self._left_button_pressed = False
                
        except Exception as e:
            print(f"Polling error: {e}")
                
    def _toggle_monitoring(self):
        """Toggle monitoring state"""
        try:
            # Get the selected coordinate item, or auto-select the last one if none selected
            selection = self.coord_listbox.curselection()
            if not selection:
                if self.recorded_coords:
                    # Auto-select the last coordinate
                    selected_index = len(self.recorded_coords) - 1
                    self.coord_listbox.selection_clear(0, tk.END)
                    self.coord_listbox.selection_set(selected_index)
                    self.coord_listbox.see(selected_index)
                else:
                    if self.root:
                        self.root.after(0, lambda: messagebox.showwarning("Warning", "No coordinates recorded yet. Press F2 to record a coordinate first"))
                    return
            else:
                selected_index = selection[0]
            
            if selected_index < len(self.recorded_coords):
                coord = self.recorded_coords[selected_index]
                
                if coord in self.monitored_coords:
                    # Stop monitoring
                    self.monitored_coords.remove(coord)
                    if self.root:
                        self.root.after(0, lambda: self.status_label.config(text=f"Login session ended"))
                    print(f"Stopped monitoring coordinate: {coord}")
                    print("Click logging disabled")
                    
                    # Save configuration after stopping monitoring
                    self._save_config()
                else:
                    # Start monitoring
                    self.monitored_coords.append(coord)
                    if self.root:
                        self.root.after(0, lambda: self.status_label.config(text=f"Login session active"))
                    print(f"Started monitoring coordinate: {coord}")
                    print(f"Monitoring area: 90x30px around ({coord[0]}, {coord[1]})")
                    print("All clicks will now be logged with area information")
                    
                    # Save configuration after starting monitoring
                    self._save_config()
            else:
                if self.root:
                    self.root.after(0, lambda: messagebox.showerror("Error", "Invalid coordinate selected"))
                    
        except Exception as e:
            if self.root:
                self.root.after(0, lambda: messagebox.showerror("Error", f"Failed to toggle monitoring: {e}"))
                
    def _check_monitored_coordinates(self, x: int, y: int):
        """Check if the click is within a 90x30px area around monitored coordinates"""
        # If a warning window is already active, do not show a new one
        if self.warning_window_active:
            return
            
        for target_x, target_y in self.monitored_coords:
            # Check if click is within 90x30px area around the target coordinate
            if (abs(x - target_x) <= 45 and abs(y - target_y) <= 15):  # 90x30px area (45px left/right, 15px up/down)
                print(f"Click detected within monitored area! Position: ({x}, {y}) - Target: ({target_x}, {target_y})")
                # Get priority and show warning
                self._handle_priority_click(x, y, target_x, target_y)
                break
    
    def _handle_priority_click(self, click_x: int, click_y: int, target_x: int, target_y: int):
        """Handle click with priority - show warning and optionally block the click"""
        try:
            # Get the window under the cursor
            window_under_cursor = win32gui.WindowFromPoint((click_x, click_y))
            if window_under_cursor:
                window_text = win32gui.GetWindowText(window_under_cursor)
                print(f"Priority click detected at ({click_x}, {click_y}) in window: {window_text}")
                
                # Show warning message
                self._show_warning_message(click_x, click_y)
                
                # Optionally bring our window to front to ensure visibility
                if self.root:
                    self.root.after(0, self.root.lift)
                    self.root.after(0, self.root.focus_force)
                    
        except Exception as e:
            print(f"Error handling priority click: {e}")
            # Fallback to normal warning
            self._show_warning_message(click_x, click_y)
                    
    def _show_warning_message(self, click_x: int, click_y: int):
        """Show the warning message box"""
        try:
            print(f"Creating warning window at position: ({click_x}, {click_y})")
            # Set warning window as active
            self.warning_window_active = True
            
            # Create a temporary window to show the warning
            warning_window = tk.Toplevel()
            warning_window.title("Warning")
            
            # Set warning window icon
            try:
                icon_path = "ui/wechat_icon.ico"
                if os.path.exists(icon_path):
                    warning_window.iconbitmap(icon_path)
                else:
                    print(f"Icon file not found for warning window: {icon_path}")
            except Exception as e:
                print(f"Error setting warning window icon: {e}")
            
            # Fixed dimensions (scaled from 568x167 at 1826x1301 to 1300x800 base)
            img_width, img_height = 405, 103  # was 568, 167
            
            # Set window size to fixed dimensions
            warning_window.geometry(f"{img_width}x{img_height}")
            warning_window.resizable(False, False)
            
            # Remove title bar and borders for a cleaner look
            warning_window.overrideredirect(True)
            
            # Make window stay on top
            warning_window.attributes('-topmost', True)
            
            # Position the window near the click position (centered)
            # Ensure window stays within screen bounds
            import win32api
            screen_width = win32api.GetSystemMetrics(0)  # SM_CXSCREEN
            screen_height = win32api.GetSystemMetrics(1)  # SM_CYSCREEN
            
            # Calculate window position, ensuring it stays within screen bounds
            window_x = max(0, min(click_x - img_width // 2, screen_width - img_width))
            window_y = max(0, min(click_y - img_height // 2, screen_height - img_height))
            
            print(f"Screen size: {screen_width}x{screen_height}")
            print(f"Window size: {img_width}x{img_height}")
            print(f"Calculated window position: ({window_x}, {window_y})")
            
            warning_window.geometry(f"+{window_x}+{window_y}")
            
            # Use a Canvas to place text over an image
            canvas = tk.Canvas(warning_window, width=img_width, height=img_height, borderwidth=0, highlightthickness=0)
            canvas.pack(fill="both", expand=True)

            # Load and set the background image
            bg_photo_ref = None
            try:
                bg_image_path = r"D:\programing\d3check\ui\message_bg.png"
                # Keep a reference to the image to prevent it from being garbage collected
                self.bg_image = Image.open(bg_image_path)
                # Resize image to match our fixed dimensions
                self.bg_image = self.bg_image.resize((img_width, img_height), Image.Resampling.LANCZOS)
                self.bg_photo = ImageTk.PhotoImage(self.bg_image)
                bg_photo_ref = self.bg_photo
                # Set the background image
                canvas.create_image(0, 0, image=bg_photo_ref, anchor="nw")
            except Exception as e:
                print(f"Failed to load background image: {e}")
                # Fallback to a dark background if image fails to load
                canvas.configure(bg='#1a1a1a')

            # Callback function for window close
            def on_window_close():
                self.warning_window_active = False
                warning_window.destroy()
            
            # Create the warning title on the canvas with yellow color
            canvas.create_text(
                img_width / 2, 40, # x, y
                text="⚠️ Key格式不正确",
                font=("Microsoft YaHei", 14, "bold"),
                fill='#FFFF00'  # Yellow color
            )
            
            # Create the warning content on the canvas with yellow color
            canvas.create_text(
                img_width / 2, 95, # x, y
                text="此key格式无效、并非合法的TurboHUD 密钥，\n但并非过期或使用过，请联系销售渠道更换",
                font=("Microsoft YaHei", 12),
                fill='#FFFF00',  # Yellow color
                justify='center',
                width=img_width - 50 # wraplength, with some padding
            )

            # Add a close button in the top-right corner
            close_button = tk.Button(
                warning_window,
                text="×",
                font=("Arial", 16, "bold"),
                fg='#FFFF00',
                bg='#1a1a1a',
                bd=0,
                highlightthickness=0,
                command=on_window_close
            )
            close_button.place(x=img_width-30, y=5, width=25, height=25)
            
            # Auto-close after 3 seconds
            warning_window.after(3000, on_window_close)
            
            # Bind the window close event
            warning_window.protocol("WM_DELETE_WINDOW", on_window_close)
            
        except Exception as e:
            print(f"Failed to show warning message: {e}")
            self.warning_window_active = False
            
    def _update_coord_list(self):
        """Update the coordinate list display"""
        if self.coord_listbox:
            self.coord_listbox.delete(0, tk.END)
            for i, (x, y) in enumerate(self.recorded_coords, 1):
                status = " [Monitoring]" if (x, y) in self.monitored_coords else ""
                self.coord_listbox.insert(tk.END, f"Coordinate {i}: ({x}, {y}){status}")
                
    def _remove_coordinate(self):
        """Remove the selected coordinate"""
        try:
            selection = self.coord_listbox.curselection()
            if not selection:
                messagebox.showwarning("Warning", "Please select a coordinate first")
                return
                
            selected_index = selection[0]
            if selected_index < len(self.recorded_coords):
                removed_coord = self.recorded_coords.pop(selected_index)
                # If it was being monitored, remove it from there as well
                if removed_coord in self.monitored_coords:
                    self.monitored_coords.remove(removed_coord)
                self.coord_listbox.delete(selected_index)
                self.status_label.config(text=f"Removed coordinate {removed_coord}")
                print(f"Removed coordinate: {removed_coord}")
                
                # Save configuration after removing coordinate
                self._save_config()
            else:
                messagebox.showerror("Error", "Invalid coordinate selected")
                
        except Exception as e:
            messagebox.showerror("Error", f"Failed to remove coordinate: {e}")
            
    def create_gui(self):
        """Create WeChat QR Code Login Interface"""
        self.root = tk.Tk()
        self.root.title("WeChat")
        self.root.geometry("400x600")
        self.root.resizable(False, False)
        
        # Set window icon
        try:
            icon_path = "ui/wechat_icon.ico"
            if os.path.exists(icon_path):
                self.root.iconbitmap(icon_path)
                print(f"Window icon set: {icon_path}")
            else:
                print(f"Icon file not found: {icon_path}")
        except Exception as e:
            print(f"Error setting window icon: {e}")
        
        # Set WeChat green theme
        self.root.configure(bg='#07C160')
        
        # Create main frame
        main_frame = tk.Frame(self.root, bg='#07C160')
        main_frame.pack(fill='both', expand=True, padx=20, pady=20)
        
        # WeChat logo and title
        title_label = tk.Label(
            main_frame,
            text="WeChat",
            font=("Arial", 24, "bold"),
            fg='#ffffff',
            bg='#07C160'
        )
        title_label.pack(pady=(20, 10))
        
        subtitle_label = tk.Label(
            main_frame,
            text="Scan QR Code to Login",
            font=("Arial", 12),
            fg='#ffffff',
            bg='#07C160'
        )
        subtitle_label.pack(pady=(0, 20))
        
        # QR Code frame
        qr_frame = tk.Frame(main_frame, bg='#ffffff', width=200, height=200)
        qr_frame.pack(pady=20)
        qr_frame.pack_propagate(False)
        
        # Virtual QR Code (simulated)
        qr_label = tk.Label(
            qr_frame,
            text="📱\n\nQR Code\n\nScan to Login",
            font=("Arial", 16),
            fg='#333333',
            bg='#ffffff',
            justify='center'
        )
        qr_label.pack(expand=True)
        
        # Settings button (hidden access to coordinate monitor)
        settings_button = tk.Button(
            main_frame,
            text="⚙️ Settings",
            font=("Arial", 12),
            fg='#ffffff',
            bg='#07C160',
            bd=0,
            relief='flat',
            command=self._show_coordinate_monitor
        )
        settings_button.pack(pady=20)
        
        # Status label
        self.status_label = tk.Label(
            main_frame,
            text="Ready to scan QR code",
            font=("Arial", 10),
            fg='#ffffff',
            bg='#07C160'
        )
        self.status_label.pack(pady=5)
        
        # Auto-select the last coordinate if available
        if self.recorded_coords:
            last_index = len(self.recorded_coords) - 1
            print(f"Auto-selected last coordinate: {self.recorded_coords[last_index]}")
    
    def _show_coordinate_monitor(self):
        """Show the coordinate monitoring interface"""
        # Create a new window for coordinate monitoring
        monitor_window = tk.Toplevel(self.root)
        monitor_window.title("Coordinate Monitor")
        monitor_window.geometry("500x400")
        monitor_window.resizable(False, False)
        
        # Set window icon
        try:
            icon_path = "ui/wechat_icon.ico"
            if os.path.exists(icon_path):
                monitor_window.iconbitmap(icon_path)
        except Exception as e:
            print(f"Error setting monitor window icon: {e}")
        
        # Set dark theme
        monitor_window.configure(bg='#1a1a1a')
        
        # Title
        title_label = tk.Label(
            monitor_window,
            text="Coordinate Monitor",
            font=("Arial", 16, "bold"),
            fg='#ffffff',
            bg='#1a1a1a'
        )
        title_label.pack(pady=10)
        
        # Hidden instructions (for developers)
        instructions = """
        # HIDDEN FUNCTIONALITY (Press these keys for coordinate monitoring):
        # F2: Record current mouse position as coordinate
        # F3: Start/stop monitoring selected coordinate (auto-selects last if none selected)
        # Monitoring area: 90x30px around the coordinate
        # Click settings button to access coordinate list interface
        """
        
        instruction_label = tk.Label(
            monitor_window,
            text=instructions,
            font=("Arial", 10),
            fg='#cccccc',
            bg='#1a1a1a',
            justify='left'
        )
        instruction_label.pack(pady=5)
        
        # Coordinate list
        list_frame = tk.Frame(monitor_window, bg='#1a1a1a')
        list_frame.pack(fill='both', expand=True, padx=10, pady=5)
        
        tk.Label(
            list_frame,
            text="Recorded Coordinates:",
            font=("Arial", 12, "bold"),
            fg='#ffffff',
            bg='#1a1a1a'
        ).pack(anchor='w')
        
        # Create listbox with scrollbar
        listbox_frame = tk.Frame(list_frame, bg='#1a1a1a')
        listbox_frame.pack(fill='both', expand=True, pady=5)
        
        coord_listbox = tk.Listbox(
            listbox_frame,
            bg='#2a2a2a',
            fg='#ffffff',
            selectbackground='#4a4a4a',
            font=("Arial", 10),
            height=8
        )
        coord_listbox.pack(side='left', fill='both', expand=True)
        
        scrollbar = tk.Scrollbar(listbox_frame, orient='vertical', command=coord_listbox.yview)
        scrollbar.pack(side='right', fill='y')
        coord_listbox.config(yscrollcommand=scrollbar.set)
        
        # Update coordinate list
        for coord in self.recorded_coords:
            coord_listbox.insert(tk.END, f"({coord[0]}, {coord[1]})")
        
        # Auto-select the last coordinate if available
        if self.recorded_coords:
            last_index = len(self.recorded_coords) - 1
            coord_listbox.selection_set(last_index)
            coord_listbox.see(last_index)
        
        # Buttons
        button_frame = tk.Frame(monitor_window, bg='#1a1a1a')
        button_frame.pack(fill='x', padx=10, pady=5)
        
        remove_button = tk.Button(
            button_frame,
            text="Remove Selected",
            command=lambda: self._remove_coordinate_from_listbox(coord_listbox),
            bg='#d32f2f',
            fg='#ffffff',
            font=("Arial", 10, "bold"),
            relief='flat',
            padx=10
        )
        remove_button.pack(side='left', padx=5)
        
        # Status label
        status_label = tk.Label(
            monitor_window,
            text="Ready to monitor coordinates",
            font=("Arial", 10),
            fg='#cccccc',
            bg='#1a1a1a'
        )
        status_label.pack(pady=5)
        
        # Store reference to listbox for updates
        self.coord_listbox = coord_listbox
        
    def _remove_coordinate_from_listbox(self, listbox):
        """Remove coordinate from the listbox"""
        try:
            selection = listbox.curselection()
            if not selection:
                messagebox.showwarning("Warning", "Please select a coordinate first")
                return
                
            selected_index = selection[0]
            if selected_index < len(self.recorded_coords):
                removed_coord = self.recorded_coords.pop(selected_index)
                # If it was being monitored, remove it from there as well
                if removed_coord in self.monitored_coords:
                    self.monitored_coords.remove(removed_coord)
                listbox.delete(selected_index)
                print(f"Removed coordinate: {removed_coord}")
                
                # Save configuration after removing coordinate
                self._save_config()
            else:
                messagebox.showerror("Error", "Invalid coordinate selected")
                
        except Exception as e:
            messagebox.showerror("Error", f"Failed to remove coordinate: {e}")
        
    def run(self):
        """Run the coordinate monitor"""
        print("=" * 50)
        print("Coordinate Monitor starting...")
        print("=" * 50)
        print("Instructions:")
        print("1. Press F2 to record the current mouse position")
        print("2. Select a coordinate in the list to monitor (or F3 will auto-select the last one)")
        print("3. Press F3 to start/stop monitoring")
        print("4. A warning will be shown if you click within 90x30px area of the monitored coordinate")
        print("5. Close the window to exit the program")
        print("=" * 50)
        
        # Create GUI
        self.create_gui()
        
        # Start monitoring
        self.start_monitoring()
        
        # Run the GUI
        self.root.mainloop()
        
        # Clean up
        self.stop_monitoring()
        print("Coordinate Monitor closed")

def main():
    """Main function"""
    monitor = CoordinateMonitor()
    monitor.run()

if __name__ == "__main__":
    main() 