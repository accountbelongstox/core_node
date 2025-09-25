import os
import shutil
from datetime import datetime

def cleanup_backup_files():
    """
    Scans for '.backup' files, prompts the user for confirmation, and moves them
    to a timestamped directory in the project's .cache folder, preserving the
    original directory structure.
    """
    # The script is in /scripts/project_cleanup, so the project root is two levels up.
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    
    # Define the destination for backups within the .cache directory
    cache_root = os.path.join(project_root, '.cache', 'backups')
    
    # Directories to skip during the scan
    exclude_dirs = {
        'node_modules', '.git', '.cache', '.idea', '.vscode', 'tmp', 
        'dist', 'build', 'vendor', '__pycache__'
    }

    backup_files = []
    print(f"Starting scan in project directory: {project_root}")
    print(f"Skipping the following directories: { ', '.join(exclude_dirs)}\n")

    for root, dirs, files in os.walk(project_root, topdown=True):
        # Efficiently prune the directories to be searched
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if file.endswith('.backup'):
                full_path = os.path.join(root, file)
                backup_files.append(full_path)

    if not backup_files:
        print("No .backup files found.")
        return

    print("Found the following .backup files:")
    for f in backup_files:
        print(f"  - {os.path.relpath(f, project_root)}")

    try:
        choice = input("\nMove these files to the .cache/backups/ directory? (Y/N): ").strip().upper()
    except (EOFError, KeyboardInterrupt):
        print("\n\nOperation cancelled.")
        return


    if choice == 'Y':
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        backup_dest_dir = os.path.join(cache_root, timestamp)
        
        print(f"\nMoving files to: {backup_dest_dir}")

        for src_path in backup_files:
            # Calculate the relative path to preserve the directory structure
            relative_path = os.path.relpath(src_path, project_root)
            dest_path = os.path.join(backup_dest_dir, relative_path)
            
            # Create the destination subdirectory if it doesn't exist
            dest_dir = os.path.dirname(dest_path)
            os.makedirs(dest_dir, exist_ok=True)
            
            # Move the file
            try:
                shutil.move(src_path, dest_path)
                print(f"  - Moved: {relative_path}")
            except Exception as e:
                print(f"  - Error moving file {src_path}: {e}")
        
        print("\nCleanup complete.")
    else:
        print("Operation cancelled.")

if __name__ == '__main__':
    cleanup_backup_files()