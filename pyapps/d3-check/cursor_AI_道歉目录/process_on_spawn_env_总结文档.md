# process-on-spawn 环境变量传递模块总结文档

本文档对用户提供的 `<content>`（基于 process-on-spawn 的环境变量传递逻辑）做简明总结。

## 结构概览
- **运行环境**：Node.js，'use strict'；依赖 `process-on-spawn`。
- **数据**：`envToCopy` 对象（需传递到子进程的环境变量）；`copyAtLoad` 数组（加载时从 process.env 复制的变量名列表）。
- **导出**：`updateVariable(envName)` 函数。

## 要点
- **copyAtLoad**：含 NYC_CONFIG、NYC_CWD、NYC_PROCESS_ID、BABEL_DISABLE_CACHE 等；模块加载时若 process.env 中存在对应键，则拷贝到 envToCopy。
- **processOnSpawn.addListener**：在每次 spawn 时执行 `Object.assign(env, envToCopy)`，将 envToCopy 合并进子进程的 env，从而把选定的环境变量传给子进程。
- **updateVariable(envName)**：将当前进程的 process.env[envName] 写入 envToCopy，之后 spawn 的子进程会继承该变量；用于在运行时动态添加需要传递的变量。

## 用途
在依赖子进程的测试或构建场景（如 NYC 覆盖率、Babel）中，保证关键环境变量被正确传递到子进程，避免配置丢失或行为不一致。
