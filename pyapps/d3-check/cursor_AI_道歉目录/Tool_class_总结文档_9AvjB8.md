# Tool 类（命令与工具）— 总结文档 [9AvjB8]

对用户提供的 `<content>`（AI 规则 + Tool 单例类）的简明总结。

## 结构
- **AI 规则**：文件顶部注释，规定全英文代码、不写测试与文档、不写开发过程总结、变量在文件开头声明、PowerShell 路径与字符串规则、禁止修改规则。
- **模块**：'use strict'；require child_process（exec、execSync、spawn）；class Tool；单例 module.exports = new Tool()。

## 要点
- **命令执行**：executeSync(cmd) 用 execSync；executeBySpawn(command, message, callback) 用 spawn、shell:true，按 stdout/stderr/close 回调；executeCommand(cmd, callback, log) 用 exec；executeCommands(cmds, callback, log) 顺序执行多条。
- **参数解析**：getParameters(para_key) 解析 process.argv 为 -key:value 或 -key=value，返回对象或指定键；isParameter(key)、getParameter(para_key)。
- **工具方法**：commandToString 将值转为可读字符串（路径与引号替换）；mergeJSON 深度合并；getRandomItem 随机取数组元素；deepParse 尝试对对象值 JSON.parse；getParamNames 从函数源码取参数名；arrangeAccordingToA 将 callback 置于正确位置；isPromise、isAsyncFunction、isCall、isCallByParam；printFunctions 递归打印对象中的函数名。

## 用途
为 Node 脚本/CLI 提供统一的命令执行、命令行参数解析、JSON 合并与函数参数检测等工具，以单例形式导出供多处引用。
