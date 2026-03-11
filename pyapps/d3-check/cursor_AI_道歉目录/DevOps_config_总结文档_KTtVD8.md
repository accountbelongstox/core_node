# DevOps 配置模块 — 总结文档 [KTtVD8]

对用户提供的 `<content>`（AI 规则 + Node.js DevOps 配置）的简明总结。

## 结构
AI 规则注释 → require path/fs/os → isWindows → osVersion IIFE（win10/win11/ubuntu*/debian*）→ DATA_DRIVER 逻辑（Windows: D:\ 或 C:\；Linux: /mnt/d 或 /www 或 /usr）→ LANG_COMPILER_DIRNAME、APP_INSTALL_NAME → config 对象（APP_NAME、JWT/ENC 密钥、MySQL、Azure Speech、Strapi、Gitea、路径字段）→ module.exports。

## 要点
- **osVersion**：按 os.platform() 与 os.release() 返回 win10、win11、ubuntu*、debian* 或 platform。
- **DATA_DRIVER**：数据盘根路径；Windows 优先 D:\；Linux 优先 /mnt/d，其次 /www，否则 /usr。
- **config**：含 APP_NAME、API_TOKEN_SALT、ADMIN_JWT_SECRET、TRANSFER_TOKEN_SALT、JWT_SECRET（部分 ENC 加密）；MYSQL_HOST/PORT/DB/USER/PWD；AZURE_SPEECH_KEY/REGION/SPEED；STRAPI_HOST/PORT/URL/TOKEN；GITEA_TOKEN；DEV_LANG_DIR、APP_INSTALL_DIR、APP_PLATFORM_BIN_DIR、TEMP_DIR、DOWNLOAD_DIR 等路径。

## 用途
为 DevOps 应用提供跨平台的路径与外部服务（MySQL、Azure Speech、Strapi、Gitea）配置，供运行时读取。
