import os
import json
import subprocess
import time
import shutil

CONFIG_FILE_PATH = "/www/config.json"
BACKUP_DIR = "/backups"
WWW_DIR = "/www"

# Function to check if a package is installed
def check_and_install_package(package_name, check_command):
    try:
        subprocess.run(check_command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"{package_name} is already installed.")
    except subprocess.CalledProcessError:
        print(f"{package_name} is not installed. Installing...")
        subprocess.run(["apt-get", "install", "-y", package_name], check=True)
        print(f"{package_name} has been installed.")

# Function to load or create configuration file
def load_or_create_config():
    if os.path.isfile(CONFIG_FILE_PATH):
        with open(CONFIG_FILE_PATH, 'r') as config_file:
            return json.load(config_file)
    else:
        default_config = {
            "new_install": False,
            "is_empty": is_dir_empty(WWW_DIR),
            "backup_needed": False
        }
        # Generate a default configuration without creating the file
        return default_config

# Function to check if a directory is empty or only contains lost+found
def is_dir_empty(dir_path):
    if not os.path.isdir(dir_path):
        return True
    return not any(os.scandir(dir_path)) or (len(os.listdir(dir_path)) == 1 and 'lost+found' in os.listdir(dir_path))

# Function to backup the /www directory
def backup_www():
    backup_file = os.path.join(BACKUP_DIR, f"www_backup_{int(time.time())}.tar.gz")
    print(f"Backing up /www to {backup_file}...")
    subprocess.run(["tar", "-czf", backup_file, "-C", "/", "www"], check=True)
    print("Backup completed.")

# Check and install required packages
required_packages = {
    "bash": ["bash", "--version"],
    "curl": ["curl", "--version"],
    "wget": ["wget", "--version"],
    "vim": ["vim", "--version"],
    "iproute2": ["ip", "addr"],
    "nano": ["nano", "--version"],
    "procps": ["ps", "--version"]
}

apt_updated = False

# Update package list if needed
def update_package_list():
    global apt_updated
    if not apt_updated:
        subprocess.run(["apt-get", "update"], check=True)
        apt_updated = True

for package, command in required_packages.items():
    update_package_list()
    check_and_install_package(package, command)

# Load or create configuration
config = load_or_create_config()

# If new_install is True, restore from backup and handle the /www directory
if config["new_install"]:
    print("New installation detected.")
    # Remove all files and directories in /www
    if os.path.isdir(WWW_DIR):
        print("Cleaning up /www directory...")
        shutil.rmtree(WWW_DIR)
    
    # Attempt to restore from backup
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.startswith('www_backup_') and f.endswith('.tar.gz')],
                     key=lambda x: os.path.getmtime(os.path.join(BACKUP_DIR, x)), reverse=True)
    if backups:
        latest_backup = os.path.join(BACKUP_DIR, backups[0])
        print(f"Restoring from backup: {latest_backup}")
        os.makedirs(WWW_DIR, exist_ok=True)
        subprocess.run(["tar", "-xzf", latest_backup, "-C", "/"], check=True)
        print("Restore completed.")
    else:
        print("No backup found. The /www directory will remain empty.")

# Backup if needed
if config["backup_needed"]:
    backup_www()

# Check if the bt command exists
if subprocess.call(["command", "-v", "bt"], stdout=subprocess.PIPE, stderr=subprocess.PIPE) != 0:
    print("bt command does not exist. Please ensure it is installed and accessible.")
    print("The container will remain running, press Ctrl+C to exit.")
    while True:
        time.sleep(3600)  # Check every hour

# Set identifier directory and files
IDENTIFIER_DIR = os.path.join(WWW_DIR, "identifiers")
USERNAME_FLAG = os.path.join(IDENTIFIER_DIR, "username_set.flag")
PASSWORD_FLAG = os.path.join(IDENTIFIER_DIR, "password_set.flag")
PORT_FLAG = os.path.join(IDENTIFIER_DIR, "port_set.flag")

# Create the identifier directory if it doesn't exist
os.makedirs(IDENTIFIER_DIR, exist_ok=True)

# Set default password if BAOTA_PASSWORD is not set
BAOTA_PASSWORD = os.getenv("BAOTA_PASSWORD", "12345678")

# Set default username if BAOTA_USERNAME is not set
BAOTA_USERNAME = os.getenv("BAOTA_USERNAME", "adminroot")

# Set default port if PANEL_PORT is not set
PANEL_PORT = os.getenv("PANEL_PORT", "8888")

# Check if the username flag exists
if not os.path.isfile(USERNAME_FLAG):
    print(f"Setting username to {BAOTA_USERNAME}...")
    subprocess.run(["bt", "6"], input=f"{BAOTA_USERNAME}\n", text=True)
    print("Username set, creating flag file.")
    open(USERNAME_FLAG, 'a').close()  # Create flag file
else:
    print("Username already set, skipping...")

# Check if the password flag exists
if not os.path.isfile(PASSWORD_FLAG):
    print(f"Setting password to {BAOTA_PASSWORD}...")
    subprocess.run(["bt", "5"], input=f"{BAOTA_PASSWORD}\n", text=True)
    print("Password set, creating flag file.")
    open(PASSWORD_FLAG, 'a').close()  # Create flag file
else:
    print("Password already set, skipping...")

# Check if the port flag exists
if not os.path.isfile(PORT_FLAG):
    print(f"Setting panel port to {PANEL_PORT}...")
    subprocess.run(["bt", "8"], input=f"{PANEL_PORT}\n", text=True)
    print("Port set, creating flag file.")
    open(PORT_FLAG, 'a').close()  # Create flag file
else:
    print("Panel port already set, skipping...")

# Execute bt 14
subprocess.run(["bt", "14"])
subprocess.run(["bt", "3"])

# Keep the container running
print("The container will remain running. Use Ctrl+C to stop it.")
try:
    while True:
        time.sleep(3600)
except KeyboardInterrupt:
    print("Stopping the container...")
