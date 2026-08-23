#!/bin/bash

# ============================================================================
# COMMON REPOSITORY MANAGEMENT FUNCTIONS
# ============================================================================

# Resolve a Debian/Ubuntu-family host to the (vendor, codename) the PHP repo actually
# publishes -- Sury for Debian, ondrej PPA for Ubuntu. Rolling derivatives report
# ID=kali / VERSION_CODENAME=kali-rolling (Parrot etc. similar), which NEITHER repo
# hosts, so the raw codename would 404. Map such hosts onto the newest hosted Debian
# suite (trixie): it both resolves AND matches the derivative's post-t64 ABI
# (libssl3t64/libcurl4t64/libzip5/libxml2 2.15), whereas pinning to an older suite
# (bookworm) drags in deps the rolling libs cannot satisfy (libxml2/libzip4 absent --
# the exact failure on Kali). Echoes "<vendor> <codename>" on stdout.
# Override the Debian fallback with APT_DEBIAN_CODENAME_DEFAULT.
resolve_php_suite_from_apt_repository_manager() {
    local in_id="$1"
    local in_codename="$2"
    local vendor=""
    local id_like=""

    in_id="$(printf '%s' "$in_id" | tr '[:upper:]' '[:lower:]')"

    # Normalize a derivative (kali, parrot, ...) to its base vendor via os-release ID_LIKE.
    if [ -r /etc/os-release ]; then
        id_like="$(. /etc/os-release 2>/dev/null; printf '%s' "${ID_LIKE:-}")"
    fi
    case "$in_id" in
        ubuntu) vendor="ubuntu" ;;
        debian) vendor="debian" ;;
        *)
            case " $id_like " in
                *ubuntu*) vendor="ubuntu" ;;
                *debian*) vendor="debian" ;;
                *)        vendor="$in_id" ;;
            esac
            ;;
    esac

    local codename="$in_codename"
    if [ "$vendor" = "debian" ]; then
        # Sury publishes only these suites (bullseye/bookworm/trixie -- NOT the rolling
        # testing/unstable suites forky/sid, which 418/404). Clamp anything else to the
        # newest hosted suite the host can actually RUN: Sury's trixie php8.5 needs
        # libc6 >= 2.38, so a bookworm-era rolling spin (glibc < 2.38) must stay on
        # bookworm, while Kali/sid (glibc 2.4x) get trixie, whose post-t64 ABI matches
        # their libraries. Override entirely with APT_DEBIAN_CODENAME_DEFAULT.
        case "$codename" in
            bullseye|bookworm|trixie) : ;;
            *)
                if [ -n "${APT_DEBIAN_CODENAME_DEFAULT:-}" ]; then
                    codename="$APT_DEBIAN_CODENAME_DEFAULT"
                else
                    local _glibc
                    _glibc="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $NF}')"
                    if [ -n "$_glibc" ] && dpkg --compare-versions "$_glibc" ge 2.38 2>/dev/null; then
                        codename="trixie"
                    else
                        codename="bookworm"
                    fi
                fi
                ;;
        esac
    fi
    # Ubuntu codenames pass through: the ondrej PPA tracks Ubuntu series directly.

    printf '%s %s\n' "$vendor" "$codename"
}

