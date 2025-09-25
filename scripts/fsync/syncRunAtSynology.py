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
import shutil
import time
from datetime import datetime
import sys

# Initialize counters
total_files = 0
copied_files = 0
skipped_files = 0
error_files = 0
skipped_dirs = 0
copied_bytes = 0
skipped_bytes = 0
start_time = datetime.now()
skipped_dir_names = set()
processed_files = 0

# Paths
source_path = "/volume1/web"
target_path = "/volume1/workdir/web"

# Directories to skip (case insensitive)
skip_directories = {"node_modules", "vendor", "bin", "obj", "packages", ".git", ".vs", ".idea"}

class PrintManager:
    def __init__(self):
        self.start_time = datetime.now()
        
    def clear_line(self, prompt_length=0):
        """Clear the current line in console"""
        print("\r" + " " * (prompt_length + 30) + "\r", end="", flush=True)
        
    def print_progress(self, operation, file_path, is_success, file_size, current_count, total_count, copied_bytes, skipped_bytes):
        """Print progress information"""
        elapsed = datetime.now() - self.start_time
        status = "SUCCESS" if is_success else "FAILED"
        percent_complete = (current_count / total_count) * 100 if total_count > 0 else 0
        
        # Calculate throughput
        throughput = (copied_bytes / (1024 * 1024)) / elapsed.total_seconds() if elapsed.total_seconds() > 0 else 0
        
        # Format sizes
        copied_gb = copied_bytes / (1024 ** 3)
        skipped_gb = skipped_bytes / (1024 ** 3)
        
        print(f"\r[{datetime.now().strftime('%H:%M:%S')}] {status} {operation} - {file_path} ({file_size/(1024*1024):.2f} MB) | "
              f"Copied: {copied_gb:.2f} GB | Skipped: {skipped_gb:.2f} GB | "
              f"{throughput:.1f} MB/s | {percent_complete:.1f}% ", end="", flush=True)

    def print_directory(self, path, indent=0):
        """Print directory structure"""
        try:
            for item in os.listdir(path):
                full_path = os.path.join(path, item)
                if os.path.isdir(full_path):
                    print('  ' * indent + f"📁 {item}")
                    self.print_directory(full_path, indent + 1)
                else:
                    print('  ' * indent + f"📄 {item}")
        except PermissionError:
            print('  ' * indent + "⚠️ [Permission denied]")

    def print_start_info(self, source_path, target_path, skip_directories):
        """Print initial synchronization information"""
        print("Starting file synchronization")
        print(f"Source: {source_path}")
        print(f"Target: {target_path}")
        print(f"Skipping directories: {', '.join(sorted(skip_directories))}")
        print("-" * 50)
        
        print("\nSource directory structure preview:")
        self.print_directory(source_path)
        print("\nTarget directory structure preview:")
        self.print_directory(target_path)

    def print_summary(self, end_time, total_files, copied_files, skipped_files, error_files,
                     copied_bytes, skipped_bytes, skipped_dirs, skipped_dir_names):
        """Print summary of synchronization"""
        total_time = end_time - self.start_time
        
        # Format sizes
        copied_gb = copied_bytes / (1024 ** 3)
        skipped_gb = skipped_bytes / (1024 ** 3)
        total_gb = (copied_bytes + skipped_bytes) / (1024 ** 3)
        
        print("\n" + "-" * 50)
        print(f"Synchronization completed at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Total processing time: {total_time}")
        print("-" * 50)
        print("Files Statistics:")
        print(f"  Total files scanned: {total_files}")
        print(f"  Files copied: {copied_files} ({copied_gb:.2f} GB)")
        print(f"  Files skipped: {skipped_files} ({skipped_gb:.2f} GB)")
        print(f"  Files with errors: {error_files}")
        print(f"  Total processed: {copied_files + skipped_files} ({total_gb:.2f} GB)")
        print("\nDirectory Statistics:")
        print(f"  Skipped directories: {skipped_dirs}")
        print(f"  Skipped directory types: {', '.join(sorted(skipped_dir_names))}")
        print("-" * 50)

    def print_countdown(self, seconds):
        """Print countdown with cancel option"""
        prompt = "Starting synchronization in"
        for i in range(seconds, 0, -1):
            print(f"\r{prompt} ({i} seconds) Press 'n' to cancel... ", end="", flush=True)
            if sys.stdin in select.select([sys.stdin], [], [], 0)[0]:
                if sys.stdin.read(1).lower() == 'n':
                    print("\nOperation cancelled by user.")
                    sys.exit(0)
            time.sleep(1)
        self.clear_line(len(prompt))

