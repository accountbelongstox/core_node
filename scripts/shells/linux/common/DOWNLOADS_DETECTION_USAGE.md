# Downloads 目录自动检测公共函数使用指南

## 概述

已将"持续等待下载并自动检测"逻辑固定为公共函数，所有脚本应使用这些统一的函数。

## 公共函数位置

文件：`/www/programing/core_node/scripts/shells/linux/common/common_functions.sh`

## 核心函数

### 1. 查找所有 Downloads 目录
```bash
find_all_downloads_dirs_from_common_functions()
```
- **功能**：扫描所有用户的 Downloads 目录
- **返回**：所有 Downloads 目录路径（每行一个）
- **扫描范围**：
  - `$HOME/Downloads` (当前用户)
  - `/home/*/Downloads` (所有用户)
  - `/root/Downloads` (root用户)

### 2. 查找单个文件
```bash
find_file_in_downloads_from_common_functions <pattern> [newest|oldest]
```
- **参数1**：文件模式（如 `*.deb`, `google-chrome-*.deb`）
- **参数2**：排序方式（`newest` 或 `oldest`，默认 `newest`）
- **返回**：找到的文件完整路径，未找到返回空
- **示例**：
  ```bash
  chrome_deb=$(find_file_in_downloads_from_common_functions "google-chrome-stable*.deb" "newest")
  ```

### 3. 查找多个文件
```bash
find_files_in_downloads_from_common_functions <pattern> [max_results]
```
- **参数1**：文件模式
- **参数2**：最大结果数（0=无限制，默认0）
- **返回**：所有匹配文件路径（按时间降序，每行一个）
- **示例**：
  ```bash
  # 查找所有 .deb 文件
  all_debs=$(find_files_in_downloads_from_common_functions "*.deb")

  # 只查找最新的3个
  recent_debs=$(find_files_in_downloads_from_common_functions "*.deb" 3)
  ```

### 4. 持续等待下载（核心函数）
```bash
prompt_and_wait_for_download_from_common_functions <url> <pattern> [timeout_seconds]
```

#### 参数说明
- **参数1 (url)**：下载链接（会自动在浏览器中打开）
- **参数2 (pattern)**：文件匹配模式（如 `*.deb`）
- **参数3 (timeout)**：超时秒数（0=无限等待，默认0）

#### 返回值
- **成功**：返回0，并输出文件路径到 stdout
- **失败**：返回1（用户取消或超时）

#### 核心特性
✅ **无限循环**：`while true` 直到找到文件或用户取消
✅ **自动检测**：每2秒自动扫描一次 Downloads 目录
✅ **进度显示**：显示已等待时间
✅ **非阻塞输入**：用户可随时输入命令
✅ **自动打开浏览器**：使用 xdg-open 打开下载页面

#### 用户命令
- `quit` / `q` / `exit` / `cancel`：取消等待
- `yes` / `y` / `check`：强制立即检查
- 其他输入：忽略

## 使用示例

### 示例1：Chrome 安装
```bash
#!/bin/bash
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# 尝试查找已下载的 Chrome
chrome_deb=$(find_file_in_downloads_from_common_functions "google-chrome-stable*.deb")

if [[ -z "$chrome_deb" ]]; then
    echo "未找到 Chrome .deb，尝试自动下载..."

    # 尝试自动下载
    if ! wget -O /tmp/chrome.deb "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"; then
        # 下载失败，提示用户手动下载并持续等待
        chrome_deb=$(prompt_and_wait_for_download_from_common_functions \
            "https://www.google.com/chrome/" \
            "google-chrome-stable*.deb" \
            0)  # 无限等待

        if [[ -z "$chrome_deb" ]]; then
            echo "用户取消下载"
            exit 1
        fi
    else
        chrome_deb="/tmp/chrome.deb"
    fi
fi

# 安装
sudo dpkg -i "$chrome_deb"
```

### 示例2：VS Code 安装（带超时）
```bash
# 查找 VS Code .deb
vscode_deb=$(find_file_in_downloads_from_common_functions "code_*.deb")

if [[ -z "$vscode_deb" ]]; then
    # 10分钟超时
    vscode_deb=$(prompt_and_wait_for_download_from_common_functions \
        "https://code.visualstudio.com/Download" \
        "code_*.deb" \
        600)

    if [[ $? -ne 0 ]]; then
        echo "下载超时或取消"
        exit 1
    fi
fi

sudo dpkg -i "$vscode_deb"
```

### 示例3：查找多个文件
```bash
# 查找所有 .AppImage 文件
appimages=$(find_files_in_downloads_from_common_functions "*.AppImage")

if [[ -n "$appimages" ]]; then
    echo "找到的 AppImage 文件："
    echo "$appimages"
else
    echo "未找到任何 AppImage 文件"
fi
```

## 运行示例

当调用 `prompt_and_wait_for_download_from_common_functions` 时，输出如下：

