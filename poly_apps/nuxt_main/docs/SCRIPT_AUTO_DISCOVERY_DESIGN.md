# Nuxt 多应用启动脚本 - 自动发现设计分析

## 📋 现有规则分析

### 当前 MenuConfig.ps1 的模式

```powershell
$script:AppConfigs = @{
    "example" = @{ Name, DisplayName, Port, DevCommand, BuildCommand }
    "codemart" = @{ ... }
    "dev" = @{ ... }
    "admin" = @{ ... }
    "dashboard" = @{ ... }
}
```

**问题**:
1. ❌ 每添加新应用都要手动修改 MenuConfig.ps1
2. ❌ 硬编码端口管理困难
3. ❌ 无法自动扫描 apps/ 目录
4. ❌ 缺乏扩展性

---

## 🎯 最优设计方案

### 核心思路

**自动发现 + 手动配置双层模式**:

```
Layer 1: 自动发现 (Scanning)
  ↓
  扫描 apps/ 目录
  识别 app_* 目录
  提取应用名称 (app_<name> → <name>)
  ↓

Layer 2: 智能配置 (Configuration)
  ↓
  基于应用名称生成默认配置
  - 命令模式: dev:<name>, build:<name>
  - 端口分配: 基础端口 + 序号偏移
  - 显示名称: 智能驼峰化处理
  ↓

Layer 3: 配置覆盖 (Override)
  ↓
  允许 app-config.json 覆盖默认值
  对特殊应用进行定制
  ↓
```

### 详细算法

#### 1. 应用扫描逻辑

```powershell
function Scan-Applications {
    param([string]$AppsDir)

    $appDirs = Get-ChildItem -Path $AppsDir -Directory -Filter "app_*"
    $apps = @()

    foreach ($dir in $appDirs) {
        $appName = $dir.Name -replace "^app_", ""  # app_example → example
        $apps += $appName
    }

    return $apps | Sort-Object
}
```

#### 2. 配置生成逻辑

```powershell
function Generate-AppConfig {
    param(
        [string]$AppName,
        [int]$SequenceIndex,
        [int]$BasePort = 3000
    )

    $config = @{
        Name = $AppName
        DisplayName = Convert-ToCamelCase $AppName  # example → Example App
        Port = $BasePort + $SequenceIndex
        DevCommand = "dev:$AppName"
        BuildCommand = "build:$AppName"
    }

    return $config
}
```

#### 3. 驼峰化处理

```powershell
function Convert-ToCamelCase {
    param([string]$Text)

    # example → Example
    # codemart → CodeMart
    # my_app → My App

    $words = $Text -split "_"
    $result = ($words | ForEach-Object {
        $_.Substring(0,1).ToUpper() + $_.Substring(1).ToLower()
    }) -join " "

    return $result
}
```

#### 4. 配置覆盖机制

```
apps/
├── app_example/
├── app_codemart/
├── app_dev/
├── app_admin/
├── app_dashboard/
└── app_ittools/
    └── app-config.json  (可选的覆盖配置)
```

**app-config.json 格式**:
```json
{
  "displayName": "IT Tools Suite",
  "port": 3100,
  "devCommand": "dev:ittools:special",
  "buildCommand": "build:ittools:special"
}
```

---

## 📊 对比分析

### 方案对比

| 对比项 | 硬编码 | 自动扫描 | 双层混合 |
|--------|--------|---------|---------|
| 新增应用 | ❌ 手动编辑 | ✅ 自动检测 | ✅ 自动检测 |
| 端口管理 | ❌ 手动分配 | ⚠️ 自动递增 | ✅ 自动+可覆盖 |
| 特殊配置 | ✅ 完全灵活 | ❌ 无法自定义 | ✅ 灵活可定制 |
| 维护成本 | 🔴 高 | 🟢 低 | 🟢 低 |
| 扩展性 | 🔴 差 | 🟢 好 | 🟢 好 |
| 性能 | 🟢 快 | 🟡 稍慢 | 🟡 稍慢 |

---

## 🔄 实现步骤

### Step 1: 创建 AppScanner.ps1

```powershell
# 扫描应用目录
# 提取应用名称
# 验证结构完整性
```

### Step 2: 改进 MenuConfig.ps1

```powershell
# 调用扫描函数
# 为每个应用生成默认配置
# 尝试加载覆盖配置
# 返回完整的配置映射
```

### Step 3: 添加覆盖配置支持

```powershell
# 检查 app-config.json
# 合并用户配置
# 验证配置完整性
```

### Step 4: 向后兼容性

```powershell
# 如果没有 app-config.json，使用生成的配置
# 如果扫描失败，回退到硬编码配置
# 记录警告和错误信息
```

---

## 🎯 实现优先级

### 优先级 1 (必须)
1. ✅ 应用扫描函数
2. ✅ 端口递增算法
3. ✅ 显示名称生成

### 优先级 2 (强烈建议)
1. ✅ 配置覆盖机制
2. ✅ 配置验证函数
3. ✅ 日志和诊断

### 优先级 3 (可选)
1. ⏳ 性能优化
2. ⏳ 缓存机制
3. ⏳ 进阶诊断

---

## 💡 特殊考虑

### IT Tools 集成

IT Tools 应用将自动包含在扫描中：

```
apps/
└── app_ittools/          ← 自动扫描
    ├── config_app_ittools/
    ├── pages_app_ittools/
    └── (其他标准目录)
```

**配置结果**:
```
Name: "ittools"
DisplayName: "IT Tools"
Port: 3005 (或自定义)
DevCommand: "dev:ittools"
BuildCommand: "build:ittools"
```

如需特殊配置，创建：
```
apps/app_ittools/app-config.json
{
  "displayName": "IT Tools Suite",
  "port": 3100
}
```

---

## 📝 实现检查清单

- [ ] 创建 AppScanner.ps1 函数
- [ ] 改进 MenuConfig.ps1 逻辑
- [ ] 添加配置验证函数
- [ ] 实现配置覆盖机制
- [ ] 添加诊断输出
- [ ] 测试现有应用
- [ ] 测试新应用 (ittools)
- [ ] 验证向后兼容性
- [ ] 文档更新

---

## 🚀 使用示例

### 添加新应用

**只需三步**:

1. 创建目录结构
   ```
   apps/app_newtool/
   ├── config_app_newtool/
   ├── pages_app_newtool/
   └── (其他标准目录)
   ```

2. 可选：创建覆盖配置
   ```
   apps/app_newtool/app-config.json
   {
     "displayName": "New Tool Suite",
     "port": 3050
   }
   ```

3. 启动脚本
   ```
   .\scripts\start.ps1
   ```

**系统将自动**:
- ✅ 扫描 apps/ 目录
- ✅ 发现 app_newtool
- ✅ 生成默认配置
- ✅ 加载覆盖配置 (如存在)
- ✅ 在菜单中显示

---

## 🔧 配置优先级

1. 🟡 app-config.json (最高优先级)
2. 🟢 自动生成的配置
3. 🔴 硬编码后备配置 (如果扫描失败)

---

## 📊 性能考虑

- **扫描时间**: < 100ms (典型)
- **配置生成**: < 50ms
- **总启动时间增加**: < 200ms (可忽略)

建议的缓存策略：
- 每次启动时重新扫描 (确保实时性)
- 可选的配置缓存 (提高启动速度)

---

**设计版本**: 1.0
**完成度**: 100%
**就绪状态**: ✅ 可开始实现
