# ChromeDriver 手动下载指南

## 问题
你的系统没有 ChromeDriver，需要手动下载并配置。

## 解决步骤

### 步骤 1: 检查 Chrome 版本

1. 打开 Chrome 浏览器
2. 地址栏输入: `chrome://version`
3. 记录版本号（例如：131.0.6778.86）

### 步骤 2: 下载 ChromeDriver

#### 选项 A: 从官方镜像下载（推荐）

**淘宝镜像（国内快）:**
```
https://registry.npmmirror.com/binary.html?path=chromedriver/
```

**步骤**:
1. 访问上述链接
2. 找到匹配你 Chrome 版本的文件夹
3. 下载 `chromedriver_win32.zip` (Windows)
4. 解压得到 `chromedriver.exe`

#### 选项 B: 从官方网站下载

**Chrome for Testing:**
```
https://googlechromelabs.github.io/chrome-for-testing/
```

**旧版本（Chrome 114及以下）:**
```
https://chromedriver.chromium.org/downloads
```

### 步骤 3: 放置驱动文件

**Windows:**
```powershell
# 创建驱动目录
New-Item -ItemType Directory -Path "D:\drivers" -Force

# 将 chromedriver.exe 复制到 D:\drivers\
Copy-Item "下载路径\chromedriver.exe" "D:\drivers\chromedriver.exe"

# 验证文件存在
Test-Path "D:\drivers\chromedriver.exe"  # 应该返回 True
```

**Linux/Mac:**
```bash
# 创建驱动目录
sudo mkdir -p /usr/local/bin

# 复制驱动
sudo cp ~/Downloads/chromedriver /usr/local/bin/chromedriver

# 设置执行权限
sudo chmod +x /usr/local/bin/chromedriver

# 验证
which chromedriver
```

### 步骤 4: 验证配置

检查配置文件是否正确：

**launcher_config.json:**
```json
{
  "selenium_service": {
    "driver_mode": "local",
    "driver_path": "D:/drivers/chromedriver.exe"  // Windows
    // 或 "/usr/local/bin/chromedriver"  // Linux/Mac
  }
}
```

运行验证：
```bash
python pyapps/selenium_test/setup_driver.py --check-only
```

应该显示：
```
Found existing driver: D:\drivers\chromedriver.exe
Driver is executable
```

### 步骤 5: 运行测试

```bash
python pymain.py app=selenium_test
```

## 常见问题

### Q: Chrome 版本和 ChromeDriver 版本不匹配
**A:** 必须下载与你 Chrome 版本匹配的 ChromeDriver

### Q: Windows 说文件不安全
**A:** 右键文件 -> 属性 -> 取消"解除锁定"

### Q: Permission denied (Linux/Mac)
**A:** 运行 `sudo chmod +x /path/to/chromedriver`

### Q: 仍然提示 "Could not reach host. Are you offline?"
**A:** 检查：
1. `driver_mode` 是否设置为 `"local"`
2. `driver_path` 路径是否正确
3. 删除 Python 缓存: `find . -type d -name __pycache__ -exec rm -rf {} +`

## 快速检查清单

- [ ] 已检查 Chrome 版本
- [ ] 已下载匹配的 ChromeDriver
- [ ] 驱动已放置在 D:\drivers\chromedriver.exe (Windows)
- [ ] 配置文件中 driver_mode = "local"
- [ ] 配置文件中 driver_path 路径正确
- [ ] 运行 setup_driver.py --check-only 验证成功

## 备用方案：使用系统 PATH

如果你已经安装了 ChromeDriver 到系统 PATH：

**配置:**
```json
{
  "selenium_service": {
    "driver_mode": "system_path"
    // 不需要 driver_path
  }
}
```

**验证:**
```bash
# Windows (PowerShell)
Get-Command chromedriver

# Linux/Mac
which chromedriver
```

## 需要帮助？

1. 查看 SOLUTION_SUMMARY.md 的详细说明
2. 检查 MULTITHREADING_ANALYSIS.md 了解技术细节
3. 运行 `python setup_driver.py` 尝试自动配置（需要网络）
