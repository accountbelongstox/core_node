# Real-time Speech-to-Text Transcription

使用 Azure Speech Service 实现实时语音转文字功能。

## 功能特性

- **实时转写**: 将语音实时转换为文字
- **系统音频捕获**: 支持录制系统正在播放的音频并实时转写
- **麦克风支持**: 支持从麦克风录制并转写
- **多语言支持**: 支持中文、英文、日文、韩文等多种语言
- **连续识别**: 持续识别直到手动停止或达到时间限制
- **置信度显示**: 显示识别结果的准确度
- **自动加载密钥**: 从项目密钥管理系统自动加载 Azure 凭证
- **低延迟**: 使用音频流推送技术实现实时转写

## 安装依赖

```bash
# 安装必需的依赖
pip install azure-cognitiveservices-speech soundcard numpy

# 或者安装所有依赖
pip install -r requirements.txt
```

**必需的库**:
- `azure-cognitiveservices-speech`: Azure 语音识别 SDK
- `soundcard`: 用于捕获系统音频和麦克风
- `numpy`: 音频数据处理

## Azure 配置

### 1. 准备 Azure Speech Service 密钥

需要在以下位置准备密钥文件：

```
.secret_keys/.secret_ignore/
├── AZURE_SPEECH_KEYA_1    # Azure Speech 密钥 A (主密钥)
├── AZURE_SPEECH_KEYB_1    # Azure Speech 密钥 B (备用密钥，可选)
└── AZURE_SPEECH_REGION_1  # Azure 区域 (例如: eastus)
```

### 2. 获取 Azure Speech Service 密钥

