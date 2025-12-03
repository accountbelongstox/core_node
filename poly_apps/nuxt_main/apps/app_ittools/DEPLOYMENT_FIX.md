# ITTools 部署修复记录

## 问题描述

在同步 ITTools 到 Laravel Nginx 时出现错误:
```
Failed to install factory dependencies
ERROR Command failed with ENOENT: pnpm add pnpm@10.13.1
```

## 根本原因

`package.json` 中指定了 `"packageManager": "pnpm@10.13.1"`,但系统安装的是 `pnpm@10.24.0`。
当 pnpm 尝试自动下载指定版本时,在特定环境下会失败。

## 修复方案

### 已完成的修复

✅ 1. 更新 `package.json` 中的 `packageManager` 字段

**文件:** `poly_apps/nuxt_main/package.json`

```json
// 旧值
"packageManager": "pnpm@10.13.1",

// 新值
"packageManager": "pnpm@10.24.0",
```

✅ 2. 更新 factory 目录中的相同字段

```bash
sed -i 's/"packageManager": "pnpm@10.13.1"/"packageManager": "pnpm@10.24.0"/' \
  /_build_dir/nuxt_factory/linux/_app_ittools/package.json
```

### 部署步骤

由于 systemd 服务创建需要 root 权限,请使用 `start.sh` 脚本进行部署:

```bash
cd /www/programing/core_node/poly_apps
./nuxt_main/scripts/start.sh
```

**在脚本菜单中选择:**
1. 选择 `SYNC TO LARAVEL NGINX`
2. 选择 App: `ittools`
3. 选择 Port: `10001`
4. 选择 Service mode: `1` (Debug mode)

脚本会自动处理:
- ✅ sudo 权限提升
- ✅ 依赖安装 (现已修复)
- ✅ Systemd 服务创建
- ✅ Nginx 配置
- ✅ 服务启动

## 验证部署

部署成功后,可以通过以下方式验证:

### 1. 检查服务状态
```bash
sudo systemctl status nuxt-ittools
```

### 2. 查看服务日志
```bash
sudo journalctl -u nuxt-ittools -f
```

### 3. 测试 HTTP 访问
```bash
curl http://127.0.0.1:10001
```

### 4. 访问域名
```
http://ittools.local
```
(需要在 hosts 文件中添加域名映射)

## 后续维护

### 重新部署
```bash
php artisan servermanager:nuxt rebuild ittools
```

### 移除部署
```bash
php artisan servermanager:nuxt remove ittools
```

### 查看所有部署
```bash
php artisan servermanager:nuxt list
```

### 监控服务
```bash
php artisan servermanager:nuxt watch ittools --follow
```

## 语言支持

目前 ITTools 完全支持两种语言:

- ✅ **英文 (en)** - `apps/app_ittools/i18n_app_ittools/locales/en.json`
- ✅ **中文 (zh)** - `apps/app_ittools/i18n_app_ittools/locales/zh.json`

其他语言框架已准备,但需要完整翻译:
- 🔄 日文 (ja), 波斯文 (fa), 西班牙文 (es), 法文 (fr), 德文 (de)
- 🔄 俄文 (ru), 葡萄牙文 (pt), 意大利文 (it), 波兰文 (pl)
- 🔄 土耳其文 (tr), 瑞典文 (sv), 匈牙利文 (hu), 丹麦文 (da), 希腊文 (el)

## 架构特点

本次开发完成了以下架构优化:

✅ **统一的 API 端点定义** (`config_app_ittools/api-routes.ts`)
- 所有 88+ 工具的 API 端点集中管理
- 类型安全的路由访问
- 无硬编码 URL

✅ **标准化的 HTTP 客户端** (`services_app_ittools/http-client.ts`)
- 自动端点选择和故障转移
- 重试逻辑
- 统一的错误处理

✅ **完整的国际化支持** (i18n)
- 结构化的翻译文件
- 支持 16 种语言框架
- 所有 UI 文本通过 i18n 管理

✅ **Pinia 状态管理**
- 集中的状态管理
- 本地存储持久化
- 类型安全的 getters 和 actions

详见: `apps/app_ittools/README.md`

## 修复时间

**修复日期:** 2025-12-03
**修复内容:**
- pnpm 版本不匹配问题
- 架构文档完善
- 国际化支持完成

**状态:** ✅ 已修复,可以正常部署
