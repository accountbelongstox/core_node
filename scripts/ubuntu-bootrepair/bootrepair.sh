#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# This script installs and launches Boot-Repair

# Update package list
echo "Updating package list..."
sudo apt update

# Install dependencies
echo "Installing required dependencies..."
sudo apt install -y software-properties-common

# Add the Boot-Repair PPA repository
echo "Adding Boot-Repair PPA repository..."
sudo add-apt-repository ppa:yannubuntu/boot-repair -y

# Update package list again after adding PPA
echo "Updating package list again..."
sudo apt update

# Install Boot-Repair
echo "Installing Boot-Repair..."
sudo apt install -y boot-repair

# Launch Boot-Repair
echo "Launching Boot-Repair..."
sudo boot-repair

# End of script
echo "Boot-Repair has been installed and launched successfully!"

