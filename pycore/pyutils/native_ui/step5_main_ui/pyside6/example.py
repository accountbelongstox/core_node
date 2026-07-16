#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Framework Example

This example demonstrates the complete workflow:
1. Show startup window (tkinter) during dependency installation
2. Launch main application (PySide6) with WebView
3. System tray integration
4. Tick timer for periodic tasks
"""

import sys
import time
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def example_with_startup():
    """
    Example with startup window showing dependency installation.
    """

    # Create framework
    app = create_framework(
        app_name="PySide6 Framework Example",
        window_size=(1280, 800),
        webview_url="https://www.example.com",
        enable_tray=True,
        show_startup=True,
        enable_tick_timer=True,
        tick_interval=2.0,
        debug=True
    )

    # Show startup window
    app.show_startup()

    # Simulate dependency installation
    app.log_startup("Initializing application...", "info")
    time.sleep(1)

    app.log_startup("Checking dependencies...", "info")
    time.sleep(1)

    app.log_startup("Installing: PySide6", "info")
    time.sleep(1)
    app.log_startup("✓ PySide6 installed successfully", "success")

    app.log_startup("Installing: PySide6-WebEngine", "info")
    time.sleep(1)
    app.log_startup("✓ PySide6-WebEngine installed successfully", "success")

    app.log_startup("All dependencies installed!", "success")
    time.sleep(1)

    # Close startup window and start main application
    app.close_startup()

    # Connect to tick signal
    app.tick.connect(lambda: print("Tick!"))

    # Start main application (this blocks)
    app.start()


def example_simple():
    """
    Simple example without startup window.
    """
    from pyside6 import PySide6Framework, PySide6UIConfig

    # Create configuration
    config = PySide6UIConfig(
        app_name="Simple Example",
        window_size=(800, 600),
        webview_url="https://www.google.com",
        enable_tray=True,
        show_on_start=True,
        enable_tick_timer=False
    )

    # Create framework
    app = PySide6Framework(config)

    # Add ready callback
    app.ready.connect(lambda: print("Application ready!"))

    # Start application
    app.start()


def example_local_html():
    """
    Example loading local HTML file.
    """

    # Create a simple HTML file
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Local HTML Example</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                font-family: 'Microsoft YaHei UI', Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            .container {
                text-align: center;
            }
            h1 {
                font-size: 48px;
                margin-bottom: 20px;
            }
            p {
                font-size: 18px;
            }
            button {
                margin-top: 20px;
                padding: 10px 30px;
                font-size: 16px;
                background-color: white;
                color: #667eea;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            }
            button:hover {
                background-color: #f0f0f0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Welcome to PySide6 Framework!</h1>
            <p>This is a local HTML page loaded in QWebEngineView</p>
            <button onclick="alert('Hello from JavaScript!')">Click Me!</button>
        </div>
    </body>
    </html>
    """

    # Save to temp file
    temp_html = Path(__file__).parent / "temp_example.html"
    with open(temp_html, 'w', encoding='utf-8') as f:
        f.write(html_content)

    # Create framework
    app = create_framework(
        app_name="Local HTML Example",
        window_size=(1000, 700),
        webview_url=str(temp_html),
        enable_tray=True,
        show_startup=False,
        show_on_start=True
    )

    # Start application
    app.start()

    # Cleanup temp file
    try:
        temp_html.unlink()
    except:
        pass


if __name__ == "__main__":
    # Choose which example to run
    print("PySide6 Framework Examples")
    print("1. Example with startup window")
    print("2. Simple example")
    print("3. Local HTML example")

    choice = input("Enter choice (1-3): ").strip()

    if choice == "1":
        example_with_startup()
    elif choice == "2":
        example_simple()
    elif choice == "3":
        example_local_html()
    else:
        print("Invalid choice. Running simple example...")
        example_simple()
