# Edge-TTS 升级修复总结

## 问题诊断

### 症状
- 231,719 个 TTS 任务pending，0个processing
- 所有edge-tts生成的MP3文件大小为0字节
- 错误信息：`NoAudioReceived: No audio was received`

### 根本原因
**Edge-TTS版本过旧** (7.2.3) 与Microsoft TTS服务不兼容

### 解决方案
升级edge-tts从 7.2.3 到 7.2.7

---

## 修复步骤

### 1. 升级 edge-tts
```bash
pip3 install --upgrade --break-system-packages edge-tts
```

**结果**:
- 旧版本: 7.2.3
- 新版本: 7.2.7
- 安装位置: `/usr/local/lib/python3.12/dist-packages/edge_tts`

### 2. 验证修复
```bash
# 测试TTS生成
cd /tmp
/usr/bin/python3 -m edge_tts --text "test" --voice "en-US-JennyNeural" --write-media test.mp3

# 检查文件
ls -lh test.mp3
-rw-rw-r-- 1 ubuntu ubuntu 8.9K Dec 21 17:45 test.mp3

# 验证文件类型
file test.mp3
test.mp3: MPEG ADTS, layer III, v2, 48 kbps, 24 kHz, Monaural
```

✅ **成功**: 生成8.9KB有效MP3文件

### 3. 重启TTS队列Worker
```bash
# 找到旧worker进程
ps aux | grep tts_queue_worker

# 停止旧worker
kill <old_pid>

# 启动新worker
cd /www/programing/core_node/poly_apps/laravel_main
nohup php tts_queue_worker.php >> storage/logs/tts_queue_worker.log 2>&1 &
```

---

## 技术细节

### Edge-TTS 执行方式对比

#### 方式1: 直接调用 (❌ 失败)
```bash
/usr/local/bin/edge-tts --text "test" ...
```
**问题**: Shebang指向`#!/usr/local/bin/python3` (不存在)
**Python实际位置**: `/usr/bin/python3`

#### 方式2: Python模块调用 (✅ 正确)
```bash
/usr/bin/python3 -m edge_tts --text "test" ...
```
**优势**:
- 不依赖shebang
- 使用正确的Python解释器
- EdgeTTSService.php已使用此方式

### 为什么PycoreEdgeTTSUtil需要修复

**PycoreEdgeTTSUtil.php的旧代码**:
```php
$command = sprintf(
    'edge-tts --text %s --voice %s --write-media %s 2>&1',
    escapeshellarg($text),
    escapeshellarg($voice),
    escapeshellarg($tempFile)
);
```

**问题**:
- 直接调用`edge-tts`脚本
- 依赖错误的shebang

**修复后的代码** (已应用):
```php
$command = sprintf(
    '/usr/bin/python3 /usr/local/bin/edge-tts --text %s --voice %s --write-media %s 2>&1',
    escapeshellarg($text),
    escapeshellarg($voice),
    escapeshellarg($tempFile)
);
```

---

## 文件修改记录

### 已修改文件

1. **PycoreEdgeTTSUtil.php** - Line 26, 85
   - 修改edge-tts调用方式
   - 位置: `/www/programing/core_node/poly_apps/laravel_main/app/CallPycoreUtils/PycoreEdgeTTSUtil.php`

### 无需修改文件

1. **EdgeTTSService.php**
   - 已正确使用 `python3 -m edge_tts`
   - 位置: `/www/programing/core_node/poly_apps/laravel_main/app/Services/EdgeTTS/EdgeTTSService.php`

2. **AppQyV1TTSService.php** (已废弃)
   - 已正确使用 `python3 -m edge_tts`
   - 标记为@deprecated

3. **AppQyV1UnifiedTTSQueueService.php**
   - 调用EdgeTTSService，无需修改

---

## 前置安装脚本建议

### 当前状况
- 没有专门的edge-tts安装脚本
- `13_ensure_python.sh` 只提供pip包安装函数
- Edge-TTS可能是手动安装的

### 建议改进

#### 选项1: 更新 13_ensure_python.sh
在包安装列表中添加edge-tts：

```bash
# 在 13_ensure_python.sh 中添加
REQUIRED_PIP_PACKAGES=(
    "setuptools"
    "wheel"
    "edge-tts>=7.2.7"  # 添加这行
)

# 调用安装函数
install_python_packages_official "$VENV_PIP3" "$VENV_PYTHON3" "${REQUIRED_PIP_PACKAGES[@]}"
```

