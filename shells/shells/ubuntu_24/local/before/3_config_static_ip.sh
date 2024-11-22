#!/bin/bash

WSL_CONFIG_PATH="$HOME/.wslconfig"
NETWORK_CONFIG_PATH="/usr/lib/systemd/network/wsl_external.network"
RESOLV_CONF_PATH="/etc/resolv.conf"
WSL_CONF_PATH="/etc/wsl.conf"
STATIC_IP_FILE="/usr/local/.pcore_local/deploy/.WSL_STATIC_IP"
DEFAULT_STATIC_IP="192.168.100.10"
DNS_SERVERS=("8.8.8.8" "8.8.4.4" "223.5.5.5")

extract_gateway() {
    local ip=$1
    IFS='.' read -r -a ip_parts <<< "$ip"
    echo "${ip_parts[0]}.${ip_parts[1]}.${ip_parts[2]}.1"
}

create_wsl_config() {
    echo -e "\033[32mCreating or updating .wslconfig file...\033[0m"
    cat <<EOF > "$WSL_CONFIG_PATH"
[wsl2]
networkingMode=bridged
vmSwitch=WSLBridge
dhcp=false
ipv6=true
EOF
    echo ".wslconfig file created or updated."
}

create_network_config() {
    GATEWAY=$(extract_gateway "$STATIC_IP")
    echo -e "\033[32mCreating or updating wsl_external.network file...\033[0m"
    cat <<EOF > /tmp/wsl_external.network
[Match]
Name=eth0

[Network]
Description=bridge
DHCP=false
Address=$STATIC_IP/24
Gateway=$GATEWAY
DNS=${DNS_SERVERS[0]}
DNS=${DNS_SERVERS[1]}
EOF

    sudo cp /tmp/wsl_external.network "$NETWORK_CONFIG_PATH"
    sudo rm /tmp/wsl_external.network
    echo "Network configuration file created or updated."
}

configure_resolv_conf() {
    echo -e "\033[32mConfiguring resolv.conf...\033[0m"
    sudo rm -f "$RESOLV_CONF_PATH"
    echo "nameserver ${DNS_SERVERS[2]}" | sudo tee "$RESOLV_CONF_PATH" > /dev/null
    echo "resolv.conf has been configured."
}

configure_wsl_conf() {
    echo -e "\033[32mConfiguring wsl.conf...\033[0m"
    if [ -f "$WSL_CONF_PATH" ]; then
        sudo rm "$WSL_CONF_PATH"
    fi
    sudo bash -c "cat > $WSL_CONF_PATH" <<EOF
[boot]
systemd=true
[network]
generateResolvConf = false
EOF
    echo "wsl.conf has been configured."
}

restart_wsl() {
    echo -e "\033[32mRestarting WSL2...\033[0m"
    wsl --shutdown
    echo "WSL2 has been restarted."
}

get_static_ip() {
    if [[ -f "$STATIC_IP_FILE" ]]; then
        STATIC_IP=$(sudo cat "$STATIC_IP_FILE")
    else
        STATIC_IP="$DEFAULT_STATIC_IP"
        echo "$STATIC_IP" | sudo tee "$STATIC_IP_FILE" > /dev/null
    fi
}

prompt_for_static_ip() {
    read -p "Enter static IP address (default: $DEFAULT_STATIC_IP): " user_ip
    if [[ ! -z "$user_ip" ]]; then
        if [[ "$user_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            STATIC_IP="$user_ip"
            echo "$STATIC_IP" | sudo tee "$STATIC_IP_FILE" > /dev/null
        else
            echo "Invalid IP address format. Using default IP: $DEFAULT_STATIC_IP"
            STATIC_IP="$DEFAULT_STATIC_IP"
        fi
    else
        STATIC_IP="$DEFAULT_STATIC_IP"
    fi
}

create_wsl_config
get_static_ip
prompt_for_static_ip
if [ "$STATIC_IP" != "$(sudo cat "$STATIC_IP_FILE")" ]; then
    echo "$STATIC_IP" | sudo tee "$STATIC_IP_FILE" > /dev/null
    echo -e "\033[31mIP address changed to $STATIC_IP and saved to $STATIC_IP_FILE\033[0m"
fi
create_network_config
configure_resolv_conf
configure_wsl_conf
restart_wsl

echo -e "\033[32mConfiguration complete. Please verify your settings.\033[0m"
echo -e "\033[32mMake sure to configure Hyper-V for bridged networking.\033[0m"
echo -e "\033[31mCurrent IP: $STATIC_IP\033[0m"
echo -e "\033[31mDNS Servers: ${DNS_SERVERS[*]}\033[0m"
echo -e "\033[32mRestarting WSL2 to apply changes...\033[0m"
wsl --shutdown
echo -e "\033[32mWSL2 has been restarted. Please verify your settings with 'ip addr' command.\033[0m"
