===================================================================
LIUNXENVS Directory - Linux Environment Scripts
===================================================================

This directory contains user-created scripts that are automatically
added to the system PATH via /usr/local/bin symlinks.

FEATURES:
---------
1. Scripts placed here are automatically accessible as global commands
2. Soft links are created in /usr/local/bin
3. Directory is added to PATH via ~/.bashrc
4. Similar to Windows winenvs directory

HOW TO USE:
-----------

Method 1: Using the Menu System
--------------------------------
Run: ./dd.sh
Navigate to: "Set Special Software Environment Variables (like AI)"
Select: "SSH Connection" or other options
Follow the prompts to create commands

Method 2: Using linux_path_function.sh directly
-----------------------------------------------
# Add a script from content
bash scripts/shells/linux/common/linux_path_function.sh addscript "#!/bin/bash
echo 'Hello World'" hello

# Add an existing file
bash scripts/shells/linux/common/linux_path_function.sh addfile /path/to/script.sh

# List all scripts
bash scripts/shells/linux/common/linux_path_function.sh list

# Remove a script
bash scripts/shells/linux/common/linux_path_function.sh remove scriptname.sh

Method 3: Manual
----------------
1. Copy your script to this directory
2. Make it executable: chmod +x your_script.sh
3. Create symlink: sudo ln -sf $(pwd)/your_script.sh /usr/local/bin/your_command

EXAMPLES:
---------

Creating SSH Connection Script:
Run dd.sh → Special Software Env → SSH Connection → Add
Enter connection: user@hostname
Command created and available globally

Creating Custom Command:
cat > scripts/liunxenvs/mycommand.sh << 'EOFSCRIPT'
#!/bin/bash
echo "My custom command"
EOFSCRIPT
chmod +x scripts/liunxenvs/mycommand.sh
sudo ln -sf $(pwd)/scripts/liunxenvs/mycommand.sh /usr/local/bin/mycommand

DIRECTORY STRUCTURE:
--------------------
scripts/
├── liunxenvs/              # This directory
│   ├── ssh1.sh             # Example: SSH connection 1
│   ├── ssh2.sh             # Example: SSH connection 2
│   └── ...
├── shells/
│   └── linux/
│       ├── common/
│       │   └── linux_path_function.sh  # Management functions
│       └── menu_itemshells/
│           ├── special_software_env_manager.sh  # Main menu
│           └── menu_func/
│               └── ssh_menu.sh  # SSH menu module

RELATED FILES:
--------------
- scripts/shells/linux/common/linux_path_function.sh
  Core functions for managing this directory

- scripts/shells/linux/menu_itemshells/special_software_env_manager.sh
  Interactive menu system

- dd.sh
  Main entry point with menu integration

WINDOWS EQUIVALENT:
-------------------
This is the Linux version of:
- D:\.dev_win10\.winenvs (global)
- scripts\winenvs (inline)

Managed by WindowsPathFunction.ps1 and SpecialSoftwareEnvManager.ps1

===================================================================