# Bridge library/SONAME gaps so Sury PHP 8.5 can install AND run on bleeding-edge
# Debian derivatives (e.g. Kali rolling) that have moved ahead of the suite Sury
# builds against.
#
# Sury's php8.5-* packages (built for Debian <codename>) depend on that suite's library
# package NAMES -- e.g. php8.5-cli/php8.5-xml -> `libxml2` (libxml2.so.2), php8.5-intl ->
# `libicu76`. Rolling derivatives that track Debian sid have already bumped those SONAMEs
# (libxml2 2.15 -> package libxml2-16 / libxml2.so.16; ICU 76 -> libicu77+) and DROPPED
# the old package names with no virtual Provides, so the dependency is unsatisfiable and
# the binaries (linked against the old soname) would not load. libxml2 is core,
# non-disableable PHP, so a missing libxml2 blocks PHP entirely.
#
# For each library dependency of the REQUESTED php packages that is unsatisfiable on this
# host, install Debian <codename>'s build of that exact library (the suite Sury built
# against -> ABI match). Such libs are SONAME-versioned, so they co-install cleanly next
# to the distro's newer version (different package name + different .so file). Only libs
# the requested php packages actually need AND that the host lacks AND that Debian
# publishes are touched -- never a blanket pull (so libsnmp40t64 for php8.5-snmp is left
# alone when that extension is not requested). Idempotent.
#
# Security: each .deb is fetched over HTTPS and verified against the SHA256 in the same
# Packages index stanza before it is installed as root; a mismatch discards the file.
#
# Opt out with PHP_COMPAT_SHIM=0 -- a gap report is printed and the PHP install is left
# to fail loudly instead of silently mixing in a library.
#
# Args: <vendor: ubuntu|debian> <codename> <space-separated php package list>
ensure_php_compat_libs_from_apt_repository_manager() {
    local php_vendor="$1"
    local php_codename="$2"
    local php_pkgs="$3"

    # Only the Debian/Sury path is affected; Ubuntu's ondrej PPA tracks Ubuntu libs.
    [ "$php_vendor" = "debian" ] || return 0
    [ -n "${php_pkgs// /}" ] || return 0

    case "${PHP_COMPAT_SHIM:-${PHP_LIBXML2_COMPAT_SHIM:-1}}" in
        0|false|no|off)
            echo "[php-compat] Compat-lib shim disabled (PHP_COMPAT_SHIM=0); not adjusting libraries." >&2
            echo "[php-compat] If Sury PHP 8.5 deps are unsatisfiable on this distro, the install will fail." >&2
            return 0
            ;;
    esac

    # Be self-contained regardless of caller order (the shim fetches/unpacks on its own).
    command -v curl >/dev/null 2>&1 || ensure_packages_from_apt_repository_manager curl >/dev/null 2>&1 || true
    command -v zcat >/dev/null 2>&1 || ensure_packages_from_apt_repository_manager gzip >/dev/null 2>&1 || true

    local arch
    arch="$(dpkg --print-architecture 2>/dev/null || echo amd64)"

    local tmp
    tmp="$(mktemp -d 2>/dev/null)" || {
        echo "[php-compat] ERROR: mktemp -d failed; refusing a predictable temp path." >&2
        return 1
    }

    # 1) Sury index for the resolved suite -> the php8.5-* dependency lists.
    local sury_idx="$tmp/sury.Packages.gz"
    if ! curl -fsSL -o "$sury_idx" "https://packages.sury.org/php/dists/${php_codename}/main/binary-${arch}/Packages.gz"; then
        echo "[php-compat] WARNING: could not fetch Sury ${php_codename} index; skipping compat pre-resolution." >&2
        rm -rf "$tmp"; return 0
    fi

    # 2) Union of the lib* deps of the requested php packages (strip version constraints
    #    and '|' alternatives). index()-based stanza match -> no regex pitfalls.
    local pkg
    for pkg in $php_pkgs; do
        zcat "$sury_idx" 2>/dev/null \
          | awk -v RS='' -v p="$pkg" 'index($0 "\n", "Package: " p "\n")==1' \
          | sed -n 's/^Depends: //p'
    done > "$tmp/depends.txt" 2>/dev/null
    local libs
    libs="$(tr ',' '\n' < "$tmp/depends.txt" | sed 's/|.*//; s/^[[:space:]]*//; s/[[:space:]].*//' | grep -E '^lib' | sort -u)"

    # 3) Which of those lib deps are UNsatisfiable on this host?
    local gaps="" lib cand
    for lib in $libs; do
        cand="$(apt-cache policy "$lib" 2>/dev/null | awk '/Candidate:/{print $2}')"
        if [ -n "$cand" ] && [ "$cand" != "(none)" ]; then continue; fi
        if dpkg-query -W -f='${Status}' "$lib" 2>/dev/null | grep -q 'install ok installed'; then continue; fi
        gaps="$gaps $lib"
    done
    gaps="$(printf '%s\n' $gaps | sed '/^$/d' | sort -u | tr '\n' ' ')"

    if [ -z "${gaps// /}" ]; then
        rm -rf "$tmp"; return 0
    fi

    echo "[php-compat] Sury PHP 8.5 needs libraries this distro no longer provides:${gaps}" >&2
    echo "[php-compat] (a rolling derivative bumped these SONAMEs past Sury's ${php_codename} build target)" >&2

    # 4) Resolve + integrity-verify each gap lib from Debian <codename> (the suite Sury
    #    built against), then collect the verified .debs.
    local deb_idx="$tmp/debian.Packages.gz"
    if ! curl -fsSL -o "$deb_idx" "https://deb.debian.org/debian/dists/${php_codename}/main/binary-${arch}/Packages.gz"; then
        echo "[php-compat] ERROR: could not fetch Debian ${php_codename} index; cannot provide compat libs." >&2
        rm -rf "$tmp"; return 1
    fi

    local debs=() missing="" stanza fname exp_sha got_sha out
    for lib in $gaps; do
        stanza="$(zcat "$deb_idx" 2>/dev/null | awk -v RS='' -v p="$lib" 'index($0 "\n", "Package: " p "\n")==1' | head -c 200000)"
        fname="$(printf '%s\n' "$stanza" | sed -n 's/^Filename: //p' | head -n1)"
        exp_sha="$(printf '%s\n' "$stanza" | sed -n 's/^SHA256: //p' | head -n1)"
        if [ -z "$fname" ]; then
            echo "[php-compat] NOTE: Debian ${php_codename} has no '${lib}' package; cannot shim it." >&2
            missing="$missing $lib"; continue
        fi
        out="$tmp/${lib}.deb"
        echo "[php-compat] Fetching ${lib} <- https://deb.debian.org/debian/${fname}" >&2
        if ! curl -fsSL -o "$out" "https://deb.debian.org/debian/${fname}"; then
            echo "[php-compat] WARNING: download failed for ${lib}." >&2
            missing="$missing $lib"; continue
        fi
        if [ -z "$exp_sha" ]; then
            echo "[php-compat] ERROR: no SHA256 in index for ${lib}; refusing to install unverified .deb." >&2
            missing="$missing $lib"; continue
        fi
        got_sha="$(sha256sum "$out" 2>/dev/null | awk '{print $1}')"
        if [ "$got_sha" != "$exp_sha" ]; then
            echo "[php-compat] ERROR: SHA256 mismatch for ${lib} (want ${exp_sha}, got ${got_sha}); discarding." >&2
            missing="$missing $lib"; continue
        fi
        debs+=("$out")
    done

    # 5) Install all verified compat libs at once (so any inter-deps resolve together),
    #    non-interactively, keeping existing configs and never letting -f install remove
    #    packages to "fix" the transaction. Diagnostics are NOT swallowed.
    if [ ${#debs[@]} -gt 0 ]; then
        echo "[php-compat] Installing verified compat libs alongside the distro's newer versions..." >&2
        if ! $USE_SUDO env DEBIAN_FRONTEND=noninteractive dpkg -i --force-confold "${debs[@]}"; then
            $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get -f install -y \
                -o APT::Get::Remove=false -o Dpkg::Options::=--force-confold || true
        fi
    fi

    # 6) Verify outcome loudly. A lib that is unshimmable (no Debian package / failed
    #    verify) is reported but not treated as the whole step failing.
    local still_missing=""
    for lib in $gaps; do
        if dpkg-query -W -f='${Status}' "$lib" 2>/dev/null | grep -q 'install ok installed'; then continue; fi
        case " $missing " in *" $lib "*) continue ;; esac
        still_missing="$still_missing $lib"
    done

    rm -rf "$tmp"

    if [ -n "${still_missing// /}" ]; then
        echo "[php-compat] WARNING: compat libs still not installed:${still_missing} -- the PHP packages needing them will fail." >&2
        return 1
    fi
    if [ -n "${missing// /}" ]; then
        echo "[php-compat] NOTE: no verified Debian compat for:${missing} (only extensions needing them are affected)." >&2
    fi
    echo "[php-compat] OK: compat libraries provided for ${php_codename}." >&2
    return 0
}

