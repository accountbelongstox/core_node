import os
import subprocess
import sys

# Function to check if the script is run as root
def check_root():
    if os.geteuid() != 0:
        print("Please run this script as root or using sudo.")
        sys.exit(1)

# Function to update the package list
def update_package_list():
    print("Updating package list...")
    subprocess.run(["apt", "update"], check=True)

# Function to check if a package is installed
def is_package_installed(package_name):
    result = subprocess.run(["dpkg", "-l"], stdout=subprocess.PIPE, text=True)
    return package_name in result.stdout

# Function to install a package
def install_package(package_name):
    print(f"{package_name} is not installed. Installing...")
    subprocess.run(["apt", "install", "-y", package_name], check=True)

# Function to start the SSH service
def start_ssh_service():
    print("Starting SSH service...")
    subprocess.run(["/usr/sbin/sshd"], check=True)

# Function to configure the SSH service
def configure_ssh_service():
    print("Configuring SSH service...")
    sshd_config = "/etc/ssh/sshd_config"

    # Disable password authentication
    with open(sshd_config, 'r') as file:
        config_lines = file.readlines()

    with open(sshd_config, 'w') as file:
        for line in config_lines:
            if line.startswith("PasswordAuthentication yes"):
                line = line.replace("yes", "no")
            elif line.startswith("PermitRootLogin yes"):
                line = line.replace("yes", "no")
            file.write(line)

# Function to generate SSH key pair
def generate_ssh_key():
    key_path = "/etc/ssh/id_rsa"
    public_key_path = f"{key_path}.pub"

    if not os.path.isfile(key_path):
        print("SSH key not found. Generating...")
        subprocess.run(["ssh-keygen", "-t", "rsa", "-b", "4096", "-C", "local@gmail.com", "-N", "", "-f", key_path], check=True)
    else:
        print("SSH key already exists.")

    return public_key_path

# Function to set up authorized_keys for key-based authentication
def setup_authorized_keys(public_key_path):
    authorized_keys_path = "/root/.ssh/authorized_keys"

    # Create .ssh directory if it doesn't exist
    os.makedirs(os.path.dirname(authorized_keys_path), exist_ok=True)
    os.chmod(os.path.dirname(authorized_keys_path), 0o700)

    # Copy the public key to authorized_keys for SSH authentication
    with open(public_key_path, 'r') as pub_key_file:
        pub_key = pub_key_file.read()

    with open(authorized_keys_path, 'a') as auth_keys_file:
        auth_keys_file.write(pub_key)

    os.chmod(authorized_keys_path, 0o600)

# Function to display the public key
def display_public_key(public_key_path):
    print("Here is the generated public key. Please add it to the necessary servers:")
    with open(public_key_path, 'r') as pub_key_file:
        print(pub_key_file.read())

# Main function to execute the script logic
def main():
    check_root()
    update_package_list()

    package_name = "openssh-server"
    if not is_package_installed(package_name):
        install_package(package_name)
    else:
        print(f"{package_name} is already installed.")

    start_ssh_service()
    configure_ssh_service()

    public_key_path = generate_ssh_key()
    setup_authorized_keys(public_key_path)
    display_public_key(public_key_path)

    print("Setup completed. The SSH server is running, and key-based authentication is configured.")

if __name__ == "__main__":
    main()
