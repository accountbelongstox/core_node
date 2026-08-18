#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# APT Sources Restore (common area) - the distro-aware self-heal for
# /etc/apt sources pollution: foreign-distro suite lines (e.g. ubuntu
# noble lines on a Debian bookworm host, the breakage that leaves
# bison/re2c/flex with "no installation candidate"). Converges the
# NATIVE distro sources using the formats each distro documents as its
# current default:
#   Debian 12 (bookworm): one-line sources.list, components include
#     non-free-firmware (bookworm release notes, ch. 5.1.1)
#   Debian >= 13 (trixie): deb822 /etc/apt/sources.list.d/debian.sources
#   Ubuntu >= 24.04 (noble): deb822 ubuntu.sources (Ubuntu deb822 spec)
#   Ubuntu < 24.04: one-line sources.list
#   Kali: deb822 kali.sources (kali.org apt-sources doc; rolling suite)
# Foreign lines are only COMMENTED OUT (kept visible); a one-time backup
# is kept. Idempotent: a healthy system no-ops and touches nothing.
#
# Consumers: 3_setting_base.sh (after repository repair, as the FINAL
# writer so a polluted "original" restore cannot survive) and
# frankenphp_static_prereq.sh (build toolchain convergence).
#
# STDOUT CONTRACT: all logs go to stderr - frankenphp_static_builder.sh
# captures stdout as the candidate binary path.
# Sets APT_SOURCES_RESTORE_CHANGED="true" when it modified anything.
# Standalone: apt_sources_restore.sh ensure | check.

APT_SOURCES_RESTORE_TAG="apt-sources-restore"
APT_SOURCES_RESTORE_LIST="/etc/apt/sources.list"
APT_SOURCES_RESTORE_LIST_D="/etc/apt/sources.list.d"
APT_SOURCES_RESTORE_BACKUP_SUFFIX=".pre-apt-sources-restore"
APT_SOURCES_RESTORE_MARK="# disabled-by-apt-sources-restore"
APT_SOURCES_RESTORE_DEBIAN_MIRROR="http://deb.debian.org/debian"
APT_SOURCES_RESTORE_DEBIAN_SECURITY_MIRROR="http://security.debian.org/debian-security"
APT_SOURCES_RESTORE_UBUNTU_MIRROR="http://archive.ubuntu.com/ubuntu"
APT_SOURCES_RESTORE_UBUNTU_SECURITY_MIRROR="http://security.ubuntu.com/ubuntu"
APT_SOURCES_RESTORE_KALI_MIRROR="http://http.kali.org/kali"
APT_SOURCES_RESTORE_DEBIAN_KEYRING="/usr/share/keyrings/debian-archive-keyring.gpg"
APT_SOURCES_RESTORE_UBUNTU_KEYRING="/usr/share/keyrings/ubuntu-archive-keyring.gpg"
APT_SOURCES_RESTORE_KALI_KEYRING="/usr/share/keyrings/kali-archive-keyring.gpg"
# deb822 file names each distro documents as its default location.
APT_SOURCES_RESTORE_DEBIAN_SOURCES_FILE="debian.sources"
APT_SOURCES_RESTORE_UBUNTU_SOURCES_FILE="ubuntu.sources"
APT_SOURCES_RESTORE_KALI_SOURCES_FILE="kali.sources"
# deb822 default starting versions (Debian trixie=13, Ubuntu noble=24.04).
APT_SOURCES_RESTORE_DEBIAN_DEB822_MIN="13"
APT_SOURCES_RESTORE_UBUNTU_DEB822_MIN="24"
APT_SOURCES_RESTORE_CHANGED="false"

# Host OS id ("debian"|"ubuntu"|"kali"|""; subshell so no vars leak).
apt_sources_restore_os_id() {
    ( . /etc/os-release 2>/dev/null; echo "${ID:-}" )
}

# Host release codename ("bookworm"|"noble"|"kali-rolling"|"").
apt_sources_restore_codename() {
    ( . /etc/os-release 2>/dev/null; echo "${VERSION_CODENAME:-}" )
}

# Host major version ("12" for bookworm; "0" when unknown).
apt_sources_restore_version_id() {
    ( . /etc/os-release 2>/dev/null; echo "${VERSION_ID:-0}" )
}

# Foreign-suite regex for ACTIVE deb lines in sources.list (wrong distro
# for this host). sources.list.d drop-ins are owned by their repos and
# are never touched.
apt_sources_restore_foreign_pattern() {
    case "$1" in
        debian) echo 'ubuntu\.com/' ;;
        ubuntu) echo 'debian\.(org|com)/' ;;
        kali) echo 'ubuntu\.com/|debian\.(org|com)/' ;;
        *) echo "" ;;
    esac
}