# Add PHP repository (Ubuntu/Debian) with automatic backup and restore
# Ubuntu: uses ppa.launchpadcontent.net and Launchpad PPA signing key (avoids certificate mismatch with ppa.launchpad.net)
# Debian: uses packages.sury.org and Sury key
add_php_repository_from_apt_repository_manager() {
    local os_id="$1"
    local os_codename="$2"
    local command_to_execute="$3"

    if [ -z "$os_id" ] || [ -z "$os_codename" ]; then
        echo "ERROR: OS ID and codename are required" >&2
        return 1
    fi

    # Normalize derivative -> base vendor (kali -> debian) and clamp to a hosted suite.
    local _resolved
    _resolved="$(resolve_php_suite_from_apt_repository_manager "$os_id" "$os_codename")"
    os_id="${_resolved%% *}"
    os_codename="${_resolved##* }"

    local php_key_url=""
    local php_key_file="/usr/share/keyrings/php-archive-keyring.gpg"
    local php_repo_line=""

    if [[ "$os_id" == "ubuntu" ]]; then
        php_key_url="https://keyserver.ubuntu.com/pks/lookup?op=get&search=0xB8DC7E53946656EFBCE4C1DD71DAEAAB4AD4CAB6"
        php_repo_line="deb [signed-by=$php_key_file] https://ppa.launchpadcontent.net/ondrej/php/ubuntu $os_codename main"
    elif [[ "$os_id" == "debian" ]]; then
        php_key_url="https://packages.sury.org/php/apt.gpg"
        php_repo_line="deb [signed-by=$php_key_file] https://packages.sury.org/php/ $os_codename main"
    else
        echo "ERROR: Unsupported OS: $os_id" >&2
        return 1
    fi

    # Bridge SONAME/library gaps on rolling derivatives before the PHP install runs.
    # The package set = php8.5-* named in the install command plus the project's declared
    # core/extension arrays (extensions installed in a later step -- e.g. php8.5-intl ->
    # libicu76 -- are covered too). The two `declare -p` guards keep the arrays optional.
    local php_pkgs
    php_pkgs="$(printf '%s ' $command_to_execute | grep -oE 'php8\.5[A-Za-z0-9.+-]*' | sort -u | tr '\n' ' ')"
    declare -p PHP85_CORE_PACKAGES >/dev/null 2>&1 && php_pkgs="$php_pkgs ${PHP85_CORE_PACKAGES[*]}"
    declare -p CORE_EXTENSIONS    >/dev/null 2>&1 && php_pkgs="$php_pkgs ${CORE_EXTENSIONS[*]}"
    ensure_php_compat_libs_from_apt_repository_manager "$os_id" "$os_codename" "$php_pkgs"

    execute_with_repo_backup_from_apt_repository_manager \
        "php" \
        "$php_repo_line" \
        "$php_key_url" \
        "$php_key_file" \
        "$command_to_execute"

    return $?
}