# Initialize printer
printer = PrintManager()

def get_file_size(file_path):
    """Get file size in bytes"""
    try:
        return os.path.getsize(file_path)
    except OSError:
        print(f"Error reading file size: {file_path}", file=sys.stderr)
        return None

def should_skip_path(path):
    """Check if path should be skipped"""
    path_parts = path.split(os.sep)
    for part in path_parts:
        if part.lower() in skip_directories:
            skipped_dir_names.add(part)
            return True
    return False

def files_are_identical(source_file, target_file):
    """Compare two files by size"""
    source_size = get_file_size(source_file)
    if source_size is None:
        return False
    
    try:
        target_size = get_file_size(target_file)
    except OSError:
        return False
    
    return source_size == target_size

def copy_file_with_retry(source, destination, file_size):
    """Copy file with retry logic"""
    max_retries = 3
    retry_count = 0
    
    # Ensure target directory exists
    target_dir = os.path.dirname(destination)
    os.makedirs(target_dir, exist_ok=True)
    
    while retry_count < max_retries:
        try:
            shutil.copy2(source, destination)
            global copied_bytes
            copied_bytes += file_size
            return True
        except Exception as e:
            retry_count += 1
            if retry_count >= max_retries:
                print(f"Failed to copy file after {max_retries} attempts: {source}", file=sys.stderr)
                return False
            time.sleep(1 * retry_count)
    
    return False

def sync_files(source_root, target_root):
    """Main synchronization function"""
    global total_files, copied_files, skipped_files, error_files, skipped_dirs, skipped_bytes, processed_files
    
    # Get all files recursively from source
    source_files = []
    for root, dirs, files in os.walk(source_root):
        # Skip directories we don't want to process
        dirs[:] = [d for d in dirs if d.lower() not in skip_directories]
        
        for file in files:
            file_path = os.path.join(root, file)
            if not should_skip_path(file_path):
                source_files.append(file_path)
            else:
                skipped_dirs += 1
    
    total_files = len(source_files)
    current_count = 0
    
    for source_file in source_files:
        current_count += 1
        processed_files = current_count
        relative_path = os.path.relpath(source_file, source_root)
        target_file = os.path.join(target_root, relative_path)
        
        try:
            file_size = get_file_size(source_file)
            if file_size is None:
                error_files += 1
                printer.print_progress("ERROR", relative_path, False, 0, current_count, total_files, copied_bytes, skipped_bytes)
                continue
            
            if os.path.exists(target_file) and files_are_identical(source_file, target_file):
                skipped_files += 1
                skipped_bytes += file_size
                printer.print_progress("SKIPPED", relative_path, True, file_size, current_count, total_files, copied_bytes, skipped_bytes)
                continue
            
            copy_result = copy_file_with_retry(source_file, target_file, file_size)
            
            if copy_result:
                copied_files += 1
                printer.print_progress("COPIED", relative_path, True, file_size, current_count, total_files, copied_bytes, skipped_bytes)
            else:
                error_files += 1
                printer.print_progress("COPY FAILED", relative_path, False, file_size, current_count, total_files, copied_bytes, skipped_bytes)
        except Exception as e:
            error_files += 1
            printer.print_progress("ERROR PROCESSING", relative_path, False, file_size if 'file_size' in locals() else 0, 
                                 current_count, total_files, copied_bytes, skipped_bytes)
            print(f"\nError processing file: {e}", file=sys.stderr)

if __name__ == "__main__":
    printer.print_start_info(source_path, target_path, skip_directories)
    
    # Countdown with cancel option
    try:
        import select
        printer.print_countdown(3)
    except ImportError:
        print("\nStarting synchronization in 3 seconds...")
        time.sleep(3)
    
    sync_files(source_path, target_path)
    
    # Print final summary
    printer.print_summary(
        datetime.now(),
        total_files,
        copied_files,
        skipped_files,
        error_files,
        copied_bytes,
        skipped_bytes,
        skipped_dirs,
        skipped_dir_names
    )