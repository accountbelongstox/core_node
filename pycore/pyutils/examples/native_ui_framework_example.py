#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Usage Examples
Demonstrates how to use the native UI framework to create desktop applications
"""

import sys
import os
import time
import traceback
from pycore.pyfoundations.serialized_worker import start_bus_task


# Add project root directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from pycore.pyutils.native_ui_framework import (
    NativeUIFramework,
    UIConfig,
    SignalType,
    Signal
)


# ============================================
# Example 1: Basic Window Application
# ============================================

def example_basic_window():
    """Basic window application example"""
    print("=== Example 1: Basic Window Application ===\n")

    # Create configuration
    config = UIConfig(
        app_name="Basic Window Example",
        window_size=(800, 600),
        show_on_start=True,
        debug=True
    )

    # Create UI framework
    app = NativeUIFramework(config)

    # Start application
    app.start()

    print("\nTip: You can drag the title bar to move the window, use the top-right buttons to control the window")


# ============================================
# Example 2: Load Remote URL
# ============================================

def example_load_url():
    """Load remote URL example"""
    print("=== Example 2: Load Remote URL ===\n")
    print("Note: Need to install tkinterweb library: pip install tkinterweb\n")

    config = UIConfig(
        app_name="Web Browser",
        window_size=(1024, 768),
        show_on_start=True,
        ui_source="https://www.baidu.com",  # Load Baidu homepage
        debug=True
    )

    app = NativeUIFramework(config)
    app.start()


# ============================================
# Example 3: Load Local HTML
# ============================================

def example_load_html():
    """Load local HTML example"""
    print("=== Example 3: Load Local HTML ===\n")

    # Create a simple HTML file
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Local HTML Example</title>
        <style>
            body {
                font-family: 'Microsoft YaHei', Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .container {
                text-align: center;
                padding: 40px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                backdrop-filter: blur(10px);
            }
            h1 { margin: 0 0 20px 0; }
            p { margin: 10px 0; font-size: 18px; }
            button {
                margin: 20px 10px 0 10px;
                padding: 12px 24px;
                font-size: 16px;
                background: white;
                color: #667eea;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.3s;
            }
            button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Native UI Framework</h1>
            <p>Welcome to Native UI Framework</p>
            <p>This is a desktop application built with Python Tkinter</p>
            <div>
                <button onclick="alert('Button 1 clicked!')">Button 1</button>
                <button onclick="alert('Button 2 clicked!')">Button 2</button>
                <button onclick="alert('Button 3 clicked!')">Button 3</button>
            </div>
        </div>
    </body>
    </html>
    """

    # Save HTML file
    html_file = "test_ui.html"
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"Created HTML file: {html_file}\n")

    # Create configuration
    config = UIConfig(
        app_name="Local HTML Example",
        window_size=(900, 700),
        show_on_start=True,
        ui_source=html_file,
        debug=True
    )

    app = NativeUIFramework(config)
    app.start()


# ============================================
# Example 4: Custom Signal Handling
# ============================================

def example_custom_signals():
    """Custom signal handling example"""
    print("=== Example 4: Custom Signal Handling ===\n")

    config = UIConfig(
        app_name="Signal Handling Example",
        window_size=(800, 600),
        show_on_start=True,
        debug=True
    )

    app = NativeUIFramework(config)

    # Register custom signal handler
    def on_custom_event(signal: Signal):
        print(f"\n📢 Received custom signal!")
        print(f"   Signal type: {signal.signal_type.value}")
        print(f"   Signal data: {signal.data}")
        print(f"   Timestamp: {signal.timestamp}\n")

    app.register_handler(SignalType.CUSTOM, on_custom_event)

    # Register UI ready signal
    def on_ui_ready(signal: Signal):
        print("\n✅ UI is ready!\n")

        # Delay sending custom signal (simulate user action)
        def send_signal():
            time.sleep(2)
            print("Sending custom signal...")
            app.emit_signal(SignalType.CUSTOM, {
                'action': 'test',
                'message': 'This is a test signal',
                'value': 42
            })

        start_bus_task(send_signal, thread_name="ExampleCustomSignalThread")

    app.register_handler(SignalType.UI_READY, on_ui_ready)

    # Start application
    app.start()


# ============================================
# Example 5: Background Task Processing
# ============================================

class CustomUIFramework(NativeUIFramework):
    """Custom UI framework - demonstrates background task processing"""

    def __init__(self, config: UIConfig):
        super().__init__(config)
        self.task_counter = 0

    def _run_background_tasks(self):
        """Override background task method"""
        self.task_counter += 1

        if self.task_counter % 10 == 0:  # Output once per second (assuming sleep 0.1s)
            print(f"⏰ Background task running... (count: {self.task_counter})")

        # Simulate background data processing
        if self.task_counter == 50:  # Send custom signal after 5 seconds
            print("\n📊 Background task completed, sending notification signal")
            self.emit_signal(SignalType.CUSTOM, {
                'task': 'background_task',
                'status': 'completed',
                'count': self.task_counter
            })


