#!/bin/bash
# notebook_artifact_cache.sh - keeps built artifacts (compiled runtimes) of a hosted notebook
# VM under the persist root, so the next VM restores one archive instead of building again.
# Inactive outside a notebook run: pyservice.sh colab|kaggle (notebook_runtime.sh) exports
# NOTEBOOK_PLATFORM and NOTEBOOK_PERSIST_DIR to every installer it starts.
#
# Layout (one namespace per artifact kind, e.g. isolated_python/python310):
#   <persist>/artifacts/<namespace>/<name>-<platform>-<os>-<arch>-<platform version>.tar.gz
#   <archive>.manifest   key=value: name, path, platform, platform_version, os, arch, created
# A restore takes the archive of the same platform version (Colab: COLAB_RELEASE_TAG), else
# the newest one of the same name, platform, OS release and architecture (same ABI); the
# platform version of the archive is printed either way.

[ "${NOTEBOOK_ARTIFACT_CACHE_LOADED:-false}" = true ] && return 0
NOTEBOOK_ARTIFACT_CACHE_LOADED=true

NOTEBOOK_ARTIFACT_ROOT_NAME="artifacts"
NOTEBOOK_ARTIFACT_TAG="[NOTEBOOK]"
NOTEBOOK_ARTIFACT_SUFFIX=".tar.gz"
NOTEBOOK_ARTIFACT_MANIFEST_SUFFIX=".manifest"

