#!/bin/bash
# Download, archive, and post-install display helpers used by common_functions.sh.

# Common download function with fallback support
download_with_fallback_from_common_functions() {
    local download_urls=("$@")
    local output_file="${download_urls[-1]}"
    unset 'download_urls[-1]'

    local downloaded=false

    print_step_from_common_functions "Starting download to: $output_file"

    # Try curl first (primary method)
    if command -v curl >/dev/null 2>&1; then
        for url in "${download_urls[@]}"; do
            print_step_from_common_functions "Attempting curl download from: $url"

            # Try with different curl options
            local curl_options=(
                "-L --connect-timeout 30 --max-time 600 --retry 3 --retry-delay 2"
                "-L --connect-timeout 60 --max-time 900 --retry 2 --retry-delay 5 -k"
                "-L --connect-timeout 120 --max-time 1200 --retry 1 -k"
            )

            for options in "${curl_options[@]}"; do
                print_step_from_common_functions "Using curl options: $options"
                if eval "curl $options --progress-bar -o \"$output_file\" \"$url\""; then
                    print_success_from_common_functions "Successfully downloaded with curl from: $url"
                    downloaded=true
                    break 2
                else
                    print_warning_from_common_functions "Failed with options: $options"
                    rm -f "$output_file" 2>/dev/null
                fi
            done

            print_warning_from_common_functions "All curl attempts failed for: $url"
        done
    else
        print_warning_from_common_functions "curl is not available, skipping curl method"
    fi

    # Fallback to wget if curl failed
    if [ "$downloaded" = "false" ]; then
        print_step_from_common_functions "curl failed. Checking if wget is available..."
        if command -v wget >/dev/null 2>&1; then
            print_step_from_common_functions "Trying with wget as fallback..."

            for url in "${download_urls[@]}"; do
                print_step_from_common_functions "Attempting wget download from: $url"

                # Try with different wget options
                local wget_options=(
                    "--timeout=30 --tries=3 --show-progress"
                    "--timeout=60 --tries=2 --no-check-certificate"
                    "--timeout=120 --tries=1 --no-check-certificate"
                )

                for options in "${wget_options[@]}"; do
                    print_step_from_common_functions "Using wget options: $options"
                    if eval "wget $options -O \"$output_file\" \"$url\""; then
                        print_success_from_common_functions "Successfully downloaded with wget from: $url"
                        downloaded=true
                        break 2
                    else
                        print_warning_from_common_functions "Failed with options: $options"
                        rm -f "$output_file" 2>/dev/null
                    fi
                done

                print_warning_from_common_functions "All wget attempts failed for: $url"
            done
        else
            print_warning_from_common_functions "wget is not available either"
        fi
    fi

    if [ "$downloaded" = "false" ]; then
        print_error_from_common_functions "All download methods failed"
        print_error_from_common_functions "Please check your network connectivity or try manually downloading:"
        for url in "${download_urls[@]}"; do
            echo "  $url"
        done
        return 1
    fi

    return 0
}

