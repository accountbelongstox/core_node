#!/bin/bash

CSS_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$CSS_COMMON_DIR/file_ops_common.sh"

CSS_CADDYFILE_RENDERED=""
CSS_CADDYFILE_READY="no"

css_caddyfile_render() {
    local bind_host="$1"
    local port="$2"
    local site_root="$3"
    local runtime_config_file="$4"
    local runtime_config_dir=""
    local runtime_config_name=""

    runtime_config_dir="$(dirname "$runtime_config_file")"
    runtime_config_name="$(basename "$runtime_config_file")"
    CSS_CADDYFILE_RENDERED="{
	admin off
	auto_https off
	persist_config off
	default_bind ${bind_host}
	servers ${bind_host}:${port} {
		protocols h1
	}
}

:${port} {
	bind ${bind_host}
	encode zstd gzip

	@runtime_config path /${runtime_config_name}
	handle @runtime_config {
		root * ${runtime_config_dir}
		header Cache-Control \"no-store\"
		file_server
	}

	handle {
		root * ${site_root}
		@immutable path /assets/*
		header @immutable Cache-Control \"public, max-age=31536000, immutable\"
		try_files {path} /index.html
		file_server
	}
}"
}

css_caddyfile_ensure() {
    local bind_host="$1"
    local port="$2"
    local site_root="$3"
    local runtime_config_file="$4"
    local caddyfile_path="$5"
    local existing=""

    CSS_CADDYFILE_READY="no"
    css_caddyfile_render "$bind_host" "$port" "$site_root" "$runtime_config_file"
    printf '%s\n' "$CSS_CADDYFILE_RENDERED" | write_file_if_changed "$caddyfile_path"
    if [ -f "$caddyfile_path" ]; then
        existing="$(cat "$caddyfile_path")"
    fi
    if [ "$existing" = "$CSS_CADDYFILE_RENDERED" ]; then
        CSS_CADDYFILE_READY="yes"
    fi
}
