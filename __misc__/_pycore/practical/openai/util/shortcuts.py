import os
import time
import keyboard
from pycore.base.base import Base


class Shortcuts(Base):
    def __init__(self):
        super().__init__()
        self.shortcuts = {}
        self.is_listening = False

    def add_shortcut(self, shortcut, action, press_count=1, time_window=1, invalid_time=3):
        """Add a shortcut with specified action and press count."""
        if press_count > 1:
            self._attempt_binding(shortcut, self.increment_press, [action, press_count, time_window, invalid_time])
        else:
            self._attempt_binding(shortcut, self.execute_action, [action])

    def _attempt_binding(self, shortcut, method, args):
        """Attempt to bind a shortcut and handle the case where it's already in use."""
        try:
            keyboard.add_hotkey(shortcut, method, args=args)
            self.info(f"Bound shortcut: {shortcut}")
        except Exception as e:
            self.error(f"Failed to bind shortcut {shortcut}. Error: {str(e)}")
            self.info(f"Retrying to bind {shortcut} in 5 seconds...")
            time.sleep(5)
            self._attempt_binding(shortcut, method, args)

    def stop_listening(self):
        self.is_listening = False
        keyboard.unhook_all_hotkeys()
        self.success("Stopped listening for shortcuts.")

    def execute_action(self, action):
        try:
            self.info(f"Executing action: {action}")
            action()
        except Exception as e:
            self.error(f"Failed to execute action. Error: {str(e)}")

    def increment_press(self, action, press_count, time_window, invalid_time):
        """Handle logic for multiple presses within a time window."""
        current_time = time.time()
        if not hasattr(self, 'last_press_times'):
            self.last_press_times = {}

        if action not in self.last_press_times:
            self.last_press_times[action] = []

        press_times = self.last_press_times[action]

        # Remove presses outside the time window
        press_times = [t for t in press_times if current_time - t <= time_window]
        press_times.append(current_time)
        self.last_press_times[action] = press_times

        self.info(f"Press count for action {action.__name__}: {len(press_times)}")

        if len(press_times) >= press_count:
            self.execute_action(action)
            self.last_press_times[action] = []


shortcuts = Shortcuts()

if __name__ == "__main__":
    # Example usage
    shortcuts.add_shortcut('ctrl+alt+shift+a', lambda: print('Shortcut A activated'))
    shortcuts.add_shortcut('ctrl+alt+shift+s', lambda: print('Shortcut S activated 3 times'), press_count=3,
                           time_window=3, invalid_time=3)

    print("Press 'ctrl+alt+shift+s' 3 times within 3 seconds to activate the shortcut")

    # Keep the program running to listen for shortcuts
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        shortcuts.stop_listening()
