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
import string

def find_python_path():
    """
    Find the Python executable path by checking common places or system environment.
    Returns the Python absolute path if found, else None.
    """
    # Check if 'python' is available in the system path
    python_exe = shutil.which("python")
    if python_exe:
        return python_exe
    
    # If python is not found in system path, check all drives (A-Z)
    for letter in string.ascii_uppercase:
        drive = f"{letter}:\\"  # Check each drive (A-Z)
        python_path = os.path.join(drive, "Python", "python.exe")
        
        # If the path exists, return it
        if os.path.exists(python_path):
            return python_path
        
    # If no Python found, return None
    return None

def get_python_subpath(python_path):
    """
    Given the absolute Python path, return the sub-path (excluding the drive letter).
    """
    # Get the subpath by removing the drive letter
    subpath = os.path.splitdrive(python_path)[1]  # Removes the drive part and returns the subpath
    return subpath

def copy_slim_c2d_disk_py():
    """
    Copy slim_c2d_disk.py to D: drive, replacing any existing one.
    """
    slim_c2d_disk_path = "slim_c2d_disk.py"
    if os.path.exists(slim_c2d_disk_path):
        destination_path = r"D:\slim_c2d_disk.py"
        shutil.copy2(slim_c2d_disk_path, destination_path)
        print(f"slim_c2d_disk.py has been copied to {destination_path}.")
    else:
        print("slim_c2d_disk.py not found in the current directory.")

def find_largest_drive():
    """
    Scans all A-Z drives and returns the drive letter of the one with the largest available free space.
    """
    max_free_space = 0
    largest_drive = None
    
    for letter in string.ascii_uppercase:
        drive = f"{letter}:\\"
        if os.path.exists(drive):
            # Get the free space of the drive
            total, used, free = shutil.disk_usage(drive)
            if free > max_free_space:
                max_free_space = free
                largest_drive = drive
    
    if largest_drive:
        print(f"Largest drive is {largest_drive} with {max_free_space} bytes free.")
        return largest_drive
    else:
        print("No valid drive found.")
        return None

def create_dot_file_on_largest_drive(largest_drive):
    """
    Creates a hidden file (starting with '.') on the largest drive to indicate it's the largest drive.
    """
    if largest_drive:
        dot_file_path = os.path.join(largest_drive, ".largest_drive_indicator")
        if not os.path.exists(dot_file_path):
            with open(dot_file_path, "w") as f:
                f.write("This file indicates that this is the largest available drive.")
            print(f"Created a hidden file on {largest_drive}: {dot_file_path}")
        else:
            print(f"The file {dot_file_path} already exists.")
    else:
        print("Largest drive not found, unable to create hidden file.")

def generate_bat_script(python_path):
    """
    Generates a batch script to list A-Z drives, check for Python executable,
    and execute the slim_c2d_disk.py script using the valid Python path.
    """
    subpath = get_python_subpath(python_path)  # Get the Python subpath excluding the drive letter
    print(f"Subpath for Python executable (excluding drive letter): {subpath}")
    
    # Prompt all possible drive combinations
    print("Possible Python executable paths for all A-Z drives:")
    for letter in string.ascii_uppercase:
        potential_path = f"{letter}:\\{subpath}"
        print(potential_path)

    # Generate the batch content
    bat_content = '''
@echo off
setlocal enabledelayedexpansion

:: List A-Z drives and check for the valid Python path
echo Searching for valid Python path...
'''

    # Check each drive A-Z and list the Python path
    for letter in string.ascii_uppercase:
        drive = f"{letter}:\\"
        bat_content += f'echo Checking drive: {drive}\n'
        bat_content += f'if exist "{drive}{subpath}" (set pythonPath={drive}{subpath})\n'
        bat_content += f'if defined pythonPath (echo Found Python at: !pythonPath! & goto end)\n'

    # If Python is found, use it to execute the Python script
    bat_content += '''
:end
if defined pythonPath (
    echo Python path found: !pythonPath!
    echo Executing slim_c2d_disk.py...
    "!pythonPath!" "%~dp0slim_c2d_disk.py"
) else (
    echo Python not found on any drive.
)

pause
'''

    # Save the .bat script to the D: drive root
    bat_file_path = r"D:\find_python_and_run.bat"
    with open(bat_file_path, "w") as bat_file:
        bat_file.write(bat_content)

    print(f"Batch script generated: {bat_file_path}")
    return bat_file_path

def generate_ps1_script(python_path):
    """
    Generates a PowerShell script to list A-Z drives, check for Python executable,
    and execute the slim_c2d_disk.py script using the valid Python path.
    """
    subpath = get_python_subpath(python_path)  # Get the Python subpath excluding the drive letter
    print(f"Subpath for Python executable (excluding drive letter): {subpath}")
    
    # Prompt all possible drive combinations
    print("Possible Python executable paths for all A-Z drives:")
    for letter in string.ascii_uppercase:
        potential_path = f"{letter}:\\{subpath}"
        print(potential_path)

    # Generate the PowerShell content
    ps1_content = '''
$ErrorActionPreference = "Stop"

# List A-Z drives and check for the valid Python path
Write-Host "Searching for valid Python path..."

$pythonPath = $null
foreach ($letter in 'A'..'Z') {
    $drive = "$letter`:\"
    $potentialPath = "$drive$subpath"
    Write-Host "Checking drive: $drive"
    if (Test-Path $potentialPath) {
        $pythonPath = $potentialPath
        Write-Host "Found Python at: $pythonPath"
        break
    }
}

if ($pythonPath) {
    Write-Host "Python path found: $pythonPath"
    Write-Host "Executing slim_c2d_disk.py..."
    & "$pythonPath" "$PSScriptRoot\slim_c2d_disk.py"
} else {
    Write-Host "Python not found on any drive."
}
'''

    # Save the .ps1 script to the D: drive root
    ps1_file_path = r"D:\find_python_and_run.ps1"
    with open(ps1_file_path, "w") as ps1_file:
        ps1_file.write(ps1_content)

    print(f"PowerShell script generated: {ps1_file_path}")
    return ps1_file_path

def main():
    # Step 1: Find the Python executable path
    python_path = find_python_path()
    
    if python_path:
        print(f"Python found at: {python_path}")
    else:
        print("Python not found on any drive.")
        return

    # Step 2: Copy the slim_c2d_disk.py to D: drive, if it exists
    copy_slim_c2d_disk_py()

    # Step 3: Find the largest drive and create the hidden file on it
    largest_drive = find_largest_drive()
    create_dot_file_on_largest_drive(largest_drive)

    # Step 4: Generate the batch script and PowerShell script to search for the Python path and run the Python script
    bat_file_path = generate_bat_script(python_path)
    ps1_file_path = generate_ps1_script(python_path)

    print(f"Batch script generated at: {bat_file_path}")
    print(f"PowerShell script generated at: {ps1_file_path}")

    # Final message indicating initialization completion
    print("\nC drive slimming initialization is complete. You can now restart and enter installation mode to execute the script.")

if __name__ == "__main__":
    main()
