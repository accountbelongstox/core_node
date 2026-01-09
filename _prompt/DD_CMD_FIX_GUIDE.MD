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


 ✅ 完成总结

  1. 核心工具已创建

  - ✅ bundle_encrypt.js - 创建批量加密包
  - ✅ bundle_add_file.js - 添加/替换文件（支持 --replace）
  - ✅ bundle_remove_file.js - 删除文件
  - ✅ bundle_list_files.js - 查看文件列表
  - ✅ bundle.template.js - 自包含可执行批量包模板

  2. dd.sh 集成完成

  修改了 secret_functions.sh 的 ensure_secret_keys_ready() 函数：

  解密触发逻辑（你要求的）：
  - ✅ 只检查 .secret_ignore/ 中是否缺少文件
  - ✅ 不对比时间戳 - 只要文件存在就不重新解密
  - ✅ 即使 encrypted 文件更新也不会自动触发解密
  - ✅ 批量包检查文件数量差异

  模式选择：
  - ✅ 两种模式都有缺失时 → 提示用户选择
  - ✅ 只有一种模式时 → 自动使用该模式

  3. 目录结构

  .secret_keys/
  ├── already_encrypted/         # 个别加密 (原有)
  ├── already_batch_encrypted/   # 批量加密 (新增)
  └── .secret_ignore/            # 解密文件

  4. 性能提升

  - 个别模式：48 文件 = 48 进程 (~2-3秒)
  - 批量模式：48 文件 = 1 进程 (~0.1秒)
  - 提升 20-30 倍

  5. 全部测试通过

  - ✅ 创建批量包（3文件）
  - ✅ 添加文件（追加到4文件）
  - ✅ 删除文件
  - ✅ 查看文件列表
  - ✅ 批量解密所有文件
  - ✅ 内容验证正确

  6. 文档齐全

  - ✅ README.txt - 技术文档
  - ✅ USAGE_GUIDE.txt - 完整使用指南
  - ✅ 逻辑流程图

