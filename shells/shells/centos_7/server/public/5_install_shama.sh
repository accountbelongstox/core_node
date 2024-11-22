#if ! dpkg -l | grep -q "samba"; then
#    echo "Samba not installed. Installing on Debian..."
#    sudo apt-get update
#    sudo apt-get init -y samba
#else
#    echo "Samba is already installed on Debian."
#fi


 从ubuntu转为centos7的脚本，注意是centos7，不是centos9,支持的软件也要降为合适centos7的对应版本，以免出错。