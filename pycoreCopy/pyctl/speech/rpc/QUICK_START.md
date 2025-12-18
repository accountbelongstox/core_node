# Quick Start Guide - Speech & Clipboard Web Service

## 🚀 快速启动

### 1. 启动服务（自动）

RPC服务器默认自动启动，只需导入即可：

```python
from pycore.pyctl.speech.rpc import rpc_manager

# 服务器已自动启动在 http://0.0.0.0:8765
# Web界面: http://localhost:8765/web/index.html
```

### 2. 访问Web界面

打开浏览器访问：**http://localhost:8765/web/index.html**

## 🎯 功能测试

### 测试1: 文字转语音（支持老挝语！）

1. 打开Web界面
2. 在"文字转语音"标签页输入：`ສະບາຍດີ` (老挝语：你好)
3. 勾选"ລາວ (老挝语)"
4. 点击"转换为语音"
5. 播放生成的音频

### 测试2: 多语言转换

1. 输入：`Hello World`
2. 勾选多个语言：中文、English、日本語、한국어、ລາວ
3. 点击转换
4. 同时获得5种语言的语音

### 测试3: 剪贴板同步

1. 在"剪贴板"标签页输入：`测试内容`
2. 点击"添加"
3. 打开另一个浏览器标签页（模拟另一台设备）
4. 访问同样的Web界面
5. 查看剪贴板历史，应该能看到刚才添加的内容

### 测试4: 实时同步

1. 保持两个浏览器标签页打开
2. 在第一个标签页添加内容
3. 等待5秒
4. 第二个标签页会自动刷新并显示新内容

## 📡 API测试

### 使用curl测试TTS

```bash
# 中文TTS
curl -X POST http://localhost:8765/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"你好世界","language":"zh-CN","return_base64":false}'

# 老挝语TTS
curl -X POST http://localhost:8765/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"ສະບາຍດີ","language":"lo-LA"}'
```

### 测试剪贴板API

```bash
# 添加内容
curl -X POST http://localhost:8765/api/clipboard_add \
  -H "Content-Type: application/json" \
  -d '{"content":"测试剪贴板","client_id":"test_client"}'

# 获取历史
curl -X POST http://localhost:8765/api/clipboard_get \
  -H "Content-Type: application/json" \
  -d '{"limit":10}'
```

### 查看服务状态

```bash
curl -X POST http://localhost:8765/api/status \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🔍 验证数据库

### 检查数据库文件

**Windows:**
```bash
ls D:\www\pycore_db\
# 应该看到：
# - clipboard.db
# - speech.db
```

**检查TTS缓存:**
```bash
ls D:\www\wwwroot\pycore_db\tts_static\
# 应该看到：
# - edge/
#   - zh-CN/
#   - en-US/
#   - ja-JP/
#   - ko-KR/
#   - lo-LA/    <-- 老挝语缓存目录
# - azure/
```

## 📊 性能验证

### 测试缓存性能

1. 第一次转换文字：
   ```python
   from pycore.pyctl.speech.rpc import rpc_manager
   result = await rpc_manager._handle_tts({
       'text': '测试缓存',
       'language': 'zh-CN'
   }, 'test_id', {})
   # 第一次：较慢（需要合成）
   ```

2. 第二次相同文字：
   ```python
   result = await rpc_manager._handle_tts({
       'text': '测试缓存',
       'language': 'zh-CN'
   }, 'test_id2', {})
   # 第二次：极快（从缓存读取，100x faster）
   ```

## 🎨 Web界面功能

### 界面特性

- ✅ 响应式设计（支持手机/平板）
- ✅ 实时状态显示
- ✅ 音频在线播放
- ✅ 历史记录管理
- ✅ 快速剪贴板浮动按钮
- ✅ 5秒自动同步
- ✅ 客户端ID自动识别

### 快捷功能

**快速剪贴板**：点击右下角浮动按钮，快速添加内容

**键盘快捷键**（计划中）：
- `Ctrl+V`: 快速粘贴到剪贴板输入框
- `Ctrl+Enter`: 快速提交

## ⚡ 支持的语言

| 语言 | 代码 | TTS | STT |
|------|------|-----|-----|
| 中文 | zh-CN | ✅ | ✅ |
| 英语 | en-US | ✅ | ✅ |
| 日语 | ja-JP | ✅ | ✅ |
| 韩语 | ko-KR | ✅ | ✅ |
| **老挝语** | lo-LA | ✅ | ✅ |

## 🐛 常见问题

### Q: 服务器启动失败？
A: 检查端口8765是否被占用：
```bash
netstat -ano | findstr 8765
```

### Q: Web界面404？
A: 确认Web文件存在：
```bash
ls D:\programing\core_node\pycore\pyctl\rpc\web\index.html
```

### Q: 剪贴板不同步？
A: 检查：
1. 浏览器控制台是否有错误
2. 时间是否正确（影响同步时间戳）
3. 数据库是否正常初始化

### Q: 老挝语转换失败？
A: 确认：
1. Edge TTS支持老挝语
2. 语言代码正确：`lo-LA`
3. 检查网络连接（Edge TTS需要网络）

## 📝 下一步

1. **测试文件上传**（功能开发中）
2. **配置音频设备**（配置界面已就绪）
3. **查看统计数据**（调用status API）
4. **导出剪贴板历史**（功能计划中）

## 🎉 完成！

现在你已经有了：
- ✅ 完整的Web界面
- ✅ 多语言语音转换（含老挝语）
- ✅ 跨设备剪贴板同步
- ✅ 数据库缓存加速
- ✅ 实时同步机制
- ✅ 配置管理

**享受使用吧！** 🚀
