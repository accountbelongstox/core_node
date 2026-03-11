# 配置 JSON (common/servers/win32/linux) — 总结文档 [MdoAUG]

对用户提供的 `<content>`（环境与路径配置 JSON）的简明总结。

## 结构
- 根对象含四块：common、servers、win32、linux。common 为内网与本地静态 API 的 URL；servers 为新加坡服务器 IP 与 API 域名；win32/linux 为各平台路径与 path_mapping_rules。

## 要点
- **common**：intranetIPAddress、localStaticHttpsApiUrl、localStaticHttpApiUrl。**servers**：SINGAPORE_SERVER_IP、SINGAPORE_API_DOMAIN。
- **win32**：NCORE_DIR、DEV_LANG_DIR 等及 base_dir、compile_dir、project_dir。**linux**：部分 auto_detected；path_mapping_rules 含 development_env、production_env、base_dir_priority、compile_dir_dev/prod、project_dir_dev/prod。

## 用途
为多环境 API 与多平台（Windows/Linux）提供统一的路径与 URL 配置，供运行时解析 NCORE、项目、编译等目录。
