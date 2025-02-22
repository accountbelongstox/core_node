import os
import shutil
import sys
from pathlib import Path
from colorama import Fore, Style, init
from datetime import datetime  # 添加在 import 部分

# Initialize colorama for colored output
init(autoreset=True)

# Target directory for storing the moved folders
TARGET_DIR = r"D:\CDriveRedirect"

# PowerShell script file to retry failed symlinks
PS_SCRIPT_PATH = os.path.join(os.path.expanduser("~"), "Desktop", "fix_symlinks.ps1")

# List of C drive directories with scan options
DIRS = [
    {"path": r"C:", "scan_level": 0},
    {"path": r"C:\Users\NON-M\AppData", "scan_level": 2},
    {"path": r"C:\ProgramData", "scan_level": 1},
    {"path": r"C:\Program Files (x86)", "scan_level": 1},
    {"path": r"C:\Program Files", "scan_level": 0},
    {"path": r"C:\Microsoft", "scan_level": 0}
]

def ensure_directory_exists(path):
    """Ensure the target directory exists."""
    try:
        os.makedirs(path, exist_ok=True)
    except Exception as e:
        print(Fore.YELLOW + f"⚠ Error creating directory {trim_dir_string(path)}: {e}")

def file_needs_copy(src, dest):
    """Check if the destination file needs to be copied (size mismatch or missing)."""
    return not os.path.exists(dest) or os.path.getsize(src) != os.path.getsize(dest)

def print_progress(message, new_line=False,not_trim=False):
    """Unified progress printer with line control"""
    message = message[:150] if not_trim else message
    prefix = "\n" if new_line else "\r"
    message = pad_string_to_terminal_width(f"{prefix}{message}   ")
    sys.stdout.write(message)
    sys.stdout.flush()

def copy_folder(source, destination):
    """Copy files from source to destination with real-time progress updates."""
    if not os.path.exists(source):
        print_progress(Fore.YELLOW + f"⚠ Skipping missing directory: {trim_dir_string(source)}")
        return

    ensure_directory_exists(destination)

    total_files = sum(len(files) for _, _, files in os.walk(source))
    copied_files = 0

    for root, _, files in os.walk(source):
        rel_path = os.path.relpath(root, source)
        target_path = os.path.join(destination, rel_path)
        ensure_directory_exists(target_path)

        for file in files:
            src_file = os.path.join(root, file)
            dest_file = os.path.join(target_path, file)

            try:
                copied_files += 1
                if file_needs_copy(src_file, dest_file):
                    shutil.copy2(src_file, dest_file)
                    status_msg = f"{Fore.GREEN}✔ Copying ({copied_files}/{total_files}): {trim_dir_string(src_file)}"
                else:
                    status_msg = f"{Style.DIM}⚡ Skipping (same size): {trim_dir_string(src_file)}"

                print_progress(status_msg)
            except Exception as e:
                print_progress(f"\n{Fore.RED}❌ Error copying {trim_dir_string(src_file)}: {e}",not_trim=True)

    print_progress(f"{Fore.GREEN}✔ Completed copying {trim_dir_string(source)} -> {trim_dir_string(destination)}")

def trim_dir_string(dir_string):
    max_length = 40
    path = Path(dir_string)
    name = path.name
    return name[:max_length] + "..." if len(name) > max_length else name

def pad_string_to_terminal_width(text):
    tw = shutil.get_terminal_size().columns
    pl = tw - len(text) - 1
    if pl > 0 :
        ptext = text + " " * pl
    else:
        ptext = text[:tw]
    return ptext

