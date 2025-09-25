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

# Download the installation script
wget -O install.sh https://download.bt.cn/install/install_lts.sh

# Check if the download was successful
if [ $? -ne 0 ]; then
    echo "Failed to download the install script."
    exit 1
fi

# Run the installation script with automatic "yes" input
bash install.sh ed8484bec -y << EOF
yes
EOF

# Optional: Check the status of the installation
if [ $? -eq 0 ]; then
    echo "Installation completed successfully."
else
    echo "Installation failed."
    exit 1
fi