# Enhanced download function with browser headers and redirect support
# Usage: download_with_browser_headers_from_common_functions <url> <output_dir> [max_retries]
# Returns: Path to downloaded file (echoes to stdout)
# Exit codes: 0=success, 1=failure
download_with_browser_headers_from_common_functions() {
    local url="$1"
    local output_dir="$2"
    local max_retries="${3:-3}"

    if [[ -z "$url" ]] || [[ -z "$output_dir" ]]; then
        print_error_from_common_functions "Usage: download_with_browser_headers_from_common_functions <url> <output_dir> [max_retries]"
        return 1
    fi

    # Create output directory if it doesn't exist
    mkdir -p "$output_dir" 2>/dev/null || true

    # Browser User-Agent header
    local user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    print_step_from_common_functions "Attempting to download from: $url"
    print_info_from_common_functions "Output directory: $output_dir"

    local retry_count=0
    local downloaded=false
    local final_file=""

    while [[ $retry_count -lt $max_retries ]]; do
        if [[ $retry_count -gt 0 ]]; then
            print_warning_from_common_functions "Retry attempt $retry_count/$max_retries..."
            sleep 2
        fi

        # Try wget first (preferred for showing progress)
        if command -v wget >/dev/null 2>&1; then
            print_step_from_common_functions "Using wget with browser headers..."

            # Get the final redirect URL and filename
            local temp_headers="/tmp/download_headers_$$.txt"

            # First, do a HEAD request to get final URL and filename
            if wget --spider --server-response \
                --user-agent="$user_agent" \
                --max-redirect=10 \
                "$url" 2>&1 | tee "$temp_headers" | grep -q "HTTP/"; then

                # Extract filename from Content-Disposition or URL
                local filename=""
                if grep -q "Content-Disposition" "$temp_headers"; then
                    filename=$(grep "Content-Disposition" "$temp_headers" | \
                        grep -oP 'filename=["'"'"']?\K[^"'"'"';]+' | tail -1)
                fi

                # If no filename from header, extract from final URL
                if [[ -z "$filename" ]]; then
                    local final_url=$(grep "Location:" "$temp_headers" | tail -1 | awk '{print $2}' | tr -d '\r')
                    if [[ -n "$final_url" ]]; then
                        filename=$(basename "$final_url")
                    else
                        filename=$(basename "$url")
                    fi
                fi

                # Remove any query parameters from filename
                filename="${filename%%\?*}"

                # Ensure filename is not empty
                if [[ -z "$filename" ]]; then
                    filename="download_$(date +%s)"
                fi

                final_file="$output_dir/$filename"
                print_info_from_common_functions "Target file: $filename"

                # Check if file already exists and is valid
                if [[ -f "$final_file" ]]; then
                    local existing_size=$(stat -c%s "$final_file" 2>/dev/null || stat -f%z "$final_file" 2>/dev/null || echo "0")
                    print_info_from_common_functions "File already exists: $filename ($existing_size bytes)"

                    # Get remote file size from Content-Length header
                    local remote_size=$(grep -i "Content-Length:" "$temp_headers" | tail -1 | awk '{print $2}' | tr -d '\r' || echo "0")

                    if [[ "$remote_size" -gt 0 ]] && [[ "$existing_size" -eq "$remote_size" ]]; then
                        # File size matches and is valid (>50MB for Cursor/VSCode)
                        if [[ "$existing_size" -gt 52428800 ]]; then
                            print_success_from_common_functions "File already downloaded and verified: $filename ($existing_size bytes)"
                            print_info_from_common_functions "Skipping download"
                            downloaded=true
                            rm -f "$temp_headers"
                            echo "$final_file"
                            return 0
                        else
                            print_warning_from_common_functions "File size too small ($existing_size bytes), re-downloading"
                            rm -f "$final_file"
                        fi
                    elif [[ "$remote_size" -gt 0 ]]; then
                        print_warning_from_common_functions "File size mismatch (local: $existing_size bytes, remote: $remote_size bytes)"
                        print_info_from_common_functions "Re-downloading file"
                        rm -f "$final_file"
                    else
                        print_warning_from_common_functions "Could not verify remote file size, checking local file"
                        # If we can't get remote size, trust local file if it's large enough
                        if [[ "$existing_size" -gt 52428800 ]]; then
                            print_success_from_common_functions "Local file appears valid: $filename ($existing_size bytes)"
                            print_info_from_common_functions "Skipping download"
                            downloaded=true
                            rm -f "$temp_headers"
                            echo "$final_file"
                            return 0
                        else
                            print_warning_from_common_functions "Local file too small ($existing_size bytes), re-downloading"
                            rm -f "$final_file"
                        fi
                    fi
                fi

                # Now download with progress (keep stderr for progress display)
                echo ""  # Add newline before progress bar
                print_info_from_common_functions "Downloading to: $final_file"

                if wget --show-progress --progress=bar:force \
                    --user-agent="$user_agent" \
                    --max-redirect=10 \
                    --timeout=30 \
                    --tries=2 \
                    -O "$final_file" \
                    "$url"; then

                    echo ""  # Add newline after progress bar

                    # Wait a moment for file system to sync
                    sleep 1

                    # Verify file was downloaded and has size > 0
                    if [[ -f "$final_file" ]]; then
                        if [[ -s "$final_file" ]]; then
                            local file_size=$(stat -c%s "$final_file" 2>/dev/null || stat -f%z "$final_file" 2>/dev/null || echo "0")
                            print_success_from_common_functions "Download successful: $filename ($file_size bytes)"
                            downloaded=true
                            rm -f "$temp_headers"
                            echo "$final_file"
                            return 0
                        else
                            print_warning_from_common_functions "Downloaded file is empty (0 bytes): $final_file"
                            rm -f "$final_file"
                        fi
                    else
                        print_warning_from_common_functions "Downloaded file not found: $final_file"
                    fi
                else
                    echo ""  # Add newline after failed download
                    print_warning_from_common_functions "wget download failed (exit code: $?)"
                    rm -f "$final_file"
                fi
            else
                print_warning_from_common_functions "wget spider check failed"
            fi

            rm -f "$temp_headers"
        fi

        # Try curl as fallback
        if [[ "$downloaded" = "false" ]] && command -v curl >/dev/null 2>&1; then
            print_step_from_common_functions "Using curl with browser headers..."

            # Get final filename from redirect
            local redirect_url=$(curl -sIL \
                -A "$user_agent" \
                --max-redirs 10 \
                "$url" | grep -i "^location:" | tail -1 | awk '{print $2}' | tr -d '\r')

            local filename=""
            if [[ -n "$redirect_url" ]]; then
                filename=$(basename "$redirect_url")
            else
                filename=$(basename "$url")
            fi

            # Remove query parameters
            filename="${filename%%\?*}"

            if [[ -z "$filename" ]]; then
                filename="download_$(date +%s)"
            fi

            final_file="$output_dir/$filename"
            print_info_from_common_functions "Target file: $filename"

            # Check if file already exists and is valid
            if [[ -f "$final_file" ]]; then
                local existing_size=$(stat -c%s "$final_file" 2>/dev/null || stat -f%z "$final_file" 2>/dev/null || echo "0")
                print_info_from_common_functions "File already exists: $filename ($existing_size bytes)"

                # Get remote file size from Content-Length header using curl
                local remote_size=$(curl -sIL \
                    -A "$user_agent" \
                    --max-redirs 10 \
                    "$url" | grep -i "^content-length:" | tail -1 | awk '{print $2}' | tr -d '\r' || echo "0")

                if [[ "$remote_size" -gt 0 ]] && [[ "$existing_size" -eq "$remote_size" ]]; then
                    # File size matches and is valid (>50MB for Cursor/VSCode)
                    if [[ "$existing_size" -gt 52428800 ]]; then
                        print_success_from_common_functions "File already downloaded and verified: $filename ($existing_size bytes)"
                        print_info_from_common_functions "Skipping download"
                        downloaded=true
                        echo "$final_file"
                        return 0
                    else
                        print_warning_from_common_functions "File size too small ($existing_size bytes), re-downloading"
                        rm -f "$final_file"
                    fi
                elif [[ "$remote_size" -gt 0 ]]; then
                    print_warning_from_common_functions "File size mismatch (local: $existing_size bytes, remote: $remote_size bytes)"
                    print_info_from_common_functions "Re-downloading file"
                    rm -f "$final_file"
                else
                    print_warning_from_common_functions "Could not verify remote file size, checking local file"
                    # If we can't get remote size, trust local file if it's large enough
                    if [[ "$existing_size" -gt 52428800 ]]; then
                        print_success_from_common_functions "Local file appears valid: $filename ($existing_size bytes)"
                        print_info_from_common_functions "Skipping download"
                        downloaded=true
                        echo "$final_file"
                        return 0
                    else
                        print_warning_from_common_functions "Local file too small ($existing_size bytes), re-downloading"
                        rm -f "$final_file"
                    fi
                fi
            fi

            # Download with curl showing progress
            echo ""  # Add newline before progress bar
            print_info_from_common_functions "Downloading to: $final_file"

            if curl -L --progress-bar \
                -A "$user_agent" \
                --max-redirs 10 \
                --connect-timeout 30 \
                --max-time 600 \
                -o "$final_file" \
                "$url"; then

                echo ""  # Add newline after progress bar

                # Wait a moment for file system to sync
                sleep 1

                # Verify file was downloaded and has size > 0
                if [[ -f "$final_file" ]]; then
                    if [[ -s "$final_file" ]]; then
                        local file_size=$(stat -c%s "$final_file" 2>/dev/null || stat -f%z "$final_file" 2>/dev/null || echo "0")
                        print_success_from_common_functions "Download successful: $filename ($file_size bytes)"
                        downloaded=true
                        echo "$final_file"
                        return 0
                    else
                        print_warning_from_common_functions "Downloaded file is empty (0 bytes): $final_file"
                        rm -f "$final_file"
                    fi
                else
                    print_warning_from_common_functions "Downloaded file not found: $final_file"
                fi
            else
                echo ""  # Add newline after failed download
                print_warning_from_common_functions "curl download failed (exit code: $?)"
                rm -f "$final_file"
            fi
        fi

        retry_count=$((retry_count + 1))
    done

    if [[ "$downloaded" = "false" ]]; then
        print_error_from_common_functions "All download attempts failed after $max_retries retries"
        print_error_from_common_functions "URL: $url"
        return 1
    fi

    return 0
}

