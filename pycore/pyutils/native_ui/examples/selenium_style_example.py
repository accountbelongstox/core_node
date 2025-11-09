"""
SeleniumThread-Style Example

This example demonstrates how NativeUIThread follows the same pattern as SeleniumThread,
showing the similarity in usage patterns.

Comparison with SeleniumThread:
    SeleniumThread:
        thread = SeleniumThread(target=func, args=config, thread_name="MyThread")
        thread.start()
        thread.send(data)

    NativeUIThread:
        thread = NativeUIThread(app_name="MyApp", on_ready=func)
        thread.start()
        thread.emit_signal(signal_type, data)
"""

import time
import threading
import tkinter as tk
from queue import Queue

from pycore import ColorPrint
from pycore.pyutils.native_ui.thread_framework import NativeUIThread, NativeUIThreadConfig
from pycore.pyutils.native_ui.signals import SignalType


class CustomNativeUIThread(NativeUIThread):
    """
    Custom UI Thread - Similar to SeleniumThread pattern

    This shows how to extend NativeUIThread with custom functionality,
    just like extending SeleniumThread.
    """

    def __init__(self, target=None, args=None, thread_name="CustomUIThread", **kwargs):
        """
        Initialize custom UI thread

        Args:
            target: Target function to run after UI is ready
            args: Arguments for target function
            thread_name: Thread name
            **kwargs: Additional UI configuration
        """
        super().__init__(thread_name=thread_name, **kwargs)

        self.target = target
        self.target_args = args or {}
        self.send_queue = Queue()

        # Custom attributes (like SeleniumThread)
        self.custom_data = {}

    def run(self):
        """
        Override run() to execute target function after UI is ready
        Similar to SeleniumThread.run()
        """
        # Call parent run() to start UI
        ColorPrint.print_info(f"[{self.name}] Starting custom UI thread...")

        # Start UI in separate thread
        ui_thread = threading.Thread(target=super().run, daemon=False)
        ui_thread.start()

        # Wait for UI to be ready
        self.wait_until_ready()

        # Execute target function (if provided)
        if self.target:
            try:
                ColorPrint.print_info(f"[{self.name}] Executing target function...")
                self.target(self.target_args)
            except Exception as e:
                ColorPrint.print_error(f"[{self.name}] Target function error: {e}")

        # Keep running
        ui_thread.join()

    def send(self, data):
        """
        Send data to the thread (similar to SeleniumThread.send)

        Args:
            data: Data to send
        """
        self.send_queue.put(data)
        ColorPrint.print_info(f"[{self.name}] Data sent: {data}")

    def set(self, name, value):
        """
        Set custom attribute (similar to SeleniumThread.set)

        Args:
            name: Attribute name
            value: Attribute value
        """
        self.custom_data[name] = value
        ColorPrint.print_info(f"[{self.name}] Set {name} = {value}")

    def get(self, name):
        """
        Get custom attribute

        Args:
            name: Attribute name

        Returns:
            Attribute value
        """
        return self.custom_data.get(name)


def example_basic_pattern():
    """Example 1: Basic SeleniumThread-like pattern"""
    ColorPrint.print_info("=" * 80)
    ColorPrint.print_info("Example 1: Basic Pattern (like SeleniumThread)")
    ColorPrint.print_info("=" * 80)

    def my_task(args):
        """Task function to execute"""
        ColorPrint.print_success(f"Task running with args: {args}")
        time.sleep(2)
        ColorPrint.print_success("Task completed!")

    config = {
        'app_name': 'My Application',
        'setting1': 'value1',
        'setting2': 'value2'
    }

    # Create thread (like SeleniumThread)
    ui_thread = CustomNativeUIThread(
        target=my_task,
        args=config,
        thread_name="MyUIThread",
        app_name="SeleniumThread-Style UI",
        width=600,
        height=400
    )

    # Start thread
    ui_thread.start()

    # Wait a bit
    time.sleep(5)

    # Stop thread
    ui_thread.stop()

    ColorPrint.print_success("Example 1 completed")


