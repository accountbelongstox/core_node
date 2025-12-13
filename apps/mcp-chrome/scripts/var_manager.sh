#!/bin/bash
# var_manager.sh
# Bash 变量管理库
# 负责读写文件变量

# 获取变量存储目录
get_vars_dir() {
    local platform="$(uname -s)"

    if [[ "$platform" == "Darwin" ]] || [[ "$platform" == "Linux" ]]; then
        # 尝试使用 /var/_core_node/_build_global_vars/
        local var_dir="/var/_core_node/_build_global_vars"

        if [[ ! -d "$var_dir" ]]; then
            # 尝试创建
            if mkdir -p "$var_dir" 2>/dev/null; then
                echo "$var_dir"
                return 0
            fi

            # 如果失败，降级到用户目录
            var_dir="$HOME/.core_node/.build_global_vars"
        fi

        echo "$var_dir"
    else
        # 其他系统，使用用户目录
        echo "$HOME/.core_node/.build_global_vars"
    fi
}

# 确保变量目录存在
ensure_vars_dir() {
    local vars_dir="$(get_vars_dir)"

    if [[ ! -d "$vars_dir" ]]; then
        if ! mkdir -p "$vars_dir" 2>/dev/null; then
            echo "ERROR: Failed to create vars directory: $vars_dir" >&2
            return 1
        fi
    fi

    return 0
}

# 设置变量（写入文件）
set_var() {
    local key="$1"
    local value="$2"

    if [[ -z "$key" ]]; then
        echo "ERROR: Variable key cannot be empty" >&2
        return 1
    fi

    if ! ensure_vars_dir; then
        return 1
    fi

    local vars_dir="$(get_vars_dir)"
    local var_file="$vars_dir/$key"

    if ! echo -n "$value" > "$var_file" 2>/dev/null; then
        echo "ERROR: Failed to write variable '$key'" >&2
        return 1
    fi

    return 0
}

# 获取变量（读取文件）
get_var() {
    local key="$1"
    local default="${2:-}"

    if [[ -z "$key" ]]; then
        echo "ERROR: Variable key cannot be empty" >&2
        return 1
    fi

    local vars_dir="$(get_vars_dir)"
    local var_file="$vars_dir/$key"

    if [[ ! -f "$var_file" ]]; then
        echo -n "$default"
        return 0
    fi

    if ! cat "$var_file" 2>/dev/null; then
        echo "WARNING: Failed to read variable '$key'" >&2
        echo -n "$default"
        return 1
    fi

    return 0
}

# 删除变量（删除文件）
remove_var() {
    local key="$1"

    if [[ -z "$key" ]]; then
        echo "ERROR: Variable key cannot be empty" >&2
        return 1
    fi

    local vars_dir="$(get_vars_dir)"
    local var_file="$vars_dir/$key"

    if [[ -f "$var_file" ]]; then
        if ! rm -f "$var_file" 2>/dev/null; then
            echo "WARNING: Failed to delete variable '$key'" >&2
            return 1
        fi
    fi

    return 0
}

# 清除所有变量
clear_all_vars() {
    local vars_dir="$(get_vars_dir)"

    if [[ ! -d "$vars_dir" ]]; then
        return 0
    fi

    find "$vars_dir" -maxdepth 1 -type f -exec rm -f {} \; 2>/dev/null || true

    return 0
}

# 检查变量是否存在
test_var() {
    local key="$1"

    if [[ -z "$key" ]]; then
        return 1
    fi

    local vars_dir="$(get_vars_dir)"
    local var_file="$vars_dir/$key"

    [[ -f "$var_file" ]]
}

# 列出所有变量（作为键值对）
list_all_vars() {
    local vars_dir="$(get_vars_dir)"

    if [[ ! -d "$vars_dir" ]]; then
        return 0
    fi

    for var_file in "$vars_dir"/*; do
        if [[ -f "$var_file" ]]; then
            local key="$(basename "$var_file")"
            local value="$(cat "$var_file" 2>/dev/null || echo "")"
            echo "$key=$value"
        fi
    done
}
