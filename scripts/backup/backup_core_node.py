
import os
import shutil
import datetime
import threading
import time
import sys

def backup_directory_with_exclusions():
    """
    Backs up a source directory to a new destination with a timestamp,
    excluding a predefined list of directories and showing a progress spinner.
    """
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Set directories relative to script location
    source_dir = os.path.join(script_dir, "..", "..")  # ../../ from script location
    backup_parent_dir = os.path.join(script_dir, "..", "..", "..")  # ../../../ from script location
    
    # Convert to absolute paths
    source_dir = os.path.abspath(source_dir)
    backup_parent_dir = os.path.abspath(backup_parent_dir)

    ignored_directories = {
        'node_modules', 
        '__pycache__', 
        '.cache', 
        'tmp',
        'temp',
        '.tmp',
        '.temp',
        'logs',
        '.logs',
        'log',
        '.log',
        '.DS_Store',
        'Thumbs.db',
        'venv',
        'target',  # Rust
        '.cargo',  # Rust
        'vendor',  # PHP
        'storage/logs',  # Laravel
        'bootstrap/cache',  # Laravel
        '.nuxt',  # Nuxt.js
        '.next',  # Next.js
        '.output',  # Nuxt.js
        'android/app/build',  # Flutter
        'ios/build',  # Flutter
        '.dart_tool',  # Dart
        'bin',  # Binary directories
        'obj',  # Object files
    }

    def ignore_func(directory, contents):
        ignored_items = set()
        for item in contents:
            item_path = os.path.join(directory, item)
            
            # Check if it's a directory and should be ignored
            if os.path.isdir(item_path):
                # Direct directory name match
                if item in ignored_directories:
                    ignored_items.add(item)
                    continue
                
                # Check for path-based patterns (like 'storage/logs')
                relative_path = os.path.relpath(item_path, source_dir)
                if relative_path in ignored_directories:
                    ignored_items.add(item)
                    continue
                
                # Check if any parent directory is in the ignore list
                path_parts = relative_path.split(os.sep)
                for i in range(len(path_parts)):
                    partial_path = os.sep.join(path_parts[:i+1])
                    if partial_path in ignored_directories:
                        ignored_items.add(item)
                        break
                        
        return ignored_items

    # Print directories and get confirmation
    print("=== Backup Configuration ===")
    print(f"Script location: {script_dir}")
    print(f"Source directory (../../): {source_dir}")
    print(f"Backup storage directory (../../../): {backup_parent_dir}")
    print()
    
    if not os.path.isdir(source_dir):
        print(f"Error: Source directory not found at '{source_dir}'")
        return
    
    if not os.path.isdir(backup_parent_dir):
        print(f"Error: Backup storage directory not found at '{backup_parent_dir}'")
        return

    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    destination_dir_name = f"core_node_bak_{timestamp_str}"
    destination_dir = os.path.join(backup_parent_dir, destination_dir_name)

    print("=== Backup Details ===")
    print(f"Source to backup: {source_dir}")
    print(f"Backup will be saved to: {destination_dir}")
    print(f"Ignoring directories: {', '.join(ignored_directories)}")
    print()
    
    # Get user confirmation
    response = input("Press 'y' to continue with backup, any other key to cancel: ")
    if response.lower() != 'y':
        print("Backup cancelled by user.")
        return
    
    print("Starting backup...")

    # --- Threading for progress spinner ---
    thread_state = {'error': None}

    def do_copy():
        try:
            shutil.copytree(
                source_dir,
                destination_dir,
                ignore=ignore_func
            )
        except Exception as e:
            thread_state['error'] = e

    backup_thread = threading.Thread(target=do_copy)
    backup_thread.start()

    spinner = ['|', '/', '-', '\\']
    i = 0
    while backup_thread.is_alive():
        # \r moves the cursor to the beginning of the line
        sys.stdout.write(f'\rProcessing... {spinner[i % len(spinner)]}')
        sys.stdout.flush()
        time.sleep(0.1)
        i += 1
    
    backup_thread.join() # Wait for the thread to finish completely

    # Clear the spinner line
    sys.stdout.write('\r' + ' ' * 30 + '\r') 
    sys.stdout.flush()

    if thread_state['error']:
        print(f"An unexpected error occurred: {thread_state['error']}")
    else:
        print("Backup completed successfully!")

if __name__ == "__main__":
    backup_directory_with_exclusions()
