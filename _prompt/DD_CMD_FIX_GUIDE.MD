# DD.CMD Fix Guide

Add methods in scripts/shells/linux/common to read get real user. Rename scripts/shells/linux/common/fix_all_permissions_lib.sh to a generic library that can fix permissions and ownership of common directories like core node dir / project dir/ _build dir/ to the real login user instead of root user. Provide a main method and sub-methods for each directory to prevent freezing when fixing too many at once, but also provide a main method that can be called once. Then, in ROOT_DIR/scripts/unified_manager, reference the permission fix library and call it before creating services to fix related paths so they can be accessed by regular users. 

## Overview

Check in `dd.cmd`'s download chain, whether `SecretDecryptionCheck.ps1` script download was not added, or this script was killed by antivirus software.

## Variable Storage

All variables stored in:
- **Windows**: User home directory `~/.core_node/.build_global_vars` (e.g., `C:\Users\username\.core_node\.build_global_vars`)
- **Linux**: `/var/_core_node/_build_global_vars/`

**Format**: No folders and subdirectories, `key=filename`, `val=content`.

## Git Management

In `dd.sh` and `dd.ps1`'s Git Management, all use Python to organize commands. Of course, finally need to return to shell for execution. Now Windows/Linux both only use entry as call to Python, final commands will go to shell for execution.

**Note**: Do not use exit codes, return value detection for anything, but use file variables. All variables stored in:
- **Windows**: User home directory `~/.core_node/.build_global_vars` (e.g., `C:\Users\username\.core_node\.build_global_vars`)
- **Linux**: `/var/_core_node/_build_global_vars/`

**Format**: No folders and subdirectories, `key=filename`, `val=content`.

使用MCP扫描文档,先得到gitea 框架是如何备份数据的,查看官方是否有推荐方法.

123_install_gitea.sh 找到这个文件,推导出其中的安装逻辑,之后在 
dd.sh>显示的菜单中添加一个备份菜单项,之后建立一个新文件(人windows的在同目录
 参考dd.cmd > Backup Management> 所在的文件),为liunx建立独立备份文件,需要和
123_install_gitea.sh  中的逻辑对应,显示一个子菜单,其中一项就是备份gitea,
注意引入scripts/shells/linux/common/gvar_common.sh 中的map web 
path中的路径映射备份到key = "www" 
目录下的backups目录中/gitea/${备份文件名_日期_编号}  
,当然菜单中同时有恢复方法.恢复时会根据同样的逻辑停止服务并恢复再重启.注意使
用多文件构架,不要在一个文件里完成全部功能.dd.sh只是引用入触发. 
