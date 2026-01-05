#!/bin/bash

# Script to download Inter font files from Google Fonts
# This allows local hosting for better performance and accessibility in China

set -e

FONT_DIR="public/fonts"
FONT_FAMILY="Inter"
FONT_WEIGHTS=(300 400 500 600 700)
FONT_NAMES=("Light" "Regular" "Medium" "SemiBold" "Bold")

# Create fonts directory if it doesn't exist
mkdir -p "$FONT_DIR"

echo "Downloading Inter font files..."

# Download each font weight
for i in "${!FONT_WEIGHTS[@]}"; do
  WEIGHT=${FONT_WEIGHTS[$i]}
  NAME=${FONT_NAMES[$i]}
  
  echo "Downloading Inter ${NAME} (weight: ${WEIGHT})..."
  
  # Google Fonts API URL
  URL="https://fonts.googleapis.com/css2?family=Inter:wght@${WEIGHT}&display=swap"
  
  # Get CSS file
  CSS_CONTENT=$(curl -s "$URL" || echo "")
  
  if [ -z "$CSS_CONTENT" ]; then
    echo "⚠ Warning: Could not download CSS for weight ${WEIGHT}"
    echo "You may need to download fonts manually from: https://fonts.google.com/specimen/Inter"
    continue
  fi
  
  # Extract woff2 URL from CSS
  WOFF2_URL=$(echo "$CSS_CONTENT" | grep -oP 'url\(https://fonts\.gstatic\.com/[^)]+\.woff2\)' | head -1 | sed "s/url(//;s/)//")
  
  if [ -z "$WOFF2_URL" ]; then
    echo "⚠ Warning: Could not extract woff2 URL for weight ${WEIGHT}"
    continue
  fi
  
  # Download woff2 file
  FILENAME="Inter-${NAME}.woff2"
  curl -s -L "$WOFF2_URL" -o "${FONT_DIR}/${FILENAME}" || {
    echo "⚠ Warning: Could not download ${FILENAME}"
    echo "Try downloading manually from: ${WOFF2_URL}"
    continue
  }
  
  echo "✓ Downloaded ${FILENAME}"
done

echo ""
echo "Font download complete!"
echo "Fonts are now available at: ${FONT_DIR}/"
echo ""
echo "Alternative: You can also download fonts manually from:"
echo "  https://fonts.google.com/specimen/Inter"
echo "  Or use: https://github.com/rsms/inter/releases"