# Active foreign deb lines in sources.list (empty when clean).
apt_sources_restore_foreign_lines() {
    local pattern=""
    pattern="$(apt_sources_restore_foreign_pattern "$1")"
    [ -n "$pattern" ] || return 0
    grep -E "^[[:space:]]*deb .*(${pattern})" "$APT_SOURCES_RESTORE_LIST" 2>/dev/null
}

# True when sources.list carries a native one-line entry for this
# distro+codename (mirror host + suite word).
apt_sources_restore_oneline_present() {
    local os_id="$1"
    local codename="$2"
    local native_re=""
    case "$os_id" in
        debian) native_re='deb\.debian\.org|security\.debian\.org' ;;
        ubuntu) native_re='archive\.ubuntu\.com|security\.ubuntu\.com' ;;
        kali) native_re='kali\.org' ;;
        *) return 1 ;;
    esac
    grep -E "^[[:space:]]*deb .*(${native_re}).*[[:space:]/]${codename}([[:space:]]|-|\$)" \
        "$APT_SOURCES_RESTORE_LIST" 2>/dev/null | grep -q .
}

# True when the distro's canonical deb822 file carries the native mirror
# and the release suite.
apt_sources_restore_deb822_present() {
    local os_id="$1"
    local codename="$2"
    local sources_file=""
    local native_re=""
    case "$os_id" in
        debian) sources_file="$APT_SOURCES_RESTORE_DEBIAN_SOURCES_FILE"; native_re='deb\.debian\.org|security\.debian\.org' ;;
        ubuntu) sources_file="$APT_SOURCES_RESTORE_UBUNTU_SOURCES_FILE"; native_re='archive\.ubuntu\.com|security\.ubuntu\.com' ;;
        kali) sources_file="$APT_SOURCES_RESTORE_KALI_SOURCES_FILE"; native_re='kali\.org' ;;
        *) return 1 ;;
    esac
    [ -f "${APT_SOURCES_RESTORE_LIST_D}/${sources_file}" ] || return 1
    grep -qE "^URIs:.*(${native_re})" "${APT_SOURCES_RESTORE_LIST_D}/${sources_file}" 2>/dev/null \
        && grep -qE "^Suites:.*${codename}([[:space:]]|\$)" "${APT_SOURCES_RESTORE_LIST_D}/${sources_file}" 2>/dev/null
}

# True when native sources exist in EITHER accepted format.
apt_sources_restore_native_present() {
    apt_sources_restore_oneline_present "$1" "$2" \
        || apt_sources_restore_deb822_present "$1" "$2"
}

# Official component list per distro (Debian bookworm+ / Kali carry the
# non-free-firmware split; Ubuntu never does).
apt_sources_restore_components() {
    local os_id="$1"
    local version_id="$2"
    case "$os_id" in
        debian)
            if [ "$version_id" -ge 12 ] 2>/dev/null; then
                echo "main contrib non-free non-free-firmware"
            else
                echo "main contrib non-free"
            fi
            ;;
        ubuntu)
            echo "main restricted universe multiverse"
            ;;
        kali)
            echo "main contrib non-free non-free-firmware"
            ;;
    esac
}

# Signed-By keyring path for the distro (empty when the keyring file is
# absent - apt then falls back to its trusted key store).
apt_sources_restore_keyring() {
    case "$1" in
        debian) [ -f "$APT_SOURCES_RESTORE_DEBIAN_KEYRING" ] && echo "$APT_SOURCES_RESTORE_DEBIAN_KEYRING" ;;
        ubuntu) [ -f "$APT_SOURCES_RESTORE_UBUNTU_KEYRING" ] && echo "$APT_SOURCES_RESTORE_UBUNTU_KEYRING" ;;
        kali) [ -f "$APT_SOURCES_RESTORE_KALI_KEYRING" ] && echo "$APT_SOURCES_RESTORE_KALI_KEYRING" ;;
    esac
}

