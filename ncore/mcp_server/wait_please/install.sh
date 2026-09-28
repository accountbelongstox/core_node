#!/bin/bash

# cunzhi MCP tools installer - Linux / macOS
# Builds the frontend (pnpm) and Rust binaries (cargo), then installs the
# produced executables into ~/.local/bin.
#
# The crate's binaries have non-ASCII (Chinese) names in Cargo.toml, so the
# produced executables are discovered at runtime from target/release instead of
# being referenced by hard-coded names.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$SCRIPT_DIR/target/release"
BIN_DIR="$HOME/.local/bin"

echo "[*] Installing cunzhi MCP tools..."

# Check required commands.
for cmd in cargo pnpm; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "[X] Error: required command not found: $cmd"
        exit 1
    fi
done

cd "$SCRIPT_DIR"

echo "[*] Building frontend (pnpm build)..."
pnpm build

echo "[*] Building Rust binaries (cargo build --release)..."
cargo build --release

if [[ ! -d "$RELEASE_DIR" ]]; then
    echo "[X] Build failed: release directory not found: $RELEASE_DIR"
    exit 1
fi

# Discover the produced top-level executables (regular, executable, no extension).
mapfile -t BINARIES < <(find "$RELEASE_DIR" -maxdepth 1 -type f -perm -u+x ! -name '*.*')
if [[ ${#BINARIES[@]} -eq 0 ]]; then
    echo "[X] Build failed: no executables found in $RELEASE_DIR"
    exit 1
fi

mkdir -p "$BIN_DIR"
for bin in "${BINARIES[@]}"; do
    cp "$bin" "$BIN_DIR/"
    chmod +x "$BIN_DIR/$(basename "$bin")"
done

echo "[+] Installed binaries to: $BIN_DIR"
for bin in "${BINARIES[@]}"; do
    echo "    $(basename "$bin")"
done

# Hint about PATH.
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo ""
    echo "[*] Add this to your ~/.bashrc or ~/.zshrc:"
    echo "    export PATH=\"\$PATH:$BIN_DIR\""
    echo "    Then run: source ~/.bashrc"
fi

echo ""
echo "[+] Done. Add the MCP server binary to your MCP client config, e.g.:"
echo '    {"mcpServers": {"<server-binary-name>": {"command": "<server-binary-name>"}}}'
