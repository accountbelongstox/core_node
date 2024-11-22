#!/bin/bash
NODE_DEFAULT_VERSION=20
NODE_VERSIONS=(18 20)
NODE_VERSION=""
NODE_DIR_BASE="/usr/lang_compiler/node"
TEMP_DIR="/tmp/nodejs"
binaries=("pm2" "pnpm" "cnpm" "yarn")
binaries_bins=("npm" "corepack" "npx" "pm2" "pm2-dev" "pm2-docker" "pm2-runtime" "pnpm" "vsce" "yarn" "yarnpkg")
binaries=("pm2" "pnpm" "cnpm" "yarn")
NODE_18_VERSION="v18.20.4"
NODE_DEFRAULT_FULL_VERSION="v20.15.1"
NODE_20_VERSION="v20.15.1"
NODE_DEFRAULT_VERSION_FULL="node-$NODE_DEFRAULT_FULL_VERSION-linux-x64"
NODE_DEFRAULT_DIR="$NODE_DIR_BASE/$NODE_DEFRAULT_VERSION_FULL"
NODE_DEFRAULT_BIN_DIR="$NODE_DEFRAULT_DIR/bin"
NODE_DEFRAULT_NBIN_DIR="$NODE_DEFRAULT_DIR/nbin"
SYS_LOCAL_BIN_BASE="/usr/local/bin"
SYS_BIN_BASE="/usr/bin"


link_default_bins() {
    local dir="$1"
    echo "-> Setting default binaries from: $dir"
    echo "-> ---------------------------------"
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
            echo "-> Removed old binary: $binary from $SYS_BIN_BASE -> Created symlink -> Set permissions."
            echo "-> Binary name: $binary"
            echo "-> Binary path: $binarypath"
            echo

            sudo ln -s "$binarypath" "$SYS_LOCAL_BIN_BASE/$binary"
            sudo chmod +x "$SYS_LOCAL_BIN_BASE/$binary"
            echo "-> Created symlink in $SYS_LOCAL_BIN_BASE -> Set permissions."
            echo "-> Binary name: $binary"
            echo "-> Binary path: $binarypath"
            echo

            if [ "$binary" == "node" ] || [ "$binary" == "npm" ] || [ "$binary" == "yarn" ]; then
                version=$("$SYS_BIN_BASE/$binary" --version)
                echo "-> Current system default $binary version: $version"
                echo
            fi
        fi
    done
    echo
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

    echo "Downloading Node.js from: $url"
    sudo wget -q --show-progress "$url" -P "$TEMP_DIR"

    echo "Downloaded Node.js to: $output_path"
    echo "$output_path"
    extract_xz "$output_path" "$NODE_DIR_BASE"
}

extract_xz() {
    local xz_file="$1"
    local extract_dir="$2"

    echo "Extracting $xz_file to $extract_dir"
    sudo tar -Jxf "$xz_file" -C "$extract_dir"
}
resolve_binaries_paths() {
    local NODE_PATH="$1"
    local NODE_VERSION_BIN_DIR="$2"
    local not_found=""

    NPMPATH="$NODE_VERSION_BIN_DIR/npm"

    NODE_PARENT_DIR=$(dirname "$(dirname "$NODE_PATH")")
    echo $NODE_PATH $NPMPATH config set prefix $NODE_PARENT_DIR
    echo $NODE_PATH $NPMPATH config set registry https://mirrors.huaweicloud.com/repository/npm/
    $NODE_PATH $NPMPATH config set prefix "$NODE_PARENT_DIR"
    echo "   -> npm prefix $NODE_PARENT_DIR"
    $NODE_PATH $NPMPATH config set registry https://mirrors.huaweicloud.com/repository/npm/
    echo "   -> npm registry configured to https://mirrors.huaweicloud.com/repository/npm/."

    for binary in "${binaries[@]}"; do
        local binary_path="$NODE_VERSION_BIN_DIR/$binary"
        echo "Binary $binary path: $binary_path"
        if [ -e "$binary_path" ]; then
            $NODE_PATH "$binary_path" --version
        else
            not_found+=" $binary"
        fi
    done
    echo "Not found,Installing binaries:$not_found"
    echo $NODE_PATH $NPMPATH install -g $not_found
    $NODE_PATH $NPMPATH install -g $not_found
}