#### 选项2: 创建独立脚本
创建 `150_install_pycore_http_service.sh` 的补充：

```bash
#!/bin/bash
# 安装edge-tts到系统Python

print_step "Installing edge-tts for TTS functionality..."

# 升级edge-tts到最新版本
pip3 install --upgrade --break-system-packages --no-user edge-tts

# 验证安装
if /usr/bin/python3 -m edge_tts --help >/dev/null 2>&1; then
    print_success "edge-tts installed successfully"
    pip3 show edge-tts | grep Version
else
    print_error "edge-tts installation failed"
    exit 1
fi
```

### 关键参数
```bash
pip3 install \
    --upgrade \                    # 升级到最新版本
    --break-system-packages \      # 允许系统级安装(Ubuntu 24.04+)
    --no-user \                    # 避免安装到用户目录
    edge-tts                       # 包名
```

---

## TTS队列系统架构

### 组件

1. **AppQyV1UnifiedTTSQueueService** - 队列管理
2. **EdgeTTSService** - TTS生成（使用edge-tts 7.2.7）
3. **tts_queue_worker.php** - 独立worker进程
4. **AppQyV1TTSGenerationTask** - Octane Timer任务

### 处理流程
```
用户请求 → appqyv1_tts_queue表 → tts_queue_worker.php
                                      ↓
                         EdgeTTSService::generateAudio()
                                      ↓
                      python3 -m edge_tts (v7.2.7)
                                      ↓
                              生成MP3文件
                                      ↓
                         更新appqyv1_lang_dictionary表
```

### 当前状态
- ✅ Edge-TTS: 7.2.7 (已修复)
- ✅ Worker: 运行中
- ✅ Octane Tasks: 5个运行中
- ⏳ 队列: 231,719 pending (正在处理)
- ⚙️ 处理速度: 1个任务/2-5秒

---

## 监控和维护

### 检查edge-tts版本
```bash
pip3 show edge-tts
```

### 检查worker状态
```bash
ps aux | grep tts_queue_worker
tail -f /www/programing/core_node/poly_apps/laravel_main/storage/logs/tts_queue_worker.log
```

### 检查队列统计
```bash
curl -s "http://localhost:9000/api/app_qy_v1/ai_tools/tts/queue/status"
```

### 测试TTS生成
```bash
/usr/bin/python3 -m edge_tts \
    --text "Hello test" \
    --voice "en-US-JennyNeural" \
    --write-media /tmp/test.mp3
```

### 升级edge-tts
```bash
# 检查最新版本
pip3 index versions edge-tts

# 升级
pip3 install --upgrade --break-system-packages edge-tts

# 重启worker
kill $(ps aux | grep tts_queue_worker | grep -v grep | awk '{print $2}')
cd /www/programing/core_node/poly_apps/laravel_main
nohup php tts_queue_worker.php >> storage/logs/tts_queue_worker.log 2>&1 &
```

---

## 常见问题

### Q: Edge-TTS报 NoAudioReceived 错误
**A**: 升级edge-tts到最新版本 (>=7.2.7)

### Q: Worker进程停止了
**A**: 重启worker:
```bash
cd /www/programing/core_node/poly_apps/laravel_main
nohup php tts_queue_worker.php >> storage/logs/tts_queue_worker.log 2>&1 &
```

### Q: 任务处理太慢
**A**: 当前配置:
- 批量大小: 1 (sequential processing)
- 间隔: 2-5秒
- 原因: Edge-TTS不支持并发请求

### Q: 文件权限错误
**A**: 使用FileSystemManager (已配置):
- 自动创建目录
- 自动设置正确权限
- 所有者: ubuntu:ubuntu

---

## 参考文档

- Edge-TTS GitHub: https://github.com/rany2/edge-tts
- Edge-TTS PyPI: https://pypi.org/project/edge-tts/
- Microsoft TTS服务: https://speech.platform.bing.com

---

**更新时间**: 2025-12-21 17:45
**修复人**: Claude AI
**Edge-TTS版本**: 7.2.7
**系统Python**: /usr/bin/python3 (3.12)
**真实用户**: ubuntu (uid=1000)
