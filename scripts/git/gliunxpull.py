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

import os
import subprocess
import re
import platform
import sys
import stat

def fix_line_endings(file_path):
    """
    Convert Windows line endings (CRLF) to Unix line endings (LF) in a file.
    """
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        
        # Convert CRLF to LF
        content = content.replace(b'\r\n', b'\n')
        
        with open(file_path, 'wb') as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"Error fixing line endings for {file_path}: {str(e)}")
        return False

def set_file_permissions():
    """
    Recursively scan the workspace directory and set permissions for specific file types.
    Excludes common build and dependency directories.
    """
    # Get the workspace directory (two levels up from script location)
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    
    # Define directories to exclude
    exclude_dirs = {
        'node_modules',
        '.git',
        '__pycache__',
        'build',
        'dist',
        '.dart_tool',
        '.flutter-plugins',
        '.flutter-plugins-dependencies',
        'target',
        '.idea',
        '.vscode',
        'venv',
        'env',
        '.env',
        'bin',
        'obj',
        '.next',
        'out',
        'coverage',
        '.cache'
    }
    
    # Define file extensions to set permissions for
    target_extensions = {'.sh'}
    
    # Track processed files and skipped directories
    processed_files = []
    skipped_dirs = []
    fixed_files = []
    
    def should_exclude(path):
        """Check if a path should be excluded based on directory name"""
        path_parts = path.split(os.sep)
        return any(part in exclude_dirs for part in path_parts)
    
    def set_permissions(file_path):
        """Set file permissions to 777 and fix line endings"""
        try:
            # First fix line endings
            if fix_line_endings(file_path):
                fixed_files.append(file_path)
            
            # Then set permissions
            os.chmod(file_path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)
            return True
        except Exception as e:
            print(f"Error setting permissions for {file_path}: {str(e)}")
            return False
    
    print("\nScanning directory for file permission updates...")
    print("---------------------------------------------")
    
    for root, dirs, files in os.walk(workspace_dir):
        # Skip excluded directories
        if should_exclude(root):
            skipped_dirs.append(root)
            continue
        
        for file in files:
            file_path = os.path.join(root, file)
            _, ext = os.path.splitext(file)
            
            if ext.lower() in target_extensions:
                if set_permissions(file_path):
                    processed_files.append(file_path)
    
    # Print summary
    print("\nPermission Update Summary:")
    print("---------------------------------------------")
    print("\nSkipped Directories:")
    for dir_path in skipped_dirs:
        print(f"- {os.path.relpath(dir_path, workspace_dir)}")
    
    print("\nFiles with Fixed Line Endings:")
    for file_path in fixed_files:
        print(f"- {os.path.relpath(file_path, workspace_dir)}")
    
    print("\nFiles with Updated Permissions:")
    for file_path in processed_files:
        print(f"- {os.path.relpath(file_path, workspace_dir)}")
    
    print(f"\nTotal files processed: {len(processed_files)}")
    print(f"Total files fixed: {len(fixed_files)}")
    print(f"Total directories skipped: {len(skipped_dirs)}")
    print("---------------------------------------------")

def execute_command(command, capture_output=True, print_output=True, check_returncode=True):
    """
    Execute a command in a cross-platform way.
    
    Args:
        command (str or list): Command to execute. If str, will be split into list.
        capture_output (bool): Whether to capture command output
        print_output (bool): Whether to print command output in real-time
        check_returncode (bool): Whether to raise exception on non-zero return code
    
    Returns:
        tuple: (returncode, stdout, stderr) if capture_output is True
               (returncode, None, None) if capture_output is False
    """
    # Convert string command to list if needed
    if isinstance(command, str):
        # Special handling for git commit message to preserve quotes
        if command.startswith('git commit'):
            parts = command.split(' ', 2)
            command = [parts[0], parts[1], parts[2]]
        else:
            command = command.split()
    
    # Set up process creation flags based on OS
    creation_flags = 0
    if platform.system() == 'Windows':
        creation_flags = subprocess.CREATE_NO_WINDOW
    
    try:
        if capture_output:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=creation_flags
            )
            
            stdout, stderr = process.communicate()
            
            if print_output:
                if stdout:
                    print(stdout, end='')
                if stderr:
                    print(stderr, end='', file=sys.stderr)
            
            if check_returncode and process.returncode != 0:
                raise subprocess.CalledProcessError(
                    process.returncode,
                    command,
                    stdout,
                    stderr
                )
            
            return process.returncode, stdout, stderr
        else:
            process = subprocess.Popen(
                command,
                creationflags=creation_flags
            )
            process.wait()
            
            if check_returncode and process.returncode != 0:
                raise subprocess.CalledProcessError(
                    process.returncode,
                    command
                )
            
            return process.returncode, None, None
            
    except subprocess.CalledProcessError as e:
        print(f"Command failed with return code {e.returncode}")
        if e.output:
            print(f"Output: {e.output}")
        if e.stderr:
            print(f"Error: {e.stderr}", file=sys.stderr)
        raise
    except Exception as e:
        print(f"Error executing command: {str(e)}", file=sys.stderr)
        raise

