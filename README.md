# Script Initialization Guide

This guide explains how to initialize and run the script using `curl` and `python3` commands.

## Steps

1. **Download the Script**  
   Use the `curl` command to download the required script from the remote repository:
    Server
   ```sh
   curl -k -O https://git.local.12gm.com:901/adminroot/core_node/raw/branch/main/ncore/base/initial/main.py && python3 main.py
   ```
    local area network
   ```sh
   curl -k -O http://192.168.100.1:17003/adminroot/core_node/raw/branch/main/ncore/base/initial/main.py && python3 main.py
   ```
   
## Couser Reference
PowerShell irm https://raw.githubusercontent.com/yuaotian/go-cursor-help/master/scripts/install.ps1 | iex