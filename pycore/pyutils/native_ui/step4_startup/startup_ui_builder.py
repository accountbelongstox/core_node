#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Startup UI Builder - pure Tkinter widget construction for TkinterStartupThread.

All functions are module-level and take the owning ``TkinterStartupThread`` instance
(``thread``) as their first argument. They MUST be called from the Tkinter thread
(the thread that runs ``TkinterStartupThread.run()``) because Tkinter widgets are
not safe to create from a foreign thread. Nothing here creates widgets at import
time - widgets are built only when these functions are invoked within ``run()``.

These functions mutate the thread's UI attributes (``thread.root``,
``thread.text_widget``, ``thread.progress_bar``, ``thread.status_label``,
``thread.language_var``, ``thread.language_frame``) which are declared in
``TkinterStartupThread.__init__``.
"""

from pathlib import Path

from pycore.pyfoundations.third_party import (
    get_third_package_tkinter,
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageTk,
)
from pycore.pyutils.native_ui.step0_i18n import i18n, I18nKeys

# Resolve tkinter + PIL via the third_party manager (auto-installs python3-tk on Linux).
# Module-level resolution mirrors the original file: it runs at import time but does
# NOT create any widgets (widgets are created only inside the functions below).
tk = get_third_package_tkinter()
ttk = tk.ttk

Image = get_third_package_PIL_Image()
ImageTk = get_third_package_PIL_ImageTk()


def initialize_ui(thread):
    """Initialize Tkinter UI (was TkinterStartupThread._initialize_ui)."""
    # Create root window
    thread.root = tk.Tk()
    initializing_text = i18n.get(I18nKeys.STARTUP_STATUS_INITIALIZING)
    thread.root.title(f"{thread.app_name} - {initializing_text} - debug #1")
    thread.root.geometry(f"{thread.width}x{thread.height}")

    # Hide window initially
    thread.root.withdraw()

    # Set icon if provided
    if thread.icon_path and Path(thread.icon_path).exists():
        try:
            if thread.icon_path.endswith('.ico'):
                thread.root.iconbitmap(thread.icon_path)
            else:
                icon_image = tk.PhotoImage(file=thread.icon_path)
                thread.root.iconphoto(True, icon_image)
        except:
            pass

    # Set close protocol (handler lives on the orchestrator)
    thread.root.protocol("WM_DELETE_WINDOW", thread._on_user_close)

    # Create UI components
    create_ui(thread)

    # Center window
    center_window(thread)

    # Show window
    thread.root.deiconify()

    # Start log processing (method lives on the orchestrator)
    thread._process_logs()


def center_window(thread):
    """Center window on screen (was TkinterStartupThread._center_window)."""
    thread.root.update_idletasks()
    screen_width = thread.root.winfo_screenwidth()
    screen_height = thread.root.winfo_screenheight()

    x = (screen_width - thread.width) // 2
    y = (screen_height - thread.height) // 2

    thread.root.geometry(f"{thread.width}x{thread.height}+{x}+{y}")


def create_ui(thread):
    """Create UI components (was TkinterStartupThread._create_ui)."""
    root = thread.root

    # Title frame
    title_frame = tk.Frame(root, bg="#2c3e50", height=60)
    title_frame.pack(fill=tk.X)
    title_frame.pack_propagate(False)

    # Logo + Title
    if thread.logo_path and Path(thread.logo_path).exists():
        try:
            title_container = tk.Frame(title_frame, bg="#2c3e50")
            title_container.pack(expand=True)

            # Load and resize logo
            logo_img = Image.open(thread.logo_path)
            logo_img = logo_img.resize((32, 32), Image.Resampling.LANCZOS)
            logo_photo = ImageTk.PhotoImage(logo_img)

            # Logo label
            logo_label = tk.Label(
                title_container,
                image=logo_photo,
                bg="#2c3e50"
            )
            logo_label.image = logo_photo
            logo_label.pack(side=tk.LEFT, padx=(0, 10))

            # Title label
            title_label = tk.Label(
                title_container,
                text=thread.app_name,
                font=("Microsoft YaHei UI", 16, "bold"),
                bg="#2c3e50",
                fg="#ecf0f1"
            )
            title_label.pack(side=tk.LEFT)
        except:
            # Fallback to title only
            title_label = tk.Label(
                title_frame,
                text=thread.app_name,
                font=("Microsoft YaHei UI", 16, "bold"),
                bg="#2c3e50",
                fg="#ecf0f1"
            )
            title_label.pack(pady=15)
    else:
        # No logo, just title
        title_label = tk.Label(
            title_frame,
            text=thread.app_name,
            font=("Microsoft YaHei UI", 16, "bold"),
            bg="#2c3e50",
            fg="#ecf0f1"
        )
        title_label.pack(pady=15)

    # Content frame
    content_frame = tk.Frame(root, bg="#34495e")
    content_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

    # Log display
    log_frame = tk.Frame(content_frame, bg="#34495e")
    log_frame.pack(fill=tk.BOTH, expand=True)

    scrollbar = tk.Scrollbar(log_frame)
    scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    thread.text_widget = tk.Text(
        log_frame,
        wrap=tk.WORD,
        bg="#1e1e1e",
        fg="#d4d4d4",
        font=("Consolas", 9),
        state=tk.DISABLED,
        yscrollcommand=scrollbar.set
    )
    thread.text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    scrollbar.config(command=thread.text_widget.yview)

    # Configure text tags for colors
    thread.text_widget.tag_config("info", foreground="#4ec9b0")
    thread.text_widget.tag_config("success", foreground="#6a9955")
    thread.text_widget.tag_config("warning", foreground="#dcdcaa")
    thread.text_widget.tag_config("error", foreground="#f48771")
    thread.text_widget.tag_config("debug", foreground="#9cdcfe")

    # Language selector (if enabled)
    if thread.enable_language_selector:
        create_language_selector(thread, root)

    # Status frame
    status_frame = tk.Frame(root, bg="#34495e", height=60)
    status_frame.pack(fill=tk.X)
    status_frame.pack_propagate(False)

    # Progress bar
    thread.progress_bar = ttk.Progressbar(
        status_frame,
        mode='indeterminate',
        length=thread.width - 40
    )
    thread.progress_bar.pack(pady=(10, 5))
    thread.progress_bar.start(10)

    # Status label
    thread.status_label = tk.Label(
        status_frame,
        text=i18n.get(I18nKeys.STARTUP_STATUS_INITIALIZING),
        bg="#34495e",
        fg="#bdc3c7",
        font=("Microsoft YaHei UI", 9)
    )
    thread.status_label.pack()


def create_language_selector(thread, parent):
    """Create language selector with radio buttons (was TkinterStartupThread._create_language_selector)."""
    thread.language_frame = tk.Frame(parent, bg="#34495e")
    thread.language_frame.pack(fill=tk.X, padx=10, pady=(0, 10))

    # Title
    lang_label = tk.Label(
        thread.language_frame,
        text="Language / 语言 / 言語:",
        bg="#34495e",
        fg="#ecf0f1",
        font=("Microsoft YaHei UI", 9, "bold")
    )
    lang_label.pack(anchor=tk.W, pady=(0, 5))

    # Radio buttons container
    radio_container = tk.Frame(thread.language_frame, bg="#34495e")
    radio_container.pack(anchor=tk.W)

    # StringVar for selected language
    thread.language_var = tk.StringVar(value="auto")

    # Auto option
    auto_radio = tk.Radiobutton(
        radio_container,
        text="🌐 Follow System / 跟随系统 / システムに従う",
        variable=thread.language_var,
        value="auto",
        bg="#34495e",
        fg="#ecf0f1",
        selectcolor="#2c3e50",
        activebackground="#34495e",
        activeforeground="#ecf0f1",
        font=("Microsoft YaHei UI", 9),
        command=lambda: on_language_change(thread)
    )
    auto_radio.pack(anchor=tk.W, padx=5)

    # Language options
    supported_languages = i18n.get_supported_languages()
    lang_display = {
        "en": "🇬🇧 English",
        "zh": "🇨🇳 简体中文",
        "ja": "🇯🇵 日本語"
    }

    for lang in supported_languages:
        display_name = lang_display.get(lang, lang.upper())

        radio = tk.Radiobutton(
            radio_container,
            text=display_name,
            variable=thread.language_var,
            value=lang,
            bg="#34495e",
            fg="#ecf0f1",
            selectcolor="#2c3e50",
            activebackground="#34495e",
            activeforeground="#ecf0f1",
            font=("Microsoft YaHei UI", 9),
            command=lambda: on_language_change(thread)
        )
        radio.pack(anchor=tk.W, padx=5)


def on_language_change(thread):
    """Handle language change (was TkinterStartupThread._on_language_change)."""
    selected = thread.language_var.get()

    if selected == "auto":
        system_lang = i18n._detect_system_language()
        supported = i18n.get_supported_languages()

        if system_lang in supported:
            i18n.set_language(system_lang)
        else:
            i18n.set_language(supported[0])
    else:
        i18n.set_language(selected)

    # Update window title
    new_app_name = i18n.get("app.name", default=thread.app_name)

    if thread.root:
        initializing_text = i18n.get(I18nKeys.STARTUP_STATUS_INITIALIZING)
        title_text = i18n.get("window.title.initializing",
                              default=f"{new_app_name} - {initializing_text}")
        thread.root.title(f"{title_text} - debug #1")

    # Update status label if it exists and current status matches a known key
    if thread.status_label:
        current_status = thread.status_label.cget("text")
        # Try to identify and re-translate the current status
        # This is a best-effort approach to maintain the current status semantic
        status_key_map = {
            "Initializing": I18nKeys.STARTUP_STATUS_INITIALIZING,
            "初始化": I18nKeys.STARTUP_STATUS_INITIALIZING,
            "初期化": I18nKeys.STARTUP_STATUS_INITIALIZING,
            "Ready": I18nKeys.STARTUP_STATUS_READY,
            "就绪": I18nKeys.STARTUP_STATUS_READY,
            "準備完了": I18nKeys.STARTUP_STATUS_READY,
            "Loading": I18nKeys.STARTUP_STATUS_LOADING,
            "加载": I18nKeys.STARTUP_STATUS_LOADING,
            "読み込み": I18nKeys.STARTUP_STATUS_LOADING,
        }
        # Check if current status starts with any known key
        for key_substr, i18n_key in status_key_map.items():
            if key_substr in current_status:
                thread.status_label.config(text=i18n.get(i18n_key))
                break

    # Log change
    current_lang = i18n.get_current_language()
    lang_name = i18n.get(f"language.name.{current_lang}", default=current_lang)
    thread.log(f"Language changed to: {lang_name}", level="info")
