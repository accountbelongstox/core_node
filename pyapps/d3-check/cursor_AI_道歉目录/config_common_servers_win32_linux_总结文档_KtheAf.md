# 多环境配置 JSON（common/servers/win32/linux）— 总结文档 [KtheAf]

对用户提供的 `<content>`（JSON 配置）的简明总结。

## 结构
- common：intranetIPAddress、localStaticHttpsApiUrl、localStaticHttpApiUrl。
- servers：SINGAPORE_SERVER_IP、SINGAPORE_API_DOMAIN。
- win32：NCORE_DIR、DEV_LANG_DIR、APP_INSTALL_DIR、PROJECT_DIR、BASE_DATA_DIR、COMPILE_DIR、WIS_PROGRAMING_DIR；path_mapping_rules（base_dir、compile_dir、project_dir）。
- linux：同名字段，值多为路径或 "auto_detected"；path_mapping_rules（development_env、production_env、base_dir_priority、compile_dir_dev/prod、project_dir_dev/prod）。

## 要点
- 按平台区分；win32 为固定路径，linux 含自动检测与 WSL/NTFS 等规则；common/servers 为 API 与服务器地址。

## 用途
多环境（内网/本地/新加坡、Windows/Linux）的路径与 API 配置，供构建或运行时读取。
