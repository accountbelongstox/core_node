#!/bin/bash
cd "$(dirname "$0")"

icons="activity app-window arrow-clockwise arrow-down arrow-left arrows-clockwise arrows-out arrow-up arrow-u-up-left backspace bold camera caret-down caret-left caret-right caret-up chat-circle-dots check check-circle circle circle-notch clipboard-text clock code cpu cube cursor-click devices download download-simple eye facebook-logo faders file-text fill film-slate film-strip flow-arrow folder folder-notch folder-open gear git-branch hand-swipe-up hard-drives hourglass house image info instagram-logo keyboard lifebuoy lightning lock-key-open magic-wand magnifying-glass package paper-plane-right paw-print play plugs plus power robot scroll sliders speaker-simple-high speaker-simple-low spinner square squares-four sun terminal-window tiktok-logo trash tree-structure upload-simple video warning whatsapp-logo wifi-high x x-circle youtube-logo"

total=0
missing=0
missing_list=""

for icon in $icons; do
  total=$((total+1))
  if grep -q "\.ph-$icon:" public/fonts/phosphor/style.css; then
    echo "✓ $icon"
  else
    echo "✗ $icon MISSING"
    missing=$((missing+1))
    missing_list="$missing_list $icon"
  fi
done

echo ""
echo "======================="
echo "Total: $total icons"
echo "Found: $((total-missing)) icons"
echo "Missing: $missing icons"
if [ $missing -gt 0 ]; then
  echo ""
  echo "Missing icons:"
  echo "$missing_list"
fi
