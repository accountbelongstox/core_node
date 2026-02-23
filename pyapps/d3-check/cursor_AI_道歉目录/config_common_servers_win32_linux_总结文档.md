# 配置 JSON (common/servers/win32/linux) — 总结文档

对用户提供的 `<content>`（环境与路径配置 JSON）的简明总结。

## 结构
- 根对象含四块：common、servers、win32、linux。
- common：内网与本地静态 API 的 URL（HTTP/HTTPS）。
- servers：新加坡服务器 IP 与 API 域名。
- win32：Windows 下 NCORE_DIR、DEV_LANG_DIR、APP_INSTALL_DIR、PROJECT_DIR、BASE_DATA_DIR、COMPILE_DIR、WIS_PROGRAMING_DIR 及 path_mapping_rules（base_dir、compile_dir、project_dir）。
- linux：同上键名，部分值为 auto_detected；path_mapping_rules 含 development_env、production_env、base_dir_priority、compile_dir_dev/prod、project_dir_dev/prod。

## 要点
- **common**：intranetIPAddress（192.168.100.5）、localStaticHttpsApiUrl（905）、localStaticHttpApiUrl（805）。
- **servers**：SINGAPORE_SERVER_IP、SINGAPORE_API_DOMAIN（api.si.12gm.com）。
- **win32**：路径以 D:\ 或 C:\Users\<USERNAME>\.ncore 为主；project_dir 指向 programing\core_node。
- **linux**：NCORE_DIR 等为 /usr/.core_node 或 auto_detected；规则区分 WSL/NTFS/桌面与生产环境，base_dir 优先级为 WSL /mnt/d → NTFS → 数据盘 → /www，project_dir 开发为 base_dir/programing/core_node，生产为 base_dir/wwwroot/core_node。

## 用途
为多环境（内网、本地静态、新加坡服务器）与多平台（Windows/Linux）提供统一的 API 基址与路径配置，供运行时解析 NCORE、项目、编译、数据等目录。
