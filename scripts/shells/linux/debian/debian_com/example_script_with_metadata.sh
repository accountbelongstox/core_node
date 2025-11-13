#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For Bash scripts: Use absolute paths resolved from script location. Declare all variables at beginning.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Example Script with Desktop Entry Metadata
# This script demonstrates how to add metadata for the Desktop Entry Manager

# DESKTOP ENTRY METADATA (optional)
# NAME: Example Script
# DESCRIPTION: This is an example script showing metadata usage
# ICON: utilities-terminal
# CATEGORY: Development
# SUDO: false

# The Desktop Entry Manager will scan these metadata comments:
#
# @name: or NAME:           - Display name in application menu
# @desc: or DESCRIPTION:    - Description shown in tooltip
# @icon: or ICON:          - Icon name (from system theme) or path
# @category: or CATEGORY:  - Application category (Development, System, Utility, etc.)
# @sudo: or SUDO:          - Set to "true" if script requires sudo

# Variable Declarations
SCRIPT_NAME="Example Script"
MESSAGE="Hello from Core Node Desktop Entry Manager!"

# Main script content
echo "========================================"
echo "  $SCRIPT_NAME"
echo "========================================"
echo ""
echo "$MESSAGE"
echo ""
echo "This script demonstrates metadata usage for desktop entries."
echo ""
echo "Metadata detected:"
echo "  Name: $(grep -m 1 'NAME:' "$0" | cut -d: -f2- | xargs)"
echo "  Description: $(grep -m 1 'DESCRIPTION:' "$0" | cut -d: -f2- | xargs)"
echo "  Icon: $(grep -m 1 'ICON:' "$0" | cut -d: -f2- | xargs)"
echo "  Category: $(grep -m 1 'CATEGORY:' "$0" | cut -d: -f2- | xargs)"
echo "  Requires sudo: $(grep -m 1 'SUDO:' "$0" | cut -d: -f2- | xargs)"
echo ""
echo "To create desktop entries for all scripts, run:"
echo "  bash desktop_entry_manager.sh --refresh"
echo ""
