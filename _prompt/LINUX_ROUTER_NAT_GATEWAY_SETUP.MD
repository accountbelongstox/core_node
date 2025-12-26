# Linux Router/NAT Gateway Setup

## Overview

This document describes how to configure a Linux system (Ubuntu) as a router/NAT gateway with dual network cards.

## Network Configuration

**Network Card A**: Connected to external network (obtains external IP, may be public IP or internal IP assigned by upstream router).

**Network Card B**: Acts as LAN interface, assigns private IPs to internal clients (e.g., 192.168.10.x), and accesses internet through Card A.

Ubuntu acts as a home router.

## Configuration Steps (Internal Router / NAT Gateway)

### 1. Enable Kernel Forwarding

```bash
echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward
sudo sed -i 's/^#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf
```

### 2. Configure Network Card B LAN Address

For example, set 192.168.10.1/24 as gateway:

```bash
sudo ip addr add 192.168.10.1/24 dev B-nic-name
sudo ip link set dev B-nic-name up
```

### 3. Configure NAT Forwarding

Allow internal network traffic to go through Card A exit via NAT:

```bash
# Internal network goes through Card A exit
sudo iptables -t nat -A POSTROUTING -o A-nic-name -j MASQUERADE

# Allow LAN forwarding to WAN
sudo iptables -A FORWARD -i B-nic-name -o A-nic-name -j ACCEPT

# Allow established connections to return
sudo iptables -A FORWARD -i A-nic-name -o B-nic-name -m state --state ESTABLISHED,RELATED -j ACCEPT
```

### 4. Assign IPs to Internal Network Clients (DHCP)

To automatically assign IPs to clients on Card B interface, you need a DHCP server. Can use `isc-dhcp-server` or `dnsmasq`.

Example using `dnsmasq` (simple and convenient):

```bash
sudo apt install dnsmasq -y
```

Edit `/etc/dnsmasq.conf`, add:

```
interface=B-nic-name
dhcp-range=192.168.10.50,192.168.10.150,12h
dhcp-option=3,192.168.10.1       # Default gateway
dhcp-option=6,8.8.8.8,1.1.1.1    # DNS
```

Restart:

```bash
sudo systemctl restart dnsmasq
```

### 5. Client Configuration

Devices connected to Network Card B will automatically obtain 192.168.10.x IP, gateway, and DNS.

Access internet through Network Card A's public/upstream network.

## Final Result

✅ Ubuntu becomes a dual network card router.

- Card A connects to external network
- Card B manages internal network
- Internal network devices can access internet

## Automation Script

A one-click script like `setup-router.sh` can be created to automate this setup.