def replace_with_symlink(source, destination):
    """Replace directory with symlink and log failures immediately"""
    try:
        print_progress(Fore.YELLOW + f"⚠ Removing: {trim_dir_string(source)}", new_line=True)
        shutil.rmtree(source, ignore_errors=True)
        print_progress(Fore.YELLOW + f"⚠ Removed original: {trim_dir_string(source)}")
        
        os.symlink(destination, source, target_is_directory=True)
        print_progress(Fore.GREEN + f"✔ Created symlink: {trim_dir_string(source)} -> {trim_dir_string(destination)}", new_line=True)
        
    except Exception as e:
        print_progress(Fore.RED + f"❌ Error processing {trim_dir_string(source)}: {e}", new_line=True,not_trim=True)
        
        # Generate PowerShell command immediately
        ps_cmd = f'New-Item -ItemType SymbolicLink -Path "{trim_dir_string(source)}" -Target "{trim_dir_string(destination)}"'
        try:
            # Create script file if not exists with header
            if not os.path.exists(PS_SCRIPT_PATH):
                with open(PS_SCRIPT_PATH, "w", encoding="utf-8") as f:
                    f.write("# Run as Administrator to create symbolic links\n")
                    f.write("Set-ExecutionPolicy Unrestricted -Scope Process -Force\n\n")
            
            # Append the new command
            with open(PS_SCRIPT_PATH, "a", encoding="utf-8") as f:
                f.write(f"{ps_cmd}\n")
                
            print_progress(Fore.YELLOW + f"⚠ Added to retry script: {trim_dir_string(PS_SCRIPT_PATH)}", new_line=True)
        except Exception as write_error:
            print_progress(Fore.RED + f"❌ Failed to update script: {write_error}", new_line=True)

def is_symlink(p):
    return os.path.islink(p)

def check_and_remove_invalid_link(p):
    try:
        path = Path(p)
        target_dir = path.resolve()
        if not target_dir.exists():
            path.unlink()
    except Exception as e:
        print_progress(Fore.YELLOW + f"⚠ Check symlink: {trim_dir_string(p)} {e}")
        pass
def delete_dir(p):
    ends = ["_deleting"]
    try:
        path = Path(p)
        name = path.name
        if name in ends:
            shutil.rmtree(path)
    except Exception as e:
        print_progress(Fore.YELLOW + f"⚠ Delete OldFolder: {trim_dir_string(p)} {e}")
        pass
 
def remove_temp_suffix(p):
    path = Path(p)
    origin_path_name = path.name
    while path.name.endswith("_temp"):
        path = path.with_name(path.name[:-5])
    exists = path.exists()
    npath = path.resolve()
    is_continue = False
    if exists:
        path.with_name(origin_path_name)
        path.unlink()
        is_continue = True
    if not exists:
        os.rename(dir_path, npath)
        dir_path = npath
    return npath,is_continue
    
def test_rename_capability(dirs):
    """Test rename capability for all directories and subdirectories"""
    validated_entries = []
    
    for dir_entry in dirs:
        original_path = dir_entry["path"]
        scan_level = dir_entry.get("scan_level", 0)
        
        # Get all directories to process based on scan level
        directories_to_test = [original_path]  # Always include the root directory
        if scan_level > 0:
            directories_to_test = get_subdirs_with_depth(original_path, max_depth=scan_level)
        end_chars = ('_temp')
        delete_chars = ('_deleting')
        # Test each directory individually
        for dir_path in directories_to_test:
            if dir_path.endswith(end_chars):
                continue
            if dir_path.endswith(delete_chars):
                npath,is_continue = remove_temp_suffix(dir_path)
                if is_continue:
                    continue
                if not is_continue:
                    dir_path = npath
            if is_symlink(dir_path):
                check_and_remove_invalid_link(dir_path)
                continue
            entry = {
                "path": dir_path,
                "can_rename": False,
                "depth": get_path_depth(dir_path, original_path),
                "target_path": ""  # 新增目标路径字段
            }
            
            if not os.path.exists(dir_path):
                print_progress(Fore.YELLOW + f"⚠ Missing directory: {trim_dir_string(dir_path)}")
                validated_entries.append(entry)
                continue

            # Perform rename test
            try:
                test_path = dir_path + "_renametest"
                os.rename(dir_path, test_path)
                os.rename(test_path, dir_path)
                entry["can_rename"] = True
                print_progress(Fore.CYAN + f"✔ Rename test passed: {trim_dir_string(dir_path)}")
                
                drive, path_without_drive = os.path.splitdrive(dir_path)
                entry["target_path"] = os.path.join(TARGET_DIR, path_without_drive.lstrip(os.sep))
            except Exception as e:
                print_progress(Fore.RED + f"❌ Rename test failed: {trim_dir_string(dir_path)} ({str(e)})")
            
            validated_entries.append(entry)
    
    # Add summary report at the end
    print_summary_report(validated_entries)
    
    return validated_entries

