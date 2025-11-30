"""
Installation Monitor GUI
Graphical interface for managing software installation monitoring
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
from pathlib import Path
import threading
from datetime import datetime

from utils import list_monitoring_sessions, save_monitor_options, load_monitor_options
from config import MONITOR_RESULTS_BASE, DEFAULT_SOFTWARE_NAME, CACHE_DIR, ensure_cache_directories
from monitor_orchestrator import InstallationMonitor
from software_packager import package_software


class MonitorGUI:
    """GUI for Installation Monitor"""

    def __init__(self, root):
        """
        Initialize GUI

        Args:
            root: Tkinter root window
        """
        self.root = root
        self.root.title("Software Installation Monitor")
        self.root.geometry("1100x700")

        self.monitoring = False
        self.monitor = None
        self.selected_session = None
        self.baseline_ready = False

        # Ensure cache directories exist
        ensure_cache_directories()
        
        # Monitoring options (checkboxes) - using detailed directory config
        from config import DIRECTORY_CONFIG
        self.directory_config = DIRECTORY_CONFIG  # Store reference for later use
        self.monitor_options = {}
        
        # Load cached options
        cached_options = load_monitor_options(CACHE_DIR)
        
        # Initialize all directory options from config
        for key, config_data in DIRECTORY_CONFIG.items():
            # Use cached value if available, otherwise use default
            if key in cached_options:
                default_value = cached_options[key]
            else:
                # Set default values based on directory type
                default_value = True
                if 'user_home' in key or 'public' in key or 'desktop' in key:
                    default_value = False  # These can be noisy
            
            self.monitor_options[key] = tk.BooleanVar(value=default_value)
        
        # Add registry option
        if 'registry' in cached_options:
            self.monitor_options['registry'] = tk.BooleanVar(value=cached_options['registry'])
        else:
            self.monitor_options['registry'] = tk.BooleanVar(value=True)

        self.setup_ui()
        self.refresh_sessions()

    def setup_ui(self):
        """Setup user interface"""
        # Main container
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=0)  # Options column (fixed width)
        main_frame.rowconfigure(5, weight=1)  # Row 5 is the sessions list

        # Title
        title_label = ttk.Label(main_frame, text="Software Installation Monitor",
                                font=('Arial', 16, 'bold'))
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 10))

        # Control buttons frame
        control_frame = ttk.Frame(main_frame)
        control_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        self.monitor_button = ttk.Button(control_frame, text="Start Monitoring",
                                         command=self.toggle_monitoring)
        self.monitor_button.grid(row=0, column=0, padx=(0, 10))

        self.copy_button = ttk.Button(control_frame, text="Copy Software",
                                      command=self.copy_software,
                                      state=tk.DISABLED)
        self.copy_button.grid(row=0, column=1, padx=(0, 10))

        self.refresh_button = ttk.Button(control_frame, text="Refresh List",
                                         command=self.refresh_sessions)
        self.refresh_button.grid(row=0, column=2, padx=(0, 10))

        self.open_button = ttk.Button(control_frame, text="Open Folder",
                                      command=self.open_session_folder,
                                      state=tk.DISABLED)
        self.open_button.grid(row=0, column=3, padx=(0, 10))

        self.detail_button = ttk.Button(control_frame, text="View Details",
                                        command=self.view_details,
                                        state=tk.DISABLED)
        self.detail_button.grid(row=0, column=4, padx=(0, 10))

        self.delete_button = ttk.Button(control_frame, text="Delete Session",
                                        command=self.delete_session,
                                        state=tk.DISABLED)
        self.delete_button.grid(row=0, column=5)

        # Status indicator frame
        status_indicator_frame = ttk.LabelFrame(main_frame, text="Monitoring Status", padding="10")
        status_indicator_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        # Status canvas for indicator light
        self.status_canvas = tk.Canvas(status_indicator_frame, width=30, height=30, highlightthickness=0)
        self.status_canvas.grid(row=0, column=0, padx=(0, 10))

        # Draw initial status (gray = not monitoring)
        self.status_indicator = self.status_canvas.create_oval(5, 5, 25, 25, fill='gray', outline='darkgray')

        # Status message label
        self.status_msg_var = tk.StringVar()
        self.status_msg_var.set("Ready to start monitoring")
        self.status_msg_label = ttk.Label(status_indicator_frame, textvariable=self.status_msg_var,
                                          font=('Arial', 10))
        self.status_msg_label.grid(row=0, column=1, sticky=tk.W)

        # Monitoring Options frame with scrollable content
        options_frame = ttk.LabelFrame(main_frame, text="Monitoring Options", padding="10")
        options_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # Create a canvas and scrollbar for the options
        canvas = tk.Canvas(options_frame, height=200)
        scrollbar = ttk.Scrollbar(options_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # Grid the canvas and scrollbar
        canvas.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        options_frame.columnconfigure(0, weight=1)
        options_frame.rowconfigure(0, weight=1)

        # Create checkboxes in a grid layout
        row = 0
        col = 0
        max_cols = 2  # Reduced to 2 columns for better readability

        # Core system directories
        ttk.Label(scrollable_frame, text="Core System Directories:", font=('Arial', 9, 'bold')).grid(row=row, column=col, columnspan=max_cols, sticky=tk.W, padx=5, pady=(0, 5))
        row += 1

        core_dirs = ['program_files', 'program_files_x86', 'programdata', 'c_root', 'windows_dir']
        for idx, key in enumerate(core_dirs):
            if key in self.monitor_options:
                config_data = self.directory_config[key]
                cb = ttk.Checkbutton(scrollable_frame, text=config_data['description'], 
                                   variable=self.monitor_options[key],
                                   command=self.save_options_to_cache)
                cb.grid(row=row + idx // max_cols, column=col + (idx % max_cols), sticky=tk.W, padx=5, pady=2)

        # User directories
        row += (len(core_dirs) + max_cols - 1) // max_cols + 1
        ttk.Label(scrollable_frame, text="User Directories:", font=('Arial', 9, 'bold')).grid(row=row, column=col, columnspan=max_cols, sticky=tk.W, padx=5, pady=(5, 5))
        row += 1

        user_dirs = ['user_all_users', 'user_public', 'user_home', 'user_appdata_local', 'user_appdata_locallow', 'user_appdata_roaming']
        for idx, key in enumerate(user_dirs):
            if key in self.monitor_options:
                config_data = self.directory_config[key]
                cb = ttk.Checkbutton(scrollable_frame, text=config_data['description'], 
                                   variable=self.monitor_options[key],
                                   command=self.save_options_to_cache)
                cb.grid(row=row + idx // max_cols, column=col + (idx % max_cols), sticky=tk.W, padx=5, pady=2)

        # Start Menu and Desktop
        row += (len(user_dirs) + max_cols - 1) // max_cols + 1
        ttk.Label(scrollable_frame, text="Start Menu & Desktop:", font=('Arial', 9, 'bold')).grid(row=row, column=col, columnspan=max_cols, sticky=tk.W, padx=5, pady=(5, 5))
        row += 1

        menu_dirs = ['user_start_menu', 'public_start_menu', 'user_desktop', 'public_desktop']
        for idx, key in enumerate(menu_dirs):
            if key in self.monitor_options:
                config_data = self.directory_config[key]
                cb = ttk.Checkbutton(scrollable_frame, text=config_data['description'], 
                                   variable=self.monitor_options[key],
                                   command=self.save_options_to_cache)
                cb.grid(row=row + idx // max_cols, column=col + (idx % max_cols), sticky=tk.W, padx=5, pady=2)

        # Development directory
        row += (len(menu_dirs) + max_cols - 1) // max_cols + 1
        ttk.Label(scrollable_frame, text="Development:", font=('Arial', 9, 'bold')).grid(row=row, column=col, columnspan=max_cols, sticky=tk.W, padx=5, pady=(5, 5))
        row += 1

        if 'dev_directory' in self.monitor_options:
            config_data = self.directory_config['dev_directory']
            cb = ttk.Checkbutton(scrollable_frame, text=config_data['description'], 
                               variable=self.monitor_options['dev_directory'],
                               command=self.save_options_to_cache)
            cb.grid(row=row, column=col, columnspan=max_cols, sticky=tk.W, padx=5, pady=2)

        # Registry option
        row += 2
        ttk.Label(scrollable_frame, text="Registry:", font=('Arial', 9, 'bold')).grid(row=row, column=col, columnspan=max_cols, sticky=tk.W, padx=5, pady=(5, 0))
        row += 1
        ttk.Checkbutton(scrollable_frame, text="Windows Registry (HKLM, HKCU, etc.)",
                       variable=self.monitor_options['registry'],
                       command=self.save_options_to_cache).grid(row=row, column=col, columnspan=max_cols, sticky=tk.W, padx=5, pady=2)

        # Sessions list frame
        list_frame = ttk.LabelFrame(main_frame, text="Monitoring Sessions", padding="5")
        list_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)

        # Create treeview
        columns = ('Software', 'Date', 'Files', 'Registry', 'Status')
        self.tree = ttk.Treeview(list_frame, columns=columns, show='tree headings')

        # Define headings
        self.tree.heading('#0', text='ID')
        self.tree.heading('Software', text='Software Name')
        self.tree.heading('Date', text='Date')
        self.tree.heading('Files', text='Files Changed')
        self.tree.heading('Registry', text='Registry Keys')
        self.tree.heading('Status', text='Status')

        # Define column widths
        self.tree.column('#0', width=50)
        self.tree.column('Software', width=200)
        self.tree.column('Date', width=150)
        self.tree.column('Files', width=100)
        self.tree.column('Registry', width=100)
        self.tree.column('Status', width=100)

        # Scrollbars
        vsb = ttk.Scrollbar(list_frame, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(list_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        # Grid layout
        self.tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        vsb.grid(row=0, column=1, sticky=(tk.N, tk.S))
        hsb.grid(row=1, column=0, sticky=(tk.W, tk.E))

        # Bind selection event
        self.tree.bind('<<TreeviewSelect>>', self.on_session_select)

        # Status bar
        self.status_var = tk.StringVar()
        self.status_var.set("Ready")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var,
                               relief=tk.SUNKEN, anchor=tk.W)
        status_bar.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E))

    def update_status_indicator(self, status: str, message: str):
        """
        Update the status indicator light and message

        Args:
            status: One of 'idle', 'scanning', 'ready', 'monitoring'
            message: Status message to display
        """
        colors = {
            'idle': ('gray', 'darkgray'),
            'scanning': ('orange', 'darkorange'),
            'ready': ('green', 'darkgreen'),
            'monitoring': ('green', 'darkgreen'),
            'error': ('red', 'darkred')
        }

        fill_color, outline_color = colors.get(status, ('gray', 'darkgray'))

        self.status_canvas.itemconfig(self.status_indicator, fill=fill_color, outline=outline_color)
        self.status_msg_var.set(message)

    def refresh_sessions(self):
        """Refresh the list of monitoring sessions"""
        self.status_var.set("Refreshing sessions...")

        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)

        # Load sessions
        sessions = list_monitoring_sessions(MONITOR_RESULTS_BASE)

        # Populate tree
        for idx, session in enumerate(sessions, 1):
            software_name = session.get('software_name', DEFAULT_SOFTWARE_NAME)
            timestamp = session.get('timestamp', 0)

            if timestamp:
                date_str = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
            else:
                date_str = 'Unknown'

            files_changed = session.get('filesystem_changes', 'N/A')
            reg_changes = session.get('registry_changes', 'N/A')

            # Determine status
            if session.get('end_time'):
                status = 'Complete'
            else:
                status = 'Incomplete'

            self.tree.insert('', tk.END, text=str(idx),
                            values=(software_name, date_str, files_changed, reg_changes, status),
                            tags=(session.get('path'),))

        self.status_var.set(f"Loaded {len(sessions)} sessions")

    def save_options_to_cache(self):
        """Save current monitoring options to cache"""
        try:
            save_monitor_options(self.monitor_options, CACHE_DIR)
            print("Options saved to cache")
        except Exception as e:
            print(f"Error saving options to cache: {e}")

    def on_session_select(self, event):
        """Handle session selection"""
        selection = self.tree.selection()

        if selection:
            item = selection[0]
            tags = self.tree.item(item, 'tags')
            if tags:
                self.selected_session = tags[0]
                self.copy_button.config(state=tk.NORMAL)
                self.open_button.config(state=tk.NORMAL)
                self.detail_button.config(state=tk.NORMAL)
                self.delete_button.config(state=tk.NORMAL)
        else:
            self.selected_session = None
            self.copy_button.config(state=tk.DISABLED)
            self.open_button.config(state=tk.DISABLED)
            self.detail_button.config(state=tk.DISABLED)
            self.delete_button.config(state=tk.DISABLED)

    def toggle_monitoring(self):
        """Toggle monitoring on/off"""
        if not self.monitoring:
            self.start_monitoring()
        else:
            self.stop_monitoring()

    def start_monitoring(self):
        """Start monitoring process"""
        # Check if at least one option is selected
        if not any(var.get() for var in self.monitor_options.values()):
            messagebox.showwarning("No Options Selected",
                                 "Please select at least one monitoring option.")
            return

        # Ask for software name
        software_name = simpledialog.askstring("Software Name",
                                               "Enter software name (optional):",
                                               parent=self.root)

        if software_name == None:  # User cancelled
            return

        if not software_name.strip():
            software_name = None

        # Print selected monitoring options
        print("\n" + "=" * 80)
        print("STARTING MONITORING SESSION")
        print("=" * 80)
        print(f"Software Name: {software_name or 'SoftwarePackage'}")
        print("\nMonitoring Options:")
        print("-" * 80)

        # Print enabled directory options
        for key, var in self.monitor_options.items():
            if key == 'registry':
                if var.get():
                    print("  [✓] Windows Registry")
            else:
                if var.get() and key in self.directory_config:
                    config_data = self.directory_config[key]
                    print(f"  [✓] {config_data['description']}")

        print("=" * 80 + "\n")

        # Save current options to cache
        save_monitor_options(self.monitor_options, CACHE_DIR)

        # Start monitoring in thread
        self.monitoring = True
        self.baseline_ready = False
        self.monitor_button.config(text="Stop Monitoring")
        self.status_var.set("Preparing to monitor...")
        self.update_status_indicator('scanning', 'Scanning baseline - Please wait...')

        # Disable other buttons
        self.copy_button.config(state=tk.DISABLED)
        self.refresh_button.config(state=tk.DISABLED)
        self.open_button.config(state=tk.DISABLED)
        self.delete_button.config(state=tk.DISABLED)

        # Create monitor with selected options
        self.monitor = InstallationMonitor(software_name)
        self.monitor.monitor_options = self.monitor_options  # Pass options to monitor

        # Run in thread
        thread = threading.Thread(target=self._run_monitoring, daemon=True)
        thread.start()

    def _run_monitoring(self):
        """Run monitoring in background thread"""
        try:
            self.monitor.setup_monitors()
            self.monitor.start_monitoring()

            # Baseline scan complete - update status
            self.baseline_ready = True
            self.root.after(0, lambda: self.update_status_indicator('ready',
                                                                    '✓ Ready - You can now install your software'))
            self.root.after(0, lambda: self.status_var.set("Monitoring active - Baseline complete"))

        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("Error",
                                                            f"Failed to start monitoring: {e}"))
            self.root.after(0, self._reset_monitoring_state)

    def stop_monitoring(self):
        """Stop monitoring process"""
        if not self.monitor:
            return

        self.status_var.set("Stopping monitoring...")
        self.update_status_indicator('scanning', 'Detecting changes - Please wait...')
        self.monitor_button.config(state=tk.DISABLED)

        # Stop monitoring in thread
        thread = threading.Thread(target=self._stop_monitoring, daemon=True)
        thread.start()

    def _stop_monitoring(self):
        """Stop monitoring in background thread"""
        try:
            # Update status to show we're detecting changes
            self.root.after(0, lambda: self.status_var.set("Detecting changes..."))
            self.root.after(0, lambda: self.update_status_indicator('scanning', 'Detecting changes - Please wait...'))
            
            # Stop monitoring (this may take some time)
            self.monitor.stop_monitoring()

            # Update status to show we're saving results
            self.root.after(0, lambda: self.status_var.set("Saving results..."))
            self.root.after(0, lambda: self.update_status_indicator('scanning', 'Saving results - Please wait...'))

            self.root.after(0, lambda: messagebox.showinfo("Complete",
                                                           "Monitoring complete!\n\n"
                                                           f"Results saved to:\n{self.monitor.output_dir}"))

            # Refresh session list
            self.root.after(0, self.refresh_sessions)

        except Exception as e:
            error_msg = f"Error stopping monitoring: {e}"
            self.root.after(0, lambda: messagebox.showerror("Error", error_msg))

        finally:
            self.root.after(0, self._reset_monitoring_state)

    def _reset_monitoring_state(self):
        """Reset monitoring state"""
        self.monitoring = False
        self.baseline_ready = False
        self.monitor = None
        self.monitor_button.config(text="Start Monitoring", state=tk.NORMAL)
        self.refresh_button.config(state=tk.NORMAL)
        self.update_status_indicator('idle', 'Ready to start monitoring')
        self.status_var.set("Ready")

    def copy_software(self):
        """Copy/package selected software"""
        if not self.selected_session:
            messagebox.showwarning("No Selection", "Please select a monitoring session first.")
            return

        session_path = Path(self.selected_session)

        if not session_path.exists():
            messagebox.showerror("Error", f"Session directory not found:\n{session_path}")
            return

        # Confirm action
        result = messagebox.askyesno("Confirm",
                                     "This will package all monitored files and registry entries.\n\n"
                                     "Continue?")

        if not result:
            return

        self.status_var.set("Packaging software...")
        self.copy_button.config(state=tk.DISABLED)

        # Run packaging in thread
        thread = threading.Thread(target=self._package_software,
                                 args=(session_path,), daemon=True)
        thread.start()

    def _package_software(self, session_path):
        """Package software in background thread"""
        try:
            export_dir = package_software(session_path)

            self.root.after(0, lambda: messagebox.showinfo("Success",
                                                           f"Software packaged successfully!\n\n"
                                                           f"Location:\n{export_dir}"))

        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("Error",
                                                            f"Failed to package software: {e}"))

        finally:
            self.root.after(0, lambda: self.copy_button.config(state=tk.NORMAL))
            self.root.after(0, lambda: self.status_var.set("Ready"))

    def open_session_folder(self):
        """Open selected session folder in file explorer"""
        if not self.selected_session:
            return

        import subprocess
        import sys

        session_path = Path(self.selected_session)

        if not session_path.exists():
            messagebox.showerror("Error", f"Directory not found:\n{session_path}")
            return

        try:
            if sys.platform == 'win32':
                subprocess.run(['explorer', str(session_path)])
            elif sys.platform == 'darwin':
                subprocess.run(['open', str(session_path)])
            else:
                subprocess.run(['xdg-open', str(session_path)])
        except Exception as e:
            messagebox.showerror("Error", f"Failed to open folder: {e}")

    def view_details(self):
        """View detailed information about selected session"""
        if not self.selected_session:
            return

        session_path = Path(self.selected_session)

        if not session_path.exists():
            messagebox.showerror("Error", f"Session directory not found:\n{session_path}")
            return

        # Create detail window
        detail_window = tk.Toplevel(self.root)
        detail_window.title(f"Session Details - {session_path.name}")
        detail_window.geometry("800x600")

        # Create main frame with scrollbar
        main_frame = ttk.Frame(detail_window, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        detail_window.columnconfigure(0, weight=1)
        detail_window.rowconfigure(0, weight=1)

        # Create text widget with scrollbar
        text_frame = ttk.Frame(main_frame)
        text_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(0, weight=1)

        text_widget = tk.Text(text_frame, wrap=tk.WORD, font=('Courier', 10))
        scrollbar = ttk.Scrollbar(text_frame, orient="vertical", command=text_widget.yview)
        text_widget.configure(yscrollcommand=scrollbar.set)

        text_widget.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        text_frame.columnconfigure(0, weight=1)
        text_frame.rowconfigure(0, weight=1)

        # Load and display session details
        try:
            import json

            # Read filesystem changes
            fs_file = session_path / "filesystem_changes.json"
            reg_file = session_path / "registry_changes.json"
            summary_file = session_path / "summary.json"

            text_widget.insert(tk.END, f"{'='*80}\n")
            text_widget.insert(tk.END, f"SESSION DETAILS: {session_path.name}\n")
            text_widget.insert(tk.END, f"{'='*80}\n\n")

            # Summary
            if summary_file.exists():
                with open(summary_file, 'r', encoding='utf-8') as f:
                    summary = json.load(f)

                text_widget.insert(tk.END, "SUMMARY\n")
                text_widget.insert(tk.END, "-" * 80 + "\n")
                text_widget.insert(tk.END, f"Software Name: {summary.get('software_name', 'N/A')}\n")
                text_widget.insert(tk.END, f"Start Time: {summary.get('start_time', 'N/A')}\n")
                text_widget.insert(tk.END, f"End Time: {summary.get('end_time', 'N/A')}\n")
                text_widget.insert(tk.END, f"Total Files Changed: {summary.get('total_filesystem_changes', 0)}\n")
                text_widget.insert(tk.END, f"Total Registry Changes: {summary.get('total_registry_changes', 0)}\n\n")

            # Filesystem changes
            if fs_file.exists():
                with open(fs_file, 'r', encoding='utf-8') as f:
                    fs_data = json.load(f)

                text_widget.insert(tk.END, "FILESYSTEM CHANGES\n")
                text_widget.insert(tk.END, "=" * 80 + "\n\n")

                changes = fs_data.get('changes', {})
                for directory, items in changes.items():
                    if items:
                        text_widget.insert(tk.END, f"{directory}\n")
                        text_widget.insert(tk.END, "-" * 80 + "\n")

                        # Group by type
                        dirs = [i for i in items if i.get('is_dir', False)]
                        files = [i for i in items if not i.get('is_dir', False)]

                        if dirs:
                            text_widget.insert(tk.END, f"\nDirectories ({len(dirs)}):\n")
                            for item in dirs[:20]:  # Limit to first 20
                                text_widget.insert(tk.END, f"  - {item.get('path', 'N/A')}\n")
                            if len(dirs) > 20:
                                text_widget.insert(tk.END, f"  ... and {len(dirs) - 20} more\n")

                        if files:
                            text_widget.insert(tk.END, f"\nFiles ({len(files)}):\n")
                            for item in files[:20]:  # Limit to first 20
                                path = item.get('path', 'N/A')
                                size = item.get('size', 0)
                                size_str = self._format_size(size)
                                text_widget.insert(tk.END, f"  - {path} ({size_str})\n")
                            if len(files) > 20:
                                text_widget.insert(tk.END, f"  ... and {len(files) - 20} more\n")

                        text_widget.insert(tk.END, "\n")

            # Registry changes
            if reg_file.exists():
                with open(reg_file, 'r', encoding='utf-8') as f:
                    reg_data = json.load(f)

                text_widget.insert(tk.END, "\nREGISTRY CHANGES\n")
                text_widget.insert(tk.END, "=" * 80 + "\n\n")

                changes = reg_data.get('changes', {})
                for key, items in changes.items():
                    if items:
                        text_widget.insert(tk.END, f"{key}\n")
                        text_widget.insert(tk.END, "-" * 80 + "\n")
                        text_widget.insert(tk.END, f"New entries: {len(items)}\n")

                        for item in items[:10]:  # Limit to first 10
                            text_widget.insert(tk.END, f"  - {item}\n")
                        if len(items) > 10:
                            text_widget.insert(tk.END, f"  ... and {len(items) - 10} more\n")

                        text_widget.insert(tk.END, "\n")

            text_widget.insert(tk.END, f"\n{'='*80}\n")
            text_widget.insert(tk.END, "END OF DETAILS\n")
            text_widget.insert(tk.END, f"{'='*80}\n")

        except Exception as e:
            text_widget.insert(tk.END, f"Error loading details: {e}\n")

        # Make text widget read-only
        text_widget.config(state=tk.DISABLED)

        # Close button
        close_button = ttk.Button(main_frame, text="Close", command=detail_window.destroy)
        close_button.grid(row=1, column=0, pady=(10, 0))

    def _format_size(self, size_bytes):
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"

    def delete_session(self):
        """Delete selected monitoring session"""
        if not self.selected_session:
            messagebox.showwarning("No Selection", "Please select a monitoring session first.")
            return

        session_path = Path(self.selected_session)

        if not session_path.exists():
            messagebox.showerror("Error", f"Session directory not found:\n{session_path}")
            return

        # Get session name for confirmation
        session_name = session_path.name

        # Confirm deletion
        result = messagebox.askyesno(
            "Confirm Deletion",
            f"Are you sure you want to delete this session?\n\n"
            f"Session: {session_name}\n"
            f"Path: {session_path}\n\n"
            f"This action cannot be undone!\n\n"
            f"Press 'Yes' to delete.",
            icon='warning'
        )

        if not result:
            return

        # Delete the session directory
        self.status_var.set("Deleting session...")
        self.delete_button.config(state=tk.DISABLED)

        try:
            import shutil
            shutil.rmtree(session_path)

            messagebox.showinfo(
                "Success",
                f"Session deleted successfully!\n\n"
                f"Deleted: {session_name}"
            )

            # Clear selection
            self.selected_session = None

            # Refresh the session list
            self.refresh_sessions()

        except Exception as e:
            messagebox.showerror("Error", f"Failed to delete session:\n\n{e}")
            self.delete_button.config(state=tk.NORMAL)

        finally:
            self.status_var.set("Ready")


def main():
    """Main entry point"""
    root = tk.Tk()
    app = MonitorGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
