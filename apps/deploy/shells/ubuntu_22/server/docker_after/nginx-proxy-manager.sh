#!/bin/bash

# Install required packages for nginx-proxy-manager
sudo docker exec -it nginx-proxy-manager python3 -m pip show zope > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "nginx-proxy-manager zope is already installed."
else
    echo "nginx-proxy-manager zope is not installed. Installing..."
    sudo docker exec -it nginx-proxy-manager python3 -m pip install --upgrade pip && \
    sudo docker exec -it nginx-proxy-manager pip install -i https://mirrors.aliyun.com/pypi/simple/ zope zope.interface certbot-dns-dnspod
fi