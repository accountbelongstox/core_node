"""
Native UI Thread-Based Example

This example demonstrates how to use NativeUIThread, which directly inherits
from threading.Thread similar to SeleniumThread pattern.

Usage:
    python -m pycore.pyutils.native_ui.examples.thread_based_example
"""

import time
import tkinter as tk
from pycore import ColorPrint
from pycore.pyutils.native_ui.thread_framework import NativeUIThread, NativeUIThreadConfig


def create_simple_ui():
    """
    Example 1: Simple UI with minimal configuration
    """
    ColorPrint.print_info("=" * 80)
    ColorPrint.print_info("Example 1: Simple UI Thread")
    ColorPrint.print_info("=" * 80)

    def on_ready():
        ColorPrint.print_success("UI is ready!")

    # Create and start UI thread (just like SeleniumThread)
    ui_thread = NativeUIThread(
        app_name="Simple UI",
        width=600,
        height=400,
        on_ready=on_ready
    )

    # Start the thread
    ui_thread.start()

    # Wait for UI to be ready
    ui_thread.wait_until_ready()

    ColorPrint.print_info("UI thread is running...")
    ColorPrint.print_info("Press Ctrl+C to stop")

    try:
        # Main thread can do other work
        while ui_thread.is_running():
            time.sleep(1)
    except KeyboardInterrupt:
        ColorPrint.print_warn("Keyboard interrupt received")

    # Stop the UI
    ui_thread.stop()
    ui_thread.join(timeout=5)

    ColorPrint.print_success("Example 1 completed")


def create_ui_with_content():
    """
    Example 2: UI with custom content
    """
    ColorPrint.print_info("=" * 80)
    ColorPrint.print_info("Example 2: UI with Custom Content")
    ColorPrint.print_info("=" * 80)

    def create_content(content_frame):
        """Create custom UI content"""
        # Title
        title_label = tk.Label(
            content_frame,
            text="Native UI Thread Example",
            font=("Arial", 20, "bold"),
            bg="#1e1e1e",
            fg="white"
        )
        title_label.pack(pady=20)

        # Button
        button = tk.Button(
            content_frame,
            text="Click Me!",
            command=lambda: ColorPrint.print_success("Button clicked!"),
            font=("Arial", 12),
            bg="#0078d4",
            fg="white",
            relief=tk.FLAT,
            padx=20,
            pady=10
        )
        button.pack(pady=10)

        # Status label
        status_label = tk.Label(
            content_frame,
            text="UI is running...",
            font=("Arial", 10),
            bg="#1e1e1e",
            fg="gray"
        )
        status_label.pack(pady=20)

    def on_ready():
        ColorPrint.print_success("UI with content is ready!")

    def on_close():
        ColorPrint.print_warn("UI is closing...")

    # Create UI with custom content
    ui_thread = NativeUIThread(
        app_name="UI with Content",
        width=800,
        height=600,
        on_create_content=create_content,
        on_ready=on_ready,
        on_close=on_close
    )

    ui_thread.start()
    ui_thread.wait_until_ready()

    ColorPrint.print_info("UI is running, press Ctrl+C to stop")

    try:
        while ui_thread.is_running():
            time.sleep(1)
    except KeyboardInterrupt:
        ColorPrint.print_warn("Keyboard interrupt received")

    ui_thread.stop()
    ui_thread.join(timeout=5)

    ColorPrint.print_success("Example 2 completed")


def create_ui_with_tasks():
    """
    Example 3: UI with timer tasks
    """
    ColorPrint.print_info("=" * 80)
    ColorPrint.print_info("Example 3: UI with Timer Tasks")
    ColorPrint.print_info("=" * 80)

    counter = {'value': 0}

    def create_content(content_frame):
        """Create content with counter display"""
        counter_label = tk.Label(
            content_frame,
            text="Counter: 0",
            font=("Arial", 24, "bold"),
            bg="#1e1e1e",
            fg="white"
        )
        counter_label.pack(expand=True)

        # Store reference for updating
        content_frame.counter_label = counter_label

    def update_counter():
        """Task that runs every second"""
        counter['value'] += 1
        ColorPrint.print_info(f"Counter: {counter['value']}")

        # Update UI (if available)
        if hasattr(ui_thread.content_frame, 'counter_label'):
            ui_thread.content_frame.counter_label.config(
                text=f"Counter: {counter['value']}"
            )

    # Create UI
    ui_thread = NativeUIThread(
        app_name="UI with Tasks",
        width=600,
        height=400,
        on_create_content=create_content,
        task_timer_interval=1.0  # 1 second timer
    )

    ui_thread.start()
    ui_thread.wait_until_ready()

    # Add timer task
    ui_thread.add_task(update_counter, interval=1.0)

    ColorPrint.print_success("Timer task added, counter will increment every second")
    ColorPrint.print_info("Press Ctrl+C to stop")

    try:
        # Let it run for 10 seconds
        time.sleep(10)
    except KeyboardInterrupt:
        ColorPrint.print_warn("Keyboard interrupt received")

    ui_thread.stop()
    ui_thread.join(timeout=5)

    ColorPrint.print_success("Example 3 completed")


