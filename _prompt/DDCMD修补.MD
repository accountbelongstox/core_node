
---

## 🚀 立即开始执行！

准备就绪，开始一次性重构。
uring pnpm registry...
[*] [Step 4] Using default pnpm registry (Global region)
[OK] [Step 4] .pnpmrc created with default settings
[*] [Step 4] Force-setting pnpm enable-pre-post-scripts via CLI...
[OK] [Step 4] pnpm enable-pre-post-scripts set to true
[OK] [Step 4] Node.js installation completed successfully
[ERROR] Step4_InstallNodeJS.ps1 failed: Cannot bind argument to parameter 'Message' because it is an empty string.
Initialization completed successfully. Exiting...


K] Set Python UTF-8 encoding variables
[OK] Set LC_ALL=C.UTF-8
[OK] Set CORE_NODE_PROJECT_ROOT=C:\Users\TVPC\.core_node
[OK] Common environment variables configured successfully
[!] WARNING: Project directory not found: D:\programing\core_node
[*] Performing full initialization...
[!] Directory 'C:\Users\TVPC\.core_node\ncore' not found. Skipping.
[!] Directory 'C:\Users\TVPC\.core_node\ncore' not found. Skipping.
[OK] All .ps1 files processed!
[!] Shortcut check script not found: C:\Users\TVPC\.core_node\pycore\pyutils\launcher\shortcut_check.ps1
The argument 'C:\Users\TVPC\.core_node\scripts\shells\win\win_common\SecretDecryptionCheck.ps1' to the -File parameter does not exist. Provide the path to an existing '.ps1' file as an argument to the -File parameter.
Windows PowerShell

查看在dd.cmd的下载链中，是不是没有加入 SecretDecryptionCheck.ps1 这个脚本的下载，还是这个脚本被杀毒软件识杀了。
Copyright (C) Microsoft Corporation. All rights reserved.

Try the new cross-platform PowerShell https://aka.ms/pscore6

[OK] Initialization complete!

Press Enter to continue, or any other key to pause (auto-continue in 3 seconds)...
Auto-continuing in 3


所有变量放到   C:\Users\用户名\.core_node\.build_global_vars / /var/_core_node/_build_global_vars/ 中，其中不能有文件夹和子目录，key=filename,val=content.


在dd.sh dd.ps1 中的 Git Management   
都使用py来组织命令，当然最后要回退到shell中来执行，现在 
windows/liunx都只使用 入口作为调用py,最后命令会到shell中执行，注意不要使用退
出码、返回值检测任何，而使用文件变量，所有变量放到  
 C:\Users\用户名\.core_node\.build_global_vars / 
/var/_core_node/_build_global_vars/ 
中，其中不能有文件夹和子目录，key=filename,val=content. 