create_new_binfile() {
    local NODEPATH="$1"
    local EXEPATH="$2"
    local BINPATH="$3"
    local BINNAME="$4"
    if [ ! -f "$NODEPATH" ]; then
        echo "Error: File '$NODEPATH' not found."
        return 1
    fi

    if [ ! -f "$EXEPATH" ]; then
        echo "Error: File '$EXEPATH' not found."
        return 1
    fi
    sudo echo "#!/bin/bash" > "$BINPATH"
    sudo echo "$NODEPATH $EXEPATH \"\$@\"" >> "$BINPATH"
    if [ -e "/usr/local/bin/$BINNAME" ]; then
        echo "   -> Removing existing /usr/local/bin/$BINNAME"
        sudo rm -rf "/usr/local/bin/$BINNAME"
    fi
    echo "   -> Creating symlink: /usr/local/bin/$BINNAME -> $BINPATH"
    sudo ln -sf "$BINPATH" "/usr/local/bin/$BINNAME"
    sudo chmod +x "/usr/local/bin/$BINNAME"
    echo "   -> Script written to $BINPATH"
}

resolve_installed_bin() {
    local NODE_VERSION_BIN_DIR="$1"
    local NODEPATH="$2"
    local NODEITEM="$3"
    local NODE_VERSION_MAIN_DIR="$4"
    echo "Scanning directory: $NODE_VERSION_BIN_DIR"
    for birary in "$NODE_VERSION_BIN_DIR"/*; do
        local filename=$(basename "$birary")
        if [ "$filename" == "node" ]; then
            echo "   -> Skipping file: $filename"
            continue
        fi
        NBINPATH="$NODE_VERSION_MAIN_DIR/nbin"
        NBINAME="$NODEITEM$filename"
        NBINNAME_PATH="$NBINPATH/$NBINAME"
        if [ ! -d "$NBINPATH" ]; then
            sudo mkdir -p "$NBINPATH"
        fi
        create_new_binfile "$NODEPATH" "$birary" "$NBINNAME_PATH" "$NBINAME"
    done
}

print_version() {
    local NODE_VERSION_BIN_DIR="$1"
    local NODEPATH="$2"
    local NODEITEM="$3"
    echo "--------------------------------------------------"
    echo "-----------------Node.js $NODEITEM------------------------"
    echo "--------------------------------------------------"
    echo "Scanning directory: $NODE_VERSION_BIN_DIR"
    for birary in "$NODE_VERSION_BIN_DIR"/*; do
        local filename=$(basename "$birary")
        if [ "$filename" == "node" ]; then
            version=$($birary --version)
        elif [ "$filename" == "npx" ]; then
            echo "Skip $filename"
        elif [ "$filename" == "pnpx" ]; then
            echo "Skip $filename"
        else
            version=$($NODEPATH $birary --version)
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

    echo "Selected NODE_VERSION: $NODE_VERSION"
    echo "NODE_VERSION_FULL: $NODE_VERSION_FULL"
    echo "NODE_DIR: $NODE_DIR_BASE/$NODE_VERSION_FULL"
    if [ ! -e "$NODE_PATH" ]; then
        echo "Node executable not found at $NODE_PATH. Downloading and extracting..."

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

        echo "NODE_TAR_URL: $NODE_TAR_URL"

        download_extract "$NODE_TAR_URL"
        resolve_binaries_paths "$NODE_PATH" "$NODE_VERSION_BIN_DIR"
        resolve_installed_bin "$NODE_VERSION_BIN_DIR" "$NODE_PATH" "$NODEITEM" "$NODE_VERSION_MAIN_DIR"
    fi
    echo "Set execute binary permissions"
    find "$NODE_VERSION_BIN_DIR" -type f -name "*" -exec chmod +x {} \;
    echo "--------------------------------"
    print_version "$NODE_VERSION_BIN_DIR" "$NODE_PATH" "$NODEITEM"
done

echo "   -> Default Node.js Version: $NODE_DEFRAULT_FULL_VERSION"
echo "   -> Default Node.js Directory: $NODE_DEFRAULT_DIR"
echo "   -> Default nbin Directory: $NODE_DEFRAULT_NBIN_DIR"

link_default_bins "$NODE_DEFRAULT_BIN_DIR"

link_default_bins "$NODE_DEFRAULT_NBIN_DIR"