# notebook_artifact_dir NAMESPACE -> prints the namespace directory on a notebook VM with a
# persist root, else nothing.
notebook_artifact_dir() {
    [ -n "${NOTEBOOK_PLATFORM:-}" ] && [ -n "${NOTEBOOK_PERSIST_DIR:-}" ] && [ -d "$NOTEBOOK_PERSIST_DIR" ] || return 0
    # Colab without a mounted Drive falls back to /content (lost with the VM): archiving there only costs time.
    case "$NOTEBOOK_PLATFORM:$NOTEBOOK_PERSIST_DIR/" in
        colab:/content/drive/*) ;;
        colab:*) return 0 ;;
    esac
    printf '%s\n' "$NOTEBOOK_PERSIST_DIR/$NOTEBOOK_ARTIFACT_ROOT_NAME/$1"
}

# Prints the notebook platform version (Colab: COLAB_RELEASE_TAG), file-name safe.
notebook_artifact_platform_version() {
    local version=""

    case "${NOTEBOOK_PLATFORM:-}" in
        colab) version="${COLAB_RELEASE_TAG:-}" ;;
        kaggle) version="${KAGGLE_DOCKER_IMAGE:-}" ;;
    esac
    printf '%s\n' "${version:-unknown}" | tr -c 'A-Za-z0-9._\n-' '_'
}

# Prints the OS release the artifact was built on (e.g. ubuntu22.04).
notebook_artifact_os() {
    (. /etc/os-release 2>/dev/null && printf '%s%s\n' "${ID:-linux}" "${VERSION_ID:-}") || echo linux
}

# notebook_artifact_manifest_value FILE KEY -> prints the value of KEY.
notebook_artifact_manifest_value() {
    sed -n "s/^$2=//p" "$1" 2>/dev/null | head -n 1
}

# notebook_artifact_restore NAMESPACE NAME PATH -> success when PATH (absent or empty) was
# extracted from a matching archive.
notebook_artifact_restore() {
    local dir="" prefix="" version="" archive="" candidate="" manifest="" started="$SECONDS"

    dir="$(notebook_artifact_dir "$1")"
    [ -n "$dir" ] && [ -d "$dir" ] || return 1
    if [ -e "$3" ] && [ -n "$(ls -A "$3" 2>/dev/null)" ]; then
        return 1
    fi
    prefix="$2-$NOTEBOOK_PLATFORM-$(notebook_artifact_os)-$(uname -m)-"
    version="$(notebook_artifact_platform_version)"
    while IFS= read -r candidate; do
        [ -f "$candidate$NOTEBOOK_ARTIFACT_MANIFEST_SUFFIX" ] || continue
        [ "$(notebook_artifact_manifest_value "$candidate$NOTEBOOK_ARTIFACT_MANIFEST_SUFFIX" path)" = "$3" ] || continue
        if [ "$candidate" = "$dir/$prefix$version$NOTEBOOK_ARTIFACT_SUFFIX" ]; then
            archive="$candidate"
            break
        fi
        [ -n "$archive" ] || archive="$candidate"
    done < <(ls -1t "$dir/$prefix"*"$NOTEBOOK_ARTIFACT_SUFFIX" 2>/dev/null)
    [ -n "$archive" ] || return 1
    manifest="$archive$NOTEBOOK_ARTIFACT_MANIFEST_SUFFIX"
    echo "$NOTEBOOK_ARTIFACT_TAG Restoring $2 from $archive ($(du -sh "$archive" 2>/dev/null | cut -f1); built on $NOTEBOOK_PLATFORM $(notebook_artifact_manifest_value "$manifest" platform_version), this VM: $version) ..."
    ${USE_SUDO:-} mkdir -p "$(dirname "$3")" || return 1
    if ! ${USE_SUDO:-} tar -xzf "$archive" -C "$(dirname "$3")"; then
        echo "$NOTEBOOK_ARTIFACT_TAG Restoring $archive failed" >&2
        return 1
    fi
    echo "$NOTEBOOK_ARTIFACT_TAG Restored $2 to $3 in $((SECONDS - started))s"
}

# notebook_artifact_save NAMESPACE NAME PATH -> archives PATH (gzip -1) into the namespace,
# written under a temporary name and renamed, with its manifest; replaces the archive of
# the same platform version.
notebook_artifact_save() {
    local dir="" file="" local_archive="" version="" started="$SECONDS"

    dir="$(notebook_artifact_dir "$1")"
    [ -n "$dir" ] && [ -d "$3" ] || return 0
    version="$(notebook_artifact_platform_version)"
    file="$2-$NOTEBOOK_PLATFORM-$(notebook_artifact_os)-$(uname -m)-$version$NOTEBOOK_ARTIFACT_SUFFIX"
    local_archive="$(mktemp "${TMPDIR:-/tmp}/notebook_artifact.XXXXXX")" || return 0
    echo "$NOTEBOOK_ARTIFACT_TAG Backing up $3 to $dir/$file ($NOTEBOOK_PLATFORM $version) ..."
    if ! tar -C "$(dirname "$3")" -cf - "$(basename "$3")" | gzip -1 > "$local_archive"; then
        rm -f "$local_archive"
        echo "$NOTEBOOK_ARTIFACT_TAG Archiving $3 failed; the next VM builds again" >&2
        return 0
    fi
    mkdir -p "$dir" \
        && cp "$local_archive" "$dir/.$file.part" \
        && mv -f "$dir/.$file.part" "$dir/$file" \
        && printf 'name=%s\npath=%s\nplatform=%s\nplatform_version=%s\nos=%s\narch=%s\ncreated=%s\n' \
            "$2" "$3" "$NOTEBOOK_PLATFORM" "$version" "$(notebook_artifact_os)" "$(uname -m)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            > "$dir/$file$NOTEBOOK_ARTIFACT_MANIFEST_SUFFIX" \
        || { rm -f "$dir/.$file.part"; echo "$NOTEBOOK_ARTIFACT_TAG Copying the archive to $dir failed (Drive quota or I/O); the next VM builds again" >&2; }
    rm -f "$local_archive"
    [ -f "$dir/$file$NOTEBOOK_ARTIFACT_MANIFEST_SUFFIX" ] \
        && echo "$NOTEBOOK_ARTIFACT_TAG Backed up $2 ($(du -sh "$dir/$file" 2>/dev/null | cut -f1)) in $((SECONDS - started))s"
    return 0
}