def change_to_parent_dir():
    """Change to the parent directory of the script's location"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.abspath(os.path.join(script_dir, '../..'))
    os.chdir(parent_dir)
    print(f"Current working directory: {os.getcwd()}")
    return parent_dir

def git_commit():
    """Perform git add and commit"""
    try:
        # First check if there are any changes to commit
        _, status_output, _ = execute_command('git status --porcelain')
        if not status_output.strip():
            print("No changes to commit.")
            return False
        
        # Add all changes
        execute_command('git add .', capture_output=False)
        
        # Commit with proper message handling
        commit_message = "Auto commit before pull"
        execute_command(['git', 'commit', '-m', commit_message], capture_output=False)
        print("Changes committed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Git commit failed: {str(e)}")
        # Don't raise the exception, continue with the script
        return False
    return True

def git_pull():
    """Perform git pull with --no-ff and return the output"""
    try:
        _, stdout, stderr = execute_command('git pull --no-ff')
        return stdout + stderr
    except subprocess.CalledProcessError as e:
        print(f"Git pull failed: {str(e)}")
        return e.stdout + e.stderr if e.stdout else str(e)

def handle_modify_delete_conflicts(pull_output):
    """Handle modify/delete conflicts by extracting paths and offering deletion"""
    conflict_pattern = r'CONFLICT \(modify/delete\): (.+?) deleted in'
    conflict_paths = re.findall(conflict_pattern, pull_output)
    
    if not conflict_paths:
        return False
    
    print("\nThe following files have conflicts and need to be deleted:")
    for path in conflict_paths:
        print(f"- {path}")
    
    response = input("\nDo you want to delete these files? (Y/N): ").strip().upper()
    if response != 'Y':
        print("\nOperation cancelled. Please resolve conflicts manually.")
        return False
    
    for path in conflict_paths:
        try:
            os.remove(path)
            print(f"Deleted: {path}")
        except Exception as e:
            print(f"Error deleting {path}: {str(e)}")
    
    return True

def handle_content_conflicts(pull_output):
    """Handle content conflicts (to be implemented for other conflict types)"""
    # TODO: Implement handling for other types of conflicts
    return False

def resolve_conflicts(pull_output):
    """Main conflict resolution function that delegates to specific handlers"""
    if 'CONFLICT (modify/delete):' in pull_output:
        return handle_modify_delete_conflicts(pull_output)
    elif 'CONFLICT (content):' in pull_output:
        return handle_content_conflicts(pull_output)
    return False

def main():
    try:
        # Change to parent directory
        change_to_parent_dir()
        
        
        # First pull attempt
        pull_output = git_pull()
        
        # Check for conflicts and resolve if necessary
        if 'CONFLICT' in pull_output:
            if resolve_conflicts(pull_output):
                # After resolving conflicts, add changes and try pull again
                execute_command('git add .', capture_output=False)
                pull_output = git_pull()
                if 'CONFLICT' not in pull_output:
                    print("\nPull successful after resolving conflicts!")
                else:
                    print("\nThere are still conflicts remaining. Please resolve them manually.")
        else:
            print("\nPull completed successfully!")
        
        # Set file permissions after successful git operations
        set_file_permissions()
        
    except Exception as e:
        print(f"\nAn error occurred: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