# Check if downloaded file exists and has valid size
check_existing_download_from_common_functions() {
    local file_path="$1"
    local min_size="${2:-20971520}"  # Default 20MB

    if [ -f "$file_path" ]; then
        print_step_from_common_functions "Found existing download file: $file_path"
        local file_size=$(stat -c%s "$file_path" 2>/dev/null || echo "0")
        if [ "$file_size" -gt "$min_size" ]; then
            print_success_from_common_functions "Existing file size looks good ($file_size bytes), skipping download"
            return 0
        else
            print_warning_from_common_functions "Existing file size too small ($file_size bytes), will re-download"
            $USE_SUDO rm -f "$file_path"
            return 1
        fi
    fi
    return 1
}

# Extract compressed archive (tar.gz, tar.xz, zip)
extract_archive_from_common_functions() {
    local archive_file="$1"
    local target_dir="$2"
    local strip_components="${3:-1}"

    if [ ! -f "$archive_file" ]; then
        print_error_from_common_functions "Archive file not found: $archive_file"
        return 1
    fi

    print_step_from_common_functions "Extracting archive: $archive_file"
    $USE_SUDO mkdir -p "$target_dir"

    case "$archive_file" in
        *.tar.gz|*.tgz)
            if $USE_SUDO tar -xzf "$archive_file" -C "$target_dir" --strip-components="$strip_components"; then
                print_success_from_common_functions "Successfully extracted tar.gz archive"
                return 0
            fi
            ;;
        *.tar.xz)
            if $USE_SUDO tar -xf "$archive_file" -C "$target_dir" --strip-components="$strip_components"; then
                print_success_from_common_functions "Successfully extracted tar.xz archive"
                return 0
            fi
            ;;
        *.zip)
            if $USE_SUDO unzip -q "$archive_file" -d "$target_dir"; then
                print_success_from_common_functions "Successfully extracted zip archive"
                return 0
            fi
            ;;
        *)
            print_error_from_common_functions "Unsupported archive format: $archive_file"
            return 1
            ;;
    esac

    print_error_from_common_functions "Failed to extract archive: $archive_file"
    return 1
}