def get_path_depth(full_path, base_path):
    """Calculate directory depth relative to original path"""
    relative_path = os.path.relpath(full_path, base_path)
    return len(relative_path.split(os.sep))

def get_subdirs_with_depth(root_path, max_depth=1, current_depth=1):
    """Recursively collect subdirectories up to specified depth"""
    subdirs = []
    try:
        with os.scandir(root_path) as it:
            for entry in it:
                if entry.is_dir():
                    subdirs.append(entry.path)
                    if current_depth < max_depth:
                        subdirs.extend(
                            get_subdirs_with_depth(
                                entry.path,
                                max_depth,
                                current_depth + 1
                            )
                        )
    except PermissionError:
        print_progress(Fore.YELLOW + f"⚠ No permission to scan: {root_path}")
    return subdirs

def process_directory(entry):
    """Process a single directory entry"""
    if not entry["can_rename"]:
        print_progress(Fore.YELLOW + f"⚠ Skipping: {trim_dir_string(entry['path'])}")
        return
    copy_folder(entry["path"], entry["target_path"])
    replace_with_symlink(entry["path"], entry["target_path"])

def print_summary_report(entries):
    """Print a formatted summary of directory test results"""
    # Statistics
    total = len(entries)
    success = sum(1 for e in entries if e["can_rename"])
    failures = total - success
    missing = sum(1 for e in entries if not os.path.exists(e["path"]))
    
    # Color helpers
    green = Fore.GREEN
    red = Fore.RED
    yellow = Fore.YELLOW
    reset = Style.RESET_ALL
    bold = Style.BRIGHT
    
    print(f"\n\n{bold}=== DIRECTORY TEST SUMMARY ==={reset}")
    print(f"{bold}Total directories checked:{reset} {total}")
    print(f"{green}Successfully renamed:{reset} {success} ({success/total:.1%})")
    print(f"{red}Failed renaming:{reset} {failures} ({failures/total:.1%})")
    print(f"{yellow}Missing directories:{reset} {missing}\n")
    
    # Group by depth
    depth_groups = {}
    for e in entries:
        depth = e["depth"]
        depth_groups.setdefault(depth, []).append(e)
    
    # Print tree structure
    print(f"{bold}Directory Structure:{reset}")
    for depth in sorted(depth_groups.keys()):
        print(f"\n{bold}Depth {depth}:{reset}")
        for e in depth_groups[depth]:
            status = green + "✓" if e["can_rename"] else red + "✗"
            if not os.path.exists(e["path"]):
                status = yellow + "∅"
            
            # 添加目标路径显示
            path_display = e['path']
            if e["can_rename"] and e["target_path"]:
                path_display += f"\n{'│   ' * (depth+1)}└─ {Fore.BLUE}➔{Style.RESET_ALL} {e['target_path']}"
            
            print(f"  {'│   ' * depth}├─ {status}{reset} {path_display}")
    
    # Print critical failures
    critical_failures = [e for e in entries if e["depth"]==0 and not e["can_rename"]]
    if critical_failures:
        print(f"\n{red}{bold}CRITICAL FAILURES (root directories):{reset}")
        for e in critical_failures:
            print(f"  {red}➔{reset} {e['path']}")
    
    # Print permissions warning
    if any("Access is denied" in str(e) for e in entries):
        print(f"\n{yellow}⚠ Some directories could not be accessed due to permissions{reset}")

def main():
    """Main execution flow"""
    ensure_directory_exists(TARGET_DIR)
    
    # Step 1: Test directories
    validated_entries = test_rename_capability(DIRS)
    
    # Step 2: Process validated entries
    for idx, entry in enumerate(validated_entries):
        process_directory(entry)
    
    print(Fore.GREEN + "\n✔ All operations completed successfully!")

if __name__ == "__main__":
    main()