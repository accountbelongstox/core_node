#!/bin/bash
# Variable key helpers (optional, for compatibility)

get_app_var_key() {
    local index="$1"
    local prop="$2"
    echo "APP_${index}_${prop}"
}
