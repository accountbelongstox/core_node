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

def find_windows_drive():
    # Traverse A-Z drives to find the Windows directory
    for letter in string.ascii_uppercase:
        drive = f"{letter}:\\"
        if os.path.exists(drive + "Windows") and os.path.exists(drive + "Program Files"):
            return drive
    return None

def find_target_drive():
    # Traverse A-Z drives to find the drive with \applications directory
    for letter in string.ascii_uppercase:
        drive = f"{letter}:\\"
        if os.path.exists(drive + "applications"):
            return drive
    return None

def find_user_name_directory():
    # Scan C:\Users\ directory and find the username folder (excluding Default and Public)
    users_path = "C:\\Users"
    for user in os.listdir(users_path):
        if user not in ["Default", "Public"] and os.path.isdir(os.path.join(users_path, user)):
            return user
    return None

def move_and_link_directories(windows_drive, target_drive, username):
    # Define the directories to be moved
    dirs_to_move = [
        "Program Files",
        "Program Files (x86)",
        f"Users\\{username}"
    ]

    # Create the .CDriveRedirect folder on the target drive
    redirect_path = os.path.join(target_drive, ".CDriveRedirect")
    if not os.path.exists(redirect_path):
        os.makedirs(redirect_path)
        print(f"Created .CDriveRedirect folder at: {redirect_path}")

    for dir_name in dirs_to_move:
        source_dir = os.path.join(windows_drive, dir_name)
        target_dir = os.path.join(redirect_path, dir_name)

        if os.path.exists(source_dir):
            try:
                # Move the directory to the target
                print(f"Moving: {source_dir} -> {target_dir}")
                shutil.move(source_dir, target_dir)

                # Delete the original directory on the windows drive
                if os.path.exists(source_dir):
                    shutil.rmtree(source_dir)
                    print(f"Deleted original directory: {source_dir}")

                # Create hard links from the target to the original location
                if not os.path.exists(source_dir):
                    os.link(target_dir, source_dir)
                    print(f"Hard link created for: {target_dir} -> {source_dir}")
            except Exception as e:
                print(f"Error moving {source_dir} to {target_dir}: {e}")

def main():
    # Step 1: Find the drive where Windows is installed
    windows_drive = find_windows_drive()
    if windows_drive is None:
        print("Windows drive not found.")
        return

    print(f"Found Windows drive: {windows_drive}")

    # Step 2: Find the target drive
    target_drive = find_target_drive()
    if target_drive is None:
        print("Target drive not found.")
        return

    print(f"Found target drive: {target_drive}")

    # Step 3: Find the user name directory (excluding Default and Public)
    username = find_user_name_directory()
    if username is None:
        print("User directory not found.")
        return

    print(f"Found user directory: {username}")

    # Step 4: Move and create hard links for the directories
    move_and_link_directories(windows_drive, target_drive, username)

if __name__ == "__main__":
    main()