# Add PHP repository permanently (no remove after install). Use for idempotent repair: repo stays so install_php_core and re-runs work.
add_php_repository_permanent_from_apt_repository_manager() {
    local os_id="$1"
    local os_codename="$2"
    local command_to_execute="$3"

    if [ -z "$os_id" ] || [ -z "$os_codename" ]; then
        echo "ERROR: OS ID and codename are required" >&2
        return 1
    fi

    # Normalize derivative -> base vendor (kali -> debian) and clamp to a hosted suite.
    local _resolved
    _resolved="$(resolve_php_suite_from_apt_repository_manager "$os_id" "$os_codename")"
    os_id="${_resolved%% *}"
    os_codename="${_resolved##* }"

    local php_key_url=""
    local php_key_file="/usr/share/keyrings/php-archive-keyring.gpg"
    local php_repo_line=""

    if [[ "$os_id" == "ubuntu" ]]; then
        php_key_url="https://keyserver.ubuntu.com/pks/lookup?op=get&search=0xB8DC7E53946656EFBCE4C1DD71DAEAAB4AD4CAB6"
        php_repo_line="deb [signed-by=$php_key_file] https://ppa.launchpadcontent.net/ondrej/php/ubuntu $os_codename main"
    elif [[ "$os_id" == "debian" ]]; then
        php_key_url="https://packages.sury.org/php/apt.gpg"
        php_repo_line="deb [signed-by=$php_key_file] https://packages.sury.org/php/ $os_codename main"
    else
        echo "ERROR: Unsupported OS: $os_id" >&2
        return 1
    fi

    add_apt_repository_from_apt_repository_manager \
        "php" \
        "$php_repo_line" \
        "$php_key_url" \
        "$php_key_file"

    local add_result=$?
    if [ $add_result -ne 0 ]; then
        return $add_result
    fi

    echo "Updating apt cache..."
    $USE_SUDO apt update 2>/dev/null || true

    # Bridge SONAME/library gaps on rolling derivatives before the PHP install runs.
    # Package set = php8.5-* named in the install command plus the project's declared
    # core/extension arrays (so extensions installed in a later step -- e.g. php8.5-intl
    # -> libicu76 -- are covered too). The two `declare -p` guards keep the arrays optional.
    local php_pkgs
    php_pkgs="$(printf '%s ' $command_to_execute | grep -oE 'php8\.5[A-Za-z0-9.+-]*' | sort -u | tr '\n' ' ')"
    declare -p PHP85_CORE_PACKAGES >/dev/null 2>&1 && php_pkgs="$php_pkgs ${PHP85_CORE_PACKAGES[*]}"
    declare -p CORE_EXTENSIONS    >/dev/null 2>&1 && php_pkgs="$php_pkgs ${CORE_EXTENSIONS[*]}"
    ensure_php_compat_libs_from_apt_repository_manager "$os_id" "$os_codename" "$php_pkgs"

    if [ -n "$command_to_execute" ]; then
        echo "Executing: $command_to_execute"
        eval "$command_to_execute"
    fi
    return $?
}

