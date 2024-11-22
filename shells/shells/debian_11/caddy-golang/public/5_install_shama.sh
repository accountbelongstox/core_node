#if ! dpkg -l | grep -q "samba"; then
#    echo "Samba not installed. Installing on Debian..."
#    sudo apt-get update
#    sudo apt-get init -y samba
#else
#    echo "Samba is already installed on Debian."
#fi