# Clean up temporary files and directories
cleanup_temp_files_from_common_functions() {
    local file_or_dir="$1"

    if [ -z "$file_or_dir" ]; then
        print_warning_from_common_functions "No file or directory specified for cleanup"
        return 1
    fi

    if [ -e "$file_or_dir" ]; then
        print_step_from_common_functions "Cleaning up: $file_or_dir"
        $USE_SUDO rm -rf "$file_or_dir" 2>/dev/null
        if [ $? -eq 0 ]; then
            print_success_from_common_functions "Cleanup completed: $file_or_dir"
            return 0
        else
            print_warning_from_common_functions "Failed to cleanup: $file_or_dir"
            return 1
        fi
    fi

    return 0
}

# Smart print function with automatic type detection (from common_functions.sh)
smart_print_from_common_functions() {
    local msg="$1"
    local type="${2:-auto}"

    # Auto-detect message type if not specified
    if [ "$type" = "auto" ]; then
        case "$msg" in
            *"error"*|*"Error"*|*"ERROR"*|*"failed"*|*"Failed"*|*"FAILED"*|*"???*|*"???*)
                type="error"
                ;;
            *"success"*|*"Success"*|*"SUCCESS"*|*"completed"*|*"Completed"*|*"???*|*"???*)
                type="success"
                ;;
            *"warning"*|*"Warning"*|*"WARNING"*|*"warn"*|*"Warn"*|*"???*|*"????"*)
                type="warning"
                ;;
            *"info"*|*"Info"*|*"INFO"*|*"note"*|*"Note"*|*"???*|*"????"*)
                type="info"
                ;;
            *"debug"*|*"Debug"*|*"DEBUG"*|*"????"*)
                type="debug"
                ;;
            *)
                type="normal"
                ;;
        esac
    fi

    # Call appropriate print method based on type
    case "$type" in
        "error")
            print_error_from_common_functions "$msg"
            ;;
        "success")
            print_success_from_common_functions "$msg"
            ;;
        "warning")
            print_warning_from_common_functions "$msg"
            ;;
        "info")
            print_info_from_common_functions "$msg"
            ;;
        "debug")
            print_debug_from_common_functions "$msg"
            ;;
        "normal"|*)
            echo "$msg"
            ;;
    esac
}

