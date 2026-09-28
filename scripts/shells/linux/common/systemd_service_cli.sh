#!/bin/bash

systemd_service_cli_show_help() {
    cat << EOF
NCore Systemd Service Manager

Usage: $0 COMMAND [OPTIONS]

Commands:
  create SCRIPT_PATH [NAME] [DESCRIPTION] [CPU_LIMIT] [MEMORY_LIMIT]
  remove SERVICE_NAME
  status SERVICE_NAME
  list
  update [SERVICE_NAME]
  help
EOF
}

systemd_service_cli_main() {
    local command="${1:-help}"

    if [ "$#" -gt 0 ]; then
        shift
    fi
    case "$command" in
        create) create_ncore_service "$@" ;;
        remove) remove_ncore_service "${1:-}" ;;
        status) check_service_status "${1:-}" ;;
        list) list_ncore_services ;;
        update)
            if [ "$#" -eq 0 ]; then
                update_all_services_resources
            else
                update_service_resources "$1"
            fi
            ;;
        help|--help|-h) systemd_service_cli_show_help ;;
        *)
            echo "[ERROR] Unknown command: $command"
            systemd_service_cli_show_help
            ;;
    esac
}
