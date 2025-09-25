# Unified App Manager 部署功能开发分析

## 现状分析

### 1. 当前 dd.sh 菜单系统
- 在 `dd.sh` 第612行存在 "Unified App Manager" 菜单项
- 当前支持的选项：install, start, build, list
- 缺少 **deploy** 选项，这是需要新增的核心功能

### 2. 现有应用注册表 (app_registry.json)
- 包含完整的应用配置信息
- 每个应用都有 `deploy_cmd_linux` 字段，指向各自的 deploy.sh 脚本
- 如果 deploy.sh 不存在，可以回退到 start.sh 脚本
- 所有 ncore-app 类型应用都有标准的脚本结构

### 3. 现有服务管理器 (serviceManager.py)
- 位于 `scripts/serviceManager.py`
- 功能完整但是 Python 实现
- 支持多种脚本类型 (.py, .js, .sh, .pl, .rb)
- 自动生成 systemd 服务文件
- 服务命名规则：`custom-{basename}`

### 4. 系统服务安装规范
从现有代码和文档分析：
- 使用 systemd 管理服务
- 服务文件位置：`/etc/systemd/system/`
- 默认 root 权限运行
- 支持自动重启 (Restart=always)
- 工作目录设置为脚本所在目录

## 需求分析

### 1. 新增部署选项
- 在 dd.sh 菜单中添加 "deploy" 选项
- 调用应用的 deploy.sh 脚本，如不存在则使用 start.sh
- 部署后自动安装为系统服务

### 2. 服务命名规范
- 服务名格式：`ncore-{basename}`
- basename 为脚本文件名（不含扩展名）
- 例如：deploy.sh -> ncore-deploy.service

### 3. 系统服务功能
- 自动生成 systemd 服务文件
- 设置开机启动 (enable)
- 默认 root 权限运行
- 支持服务更新（已存在则更新脚本路径）

## 开发计划

### 阶段1：创建 Shell 版本的服务管理器
1. **位置**：`scripts/unified_manager/common/debian_service_manager.sh`（主要支持debian 12系统）
2. **功能**：
   - 将 serviceManager.py 的功能转换为 Shell 脚本，默认使用root账户，默认限制每个app最大CPU为现30%，内存为500M。可以供且第三方软件实现（但需要一个前置判断自动安装第三方软件）
   - 实现 `ncore-{basename}` 命名规范
   - 支持服务安装、更新、删除，安装时将安装到系统服务，更新时，如果服务名存在而脚本路径不一致，则更新脚本路径。如果脚本存在，而服务名不一样，则清理旧的服务安装新的服务。显然需要扫描所有ncore镞的服务列表。这就是为什么要使用ncore作为一个命名空间的原因。
   - 自动处理 systemd 配置

### 阶段2：扩展 unified_manager
1. **新增脚本**：`scripts/unified_manager/deploy_apps.sh`
2. **功能**：
   - 读取 app_registry.json 配置
   - 调用应用的 deploy 脚本
   - 集成服务管理器进行系统服务安装
   - 支持批量部署和单个应用部署
   - 可以显示菜单 列出所有app/poly app，选择需要安装那一个 格式为 1:appname appType [已安装服务名/未安装] ，并附加菜单，查看所有已经安装的app 列出服务器，退回上一级菜单，和退出，使用上下箭头选择。供dd.sh调用。


### 阶段3：硬编码各个app的deploy脚本
1. **新增脚本**：`scripts/unified_manager/deploy_apps.sh`
2. **功能**：
   - 对于ncore app，修改启动参数后更新到/apps/{appname}/scripts 中合适的位置，注意ncore app都是共用$root/main.js作为启动入口，只是参数不一样，详细可以查看文档
   - 对于poly app，根据项目的特色，创建deploy脚本到app目录下
   - 以上脚本供 `scripts/unified_manager/deploy_apps.sh` 调用，当不存在时，使用start脚本，当start脚本也不存在时，使用内嵌脚本：比如ncore-app的。

### 阶段4：集成到 dd.sh 菜单
1. **修改位置**：`dd.sh` 第712-766行的 unified_manager 处理逻辑
2. **新增选项**：deploy
3. **调用逻辑**：在deploy子菜单中，列出所有app/poly app，选择需要安装那一个 格式为 1:appname appType [已安装服务名/未安装] ，并附加菜单，查看所有已经安装的app 列出服务器，退回上一级菜单，和退出，使用上下箭头选择。
   ```bash
   "deploy")
       echo "Deploying applications as system services..."
       ;;
   ```

### 阶段5：更新应用注册表
1. **验证**：确保所有应用的 deploy_cmd_linux 路径正确
2. **标准化**：统一部署脚本的行为和输出格式

## 技术实现细节

### 1. 服务管理器核心函数
```bash
# 核心函数设计
create_ncore_service()     # 创建 ncore-* 服务
update_ncore_service()     # 更新现有服务
remove_ncore_service()     # 删除服务
check_service_status()     # 检查服务状态
```

### 2. 部署脚本逻辑
```bash
# 部署流程
1. 解析应用配置
2. 检查 deploy.sh 是否存在
3. 如不存在，回退到 start.sh
4. 执行部署脚本
5. 调用服务管理器安装系统服务
6. 启用并启动服务
```

### 3. 错误处理
- 脚本不存在时的回退机制
- 服务安装失败的回滚
- 权限不足的提示
- 端口冲突检测

## 现有文档满足度评估

### 满足的部分
1. ✅ dd.sh 菜单系统架构清晰
2. ✅ unified_manager 结构完整
3. ✅ 应用注册表格式标准
4. ✅ 脚本开发规范明确

### 不满足的部分
1. ❌ 缺少系统服务安装的详细规范
2. ❌ 缺少 ncore-* 服务命名规范的文档
3. ❌ 缺少部署脚本的标准化规范
4. ❌ 缺少服务管理的最佳实践指南

## 风险评估

### 低风险
- Shell 脚本开发技术成熟
- 现有框架支持良好
- systemd 是标准服务管理器

### 中风险
- 需要 root 权限操作
- 服务冲突可能性
- 不同应用的部署脚本行为可能不一致

### 高风险
- 系统服务安装可能影响系统稳定性
- 错误的服务配置可能导致启动失败

## 开发时间估算

- 阶段1
- 阶段2
- 阶段3
- 阶段4
- 阶段5

**总计**：6-9小时

## 结论

现有文档和代码结构为开发提供了良好的基础，主要需要：
1. 创建强大的 Shell 版本服务管理器
2. 实现标准化的部署流程
3. 集成到现有菜单系统

建议按阶段逐步实施，确保每个阶段都经过充分测试后再进行下一阶段。
