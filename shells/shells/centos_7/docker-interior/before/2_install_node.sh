#!/bin/bash

NODE_DEFAULT_VERSION=20
NODE_VERSIONS=(18 20)
NODE_VERSION=""
NODE_DIR_BASE="/usr/lang_compiler/node"
TEMP_DIR="/tmp/nodejs"
binaries=("pm2" "pnpm" "cnpm" "yarn")
binaries_bins=("npm" "corepack" "npx" "pm2" "pm2-dev" "pm2-docker" "pm2-runtime" "pnpm" "vsce" "yarn" "yarnpkg")
NODE_18_VERSION="v18.20.4"
NODE_20_VERSION="v20.15.1"
NODE_DEFAULT_FULL_VERSION="v20.15.1"
NODE_DEFAULT_VERSION_FULL="node-$NODE_DEFAULT_FULL_VERSION-linux-x64"
NODE_DEFAULT_DIR="$NODE_DIR_BASE/$NODE_DEFAULT_VERSION_FULL"
NODE_DEFAULT_BIN_DIR="$NODE_DEFAULT_DIR/bin"
NODE_DEFAULT_NBIN_DIR="$NODE_DEFAULT_DIR/nbin"
SYS_LOCAL_BIN_BASE="/usr/local/bin"
SYS_BIN_BASE="/usr/bin"