# Add Antigravity repository with automatic backup and restore
add_antigravity_repository_from_apt_repository_manager() {
    local command_to_execute="$1"
    
    local antigravity_key_url="https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg"
    local antigravity_key_file="/etc/apt/keyrings/antigravity-repo-key.gpg"
    local antigravity_repo_line="deb [signed-by=$antigravity_key_file] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main"
    
    execute_with_repo_backup_from_apt_repository_manager \
        "antigravity" \
        "$antigravity_repo_line" \
        "$antigravity_key_url" \
        "$antigravity_key_file" \
        "$command_to_execute"
    
    return $?
}

# Add Docker repository with automatic backup and restore
add_docker_repository_from_apt_repository_manager() {
    local os_codename="$1"
    local command_to_execute="$2"

    if [ -z "$os_codename" ]; then
        echo "ERROR: OS codename is required" >&2
        return 1
    fi

    # Resolve to the vendor + a codename Docker actually publishes. Docker hosts pools ONLY
    # under .../linux/debian and .../linux/ubuntu. A Debian-family derivative (e.g. Kali,
    # ID=kali) must normalize to vendor=debian with a real Debian codename -- never emit
    # Docker's "ubuntu" pool or a kali-rolling suite (Docker hosts neither) onto a Debian
    # box, which would pollute sources with a foreign, non-resolving line. Reuses the shared
    # suite resolver (returns "vendor codename"); only debian/ubuntu are valid Docker vendors.
    local _resolved docker_vendor docker_codename os_id
    os_id="$(. /etc/os-release 2>/dev/null; printf '%s' "${ID:-}")"
    _resolved="$(resolve_php_suite_from_apt_repository_manager "$os_id" "$os_codename")"
    docker_vendor="${_resolved%% *}"
    docker_codename="${_resolved##* }"
    case "$docker_vendor" in debian|ubuntu) : ;; *) docker_vendor="debian" ;; esac

    local docker_key_url="https://download.docker.com/linux/${docker_vendor}/gpg"
    local docker_key_file="/usr/share/keyrings/docker-archive-keyring.gpg"
    local docker_repo_line="deb [arch=$(dpkg --print-architecture) signed-by=$docker_key_file] https://download.docker.com/linux/${docker_vendor} ${docker_codename} stable"

    execute_with_repo_backup_from_apt_repository_manager \
        "docker" \
        "$docker_repo_line" \
        "$docker_key_url" \
        "$docker_key_file" \
        "$command_to_execute"
    
    return $?
}

# Add Microsoft Edge repository with automatic backup and restore
add_edge_repository_from_apt_repository_manager() {
    local command_to_execute="$1"
    
    local edge_key_url="https://packages.microsoft.com/keys/microsoft.asc"
    local edge_key_file="/usr/share/keyrings/microsoft-edge.gpg"
    local edge_repo_line="deb [arch=amd64 signed-by=$edge_key_file] https://packages.microsoft.com/repos/edge stable main"
    
    execute_with_repo_backup_from_apt_repository_manager \
        "edge" \
        "$edge_repo_line" \
        "$edge_key_url" \
        "$edge_key_file" \
        "$command_to_execute"
    
    return $?
}

