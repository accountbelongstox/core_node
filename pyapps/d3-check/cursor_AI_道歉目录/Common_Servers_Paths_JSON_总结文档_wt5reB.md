# Common/Servers/Paths JSON 配置 — 总结文档 [wt5reB]

对用户提供的 `<content>`（含 common、servers、win32、linux 的 JSON 配置）的简明总结。

## 结构
顶层对象：common、servers、win32、linux。common：intranetIPAddress、localStaticHttpsApiUrl、localStaticHttpApiUrl。servers：SINGAPORE_SERVER_IP、SINGAPORE_API_DOMAIN。win32/linux：NCORE_DIR、DEV_LANG_DIR、APP_INSTALL_DIR、PROJECT_DIR、BASE_DATA_DIR、COMPILE_DIR、WIS_PROGRAMING_DIR、path_mapping_rules。

## 要点
- **common**：内网 IP（如 192.168.100.5）、本地静态 API（HTTPS :905、HTTP :805，static.local.12gm.com）。
- **servers**：新加坡服务器 IP 与 API 域（api.si.12gm.com）。
- **win32**：Windows 下固定盘符路径（含 &lt;USERNAME&gt; 的 NCORE_DIR）；path_mapping_rules 含 base_dir、compile_dir、project_dir（如 D:\\programing\\core_node）。
- **linux**：部分值为 "auto_detected"；path_mapping_rules 含 development_env/production_env、base_dir_priority（WSL /mnt/d、NTFS、/www）、compile_dir_dev/prod、project_dir_dev/prod。

## 用途
为跨平台（Windows/Linux）提供公共 API 基址、服务器地址及目录/路径映射规则，供构建或运行时配置使用。
