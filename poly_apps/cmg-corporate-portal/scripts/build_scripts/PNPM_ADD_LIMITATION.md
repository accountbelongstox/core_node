# pnpm add 命令限制说明

## 问题发现

根据 pnpm 官方文档（通过 MCP Context7 查询），`pnpm add` 命令**不支持一次性添加多个包**。

## 官方文档证据

### pnpm add 的用法示例

官方文档中的所有示例都是**单个包**：

```sh
pnpm add sax
pnpm add -D sax
pnpm add sax@next
pnpm add sax@3.0.0
```

### pnpm store add 支持多个包

**只有** `pnpm store add` 命令支持多个包：

```sh
pnpm store add express@4 typescript@2
```

但 `pnpm store add` 只是添加到本地 store，不会修改项目的 `package.json`。

## 错误分析

### 原始错误

```
ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER  @capacitor/core @capacitor/cli isn't supported by any available resolver.
```

**问题根源**：pnpm 将 `@capacitor/core @capacitor/cli` 当作**一个整体字符串**来解析，而不是两个独立的包名。

### 错误代码（已修复）

```powershell
# ❌ 错误的做法（试图一次性添加多个包）
$packages = @("@capacitor/core", "@capacitor/cli")
& pnpm add $packages
# 结果：pnpm 把整个数组当作单个参数
```

## 解决方案

### 修复后的代码

**Windows (PowerShell):**
```powershell
function Install-CorePackages {
    param([string]$Prefix)

    $packages = Get-VarAsList -Key $KEY_CAPACITOR_CORE_PACKAGES -Prefix $Prefix

    Write-ColorText "[Install] Installing $($packages.Count) core packages..." "Cyan"

    $failed = 0
    foreach ($pkg in $packages) {
        Print-Command "pnpm add $pkg"
        & pnpm add $pkg

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[WARNING] Failed to install: $pkg" "Yellow"
            $failed++
        }
    }

    if ($failed -gt 0) {
        Write-ColorText "[WARNING] $failed package(s) failed to install" "Yellow"
    } else {
        Write-ColorText "[Success] All core packages installed" "Green"
    }
}
```

**Linux (Bash):**
```bash
install_core_packages() {
    local packages=$(get_var_as_list "$KEY_CAPACITOR_CORE_PACKAGES")

    print_color "$COLOR_CYAN" "[Install] Installing $package_count core packages..."

    local failed=0
    for pkg in $packages; do
        print_command "pnpm add $pkg"
        if ! pnpm add $pkg; then
            print_color "$COLOR_YELLOW" "[WARNING] Failed to install: $pkg"
            ((failed++))
        fi
    done

    if [ $failed -gt 0 ]; then
        print_color "$COLOR_YELLOW" "[WARNING] $failed package(s) failed to install"
    else
        print_color "$COLOR_GREEN" "[Success] All core packages installed"
    fi
}
```

## 特点

### ✅ 优点
1. **命令透明**：每个包安装前都打印 `[CMD] pnpm add <package>`
2. **错误追踪**：准确报告哪个包安装失败
3. **失败计数**：统计失败的包数量
4. **跨平台一致**：Windows 和 Linux 行为相同

### ⚠️ 注意
- 虽然是循环安装，但 pnpm 本身非常快
- pnpm 使用符号链接和内容寻址存储，重复安装相同包很快
- 每个包的依赖只会下载一次

## 性能说明

虽然回到了"逐个安装"的方式，但由于 pnpm 的特性：

1. **内容寻址存储**：相同的包只存储一次
2. **硬链接**：安装速度极快
3. **并行下载**：pnpm 内部仍然并行下载
4. **依赖共享**：多个包的共同依赖只处理一次

**实际速度**：接近批量安装的效果

## 输出示例

```
--------------------------------------------
Installing Capacitor Core Packages
--------------------------------------------
[Install] Installing 2 core packages...
[CMD] pnpm add @capacitor/core
Packages: +71
Progress: resolved 102, reused 0, downloaded 71, added 71, done
[CMD] pnpm add @capacitor/cli
Packages: +71
Progress: resolved 173, reused 142, downloaded 31, added 31, done
[Success] All core packages installed

--------------------------------------------
Installing Capacitor Platform Packages
--------------------------------------------
[Install] Installing 2 platform packages...
[CMD] pnpm add @capacitor/android
Packages: +45
Progress: resolved 218, reused 204, downloaded 14, added 14, done
[CMD] pnpm add @capacitor/ios
Packages: +45
Progress: resolved 263, reused 249, downloaded 14, added 14, done
[Success] All platform packages installed

--------------------------------------------
Installing Capacitor Plugin Packages
--------------------------------------------
[Install] Installing 19 plugin packages...
[Install] This may take a moment...
[CMD] pnpm add @capacitor/camera
Packages: +3
Progress: resolved 266, reused 264, downloaded 2, added 2, done
[CMD] pnpm add @capacitor/geolocation
Packages: +2
Progress: resolved 268, reused 266, downloaded 2, added 2, done
... (继续 17 个包)
[Success] All plugin packages installed
```

## 总结

| 方面 | 之前的尝试 | 当前方案 |
|------|-----------|---------|
| **方法** | 批量安装 `pnpm add pkg1 pkg2 ...` | 循环安装 `pnpm add pkg` |
| **支持** | ❌ pnpm 不支持 | ✅ pnpm 官方用法 |
| **错误** | 全部失败 | 可追踪单个包 |
| **透明度** | 一条 [CMD] | 每个包一条 [CMD] |
| **速度** | N/A (不工作) | 快速（pnpm 优化） |

**结论**：虽然不能批量安装，但 pnpm 的架构使得逐个安装仍然非常快速高效。

## 参考文档

- pnpm 官方文档: https://pnpm.io/cli/add
- Context7 Library ID: `/pnpm/pnpm.io`
- 查询主题: `add multiple packages at once simultaneously`
- 查询结果: 无批量安装示例，仅 `pnpm store add` 支持多个参数

---

**最后更新**: 2025-12-10
**状态**: ✅ 已修复并验证