# Add MariaDB/MySQL repository with automatic backup and restore
# Note: MariaDB uses an official setup script, so we need to handle it differently
add_mysql_repository_from_apt_repository_manager() {
    local os_id="$1"
    local os_codename="$2"
    local command_to_execute="$3"
    
    if [ -z "$os_id" ] || [ -z "$os_codename" ]; then
        echo "ERROR: OS ID and codename are required" >&2
        return 1
    fi
    
    # MariaDB uses an official setup script that handles repository addition
    # We need to backup before running the script, then restore after installation
    local repo_name="mariadb"
    local backup_id=$(date +%Y%m%d_%H%M%S)_${repo_name}
    local backup_dir="$APT_BACKUP_BASE_DIR/$backup_id"
    
    # Initialize backup directory
    if ! init_apt_backup_dir_from_apt_repository_manager; then
        echo "ERROR: Failed to initialize backup directory" >&2
        return 1
    fi
    
    # Backup current state
    if ! backup_apt_sources_from_apt_repository_manager "$backup_id"; then
        echo "ERROR: Failed to backup current state" >&2
        return 1
    fi
    
    # Ensure required packages are available
    if ! ensure_packages_from_apt_repository_manager curl apt-transport-https ca-certificates; then
        echo "ERROR: Failed to install required packages" >&2
        restore_apt_sources_from_apt_repository_manager "$backup_id"
        return 1
    fi
    
    # Download the MariaDB setup script directly to an absolute path. -f makes an
    # HTTP error (e.g. a transient 5xx returning an HTML body) a hard failure
    # instead of saving error HTML and running it; -o avoids writing into (and
    # depending on the writability of) the current working directory.
    local setup_script="/tmp/mariadb_repo_setup"
    if ! curl -fLsS -o "$setup_script" https://r.mariadb.com/downloads/mariadb_repo_setup; then
        echo "ERROR: Failed to download mariadb_repo_setup script" >&2
        restore_apt_sources_from_apt_repository_manager "$backup_id"
        return 1
    fi
    fix_file_permissions_from_apt_repository_manager "$setup_script" "+x"

    # mariadb_repo_setup auto-detects the OS from /etc/os-release and does NOT
    # recognize rolling derivatives (Kali/Parrot report ID=kali / kali-rolling),
    # failing with "Could not identify OS type or version". Normalize such hosts to
    # their base Debian/Ubuntu vendor + a hosted codename (reusing the same mapping
    # the PHP repo uses) and pass --os-type/--os-version explicitly. Debian/Ubuntu
    # are recognized natively and pass through unchanged.
    local mdb_os_args=""
    local _suite="" _vendor="" _codename=""
    case "$(printf '%s' "$os_id" | tr '[:upper:]' '[:lower:]')" in
        ubuntu|debian) : ;;
        *)
            _suite="$(resolve_php_suite_from_apt_repository_manager "$os_id" "$os_codename")"
            _vendor="${_suite%% *}"
            _codename="${_suite##* }"
            if [ -n "$_vendor" ] && [ -n "$_codename" ] && [ "$_vendor" != "$os_id" ]; then
                mdb_os_args="--os-type=$_vendor --os-version=$_codename"
                echo "[mariadb] '$os_id/$os_codename' not natively supported; using $mdb_os_args"
            fi
            ;;
    esac

    # Run the setup script
    if ! $USE_SUDO "$setup_script" --mariadb-server-version="mariadb-10.11" --skip-maxscale --skip-tools $mdb_os_args; then
        echo "ERROR: Failed to setup MariaDB repository" >&2
        $USE_SUDO rm -f "$setup_script"
        restore_apt_sources_from_apt_repository_manager "$backup_id"
        return 1
    fi
    
    $USE_SUDO rm -f "$setup_script"
    
    # Update package list
    $USE_SUDO apt update
    
    # Execute the installation command
    if ! eval "$command_to_execute"; then
        echo "ERROR: Installation command failed" >&2
        restore_apt_sources_from_apt_repository_manager "$backup_id"
        return 1
    fi
    
    # Restore original sources after successful installation
    restore_apt_sources_from_apt_repository_manager "$backup_id"
    
    return 0
}

# Add repository permanently (no restore) - for manage_repositories function
add_apt_repository_from_apt_repository_manager() {
    local repo_name="$1"
    local repo_line="$2"
    local key_url="$3"
    local key_file="$4"
    
    if [ -z "$repo_name" ] || [ -z "$repo_line" ]; then
        echo "ERROR: Repository name and line are required" >&2
        return 1
    fi
    
    # Add GPG key if provided
    if [ -n "$key_url" ] && [ -n "$key_file" ]; then
        echo "Adding GPG key from: $key_url"
        $USE_SUDO mkdir -p "$(dirname "$key_file")" 2>/dev/null || true
        
        # Ensure curl is available
        if ! ensure_packages_from_apt_repository_manager curl; then
            echo "WARNING: Failed to install curl, cannot add GPG key" >&2
            return 1
        fi
        
        if curl -fsSL "$key_url" | $USE_SUDO gpg --dearmor -o "$key_file" 2>/dev/null; then
            echo "GPG key added successfully"
        else
            echo "WARNING: Failed to add GPG key" >&2
            return 1
        fi
    fi
    
    # Add repository source
    local repo_list_file="$APT_SOURCES_LIST_D/${repo_name}.list"
    echo "$repo_line" | $USE_SUDO tee "$repo_list_file" > /dev/null
    
    if [ -f "$repo_list_file" ]; then
        echo "Repository added: $repo_list_file"
        return 0
    else
        echo "ERROR: Failed to add repository" >&2
        return 1
    fi
}

