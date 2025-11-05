#!/usr/bin/env bash
set -euo pipefail

# Determine project root (script sits in scripts/)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
LIB_APPS_DIR="$ROOT_DIR/poly_apps/flutter_bloom/lib/apps"
OUTPUT_DIR="$ROOT_DIR/.analysis_reports/flutter"

# Ensure the output directory exists
mkdir -p "$OUTPUT_DIR"

# 1. Scan all Dart files under lib/apps and store the list
find "$LIB_APPS_DIR" -type f -name '*.dart' | sort > "$OUTPUT_DIR/dart_files.txt"

# 2. Run flutter analyze over lib/apps and capture the report
if ! command -v flutter >/dev/null 2>&1; then
  echo "[ERROR] flutter command not found in PATH" | tee "$OUTPUT_DIR/flutter_analyze.log"
  exit 1
fi

flutter analyze "$LIB_APPS_DIR" > "$OUTPUT_DIR/flutter_analyze.log" 2>&1

echo "[INFO] Dart file list: $OUTPUT_DIR/dart_files.txt"
echo "[INFO] Flutter analyze report: $OUTPUT_DIR/flutter_analyze.log"
