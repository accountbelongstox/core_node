# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

import sys
from typing import Union, List
from colorama import init, Fore, Style
import inspect
from provider import build_provider
import pprint
import os

init(autoreset=True)  # Initialize colorama with auto-reset

class Print:
    """
    Printing utility class supporting various print methods
    """
    
    @staticmethod
    def _clear_line() -> None:
        """
        Clear the current line and move cursor to the beginning
        """
        sys.stdout.write('\r')  # Move to start of line
        sys.stdout.write('\033[K')  # Clear line
        sys.stdout.flush()
    
    @staticmethod
    def print_single_line(*msgs: Union[str, List[str]], end: str = '\r') -> None:
        """
        Print message(s) on a single line, clearing previous content
        :param msgs: One or more messages to print
        :param end: End character (default: \r for carriage return)
        """
        message = " ".join(str(msg) for msg in msgs)
        print(f"{Fore.WHITE}{Style.BRIGHT}{message}{Style.RESET_ALL}", end=end)
        sys.stdout.flush()
    
    @staticmethod
    def print_single_line_info(*msgs: Union[str, List[str]], end: str = '\r') -> None:
        """
        Print info message(s) on a single line, clearing previous content
        :param msgs: One or more messages to print
        :param end: End character (default: \r for carriage return)
        """
        Print._clear_line()
        message = " ".join(str(msg).replace('\n', ' ') for msg in msgs)
        print(f"{Fore.BLUE}{Style.BRIGHT}[INFO] {message}{Style.RESET_ALL}", end=end)
        sys.stdout.flush()
    
    @staticmethod
    def print_single_line_warn(*msgs: Union[str, List[str]], end: str = '\r') -> None:
        """
        Print warning message(s) on a single line, clearing previous content
        :param msgs: One or more messages to print
        :param end: End character (default: \r for carriage return)
        """
        Print._clear_line()
        message = " ".join(str(msg).replace('\n', ' ') for msg in msgs)
        print(f"{Fore.YELLOW}{Style.BRIGHT}[WARN] {message}{Style.RESET_ALL}", end=end)
        sys.stdout.flush()
    
    @staticmethod
    def print_single_line_success(*msgs: Union[str, List[str]], end: str = '\r') -> None:
        """
        Print success message(s) on a single line, clearing previous content
        :param msgs: One or more messages to print
        :param end: End character (default: \r for carriage return)
        """
        Print._clear_line()
        message = " ".join(str(msg).replace('\n', ' ') for msg in msgs)
        print(f"{Fore.GREEN}{Style.BRIGHT}[SUCCESS] {message}{Style.RESET_ALL}", end=end)
        sys.stdout.flush()
    
    @staticmethod
    def print_single_line_error(*msgs: Union[str, List[str]], end: str = '\r') -> None:
        """
        Print error message(s) on a single line, clearing previous content
        :param msgs: One or more messages to print
        :param end: End character (default: \r for carriage return)
        """
        Print._clear_line()
        message = " ".join(str(msg).replace('\n', ' ') for msg in msgs)
        print(f"{Fore.RED}{Style.BRIGHT}[ERROR] {message}{Style.RESET_ALL}", end=end)
        sys.stdout.flush()
    
    @staticmethod
    def print_build_provider_exports() -> None:
        """
        Print all exported variables from build_provider.py, excluding those with certain keys
        """
        # Get all variables defined in the build_provider module
        module_vars = inspect.getmembers(build_provider)
        
        # Filter out global variables and exclude certain keys
        exclude_keys = ['Enum', 'FLUTTER_SKIP_PATTERNS', 'IconSpec', 'List', 
                        'dataclass', 'os', 'Path', 'pathlib', 'sys', 
                        'DENSITY_SPECS', 'DensityType', 
                        ]
        def should_include(var_name):
            for key in exclude_keys:
                if key in var_name:
                    return False
            return not var_name.startswith('_')
        global_vars = [var for var in module_vars if should_include(var[0])]
        
        Print.info("Build Provider Exports:")
        
        # Print variables
        for name, value in global_vars:
            # Use different colors based on variable type
            if isinstance(value, str):
                color = Fore.BLUE
                value_str = f"'{value}'"
            elif isinstance(value, list):
                color = Fore.GREEN
                value_str = f"[{', '.join(f'\"{item}\"' for item in value)}]"
            else:
                color = Fore.CYAN
                value_str = str(value)
            
            Print._print(color, f"{name}: {value_str}")
    
    @staticmethod
    def info(*msgs: Union[str, List[str]]) -> None:
        """
        Print info message(s)
        :param msgs: One or more messages to print
        """
        Print._print(Fore.BLUE, f"[INFO] {' '.join(str(msg) for msg in msgs)}")
    
    @staticmethod
    def warn(*msgs: Union[str, List[str]]) -> None:
        """
        Print warning message(s)
        :param msgs: One or more messages to print
        """
        Print._print(Fore.YELLOW, f"[WARN] {' '.join(str(msg) for msg in msgs)}")
    
    @staticmethod
    def success(*msgs: Union[str, List[str]]) -> None:
        """
        Print success message(s)
        :param msgs: One or more messages to print
        """
        Print._print(Fore.GREEN, f"[SUCCESS] {' '.join(str(msg) for msg in msgs)}")
    
    @staticmethod
    def debug(*msgs: Union[str, List[str]]) -> None:
        """
        Print debug message(s)
        :param msgs: One or more messages to print
        """
        Print._print(Fore.CYAN, f"[DEBUG] {' '.join(str(msg) for msg in msgs)}")
    
    @staticmethod
    def error(*msgs: Union[str, List[str]]) -> None:
        """
        Print error message(s)
        :param msgs: One or more messages to print
        """
        Print._print(Fore.RED, f"[ERROR] {' '.join(str(msg) for msg in msgs)}")
    
    @staticmethod
    def note(*msgs: Union[str, List[str]]) -> None:
        """
        Print note message(s)
        :param msgs: One or more messages to print
        """
        Print._print(Fore.WHITE, f"[NOTE] {' '.join(str(msg) for msg in msgs)}")
    
    @staticmethod
    def _print(color: str, message: str) -> None:
        """
        Internal print method
        :param color: Text color
        :param message: Message to print
        """
        print(f"{color}{Style.BRIGHT}{message}{Style.RESET_ALL}")

    @staticmethod
    def print_build_provider_variable(var_name: str) -> None:
        """
        Print a specific variable from build_provider
        :param var_name: Name of the variable to print
        """
        try:
            # Get the variable value
            value = getattr(build_provider, var_name)
            
            # Print header
            Print.info(f"\nVariable: {var_name}")
            Print.info("=" * 50)
            
            # Print value with appropriate formatting
            if isinstance(value, str):
                Print.info(f"Type: String")
                Print.info(f"Value: '{value}'")
            elif isinstance(value, list):
                Print.info(f"Type: List")
                Print.info(f"Length: {len(value)}")
                Print.info("Values:")
                for item in value:
                    Print.info(f"  - {item}")
            elif isinstance(value, (int, float, bool)):
                Print.info(f"Type: {type(value).__name__}")
                Print.info(f"Value: {value}")
            else:
                Print.info(f"Type: {type(value).__name__}")
                Print.info(f"Value: {value}")
                
            Print.info("=" * 50)
            
        except AttributeError:
            Print.error(f"Variable '{var_name}' not found in build_provider")
        except Exception as e:
            Print.error(f"Error showing variable: {str(e)}")

    @staticmethod
    def pretty_print(obj):
        pprint.pprint(obj)

    @staticmethod
    def print_categorized_items(items: list, category_func=None, title: str = "Items", color: str = Fore.BLUE) -> None:
        """
        Print items categorized by a function, showing one example per category and a summary.
        :param items: List of items to categorize and print
        :param category_func: Function to get category from item (default: file extension)
        :param title: Title for the output
        :param color: Color to use for printing
        """
        if not items:
            Print.info(f"No {title.lower()} to display")
            return

        # Default category function gets file extension
        if category_func is None:
            def category_func(item):
                return os.path.splitext(item)[1] or "no_extension"

        # Categorize items
        categories = {}
        for item in items:
            category = category_func(item)
            if category not in categories:
                categories[category] = []
            categories[category].append(item)

        # Print header
        Print._print(color, f"\n{title}:")
        Print._print(color, "=" * 80)

        # Print one example per category with count
        for category, items in categories.items():
            example = items[0]
            count = len(items)
            if count == 1:
                Print._print(color, f"{category}: {example}")
            else:
                Print._print(color, f"{category}: {example} (and {count-1} more)")

        # Print summary
        Print._print(color, "-" * 80)
        total = sum(len(items) for items in categories.values())
        Print._print(color, f"Total {title.lower()}: {total}")

# Example usage
if __name__ == "__main__":
    # Test single line printing
    for i in range(5):
        Print.print_single_line(f"Processing item {i}...")
        import time
        time.sleep(0.5)
    print()  # New line after loop
    
    # Test single line info printing
    for i in range(5):
        Print.print_single_line_info(f"Processing item {i}...")
        time.sleep(0.5)
    print()  # New line after loop
    
    # Regular printing examples
    Print.info("This is an info message")
    Print.warn("This is a warning message")
    Print.success("This is a success message")
    Print.debug("This is a debug message")
    Print.error("This is an error message")
    Print.note("This is a note message")
    
    # Support multiple messages
    Print.info("First part", "Second part", "Third part")
    
    # Print exported variables from build_provider
    Print.print_build_provider_exports()