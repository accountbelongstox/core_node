import sys
import time
import os
from pycore.base.base import Base

class IncrementalPrinter(Base):
    def __init__(self):
        self._content = ""

    def initialize_screen(self):
        """Initialize the screen by clearing and resetting content."""
        self._content = ""
        self._clear_screen()

    def add_string(self, new_str):
        """Add a string and print incrementally."""
        self._content += new_str
        self._incremental_print()

    def get_printed_content(self):
        """Get all printed content."""
        return self._content

    def clear_screen(self):
        """Clear the screen."""
        self._clear_screen()

    def clear_content(self):
        """Clear the content."""
        self._content = ""

    def _clear_screen(self):
        """Clear the terminal screen."""
        os.system('cls' if os.name == 'nt' else 'clear')

    def _incremental_print(self):
        """Print content incrementally, clearing the screen first."""
        self._clear_screen()
        sys.stdout.write(self._content)
        sys.stdout.flush()

increment_print = IncrementalPrinter()
