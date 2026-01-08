#!/bin/bash
# SystemD Service File Generator Module
# Provides utilities for generating systemd service files

# Colors for logging
COLOR_SUCCESS="\033[32m"
COLOR_INFO="\033[90m"
COLOR_RESET="\033[0m"

# Generate a standard systemd service file
# Arguments: service_name, description, working_dir, exec_start, user, cpu_quota, memory_max
generate_systemd_service_file() {
    local service_name="$1"
    local description="$2"
    local working_dir="$3"
    local exec_start="$4"
    local user="${5:-root}"
    local cpu_quota="${6:-50%}"
    local memory_max="${7:-1G}"

    local service_file="/etc/systemd/system/${service_name}.service"

    cat > "$service_file" << EOF
[Unit]
Description=$description
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$working_dir
ExecStart=$exec_start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
CPUQuota=$cpu_quota
MemoryMax=$memory_max
MemoryHigh=0M

[Install]
WantedBy=multi-user.target
EOF

    echo "$service_file"
}

# Enable and start a systemd service
# Arguments: service_name
start_systemd_service() {
    local service_name="$1"

    systemctl daemon-reload
    systemctl enable "$service_name"
    systemctl start "$service_name"

    sleep 2

    if systemctl is-active --quiet "$service_name"; then
        return 0
    else
        return 1
    fi
}

# Remove a systemd service (mutual exclusion helper)
# Arguments: service_name
remove_systemd_service() {
    local service_name="$1"

    if systemctl list-unit-files "$service_name.service" >/dev/null 2>&1; then
        systemctl stop "$service_name" 2>/dev/null || true
        systemctl disable "$service_name" 2>/dev/null || true
        rm -f "/etc/systemd/system/$service_name.service"
        systemctl daemon-reload
        return 0
    else
        return 1
    fi
}

# Remove services matching a pattern with app name
# Arguments: app_name, pattern_array_name, suffix
remove_services_by_patterns() {
    local app_name="$1"
    local -n patterns=$2
    local suffix="$3"
    local removed_count=0

    for pattern in "${patterns[@]}"; do
        local service_name="$pattern-$app_name$suffix"
        if remove_systemd_service "$service_name"; then
            echo -e "${COLOR_SUCCESS}✓ Removed service: $service_name${COLOR_RESET}"
            ((removed_count++))
        fi
    done

    return $removed_count
}

# Export functions
export -f generate_systemd_service_file
export -f start_systemd_service
export -f remove_systemd_service
export -f remove_services_by_patterns
