import os
import subprocess
import shutil

def get_wsl_path(username):
    """
    Automatically get the WSL storage path based on the username.
    """
    try:
        # Run the command to get the WSL user profile path
        wsl_userprofile = subprocess.check_output(["wsl", "echo", "$USERPROFILE"], text=True).strip()
        print(f"Detected WSL user profile path for {username}: {wsl_userprofile}")
        return wsl_userprofile
    except subprocess.CalledProcessError as e:
        print(f"Error detecting WSL path for {username}: {e}")
        return None

def get_wsl_distro_name():
    """
    Get the current WSL distribution name.
    """
    try:
        # Run the command to get WSL distribution info
        distro_name = subprocess.check_output(["wsl", "-l", "-v"], text=True).strip()
        if "Running" in distro_name:
            print(f"Detected running WSL distro: {distro_name.splitlines()[0]}")
            return distro_name.splitlines()[0].split()[0]  # Return the distro name
        else:
            print("No running WSL distro detected.")
            return None
    except subprocess.CalledProcessError as e:
        print(f"Error detecting WSL distro: {e}")
        return None

def clean_wsl_space(wsl_path):
    """
    Clean up WSL space by removing unnecessary files.
    """
    print("Starting cleanup of WSL occupied space...")
    if wsl_path:
        try:
            # Assume deleting some temporary files (like cache files, logs, etc.)
            temp_dir = os.path.join(wsl_path, "AppData", "Local", "Packages")
            if os.path.exists(temp_dir):
                print(f"Cleaning up temporary files in: {temp_dir}")
                shutil.rmtree(temp_dir)
                print(f"Successfully cleaned: {temp_dir}")
            else:
                print(f"No temporary directory found: {temp_dir}")

            # Run WSL internal cleanup command (like apt-get clean or others)
            subprocess.run(["wsl", "sudo", "apt-get", "clean"], check=True)
            print("Executed 'apt-get clean' in WSL.")

        except Exception as e:
            print(f"Error cleaning WSL space: {e}")

def get_wsl_disk_usage():
    """
    Get WSL's disk usage information.
    """
    try:
        # Run the command to check WSL disk usage
        disk_usage = subprocess.check_output(["wsl", "--df"], text=True).strip()
        print(f"WSL disk usage:\n{disk_usage}")
    except subprocess.CalledProcessError as e:
        print(f"Error getting WSL disk usage: {e}")

def main():
    # Get the current username
    username = os.getlogin()
    print(f"Detected current username: {username}")

    # Get WSL path
    wsl_path = get_wsl_path(username)
    if wsl_path:
        print(f"WSL path for {username}: {wsl_path}")

    # Get WSL distribution name
    distro_name = get_wsl_distro_name()

    # Get disk usage information
    get_wsl_disk_usage()

    # Clean WSL occupied space
    clean_wsl_space(wsl_path)

if __name__ == "__main__":
    main()
