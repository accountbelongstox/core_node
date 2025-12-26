# 根目录补丁脚本清单

生成时间: 2025-12-27  
更新时间: 2025-12-27 (已移动到 scripts/ 子目录)

## 说明
本文档列出了项目根目录下的所有脚本文件，特别标注了可能是补丁/修复脚本的文件。

**状态**: 所有脚本（除主脚本 dd.sh 和 dd.cmd）已移动到 scripts/ 的相应子目录中。

---

## Shell 脚本 (.sh)

### 主脚本
- **dd.sh** (21.54 KB) - 主部署脚本，包含系统初始化和菜单系统
- **133_setup_api_domains.sh** (0 KB) - API 域名设置脚本（空文件）
- **check_large_files.sh** (2.23 KB) - 检查大文件脚本

### 测试脚本（文件名异常）
- **D?programingcore_nodetest_all_endpoints.sh** (1.59 KB) - 测试所有端点
- **D?programingcore_nodetest_server_50_3.sh** (2.26 KB) - 测试服务器脚本

---

## Python 脚本 (.py)

### 修复/补丁类脚本 ⚠️
- **fix_all_singletons.py** (3.88 KB) - 修复所有单例
- **remove_subprocess_imports.py** (2.74 KB) - 移除 subprocess 导入
- **add_subprocess_where_needed.py** (2.61 KB) - 在需要的地方添加 subprocess
- **download_correct_server.py** (1.45 KB) - 下载正确的服务器
- **push_server_correct.py** (3.7 KB) - 推送正确的服务器
- **push_jar_all_devices_fixed.py** (4.09 KB) - 推送 JAR 到所有设备（已修复）
- **push_server_all_devices_fixed.py** (3.24 KB) - 推送服务器到所有设备（已修复）

### 诊断/调试类脚本
- **diagnose_offline_devices.py** (4.14 KB) - 诊断离线设备
- **debug_server_simple.py** (2.95 KB) - 简单服务器调试
- **debug_server_startup.py** (8.39 KB) - 服务器启动调试
- **check_all_server_files.py** (1.94 KB) - 检查所有服务器文件

### 设备管理类脚本
- **connect_devices.py** (2.57 KB) - 连接设备
- **reconnect_all_devices.py** (2.7 KB) - 重新连接所有设备
- **restart_adb.py** (1.95 KB) - 重启 ADB
- **restart_adbd_offline_devices.py** (2.96 KB) - 重启离线设备的 ADBD
- **usb_enable_network_adb.py** (6.4 KB) - USB 启用网络 ADB
- **verify_device_scrcpy.py** (6.43 KB) - 验证设备 scrcpy
- **verify_device_scrcpy_en.py** (6.46 KB) - 验证设备 scrcpy（英文版）

### 推送/部署类脚本
- **push_to_all_devices.py** (1.5 KB) - 推送到所有设备
- **push_scrcpy_server.py** (1.31 KB) - 推送 scrcpy 服务器
- **push_scrcpy_server_all_devices.py** (2.44 KB) - 推送 scrcpy 服务器到所有设备
- **push_jar_simple.py** (3.48 KB) - 简单推送 JAR

### 下载类脚本
- **download_nsrcc.py** (12.57 KB) - 下载 NSRCC

### 测试类脚本
- **COMPLETE_TEST_GUIDE.py** (11.88 KB) - 完整测试指南
- **QUICK_TEST_GUIDE.py** (1.44 KB) - 快速测试指南
- **test_mcp_chrome_browser.py** (6.55 KB) - 测试 MCP Chrome 浏览器
- **test_voice_subtitle.py** (2.26 KB) - 测试语音字幕
- **test_voice_subtitle_image.py** (6.75 KB) - 测试语音字幕图片

### 工具类脚本
- **scan_large_files.py** (4.67 KB) - 扫描大文件
- **git_package_size_stats.py** (11.46 KB) - Git 包大小统计
- **pycore_module_caller.py** (4.69 KB) - PyCore 模块调用器
- **pymain.py** (3.38 KB) - Python 主程序
- **run_callmodule_service.py** (2.66 KB) - 运行调用模块服务