def example_queue_communication():
    """Example 2: Queue-based communication (like SeleniumThread)"""
    ColorPrint.print_info("=" * 80)
    ColorPrint.print_info("Example 2: Queue Communication")
    ColorPrint.print_info("=" * 80)

    def process_messages(args):
        """Process incoming messages from queue"""
        thread = args['thread']

        ColorPrint.print_info("Message processor started")

        for i in range(5):
            if not thread.send_queue.empty():
                msg = thread.send_queue.get()
                ColorPrint.print_success(f"Received message: {msg}")
            time.sleep(1)

        ColorPrint.print_info("Message processor finished")

    # Create thread
    ui_thread = CustomNativeUIThread(
        target=process_messages,
        thread_name="QueueUIThread",
        app_name="Queue Communication UI",
        width=500,
        height=300
    )

    # Add thread reference to args
    ui_thread.target_args = {'thread': ui_thread}

    # Start thread
    ui_thread.start()

    # Wait for UI to be ready
    ui_thread.wait_until_ready()

    # Send messages (like SeleniumThread.send)
    for i in range(3):
        ui_thread.send(f"Message {i+1}")
        time.sleep(1)

    # Wait for processing
    time.sleep(5)

    # Stop thread
    ui_thread.stop()

    ColorPrint.print_success("Example 2 completed")


def example_custom_attributes():
    """Example 3: Custom attributes (like SeleniumThread.set/get)"""
    ColorPrint.print_info("=" * 80)
    ColorPrint.print_info("Example 3: Custom Attributes")
    ColorPrint.print_info("=" * 80)

    def use_attributes(args):
        """Use custom attributes"""
        thread = args['thread']

        # Set attributes
        thread.set('counter', 0)
        thread.set('status', 'running')

        # Use attributes
        for i in range(5):
            counter = thread.get('counter')
            thread.set('counter', counter + 1)
            ColorPrint.print_info(f"Counter: {thread.get('counter')}")
            time.sleep(1)

        thread.set('status', 'finished')
        ColorPrint.print_success(f"Final status: {thread.get('status')}")

    # Create thread
    ui_thread = CustomNativeUIThread(
        target=use_attributes,
        thread_name="AttributeUIThread",
        app_name="Custom Attributes UI",
        width=500,
        height=300
    )

    ui_thread.target_args = {'thread': ui_thread}

    # Start thread
    ui_thread.start()

    # Wait for completion
    time.sleep(7)

    # Check final state
    ColorPrint.print_info(f"Final counter: {ui_thread.get('counter')}")
    ColorPrint.print_info(f"Final status: {ui_thread.get('status')}")

    # Stop thread
    ui_thread.stop()

    ColorPrint.print_success("Example 3 completed")


def example_multiple_threads():
    """Example 4: Multiple threads (like multiple SeleniumThread instances)"""
    ColorPrint.print_info("=" * 80)
    ColorPrint.print_info("Example 4: Multiple Threads")
    ColorPrint.print_info("=" * 80)

    threads = []

    # Create multiple threads
    for i in range(3):
        thread = CustomNativeUIThread(
            app_name=f"Thread {i+1}",
            width=300,
            height=200,
            thread_name=f"UIThread-{i+1}"
        )

        thread.set('id', i+1)
        thread.start()
        threads.append(thread)

        time.sleep(0.5)

    # Wait for all to be ready
    for thread in threads:
        thread.wait_until_ready()
        ColorPrint.print_success(f"Thread {thread.get('id')} ready")

    # Let them run
    time.sleep(5)

    # Stop all
    for thread in threads:
        ColorPrint.print_info(f"Stopping thread {thread.get('id')}...")
        thread.stop()

    ColorPrint.print_success("Example 4 completed")


def main():
    """Run all examples"""
    ColorPrint.print_info("\n" + "=" * 80)
    ColorPrint.print_info(" SeleniumThread-Style Examples")
    ColorPrint.print_info(" (Showing similarity between SeleniumThread and NativeUIThread)")
    ColorPrint.print_info("=" * 80 + "\n")

    examples = [
        ("Basic Pattern", example_basic_pattern),
        ("Queue Communication", example_queue_communication),
        ("Custom Attributes", example_custom_attributes),
        ("Multiple Threads", example_multiple_threads)
    ]

    for i, (name, _) in enumerate(examples, 1):
        ColorPrint.print_info(f"  {i}. {name}")

    ColorPrint.print_info("\nSelect example (1-4) or 0 to run all: ", end="")

    try:
        choice = int(input())

        if choice == 0:
            for name, func in examples:
                ColorPrint.print_info(f"\n\nRunning: {name}\n")
                func()
                time.sleep(2)
        elif 1 <= choice <= len(examples):
            name, func = examples[choice - 1]
            ColorPrint.print_info(f"\n\nRunning: {name}\n")
            func()
        else:
            ColorPrint.print_error("Invalid choice")

    except ValueError:
        ColorPrint.print_error("Invalid input")
    except KeyboardInterrupt:
        ColorPrint.print_warn("\nInterrupted by user")

    ColorPrint.print_success("\nAll examples completed!")


if __name__ == '__main__':
    main()