def create_ui_with_config():
    """
    Example 4: UI with full configuration object
    """
    ColorPrint.print_info("=" * 80)
    ColorPrint.print_info("Example 4: UI with Configuration Object")
    ColorPrint.print_info("=" * 80)

    # Create configuration
    config = NativeUIThreadConfig(
        app_name="Configured UI",
        width=1000,
        height=700,
        show_on_start=True,
        resizable=True,
        frameless=True,
        theme="dark",
        background_color="#2d2d2d",
        debug=True,
        custom_data={
            'version': '1.0.0',
            'author': 'Native UI Team'
        }
    )

    def on_ready():
        ColorPrint.print_success("Configured UI ready!")
        ColorPrint.print_info(f"Custom data: {ui_thread.config.custom_data}")

    # Create UI with config object
    ui_thread = NativeUIThread(
        config=config,
        on_ready=on_ready,
        thread_name="ConfiguredUIThread"
    )

    ui_thread.start()
    ui_thread.wait_until_ready()

    # Get status
    status = ui_thread.get_status()
    ColorPrint.print_info(f"Status: {status}")

    # Run for 5 seconds
    time.sleep(5)

    ui_thread.stop()
    ui_thread.join(timeout=5)

    ColorPrint.print_success("Example 4 completed")


def create_multiple_ui_threads():
    """
    Example 5: Multiple UI threads running simultaneously
    """
    ColorPrint.print_info("=" * 80)
    ColorPrint.print_info("Example 5: Multiple UI Threads")
    ColorPrint.print_info("=" * 80)

    threads = []

    # Create 3 UI threads
    for i in range(3):
        ui_thread = NativeUIThread(
            app_name=f"UI Window {i+1}",
            width=400,
            height=300,
            on_ready=lambda idx=i: ColorPrint.print_success(f"Window {idx+1} ready!"),
            thread_name=f"UIThread-{i+1}"
        )

        ui_thread.start()
        threads.append(ui_thread)

        # Offset window positions (if possible)
        time.sleep(0.5)

    # Wait for all to be ready
    for thread in threads:
        thread.wait_until_ready()

    ColorPrint.print_success("All 3 UI windows are running!")
    ColorPrint.print_info("Press Ctrl+C to stop all")

    try:
        while any(t.is_running() for t in threads):
            time.sleep(1)
    except KeyboardInterrupt:
        ColorPrint.print_warn("Keyboard interrupt received")

    # Stop all threads
    for thread in threads:
        thread.stop()

    # Wait for all to finish
    for thread in threads:
        thread.join(timeout=5)

    ColorPrint.print_success("Example 5 completed")


def main():
    """Run all examples"""
    ColorPrint.print_info("\n" + "=" * 80)
    ColorPrint.print_info(" Native UI Thread-Based Examples")
    ColorPrint.print_info("=" * 80 + "\n")

    examples = [
        ("Simple UI", create_simple_ui),
        ("UI with Content", create_ui_with_content),
        ("UI with Tasks", create_ui_with_tasks),
        ("UI with Config", create_ui_with_config),
        ("Multiple UIs", create_multiple_ui_threads)
    ]

    ColorPrint.print_info("Available examples:")
    for i, (name, _) in enumerate(examples, 1):
        ColorPrint.print_info(f"  {i}. {name}")

    ColorPrint.print_info("\nSelect example (1-5) or 0 to run all: ", end="")

    try:
        choice = int(input())

        if choice == 0:
            # Run all examples
            for name, func in examples:
                ColorPrint.print_info(f"\n\nRunning: {name}\n")
                func()
                time.sleep(2)
        elif 1 <= choice <= len(examples):
            # Run selected example
            name, func = examples[choice - 1]
            ColorPrint.print_info(f"\n\nRunning: {name}\n")
            func()
        else:
            ColorPrint.print_error("Invalid choice")

    except ValueError:
        ColorPrint.print_error("Invalid input")
    except KeyboardInterrupt:
        ColorPrint.print_warn("\nInterrupted by user")

    ColorPrint.print_info("\n" + "=" * 80)
    ColorPrint.print_success(" Examples completed!")
    ColorPrint.print_info("=" * 80 + "\n")


if __name__ == '__main__':
    main()
