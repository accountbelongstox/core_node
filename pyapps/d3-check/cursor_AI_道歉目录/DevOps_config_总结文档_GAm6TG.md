# DevOps 配置模块 — 总结文档 [GAm6TG]

对用户提供的 `<content>`（AI 规则 + Node.js DevOps 配置）的简明总结。

## 结构
AI 规则注释 → require path/fs/os → isWindows → osVersion IIFE（win10/win11/ubuntu*/debian*）→ DATA_DRIVER 逻辑 → LANG_COMPILER_DIRNAME、APP_INSTALL_NAME → config 对象（APP_NAME、JWT、MySQL、Azure Speech、Strapi、Gitea、路径）→ module.exports。

## 要点
- osVersion：按 platform/release 返回 win10、win11、ubuntu*、debian* 或 platform。
- DATA_DRIVER：Windows 优先 D:\；Linux 优先 /mnt/d，其次 /www，否则 /usr。
- config：含 API_TOKEN_SALT、ADMIN_JWT_SECRET、JWT_SECRET（ENC）、MYSQL_*、AZURE_SPEECH_*、STRAPI_*、GITEA_TOKEN 及 DEV_LANG_DIR、APP_INSTALL_DIR、TEMP_DIR、DOWNLOAD_DIR 等路径。

## 用途
为 DevOps 应用提供跨平台路径与外部服务（MySQL、Azure、Strapi、Gitea）配置。