---

## CMD 脚本 (.cmd)

- **dd.cmd** (2.84 KB) - Windows 下的主部署脚本启动器，调用 PowerShell 版本的 dd.ps1

---

## 补丁脚本分类总结

### 🔧 明确的补丁/修复脚本
1. **fix_all_singletons.py** - 修复所有单例
2. **remove_subprocess_imports.py** - 移除 subprocess 导入
3. **add_subprocess_where_needed.py** - 添加 subprocess 导入
4. **download_correct_server.py** - 下载正确的服务器版本
5. **push_server_correct.py** - 推送正确的服务器
6. **push_jar_all_devices_fixed.py** - 修复后的推送 JAR 脚本
7. **push_server_all_devices_fixed.py** - 修复后的推送服务器脚本

### 🔍 诊断/修复辅助脚本
1. **diagnose_offline_devices.py** - 诊断设备问题
2. **debug_server_simple.py** - 调试服务器
3. **debug_server_startup.py** - 调试服务器启动
4. **check_all_server_files.py** - 检查服务器文件完整性

### 📋 其他工具脚本
- 设备管理脚本（连接、重启、验证等）
- 推送/部署脚本
- 测试脚本
- 统计/分析脚本

---

## 注意事项

1. **133_setup_api_domains.sh** 是空文件，可能需要检查
2. 两个测试脚本文件名包含特殊字符（`D?programingcore_node...`），可能需要重命名
3. 多个脚本名称包含 "fixed" 或 "correct"，表明是修复版本
4. **dd.sh** 和 **dd.cmd** 是主部署脚本，不是补丁脚本

---

## 文件统计

- **Shell 脚本**: 5 个
- **Python 脚本**: 33 个
- **CMD 脚本**: 1 个
- **总计**: 39 个脚本文件

---

## 移动结果

所有脚本已按类别移动到以下目录：

### scripts/fixes/ (7 个文件)
- add_subprocess_where_needed.py
- download_correct_server.py
- fix_all_singletons.py
- push_jar_all_devices_fixed.py
- push_server_all_devices_fixed.py
- push_server_correct.py
- remove_subprocess_imports.py

### scripts/debug/ (4 个文件)
- check_all_server_files.py
- debug_server_simple.py
- debug_server_startup.py
- diagnose_offline_devices.py

### scripts/device_management/ (7 个文件)
- connect_devices.py
- reconnect_all_devices.py
- restart_adb.py
- restart_adbd_offline_devices.py
- usb_enable_network_adb.py
- verify_device_scrcpy.py
- verify_device_scrcpy_en.py

### scripts/deployment/ (4 个文件)
- push_jar_simple.py
- push_scrcpy_server.py
- push_scrcpy_server_all_devices.py
- push_to_all_devices.py

### scripts/download/ (1 个文件)
- download_nsrcc.py

### scripts/testing/ (7 个文件)
- COMPLETE_TEST_GUIDE.py
- D_programingcore_nodetest_all_endpoints.sh (已重命名，原文件名包含特殊字符)
- D_programingcore_nodetest_server_50_3.sh (已重命名，原文件名包含特殊字符)
- QUICK_TEST_GUIDE.py
- test_mcp_chrome_browser.py
- test_voice_subtitle.py
- test_voice_subtitle_image.py

### scripts/tools/ (11 个文件)
- check_large_files.sh
- git_package_size_stats.py
- scan_large_files.py
- move_root_scripts.py (移动脚本本身)

### scripts/pycore/ (3 个文件)
- pycore_module_caller.py
- pymain.py
- run_callmodule_service.py

## 处理结果

- ✅ **已移动**: 36 个文件
- ✅ **已删除**: 1 个空文件 (133_setup_api_domains.sh)
- ✅ **已重命名**: 2 个文件名异常的文件
- ✅ **保留在根目录**: dd.sh, dd.cmd (主脚本)