# Render the native one-line block (stdout).
apt_sources_restore_render_oneline() {
    local os_id="$1"
    local codename="$2"
    local version_id="$3"
    local components=""
    components="$(apt_sources_restore_components "$os_id" "$version_id")"
    case "$os_id" in
        debian)
            echo "# Debian repositories"
            echo "deb ${APT_SOURCES_RESTORE_DEBIAN_MIRROR} ${codename} ${components}"
            echo "deb ${APT_SOURCES_RESTORE_DEBIAN_MIRROR} ${codename}-updates ${components}"
            echo "deb ${APT_SOURCES_RESTORE_DEBIAN_SECURITY_MIRROR} ${codename}-security ${components}"
            ;;
        ubuntu)
            echo "# Ubuntu repositories"
            echo "deb ${APT_SOURCES_RESTORE_UBUNTU_MIRROR}/ ${codename} ${components}"
            echo "deb ${APT_SOURCES_RESTORE_UBUNTU_MIRROR}/ ${codename}-updates ${components}"
            echo "deb ${APT_SOURCES_RESTORE_UBUNTU_MIRROR}/ ${codename}-backports ${components}"
            echo "deb ${APT_SOURCES_RESTORE_UBUNTU_SECURITY_MIRROR}/ ${codename}-security ${components}"
            ;;
        kali)
            echo "# Kali repositories"
            echo "deb ${APT_SOURCES_RESTORE_KALI_MIRROR} ${codename} ${components}"
            ;;
    esac
}

# Render the native deb822 stanzas (stdout).
apt_sources_restore_render_deb822() {
    local os_id="$1"
    local codename="$2"
    local version_id="$3"
    local components=""
    local keyring=""
    components="$(apt_sources_restore_components "$os_id" "$version_id")"
    keyring="$(apt_sources_restore_keyring "$os_id")"
    case "$os_id" in
        debian)
            echo "Types: deb"
            echo "URIs: ${APT_SOURCES_RESTORE_DEBIAN_MIRROR}"
            echo "Suites: ${codename} ${codename}-updates"
            echo "Components: ${components}"
            [ -n "$keyring" ] && echo "Signed-By: ${keyring}"
            echo ""
            echo "Types: deb"
            echo "URIs: ${APT_SOURCES_RESTORE_DEBIAN_SECURITY_MIRROR}"
            echo "Suites: ${codename}-security"
            echo "Components: ${components}"
            [ -n "$keyring" ] && echo "Signed-By: ${keyring}"
            ;;
        ubuntu)
            echo "Types: deb"
            echo "URIs: ${APT_SOURCES_RESTORE_UBUNTU_MIRROR}/"
            echo "Suites: ${codename} ${codename}-updates ${codename}-backports"
            echo "Components: ${components}"
            [ -n "$keyring" ] && echo "Signed-By: ${keyring}"
            echo ""
            echo "Types: deb"
            echo "URIs: ${APT_SOURCES_RESTORE_UBUNTU_SECURITY_MIRROR}"
            echo "Suites: ${codename}-security"
            echo "Components: ${components}"
            [ -n "$keyring" ] && echo "Signed-By: ${keyring}"
            ;;
        kali)
            echo "Types: deb"
            echo "URIs: ${APT_SOURCES_RESTORE_KALI_MIRROR}/"
            echo "Suites: ${codename}"
            echo "Components: ${components}"
            [ -n "$keyring" ] && echo "Signed-By: ${keyring}"
            ;;
    esac
}

# True when this distro+version defaults to the deb822 format.
apt_sources_restore_prefers_deb822() {
    local os_id="$1"
    local version_id="$2"
    case "$os_id" in
        debian) [ "$version_id" -ge "$APT_SOURCES_RESTORE_DEBIAN_DEB822_MIN" ] 2>/dev/null ;;
        ubuntu) [ "$version_id" -ge "$APT_SOURCES_RESTORE_UBUNTU_DEB822_MIN" ] 2>/dev/null ;;
        kali) return 0 ;;
        *) return 1 ;;
    esac
}

