#!/bin/bash

IDE_DEB_INTEGRITY_READY="no"

ide_extract_version_from_filename() {
    local filename="$1"
    local basename_file=""
    local version_string=""

    basename_file="$(basename "$filename")"
    version_string="${basename_file%.*}"
    printf '%s' "$version_string"
}

ide_deb_integrity_check() {
    local deb_file="$1"
    local file_size="0"

    IDE_DEB_INTEGRITY_READY="no"
    print_step_from_common_functions "Checking .deb file integrity..."
    if [[ ! -f "$deb_file" ]]; then
        print_error_from_common_functions ".deb file not found: $deb_file"
        return
    fi

    file_size="$(stat -c%s "$deb_file" 2>/dev/null || echo "0")"
    if [[ "$file_size" -lt 50000000 ]]; then
        print_warning_from_common_functions ".deb file too small ($file_size bytes), expected > 50MB"
        return
    fi
    if ! dpkg-deb --info "$deb_file" >/dev/null 2>&1; then
        print_warning_from_common_functions ".deb file is corrupted (dpkg-deb check failed)"
        return
    fi
    if ! ar t "$deb_file" >/dev/null 2>&1; then
        print_warning_from_common_functions ".deb file is corrupted (ar archive check failed)"
        return
    fi

    IDE_DEB_INTEGRITY_READY="yes"
    print_success_from_common_functions ".deb file integrity check passed"
}