def example_background_tasks():
    """Background task processing example"""
    print("=== Example 5: Background Task Processing ===\n")

    config = UIConfig(
        app_name="Background Task Example",
        window_size=(800, 600),
        show_on_start=True,
        debug=True
    )

    # Use custom framework class
    app = CustomUIFramework(config)

    # Register task completion signal handler
    def on_task_complete(signal: Signal):
        if signal.data.get('task') == 'background_task':
            print(f"\n✅ Background task completion notification!")
            print(f"   Status: {signal.data.get('status')}")
            print(f"   Count: {signal.data.get('count')}\n")

    app.register_handler(SignalType.CUSTOM, on_task_complete)

    # Start application
    app.start()


# ============================================
# Example 6: Hidden Window Startup (Tray Mode)
# ============================================

def example_hidden_start():
    """Hidden window startup example (simulates tray application)"""
    print("=== Example 6: Hidden Window Startup ===\n")
    print("Window will start in background, automatically show after 3 seconds\n")

    config = UIConfig(
        app_name="Tray Mode Example",
        window_size=(700, 500),
        show_on_start=False,  # Don't show window
        debug=True
    )

    app = NativeUIFramework(config)

    # Delay showing window
    def delayed_show():
        time.sleep(3)
        print("Showing window...")
        app.show_window()

    start_bus_task(delayed_show, thread_name="ExampleDelayedShowThread")

    # Start application
    app.start()


# ============================================
# Example 7: Complete Application Example
# ============================================

class MyCustomApp(NativeUIFramework):
    """Complete custom application example"""

    def __init__(self, config: UIConfig):
        super().__init__(config)

        # Application state
        self.data = {
            'counter': 0,
            'tasks': []
        }

        # Register custom signal handlers
        self._register_custom_handlers()

    def _register_custom_handlers(self):
        """Register custom signal handlers"""

        def on_ui_ready(signal: Signal):
            print("\n🎉 Application UI is ready!")
            print(f"   App name: {self.config.app_name}")
            print(f"   Window size: {self.config.window_size}")

        def on_custom_action(signal: Signal):
            action = signal.data.get('action')
            print(f"\n🔔 Processing custom action: {action}")

            if action == 'increment':
                self.data['counter'] += 1
                print(f"   Counter: {self.data['counter']}")

            elif action == 'add_task':
                task = signal.data.get('task')
                self.data['tasks'].append(task)
                print(f"   Added task: {task}")
                print(f"   Task list: {self.data['tasks']}")

        self.register_handler(SignalType.UI_READY, on_ui_ready)
        self.register_handler(SignalType.CUSTOM, on_custom_action)

    def _run_background_tasks(self):
        """Background tasks"""
        # Automatically increment counter every second
        if int(time.time()) % 5 == 0:  # Execute every 5 seconds
            self.emit_signal(SignalType.CUSTOM, {
                'action': 'increment'
            })


def example_complete_app():
    """Complete application example"""
    print("=== Example 7: Complete Application Example ===\n")

    config = UIConfig(
        app_name="My Desktop Application",
        window_size=(1000, 700),
        show_on_start=True,
        debug=True
    )

    app = MyCustomApp(config)

    # Simulate user actions
    def simulate_user_actions():
        time.sleep(2)

        # Send some test signals
        app.emit_signal(SignalType.CUSTOM, {
            'action': 'add_task',
            'task': 'Complete project documentation'
        })

        time.sleep(1)

        app.emit_signal(SignalType.CUSTOM, {
            'action': 'add_task',
            'task': 'Code review'
        })

    start_bus_task(
        simulate_user_actions,
        thread_name="ExampleUserActionsThread",
    )

    # Start application
    app.start()


# ============================================
# Main Function
# ============================================

def main():
    """Main function - select which example to run"""
    print("\n" + "=" * 60)
    print(" Native UI Framework - Example Collection")
    print("=" * 60)
    print("\nPlease select an example to run:\n")
    print("1. Basic window application")
    print("2. Load remote URL (requires tkinterweb)")
    print("3. Load local HTML")
    print("4. Custom signal handling")
    print("5. Background task processing")
    print("6. Hidden window startup")
    print("7. Complete application example")
    print("\n0. Exit")
    print("\n" + "=" * 60)

    try:
        choice = input("\nPlease enter option (0-7): ").strip()

        examples = {
            '1': example_basic_window,
            '2': example_load_url,
            '3': example_load_html,
            '4': example_custom_signals,
            '5': example_background_tasks,
            '6': example_hidden_start,
            '7': example_complete_app
        }

        if choice == '0':
            print("\nGoodbye!")
            return

        if choice in examples:
            print("\n")
            examples[choice]()
        else:
            print("\n❌ Invalid option, please try again")
            main()

    except KeyboardInterrupt:
        print("\n\n👋 Program exited")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        traceback.print_exc()


if __name__ == '__main__':
    main()
