# 环境与路径配置 JSON 总结文档

对用户提供的 `<content>`（common/servers/win32/linux 配置 JSON）的简明总结。

## 结构
- 顶层：common、servers、win32、linux。win32/linux 内为路径变量与 path_mapping_rules。

## 要点
- **common**：intranetIPAddress、localStaticHttpsApiUrl、localStaticHttpApiUrl。
- **servers**：SINGAPORE_SERVER_IP、SINGAPORE_API_DOMAIN。
- **win32**：NCORE_DIR（含 &lt;USERNAME&gt;）、DEV_LANG_DIR、APP_INSTALL_DIR、PROJECT_DIR、BASE_DATA_DIR、COMPILE_DIR、WIS_PROGRAMING_DIR；path_mapping_rules 含 base_dir、compile_dir、project_dir。
- **linux**：同名键多为 auto_detected 或固定路径；path_mapping_rules 含 development_env、production_env、base_dir_priority、compile_dir_dev/prod、project_dir_dev/prod。

## 用途
为 12gm/core_node 类项目在 Windows 与 Linux（WSL/生产）下提供通用 API 与服务器地址及按平台区分的目录与路径映射。