1. 登录 [Azure Portal](https://portal.azure.com/)
2. 创建或打开 Speech Service 资源
3. 在左侧菜单选择 "Keys and Endpoint"
4. 复制以下信息：
   - **KEY 1** 或 **KEY 2** → 保存到 `AZURE_SPEECH_KEYA_1`
   - **Region** (例如 eastus) → 保存到 `AZURE_SPEECH_REGION_1`

### 3. Azure Speech Service 免费额度

- **免费层 (F0)**:
  - 标准语音转文字: 每月 5 小时免费
  - 实时转写: 每月 5 小时免费
  - 自定义语音: 每月 1 个端点免费
- **付费层**: 超出免费额度后按使用量计费

## 使用方法

```bash
# 运行程序
python realtime_speech_to_text.py
```

### 交互式菜单

程序启动后会显示交互式菜单：

#### 1. 选择语言

```
1 - Chinese (Simplified) / 中文简体
2 - English (US) / 英文
3 - Japanese / 日文
4 - Korean / 韩文
5 - Custom language code / 自定义语言代码
```

#### 2. 选择音频设备

程序会列出所有可用的音频设备：

```
[System Audio / 系统音频] - Loopback Devices:
  [0] 扬声器 (Realtek High Definition Audio)
      Channels: 2 | ID: ...

[Microphones / 麦克风]:
  [1] 麦克风 (Realtek High Definition Audio)
      Channels: 2 | ID: ...
```

- **系统音频设备**: 捕获系统正在播放的声音（音乐、视频、游戏等）
- **麦克风设备**: 捕获麦克风输入的声音

#### 3. 选择时长模式

```
1 - Continuous (press Ctrl+C to stop) / 连续识别
    持续识别，按 Ctrl+C 停止

2 - Time limited / 限时识别
    连续识别指定时长后自动停止
```

## 使用示例

### 示例 1: 中文连续识别

```bash
$ python realtime_speech_to_text.py

# 选择语言: 1 (中文)
# 选择模式: 2 (连续识别)

[READY] Start speaking... Recognition in progress

[RECOGNIZING] 你好
[RECOGNIZED] 你好
[CONFIDENCE] 95.24%

[RECOGNIZING] 今天天气
[RECOGNIZING] 今天天气很好
[RECOGNIZED] 今天天气很好
[CONFIDENCE] 98.76%

# 按 Ctrl+C 停止
```

### 示例 2: 英文单次识别

```bash
$ python realtime_speech_to_text.py

# 选择语言: 2 (英文)
# 选择模式: 1 (单次识别)

[INFO] Speak into your microphone...

[SUCCESS] Speech recognized:
----------------------------------------------------------------------
Hello, how are you doing today?
----------------------------------------------------------------------
[CONFIDENCE] 97.32%
```

### 示例 3: 限时连续识别

```bash
$ python realtime_speech_to_text.py

# 选择语言: 1 (中文)
# 选择模式: 3 (限时连续)
# 输入时长: 30 (秒)

[READY] Start speaking... Recognition in progress
[INFO] Will stop after 30 seconds

[RECOGNIZING] 这是一个测试
[RECOGNIZED] 这是一个测试
[CONFIDENCE] 96.18%

# 30秒后自动停止
[INFO] Duration limit reached
```

## 代码架构

### 项目规范遵循

遵循 `PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md` 中的开发规范：

1. **密钥管理**: 使用 `pycore.pyfoundations.secret_manager` 读取密钥
2. **第三方包导入**: 从 `pycore.pyfoundations.third_party` 导入 Azure SDK
3. **日志输出**: 使用 `ColorPrint` 进行彩色日志输出
4. **导入规范**: 所有导入语句在文件顶部，按标准库 → 第三方 → 项目内部排序

### 主要类和方法

```python
class RealtimeSpeechToText:
    """实时语音转文字类"""

    def load_credentials(self) -> bool:
        """从密钥管理器加载 Azure 凭证"""

    def initialize_speech_config(self, language="zh-CN") -> bool:
        """初始化 Azure Speech 配置"""

    def recognize_from_microphone_once(self):
        """单次识别模式"""

    def recognize_continuous_from_microphone(self, duration_seconds=None):
        """连续识别模式"""
```

## 支持的语言代码

常用语言代码：

| 语言 | 代码 |
|------|------|
| 中文（简体）| zh-CN |
| 中文（繁体）| zh-TW |
| 英语（美国）| en-US |
| 英语（英国）| en-GB |
| 日语 | ja-JP |
| 韩语 | ko-KR |
| 德语 | de-DE |
| 法语 | fr-FR |
| 西班牙语 | es-ES |
| 俄语 | ru-RU |

完整语言列表: [Azure Speech 支持的语言](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support)

## 输出格式

### 识别状态

- `[RECOGNIZING]` - 中间识别结果（实时显示）
- `[RECOGNIZED]` - 最终识别结果（一句话完成）
- `[CONFIDENCE]` - 置信度百分比
- `[WARNING]` - 警告信息
- `[ERROR]` - 错误信息
- `[SESSION]` - 会话状态

### 颜色标识

- 🔵 蓝色 - 信息提示
- 🟢 绿色 - 成功状态
- 🟡 黄色 - 警告提示
- 🔴 红色 - 错误信息

## 故障排除

### 1. 找不到 Azure SDK

```
[ERROR] Azure Speech SDK is not available
```

**解决方法**:
```bash
pip install azure-cognitiveservices-speech
```

### 2. 凭证加载失败

```
[ERROR] No valid Azure Speech Key found
```

**解决方法**:
- 确保 `.secret_keys/.secret_ignore/AZURE_SPEECH_KEYA_1` 文件存在
- 确保文件内容为有效的 Azure Speech Key
- 检查文件权限

### 3. 识别错误

```
[ERROR] Recognition canceled: Error
[ERROR] Authentication failure
```

**解决方法**:
- 验证 Speech Key 是否正确
- 验证 Region 是否匹配（例如 eastus）
- 检查网络连接
- 确认 Azure 订阅是否有效

### 4. 麦克风无法访问

```
[WARNING] No speech could be recognized
```

**解决方法**:
- 检查麦克风是否连接
- 检查麦克风权限（系统设置）
- 确认麦克风未被其他程序占用
- 测试麦克风是否正常工作

### 5. 语言识别不准确

**解决方法**:
- 确认选择了正确的语言代码
- 检查发音是否清晰
- 减少环境噪音
- 靠近麦克风说话

## 技术细节

### Azure Speech SDK 特性

- **连续识别**: 使用 `start_continuous_recognition_async()`
- **事件驱动**: 通过回调函数处理识别结果
- **实时中间结果**: `recognizing` 事件提供实时反馈
- **最终结果**: `recognized` 事件提供完整转写

### 事件处理

```python
recognizer.recognizing.connect(recognizing_handler)    # 中间结果
recognizer.recognized.connect(recognized_handler)      # 最终结果
recognizer.canceled.connect(canceled_handler)          # 取消事件
recognizer.session_started.connect(session_started_handler)  # 会话开始
recognizer.session_stopped.connect(session_stopped_handler)  # 会话停止
```

## 相关资源

- [Azure Speech Service 文档](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/)
- [Python Speech SDK 参考](https://learn.microsoft.com/en-us/python/api/azure-cognitiveservices-speech/)
- [语音转文字快速入门](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/get-started-speech-to-text)
- [支持的语言列表](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support)

## 许可证

本程序使用 Azure Speech Service，需要有效的 Azure 订阅。请遵守 Azure 服务条款和定价政策。
