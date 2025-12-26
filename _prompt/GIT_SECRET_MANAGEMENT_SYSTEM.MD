# Git Secret Management System

## Overview

Starting from `dd.cmd`, analyze and combine development specifications. Find if there is a git push menu related script. Now extend a script in `scripts/git`, and allow you to update related documentation. Use description within 10 lines to explain specification:

## Specification

1. In local development environment, there will be a local directory to store sensitive characters, such as keys.
2. Before git commit, will call additional script, use `scripts/disguise.js`, `disguised.template.js` and other scripts for encryption. When encrypting before git commit, if unencrypted files exist, then submitting developer inputs password. Password is not recorded in any file.
3. In global var, support reading any key. If key is encrypted, will prompt to input password. After encryption, modify filename to reflect in filename. If not yet encrypted (i.e., before git commit, can directly decrypt).
4. In gitignore, will block unencrypted files, but any encrypted content after decryption can be saved. This way when using globalvar ps1 to read, don't need to input password every time.
5. After this project commits to git, if clone on a completely new computer, then in `dd.ps1` will detect unencrypted scripts. After inputting password, decrypt a copy with different filename. Of course, decrypted files are already blocked in gitignore.
6. For `ALIBABA_CLOUD_ACCESS_KEY_ID`, create several example keys. When local unencrypted, directly call. Before git commit, will require input password (needs two password confirmation) to encrypt. If encrypted file is called, will require input password.
7. Have public encryption and decryption methods. According to passed key, read a value, or according to file, read content. In `dd.ps1` and `GlobalVars.ps1`, both independently implement two copies of same logic.

## Unified App Manager Deployment

Have you noticed in Linux `dd.sh` menu the "Unified App Manager [start]"? Please read development documentation, and according to my requirements:

1. Add a deployment option. When selecting deployment, will automatically call app's deploy script. If doesn't exist, use `start.sh` script, then directly install to system service.
2. View documentation's system service installation specification.
3. Display needs a powerful system installation class library. You can move `serviceManager.py` to appropriate location and transcribe as more powerful sh tool class. Need to be able to give sh path and automatically generate server `ncore-` prefix + filename basename, and automatically install to system, set boot startup. For already existing, update script location. Default root permissions.

First comprehensively analyze, and tell me how you will execute script development, and if existing documentation still has places that don't satisfy you. Output your analysis to `scripts/unified_manager/analyze.md`. After I approve, you can start development.

## DD.SH Parameter Extension

Please check again, after confirming no errors, extend a function for `dd.sh`. `dd.sh` can receive parameters. If parameters exist, automatically run program in parameters (if parameters have multiple, then sequentially pass parameters). Limit to use 30% CPU/memory of system. Can use third-party software to implement, but simultaneously you need to ensure automatic installation of third-party software.

`scripts/unified_manager/common/debian_service_manager.sh` (server deployment path: `/www/wwwroot/core_node/scripts/unified_manager/common/debian_service_manager.sh`) - Don't know if you added logic to limit service resource usage. Please continue to add a class library in common for `dd.sh` to call.

## Resource Limiter

`scripts/unified_manager/common/resource_limiter.sh` (server deployment path: `/www/wwwroot/core_node/scripts/unified_manager/common/resource_limiter.sh`) - Reference this script. Of course, you need to read documentation `development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`. Then in `scripts/shells/linux/common`, complete public script. Then in `scripts/shells/linux/debian/install_shells/85_install_code_server.sh`, encapsulate, limit memory usage and CPU usage.

## Nginx/Certbot/Laravel Integration

Based on your previous task `test_task.txt` (in project root, server deployment path: `/www/wwwroot/core_node/test_task.txt`), do you remember several related scripts?
- Install nginx `.sh` (`scripts/shells/linux/debian/install_shells/25_install_nginx.sh`)
- Install certbot `.sh` (`scripts/shells/linux/debian/install_shells/26_install_certbot.sh`)
- Laravel nginx management based on nginx/certbot (`poly_apps/laravel_main/app/Apps/ServerManagerV1`)

### Tasks

**Problem 1**: `test_promble_1.txt` (in project root, server deployment path: `/www/wwwroot/core_node/test_promble_1.txt`) - Why in set mirror there is nginx content, and errors appeared?

**Task 2**: Ensure nginx/certbot when installing, configuration files are modified to server deployment path `/www/nginxconfig` directory. If cannot move directories like `/etc`, don't worry, but nginx website configuration, SSL, reverse proxy configuration, etc. all need to be in `/www` directory (server deployment path). This is to prevent loss after system reinstall. Simultaneously, this directory Laravel's Nginx management can search, need consistency.

**Task 3**: All website directories must be placed in server deployment path `/www/wwwroot` directory, don't place in `/var/wwwroot/html`, etc. Don't make assumptions, this has been said before. Unless absolute path specified, otherwise any domain and relative path, must connect to `/www/wwwroot` directory (server deployment path).

**Task 4**: Certbot and nginx and Laravel's nginx server management need to share a data directory, used to exchange SSL certificate application and update data. Mainly exchange domain, DNS provider, DNS token, etc.

**Task 5**: Nginx installation script appeared many problems (see `test_problem_2.txt` in project root, server deployment path: `/www/wwwroot/core_node/test_problem_2.txt`). Can use powerful recovery mechanism in nginx installation script: not installed install, after installation repair, repair failed forcefully delete then reinstall. Note: Because website SSL configuration all require to be placed in server deployment path `/www/wwwroot/nginxconfig` directory, so configuration won't be lost. This is a very long task, you need to carefully complete.

## Git Conflict Resolution

Write a Python file to solve git conflicts, place in `scripts/git`. You directly complete a completely new version. Scan `../../` path (relative to script location), skip unnecessary directories and file extensions. Mainly target code. Scan files with conflict markers. Skip files with read errors. Then intelligently keep remote and local. Default keep local. Print replacement preview effect. After pressing Y, one-click replace. Replaced files first backup save (timestamp + `.backup` file extension). Simultaneously, filename also saved to `tmp/git_merge` temporary file set backup (relative to project root). When scanning, ignore this file itself (because file has marker string).

## Network Interface Configuration

According to `_prompt/analyze.txt` this document as parameter (note: only as reference, cannot copy directly). Detect all network interfaces of system. List all network interfaces. Use up/down arrows and left/right arrows to select each network interface's function, such as `eth0[function]`. Down arrow selects network interface, left/right arrows toggle. After selection, save to temporary file. If network interfaces insufficient, prompt, and 60 seconds or press Y to skip. If selection insufficient also skip, such as no output selected, then prompt and skip. When running script again, load already selected network interface names, set as specified value in menu (still can toggle). After toggling a value, immediately update cache file.

Then use 2 network interfaces to form a virtual router in Ubuntu. For non-existent packages, automatically pre-install. Script complete in `scripts/shells/linux/debian/install_shells`, complete according to standard.