# Repair: one-time backup, comment foreign lines, ensure native sources
# exist in the distro's documented default format. Idempotent.
apt_sources_restore_repair() {
    local os_id="$1"
    local codename="$2"
    local version_id="$3"
    local backup_path="${APT_SOURCES_RESTORE_LIST}${APT_SOURCES_RESTORE_BACKUP_SUFFIX}"
    local pattern=""

    if [ -f "$APT_SOURCES_RESTORE_LIST" ] && [ ! -f "$backup_path" ]; then
        $USE_SUDO cp -a "$APT_SOURCES_RESTORE_LIST" "$backup_path"
        echo "[$APT_SOURCES_RESTORE_TAG] sources.list backed up: $backup_path" >&2
        APT_SOURCES_RESTORE_CHANGED="true"
    fi

    pattern="$(apt_sources_restore_foreign_pattern "$os_id")"
    if [ -n "$pattern" ] && [ -n "$(apt_sources_restore_foreign_lines "$os_id")" ]; then
        $USE_SUDO sed -i -E \
            "s|^[[:space:]]*(deb[[:space:]].*(${pattern}).*)$|${APT_SOURCES_RESTORE_MARK} (foreign suite on ${os_id}): \1|" \
            "$APT_SOURCES_RESTORE_LIST"
        echo "[$APT_SOURCES_RESTORE_TAG] foreign suite lines disabled (kept as comments in $APT_SOURCES_RESTORE_LIST)" >&2
        APT_SOURCES_RESTORE_CHANGED="true"
    fi

    if ! apt_sources_restore_native_present "$os_id" "$codename"; then
        if apt_sources_restore_prefers_deb822 "$os_id" "$version_id"; then
            local sources_file=""
            case "$os_id" in
                debian) sources_file="$APT_SOURCES_RESTORE_DEBIAN_SOURCES_FILE" ;;
                ubuntu) sources_file="$APT_SOURCES_RESTORE_UBUNTU_SOURCES_FILE" ;;
                kali) sources_file="$APT_SOURCES_RESTORE_KALI_SOURCES_FILE" ;;
            esac
            $USE_SUDO mkdir -p "$APT_SOURCES_RESTORE_LIST_D"
            apt_sources_restore_render_deb822 "$os_id" "$codename" "$version_id" \
                | $USE_SUDO tee "${APT_SOURCES_RESTORE_LIST_D}/${sources_file}" >/dev/null
            echo "[$APT_SOURCES_RESTORE_TAG] native ${os_id} ${codename} deb822 written: ${APT_SOURCES_RESTORE_LIST_D}/${sources_file}" >&2
        else
            apt_sources_restore_render_oneline "$os_id" "$codename" "$version_id" \
                | $USE_SUDO tee -a "$APT_SOURCES_RESTORE_LIST" >/dev/null
            echo "[$APT_SOURCES_RESTORE_TAG] native ${os_id} ${codename} suites appended to $APT_SOURCES_RESTORE_LIST" >&2
        fi
        APT_SOURCES_RESTORE_CHANGED="true"
    fi
}

# Converge native apt sources. Healthy system -> no-op (nothing touched,
# APT_SOURCES_RESTORE_CHANGED stays "false"). Returns 1 only for an
# unsupported/undetectable distro.
apt_sources_restore_ensure() {
    local os_id=""
    local codename=""
    local version_id=""

    os_id="$(apt_sources_restore_os_id)"
    case "$os_id" in
        debian|ubuntu|kali) ;;
        *)
            echo "[$APT_SOURCES_RESTORE_TAG] [ERROR] unsupported OS id '${os_id:-unknown}' (need debian/ubuntu/kali)" >&2
            return 1
            ;;
    esac
    codename="$(apt_sources_restore_codename)"
    if [ -z "$codename" ]; then
        echo "[$APT_SOURCES_RESTORE_TAG] [ERROR] cannot resolve the ${os_id} release codename" >&2
        return 1
    fi
    version_id="$(apt_sources_restore_version_id)"

    if [ -z "$(apt_sources_restore_foreign_lines "$os_id")" ] \
        && apt_sources_restore_native_present "$os_id" "$codename"; then
        echo "[$APT_SOURCES_RESTORE_TAG] native ${os_id} ${codename} sources already healthy" >&2
        return 0
    fi
    apt_sources_restore_repair "$os_id" "$codename" "$version_id"
    return 0
}

# Read-only report: distro, foreign lines, native presence per format.
apt_sources_restore_check() {
    local os_id=""
    local codename=""
    os_id="$(apt_sources_restore_os_id)"
    codename="$(apt_sources_restore_codename)"
    echo "[$APT_SOURCES_RESTORE_TAG] os: ${os_id:-unknown} ${codename:-?}" >&2
    if [ -n "$(apt_sources_restore_foreign_lines "$os_id")" ]; then
        echo "[$APT_SOURCES_RESTORE_TAG] foreign suite lines PRESENT in $APT_SOURCES_RESTORE_LIST" >&2
    else
        echo "[$APT_SOURCES_RESTORE_TAG] foreign suite lines: none" >&2
    fi
    apt_sources_restore_oneline_present "$os_id" "$codename" \
        && echo "[$APT_SOURCES_RESTORE_TAG] native one-line: present" >&2 \
        || echo "[$APT_SOURCES_RESTORE_TAG] native one-line: absent" >&2
    apt_sources_restore_deb822_present "$os_id" "$codename" \
        && echo "[$APT_SOURCES_RESTORE_TAG] native deb822: present" >&2 \
        || echo "[$APT_SOURCES_RESTORE_TAG] native deb822: absent" >&2
}

# Management CLI: ensure (default) | check
if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    USE_SUDO="${USE_SUDO:-}"
    case "${1:-ensure}" in
        check)
            apt_sources_restore_check
            ;;
        ensure|*)
            apt_sources_restore_ensure
            ;;
    esac
fi