link_default_bins() {
    local dir="$1"
    for binarypath in "$dir"/*; do
        if [ -f "$binarypath" ]; then
            binary=$(basename "$binarypath")

            if [ -f "$SYS_BIN_BASE/$binary" ]; then
                sudo rm -rf "$SYS_BIN_BASE/$binary"
            fi

            if [ -L "$SYS_BIN_BASE/$binary" ]; then
                sudo rm -rf "$SYS_BIN_BASE/$binary"
            fi

            if [ -f "$SYS_LOCAL_BIN_BASE/$binary" ]; then
                sudo rm -rf "$SYS_LOCAL_BIN_BASE/$binary"
            fi

            if [ -L "$SYS_LOCAL_BIN_BASE/$binary" ]; then
                sudo rm -rf "$SYS_LOCAL_BIN_BASE/$binary"
            fi

            sudo ln -s "$binarypath" "$SYS_BIN_BASE/$binary"
            sudo chmod +x "$SYS_BIN_BASE/$binary"
            sudo ln -s "$binarypath" "$SYS_LOCAL_BIN_BASE/$binary"
            sudo chmod +x "$SYS_LOCAL_BIN_BASE/$binary"

            if [ "$binary" == "node" ] || [ "$binary" == "npm" ] || [ "$binary" == "yarn" ]; then
                version=$("$SYS_BIN_BASE/$binary" --version)
            fi
        fi
    done
}

check_binaries() {
    for binary in "${binaries[@]}"; do
        binary_path="$SYS_BIN_BASE/$binary"
        if [ -x "$binary_path" ]; then
            echo "$binary exists in $binary_path"
        else
            echo "$binary does not exist in $SYS_BIN_BASE or is not executable"
        fi
    done
}

if [ ! -d "$TEMP_DIR" ]; then
    sudo mkdir -p "$TEMP_DIR"
fi

if [ ! -d "$NODE_DIR_BASE" ]; then
    sudo mkdir -p "$NODE_DIR_BASE"
fi

download_extract() {
    local url="$1"
    local filename=$(basename "$url")
    local output_path="$TEMP_DIR/$filename"

    sudo rm -f "$output_path"
    sudo wget -q "$url" -P "$TEMP_DIR"
    extract_xz "$output_path" "$NODE_DIR_BASE"
}

extract_xz() {
    local xz_file="$1"
    local extract_dir="$2"
    sudo tar -Jxf "$xz_file" -C "$extract_dir"
}

resolve_binaries_paths() {
    local NODE_PATH="$1"
    local NODE_VERSION_BIN_DIR="$2"
    local not_found=""

    NPMPATH="$NODE_VERSION_BIN_DIR/npm"
    NODE_PARENT_DIR=$(dirname "$(dirname "$NODE_PATH")")
    $NODE_PATH $NPMPATH config set prefix "$NODE_PARENT_DIR"
    $NODE_PATH $NPMPATH config set registry https://mirrors.huaweicloud.com/repository/npm/

    for binary in "${binaries[@]}"; do
        local binary_path="$NODE_VERSION_BIN_DIR/$binary"
        if [ -e "$binary_path" ]; then
            $NODE_PATH "$binary_path" --version
        else
            not_found+=" $binary"
        fi
    done
    $NODE_PATH $NPMPATH install -g $not_found
}

create_new_binfile() {
    local NODEPATH="$1"
    local EXEPATH="$2"
    local BINPATH="$3"
    local BINNAME="$4"
    if [ ! -f "$NODEPATH" ]; then
        return 1
    fi

    if [ ! -f "$EXEPATH" ]; then
        return 1
    fi
    sudo bash -c "echo '#!/bin/bash' > \"$BINPATH\""
    sudo bash -c "echo '$NODEPATH $EXEPATH \"\$@\"' >> \"$BINPATH\""
    if [ -e "/usr/local/bin/$BINNAME" ]; then
        sudo rm -rf "/usr/local/bin/$BINNAME"
    fi
    sudo ln -sf "$BINPATH" "/usr/local/bin/$BINNAME"
    sudo chmod +x "$BINPATH"
}

resolve_installed_bin() {
    local NODE_VERSION_BIN_DIR="$1"
    local NODEPATH="$2"
    local NODEITEM="$3"
    local NODE_VERSION_MAIN_DIR="$4"
    for binary in "$NODE_VERSION_BIN_DIR"/*; do
        local filename=$(basename "$binary")
        if [ "$filename" == "node" ]; then
            continue
        fi
        NBINPATH="$NODE_VERSION_MAIN_DIR/nbin"
        NBINAME="$NODEITEM$filename"
        NBINNAME_PATH="$NBINPATH/$NBINAME"
        if [ ! -d "$NBINPATH" ]; then
            sudo mkdir -p "$NBINPATH"
        fi
        create_new_binfile "$NODEPATH" "$binary" "$NBINNAME_PATH" "$NBINAME"
    done
}

print_version() {
    local NODE_VERSION_BIN_DIR="$1"
    local NODEPATH="$2"
    local NODEITEM="$3"
    for binary in "$NODE_VERSION_BIN_DIR"/*; do
        local filename=$(basename "$binary")
        if [ "$filename" == "node" ]; then
            version=$($binary --version)
        elif [ "$filename" == "npx" ]; then
            echo "Skip $filename"
        elif [ "$filename" == "pnpx" ]; then
            echo "Skip $filename"
        else
            version=$($NODEPATH $binary --version)
        fi
        echo "   -> $filename: $version."
    done
}

for NODEITEM in "${NODE_VERSIONS[@]}"; do
    if [ "$NODEITEM" -eq 18 ]; then
        NODE_VERSION="$NODE_18_VERSION"
    elif [ "$NODEITEM" -eq 20 ]; then
        NODE_VERSION="$NODE_20_VERSION"
    fi

    NODE_VERSION_FULL="node-$NODE_VERSION-linux-x64"
    NODE_VERSION_MAIN_DIR="$NODE_DIR_BASE/$NODE_VERSION_FULL"
    NODE_VERSION_BIN_DIR="$NODE_VERSION_MAIN_DIR/bin"
    NODE_PATH="$NODE_VERSION_BIN_DIR/node"

    if [ ! -e "$NODE_PATH" ]; then
        if [ -d "$NODE_VERSION_MAIN_DIR" ]; then
            sudo rm -rf "$NODE_VERSION_MAIN_DIR"
        fi
        if [ -d "$NODE_VERSION_BIN_DIR" ]; then
            sudo rm -rf "$NODE_VERSION_BIN_DIR"
        fi
        if [ -d "$NODE_VERSION_FULL" ]; then
            sudo rm -rf "$NODE_VERSION_FULL"
        fi
        NODE_TAR_URL="https://nodejs.org/dist/$NODE_VERSION/$NODE_VERSION_FULL.tar.xz"
        download_extract "$NODE_TAR_URL"
        resolve_binaries_paths "$NODE_PATH" "$NODE_VERSION_BIN_DIR"
        resolve_installed_bin "$NODE_VERSION_BIN_DIR" "$NODE_PATH" "$NODEITEM" "$NODE_VERSION_MAIN_DIR"
    fi
    sudo find "$NODE_VERSION_BIN_DIR" -type f -name "*" -exec chmod +x {} \;
    print_version "$NODE_VERSION_BIN_DIR" "$NODE_PATH" "$NODEITEM"
done

link_default_bins "$NODE_DEFAULT_BIN_DIR"
link_default_bins "$NODE_DEFAULT_NBIN_DIR"