# Remove repository permanently - for manage_repositories function
remove_apt_repository_from_apt_repository_manager() {
    local repo_name="$1"
    
    if [ -z "$repo_name" ]; then
        echo "ERROR: Repository name is required" >&2
        return 1
    fi
    
    # Remove repository file
    local repo_list_file="$APT_SOURCES_LIST_D/${repo_name}.list"
    if [ -f "$repo_list_file" ]; then
        $USE_SUDO rm -f "$repo_list_file"
        echo "Removed repository file: $repo_list_file"
    fi
    
    # Remove GPG key (try common locations)
    local key_files=(
        "/usr/share/keyrings/${repo_name}.gpg"
        "/usr/share/keyrings/${repo_name}-keyring.gpg"
        "/usr/share/keyrings/${repo_name}-archive-keyring.gpg"
        "/etc/apt/trusted.gpg.d/${repo_name}.gpg"
    )
    
    for key_file in "${key_files[@]}"; do
        if [ -f "$key_file" ]; then
            $USE_SUDO rm -f "$key_file"
            echo "Removed GPG key: $key_file"
        fi
    done
    
    # Remove MariaDB specific files
    if [ "$repo_name" = "mariadb" ]; then
        local mariadb_files=(
            "/etc/apt/sources.list.d/mariadb.list"
            "/etc/apt/sources.list.d/mariadb-10.11.list"
            "/etc/apt/sources.list.d/mariadb-maxscale.list"
        )
        for file in "${mariadb_files[@]}"; do
            if [ -f "$file" ]; then
                $USE_SUDO rm -f "$file"
                echo "Removed: $file"
            fi
        done
        
        local mariadb_keys=(
            "/usr/share/keyrings/mariadb-keyring.gpg"
            "/usr/share/keyrings/mariadb-archive-keyring.gpg"
        )
        for key in "${mariadb_keys[@]}"; do
            if [ -f "$key" ]; then
                $USE_SUDO rm -f "$key"
                echo "Removed: $key"
            fi
        done
    fi
    
    echo "Repository removal completed: $repo_name"
    return 0
}

