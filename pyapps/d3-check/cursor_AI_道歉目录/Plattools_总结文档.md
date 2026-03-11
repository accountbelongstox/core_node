# Plattools 总结文档

本文档对用户提供的 `<content>`（Plattools 类）做简明总结。

## 文件头部规则
- **AI SPECIAL ATTENTION RULES**：代码仅用英文；不编写/执行/修改测试；不创建或更新 `*.md` 文档；开发与思考过程中不写总结；所有变量在文件开头声明；PowerShell 脚本不使用相对路径、不直接拼接字符串到变量，改用 Split-Path/Join-Path/Resolve-Path；不得修改上述规则。

## 依赖与继承
- **require**：child_process（execSync、spawn、exec、spawnSync）、fs、path、Base（#@base）、readline。
- **Plattools** 继承 **Base**；构造时 `initialWorkingDirectory`、`currentDir` 取自 `getCwd()`。

## 命令执行方法
- **cmd(command, info, cwd, logname)**：异步 Promise，内部用 spawnSync；支持 cwd 与恢复 initialWorkingDirectory；注意 spawnSync 无流式 .on('data')，当前实现可能无法正确收集 stdout/stderr。
- **execCommand / execCmdSync / cmdSync**：基于 exec，回调中 wrapEmdResult，支持 cwd、logname。
- **wrapEmdResult(success, stdout, error, code, info)**：第二参数在实现中被误赋为 stdout，error 未正确传入。
- **execCmd**：同步 execSync，Linux 下 shell 为 /bin/bash；支持 cwd 与恢复工作目录。
- **cmdAsync**：委托给 cmd。
- **spawnAsync**：spawn 子进程，支持 timeout、progressCallback；遇 (y/n) 或 (yes/no) 自动写 Y 或 Yes；close 时 resolve wrapEmdResult。
- **spawnSync**：Promise 包装的 spawnSync，收集 stdout/stderr，close/error 时 resolve。
- **execByExplorer / execByCommand**：Windows 下通过 explorer 或 cmd /c 执行。

## 平台与权限
- **isWindows / isLinux**：依据 process.platform。
- **isCentos / isUbuntu / isDebian**：读 /etc/os-release 判断。
- **isCommand(command)**：where（Windows）或 which（Linux）检测命令是否存在。
- **isAdmin()**：Windows 下通过 NET SESSION 判断。

## 工具方法
- **byteToStr**：Buffer/字节转 UTF-8 字符串。
- **reloadSystemctl()**：Linux 下执行 systemctl daemon-reload（代码中引用 os.platform，需确保 require('os') 已存在）。

## 用途
为项目提供跨平台命令行执行、工作目录切换、日志记录、平台与权限检测，供其他模块复用。
