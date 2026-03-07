# ModelInitializer (DeepSeek-VL) + AI 规则 — 总结文档 [rfqlb5]

对用户提供的 `<content>`（ModelInitializer 类与 AI 规则注释）的简明总结。

## 结构
- 头部注释 AI SPECIAL ATTENTION RULES：仅英文、不写测试/文档/总结、变量在文件开头、PowerShell 规则、禁止修改规则。
- require fs、path、os、Logger、CommandExecutor。类 ModelInitializer：constructor（executor、platform、baseDir、modelName、modelDir、repoUrl）；detectPlatform（win32/wsl/linux/darwin）；getBaseDirectory（按平台）；ensureBaseDirectory；checkModelExists（requiredFiles、verifyDirectory）；cloneModel（git clone）；installDependencies（requirements.txt、pipInstall）；initializeModel（存在则跳过否则 clone+install）；getModelPath、getStatus。module.exports。

## 要点
- 跨平台基础目录；DeepSeek-VL 存在性检查与校验；不存在则 clone 再安装依赖；依赖 CommandExecutor、Logger。

## 用途
初始化/拉取 DeepSeek-VL 模型仓库并安装依赖，供获取模型路径与状态。