# Manage repositories based on control variables (for 3_setting_base.sh)
# This function manages repositories without automatic restore (permanent addition)
manage_repositories_from_apt_repository_manager() {
    echo "Managing repositories based on control variables..."
    
    # Get control variables
    local install_edge=$(get_global_var "INSTALL_EDGE" "false")
    local install_mysql=$(get_global_var "INSTALL_MYSQL" "false")
    
    echo "INSTALL_EDGE: $install_edge, INSTALL_MYSQL: $install_mysql"
    
    # Initialize backup directory (ensure original backup exists)
    if ! init_apt_backup_dir_from_apt_repository_manager; then
        echo "WARNING: Failed to initialize backup directory, continuing anyway..." >&2
    fi
    
    # Manage Edge repository
    if [ "$install_edge" = "true" ]; then
        echo "Managing Edge repository..."
        local edge_key_url="https://packages.microsoft.com/keys/microsoft.asc"
        local edge_key_file="/usr/share/keyrings/microsoft-edge.gpg"
        local edge_repo_line="deb [arch=amd64 signed-by=$edge_key_file] https://packages.microsoft.com/repos/edge stable main"
        
        # Check if already added
        if [ -f "/etc/apt/sources.list.d/microsoft-edge.list" ]; then
            echo "Edge repository already added"
        else
            # Add Edge repository (permanent, no restore)
            add_apt_repository_from_apt_repository_manager \
                "edge" \
                "$edge_repo_line" \
                "$edge_key_url" \
                "$edge_key_file"
            
            if [ $? -eq 0 ]; then
                $USE_SUDO apt update
                echo "Edge repository added successfully"
            else
                echo "Warning: Edge repository addition failed"
            fi
        fi
    elif [ "$install_edge" = "false" ]; then
        echo "Removing Edge repository..."
        remove_apt_repository_from_apt_repository_manager "edge"
    else
        echo "INSTALL_EDGE not set or invalid: $install_edge"
    fi
    
    # Manage MySQL repository
    if [ "$install_mysql" = "true" ]; then
        echo "Managing MySQL repository..."
        
        # Detect OS
        local os_id=""
        local os_codename=""
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            os_id="$ID"
            os_codename="$VERSION_CODENAME"
        fi
        
        # Check if already added
        local mariadb_files=(
            "/etc/apt/sources.list.d/mariadb.list"
            "/etc/apt/sources.list.d/mariadb-10.11.list"
            "/etc/apt/sources.list.d/mariadb-maxscale.list"
        )
        
        local already_added=false
        for file in "${mariadb_files[@]}"; do
            if [ -f "$file" ]; then
                already_added=true
                echo "MariaDB repository already added at: $file"
                break
            fi
        done
        
        if [ "$already_added" = false ]; then
            # Use MariaDB setup script (permanent, no restore)
            # Ensure required packages are available
            if ! ensure_packages_from_apt_repository_manager curl apt-transport-https ca-certificates; then
                echo "Warning: Failed to install required packages" >&2
                return 1
            fi
            
            local setup_script="/tmp/mariadb_repo_setup"
            # -f: fail on HTTP error (don't save/run error HTML); -o: absolute path,
            # never the current working directory.
            if curl -fLsS -o "$setup_script" https://r.mariadb.com/downloads/mariadb_repo_setup; then
                fix_file_permissions_from_apt_repository_manager "$setup_script" "+x"
                
                if $USE_SUDO "$setup_script" --mariadb-server-version="mariadb-10.11" --skip-maxscale --skip-tools; then
                    $USE_SUDO rm -f "$setup_script"
                    $USE_SUDO apt update
                    echo "MariaDB repository added successfully"
                else
                    echo "Warning: MariaDB repository addition failed"
                    $USE_SUDO rm -f "$setup_script"
                fi
            else
                echo "Warning: Failed to download MariaDB setup script"
            fi
        fi
    elif [ "$install_mysql" = "false" ]; then
        echo "Removing MySQL repository..."
        remove_apt_repository_from_apt_repository_manager "mariadb"
    else
        echo "INSTALL_MYSQL not set or invalid: $install_mysql"
    fi
    
    echo "Repository management completed"
}

# Clean up all custom repositories and restore to original state
cleanup_all_custom_repositories_from_apt_repository_manager() {
    echo "Cleaning up all custom repositories..."
    
    # Initialize backup directory
    if ! init_apt_backup_dir_from_apt_repository_manager; then
        echo "WARNING: Failed to initialize backup directory, continuing anyway..." >&2
    fi
    
    # Backup current state before cleanup
    local cleanup_backup_id="cleanup_$(date +%Y%m%d_%H%M%S)"
    if ! backup_apt_sources_from_apt_repository_manager "$cleanup_backup_id"; then
        echo "WARNING: Failed to backup before cleanup, continuing anyway..." >&2
    fi
    
    # Remove all custom repository files (keep system defaults)
    echo "Removing custom repository files..."
    $USE_SUDO find "$APT_SOURCES_LIST_D" -name "*.list" -type f -exec rm -f {} \; 2>/dev/null || true
    
    # SAFETY: do NOT bulk-delete *.gpg from /usr/share/keyrings -- that wipes the
    # distro's own signing keys (breaking apt verification system-wide) on Debian/Kali.
    # Custom repo keys are removed individually by the per-repo remove functions.
    
    # SAFETY: likewise do NOT bulk-delete *.gpg from /etc/apt/trusted.gpg.d.
    
    # Clean apt cache
    echo "Cleaning APT cache..."
    $USE_SUDO apt clean 2>/dev/null || true
    $USE_SUDO apt autoclean 2>/dev/null || true
    
    echo "Custom repositories cleanup completed"
    echo "Backup saved at: $APT_BACKUP_BASE_DIR/$cleanup_backup_id"
    return 0
}

# Restore to original backup (first-time backup)
restore_to_original_from_apt_repository_manager() {
    echo "Restoring APT sources to original state..."
    
    if [ ! -d "$APT_ORIGINAL_BACKUP_DIR" ]; then
        echo "ERROR: Original backup not found. Creating it now..." >&2
        backup_original_apt_sources_from_apt_repository_manager
    fi
    
    # Restore from original backup
    restore_apt_sources_from_apt_repository_manager "original"
    
    if [ $? -eq 0 ]; then
        echo "Successfully restored to original state"
        $USE_SUDO apt update 2>/dev/null || true
        return 0
    else
        echo "ERROR: Failed to restore to original state" >&2
        return 1
    fi
}