```
[STEP] Manual download required
[INFO] Download URL: https://www.google.com/chrome/
[INFO] Save the file to any /home/*/Downloads directory
[INFO] Expected file pattern: google-chrome-stable*.deb

[INFO] Auto-scanning every 2s (waiting indefinitely)
[INFO] Type 'quit' to cancel anytime

[0s] Scanning Downloads directories for: google-chrome-stable*.deb
[2s] Scanning Downloads directories for: google-chrome-stable*.deb
[4s] Scanning Downloads directories for: google-chrome-stable*.deb
...
[18s] Scanning Downloads directories for: google-chrome-stable*.deb

[SUCCESS] Auto-detected downloaded file: /home/user/Downloads/google-chrome-stable_current_amd64.deb
```

## 工作流程

```
开始
  ↓
尝试在 Downloads 查找文件
  ├─ 找到 → 直接使用
  └─ 未找到 ↓
     尝试自动下载
       ├─ 成功 → 使用下载的文件
       └─ 失败 ↓
          调用 prompt_and_wait_for_download_from_common_functions
            ↓
          打开浏览器到下载页面
            ↓
          [while true 循环开始]
            ↓
          每2秒自动扫描 Downloads 目录
            ├─ 检测到文件 → 返回文件路径
            ├─ 用户输入 quit → 返回错误
            └─ 继续循环 ↑
```

## 已修改的脚本

以下脚本已使用此公共逻辑：

| 脚本 | 文件模式 | 下载URL |
|------|----------|---------|
| `32_install_swoole.sh` | - | PHP 符号链接检测 |
| `35_install_chrome.sh` | `google-chrome-stable*.deb` | https://www.google.com/chrome/ |
| `37_install_dotnet.sh` | - | 使用官方安装脚本 |

## 最佳实践

### 1. 优先级顺序
```bash
# 1. 优先使用 Snap（如果支持）
if command -v snap >/dev/null 2>&1; then
    snap install package-name
    exit 0
fi

# 2. 查找 Downloads 中的包
local_pkg=$(find_file_in_downloads_from_common_functions "package*.deb")

# 3. 尝试自动下载
if [[ -z "$local_pkg" ]]; then
    wget -O /tmp/package.deb "https://download-url"
fi

# 4. 下载失败，持续等待用户手动下载
if [[ ! -f /tmp/package.deb ]]; then
    local_pkg=$(prompt_and_wait_for_download_from_common_functions \
        "https://download-page" \
        "package*.deb" \
        0)
fi
```

### 2. 错误处理
```bash
# 检查返回值
if [[ $? -ne 0 ]] || [[ -z "$package_file" ]]; then
    echo "安装取消或失败"
    exit 1
fi

# 验证文件存在
if [[ ! -f "$package_file" ]]; then
    echo "文件不存在：$package_file"
    exit 1
fi
```

### 3. 文件清理
```bash
# 如果使用临时文件，记得清理
if [[ "$package_file" == "/tmp/"* ]]; then
    rm -f "$package_file"
fi
```

## 技术细节

### 自动检测机制
```bash
while true; do
    # 每2秒检查一次
    if [[ $((current_time - last_check)) -ge 2 ]]; then
        found_file=$(find_file_in_downloads_from_common_functions "$pattern")
        if [[ -n "$found_file" ]]; then
            return 0  # 找到文件，退出循环
        fi
        last_check=$current_time
    fi

    # 非阻塞用户输入（1秒超时）
    read -r -t 1 user_input || true

    # 处理用户命令...
done
```

### 性能优化
- 使用 `find -maxdepth 1` 避免深度递归
- 使用 `find -print0` 和 `read -d ''` 处理特殊文件名
- 使用 `-t 1` 实现非阻塞输入
- 只在需要时才执行 `find` 命令

## 故障排除

### 问题1：检测不到文件
**原因**：文件名不匹配模式
**解决**：
```bash
# 使用更宽松的模式
"*.deb"           # 所有 .deb 文件
"*chrome*.deb"    # 包含 chrome 的 .deb
"code*.deb"       # code 开头的 .deb
```

### 问题2：多个文件时选择哪个
**答案**：默认选择最新的（newest）
```bash
# 明确指定
find_file_in_downloads_from_common_functions "*.deb" "newest"  # 最新
find_file_in_downloads_from_common_functions "*.deb" "oldest"  # 最旧
```

### 问题3：权限问题
**解决**：确保脚本可以访问所有用户的 Downloads 目录
```bash
# 以 root 运行或使用 sudo
sudo bash script.sh
```

## 总结

这套公共函数提供了统一的 Downloads 目录检测机制，具有以下优势：

✅ **自动化**：无需手动干预，自动检测文件
✅ **用户友好**：清晰的进度提示
✅ **可靠性**：无限循环确保不会错过文件
✅ **灵活性**：支持超时、取消、强制检查
✅ **一致性**：所有脚本使用相同的逻辑
