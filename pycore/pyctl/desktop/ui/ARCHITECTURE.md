# Voice Subtitle Framework - 代码中心化架构

## 架构概览

代码已完全中心化，避免硬编码和重复逻辑。

## 文件结构

```
pycore/pyctl/voice_subtitle/ui/
├── index.html          # 主框架HTML
├── framework.css       # 框架样式
├── framework.js        # 框架逻辑
├── config.js          # 中心化配置 ⭐
├── api.js             # 中心化API客户端 ⭐
├── subtitle.html      # 旧版简单播放器
├── subtitle.css       # 旧版播放器样式
└── subtitle.js        # 旧版播放器逻辑
```

## 中心化组件

### 1. 配置中心 (`config.js`)

所有配置集中管理，包括：
- 服务器地址和端口
- API端点路径
- WebSocket配置
- 默认值设置
- UI模块配置

**特点**：
- 所有对象都被冻结（`Object.freeze`），防止运行时修改
- 单一真实来源（Single Source of Truth）
- 易于维护和更新

**使用示例**：
```javascript
// 访问服务器配置
const baseUrl = CONFIG.SERVER.BASE_URL;

// 访问API端点
const endpoint = CONFIG.API.QUEUE;

// 访问默认值
const defaultLang = CONFIG.DEFAULTS.LANGUAGES;
```

### 2. API客户端 (`api.js`)

统一的HTTP请求处理层，封装所有API调用。

**特点**：
- 单一责任原则
- 统一错误处理
- 类型安全的方法
- 自动处理URL构建

**主要方法**：

#### 队列管理
- `getQueue()` - 获取完整队列
- `getLatestItems(limit)` - 获取最新N项
- `getTodayItems()` - 获取今天的项目
- `getItemsByCategory(category)` - 按分类过滤
- `clearQueue()` - 清空队列
- `setCurrentIndex(index)` - 设置当前索引
- `incrementPlayCount(index)` - 增加播放次数

#### 项目管理
- `addText(text, langs, category)` - 添加文本
- `addImage(imagePath, langs, category)` - 添加图片
- `addVoice(audioPath, text, langs, category)` - 添加音频
- `removeItems(indices)` - 删除项目
- `changeItemCategory(index, category)` - 改变分类

#### 分类管理
- `getCategories()` - 获取所有分类

#### 文件上传
- `uploadFile(file)` - 上传文件

#### 后台服务
- `startClipboardMonitor()` - 启动剪切板监听
- `stopClipboardMonitor()` - 停止剪切板监听
- `getClipboardStatus()` - 获取剪切板监听状态
- `startScreenshotMonitor(interval)` - 启动截屏监听
- `stopScreenshotMonitor()` - 停止截屏监听
- `getScreenshotStatus()` - 获取截屏监听状态

#### 工具方法
- `getAudioUrl(audioPath)` - 获取音频文件URL

## 使用方式

### 在HTML中引入

```html
<script src="/voice-subtitle/config.js"></script>
<script src="/voice-subtitle/api.js"></script>
<script src="/voice-subtitle/framework.js"></script>
```

**注意顺序**：必须先加载`config.js`，再加载`api.js`，最后加载`framework.js`。

### 在JavaScript中使用

```javascript
// 创建API客户端实例
const api = new VoiceSubtitleAPI(CONFIG);

// 使用API
async function example() {
    // 获取队列
    const queueData = await api.getQueue();

    // 添加文本
    const result = await api.addText('Hello World', ['en'], 'normal');

    // 获取分类
    const categories = await api.getCategories();

    // 启动剪切板监听
    const status = await api.startClipboardMonitor();
}
```

## 优势

### 1. 代码可维护性
- 单一修改点：只需修改`config.js`即可更新所有配置
- 清晰的职责分离：配置、API、业务逻辑分离
- 易于测试：可以轻松模拟API客户端

### 2. 开发效率
- 自动完成：IDE可以提供更好的代码提示
- 类型安全：方法签名明确，减少错误
- 代码复用：避免重复的fetch调用

### 3. 灵活性
- 易于切换环境：修改`CONFIG.SERVER`即可切换开发/生产环境
- 易于扩展：添加新API只需在`api.js`中添加方法
- 版本控制友好：配置变更易于追踪

## 迁移指南

### Before (硬编码)
```javascript
const response = await fetch('http://localhost:59000/voice-subtitle/queue');
const data = await response.json();
```

### After (中心化)
```javascript
const data = await api.getQueue();
```

### Before (URL拼接)
```javascript
const audioUrl = `/voice-subtitle/audio?path=${encodeURIComponent(item.audio_path)}`;
```

### After (中心化)
```javascript
const audioUrl = api.getAudioUrl(item.audio_path);
```

## 配置说明

### 修改服务器地址

编辑 `config.js`:
```javascript
SERVER: {
    HOST: 'your-host',
    PORT: your-port,
    BASE_URL: 'http://your-host:your-port'
}
```

### 添加新API端点

1. 在 `config.js` 中添加端点路径：
```javascript
API: {
    YOUR_NEW_ENDPOINT: '/voice-subtitle/your-endpoint'
}
```

2. 在 `api.js` 中添加方法：
```javascript
async yourNewMethod(param) {
    return await this.post(this.endpoints.YOUR_NEW_ENDPOINT, { param });
}
```

3. 在 `framework.js` 中使用：
```javascript
const result = await api.yourNewMethod('value');
```

## 最佳实践

1. **永远不要硬编码URL** - 使用`CONFIG.API`或`api`方法
2. **永远不要硬编码默认值** - 使用`CONFIG.DEFAULTS`
3. **添加新功能时先更新配置** - 先在`config.js`中定义，再实现
4. **保持API客户端简洁** - 只处理HTTP请求，不包含业务逻辑
5. **使用语义化的方法名** - `getQueue()`比`fetchData()`更清晰

## 总结

代码中心化实现了：
✅ 单一真实来源（Single Source of Truth）
✅ 关注点分离（Separation of Concerns）
✅ 开闭原则（Open-Closed Principle）
✅ DRY原则（Don't Repeat Yourself）
✅ 易于维护和扩展