# Debug print function (from common_functions.sh)
print_debug_from_common_functions() {
    local msg="$1"
    echo -e "\033[0;35m[DEBUG] ${msg}\033[0m"
}

# Print file content with prefix (from common_functions.sh)
print_file_with_prefix_from_common_functions() {
    local file_path="$1"
    local prefix="${2:-    }"

    if [[ ! -f "$file_path" ]]; then
        print_warning_from_common_functions "File not found: $file_path"
        return 1
    fi

    while IFS= read -r line || [[ -n "$line" ]]; do
        echo "${prefix}${line}"
    done < "$file_path"
}

# Show post-install artifacts for verification (from common_functions.sh)
show_post_install_artifacts_from_common_functions() {
    local launch_script="$1"
    local desktop_entry="$2"
    local system_desktop_disabled="$3"

    print_step_from_common_functions "Displaying generated launch artifacts"

    if [[ -n "$launch_script" ]] && [[ -f "$launch_script" ]]; then
        print_info_from_common_functions "Launch script: $launch_script"
        print_file_with_prefix_from_common_functions "$launch_script"
        echo ""
    fi

    if [[ -n "$desktop_entry" ]] && [[ -f "$desktop_entry" ]]; then
        print_info_from_common_functions "Desktop entry: $desktop_entry"
        print_file_with_prefix_from_common_functions "$desktop_entry"
        echo ""
    fi

    if [[ -n "$system_desktop_disabled" ]] && [[ -f "$system_desktop_disabled" ]]; then
        print_info_from_common_functions "System desktop entry disabled: $system_desktop_disabled"
    fi
}

# ============================================================================
