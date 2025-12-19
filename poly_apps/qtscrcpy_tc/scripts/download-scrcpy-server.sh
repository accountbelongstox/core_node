#!/bin/bash
########################################
# Download scrcpy-server 3.3.3
########################################

set -e

echo "========================================"
echo "Downloading scrcpy-server v3.3.3"
echo "========================================"
echo ""

SCRCPY_VERSION="3.3.3"
DOWNLOAD_URL="https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VERSION}/scrcpy-server-v${SCRCPY_VERSION}"
TARGET_DIR="../TcUi/third_party/scrcpy-server"
TARGET_FILE="${TARGET_DIR}/scrcpy-server-v${SCRCPY_VERSION}"

echo "Version: ${SCRCPY_VERSION}"
echo "Download URL: ${DOWNLOAD_URL}"
echo "Target: ${TARGET_FILE}"
echo ""

# Create target directory
if [ ! -d "${TARGET_DIR}" ]; then
    echo "Creating directory: ${TARGET_DIR}"
    mkdir -p "${TARGET_DIR}"
fi

# Check if already downloaded
if [ -f "${TARGET_FILE}" ]; then
    echo "scrcpy-server v${SCRCPY_VERSION} already exists."
    echo "File: ${TARGET_FILE}"
    echo ""
    read -p "Re-download? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        exit 0
    fi
    rm -f "${TARGET_FILE}"
fi

echo "Downloading scrcpy-server..."
echo "This may take a few moments depending on your connection."
echo ""

# Download using curl or wget
if command -v curl &> /dev/null; then
    curl -L -o "${TARGET_FILE}" "${DOWNLOAD_URL}"
elif command -v wget &> /dev/null; then
    wget -O "${TARGET_FILE}" "${DOWNLOAD_URL}"
else
    echo "[ERROR] Neither curl nor wget found!"
    echo "Please install curl or wget, or download manually from:"
    echo "${DOWNLOAD_URL}"
    exit 1
fi

# Verify download
if [ ! -f "${TARGET_FILE}" ]; then
    echo "[ERROR] Downloaded file not found!"
    exit 1
fi

# Get file size
FILE_SIZE=$(stat -f%z "${TARGET_FILE}" 2>/dev/null || stat -c%s "${TARGET_FILE}" 2>/dev/null)

echo ""
echo "========================================"
echo "Download Completed Successfully!"
echo "========================================"
echo "File: ${TARGET_FILE}"
echo "Size: ${FILE_SIZE} bytes"
echo ""

# Create version info file
cat > "${TARGET_DIR}/version.json" <<EOF
{
  "scrcpy_version": "${SCRCPY_VERSION}",
  "download_date": "$(date)",
  "file_size": ${FILE_SIZE},
  "download_url": "${DOWNLOAD_URL}"
}
EOF

echo "Version info saved to: ${TARGET_DIR}/version.json"
echo ""

echo "========================================"
echo "Next Steps:"
echo "========================================"
echo "1. Build the application using build script"
echo "2. The scrcpy-server will be automatically included"
echo "3. When running, it will be pushed to Android device"
echo ""
