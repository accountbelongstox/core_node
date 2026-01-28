# Bing Translator 解析方案测试文档

## Bing 翻译器实现方案

### 方案概述

Bing 翻译器使用网页抓取方式，无需 API 密钥，完全免费。

### 核心实现

```typescript
class BingTranslator implements ITranslator {
  private readonly baseUrl = 'https://www.bing.com/ttranslate';

  async translate(text: string, from: string, to: string): Promise<string> {
    // 构建 URL
    const fromLang = this.mapLanguageCode(from);
    const toLang = this.mapLanguageCode(to);
    const url = `https://www.bing.com/ttranslate?&text=${encodeURIComponent(text)}&from=${fromLang}&to=${to Lang}`;

    // 发送请求
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();

    // 解析方案 1: JSON 格式
    const jsonMatch = html.match(/\[{[^\]]+}\]/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data[0]?.translations?.[0]?.text) {
        return data[0].translations[0].text;
      }
    }

    // 解析方案 2: HTML DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const resultElement = doc.querySelector('#t_sv') || doc.querySelector('.t_sv');

    if (resultElement) {
      return resultElement.textContent?.trim() || text;
    }

    return text; // 失败时返回原文
  }
}
```

## 响应格式解析

### 格式 1: JSON 响应

Bing 可能返回 JSON 格式的响应：

```json
[
  {
    "translations": [
      {
        "text": "你好",
        "to": "zh-Hans"
      }
    ]
  }
]
```

**解析代码**:
```javascript
const jsonMatch = html.match(/\[{[^\]]+}\]/);
if (jsonMatch) {
  const data = JSON.parse(jsonMatch[0]);
  return data[0]?.translations?.[0]?.text;
}
```

### 格式 2: HTML DOM

Bing 也可能在 HTML 中返回结果：

```html
<div id="t_sv">你好</div>
<!-- 或 -->
<span class="t_sv">你好</span>
```

**解析代码**:
```javascript
const parser = new DOMParser();
const doc = parser.parseFromString(html, 'text/html');
const resultElement = doc.querySelector('#t_sv') || doc.querySelector('.t_sv');

if (resultElement) {
  return resultElement.textContent?.trim();
}
```

## 语言代码映射

Bing 使用特定的语言代码格式：

```typescript
const languageMap = {
  // 完整名称 -> Bing 代码
  'english': 'en',
  'chinese': 'zh-Hans',    // 简体中文
  'chinese_tw': 'zh-Hant', // 繁体中文
  'japanese': 'ja',
  'korean': 'ko',
  'spanish': 'es',
  'french': 'fr',
  'german': 'de',
  'russian': 'ru',
  'arabic': 'ar',
  'portuguese': 'pt',
  'vietnamese': 'vi',
  'lao': 'lo',

  // 短代码 -> Bing 代码
  'en': 'en',
  'zh': 'zh-Hans',
  'ja': 'ja',
  'ko': 'ko',
};
```

## 测试用例

### 测试 1: 英译中

```typescript
const translator = new BingTranslator();
const result = await translator.translate('hello', 'english', 'chinese');
console.log(result); // 应该输出: "你好"
```

### 测试 2: 中译英

```typescript
const result = await translator.translate('世界', 'chinese', 'english');
console.log(result); // 应该输出: "world"
```

### 测试 3: 批量翻译

```typescript
const words = ['hello', 'world', 'good', 'morning'];
const results = await translator.translateBatch(words, 'english', 'chinese');
console.log(results);
// 预期输出: ["你好", "世界", "好", "早上"]
```

### 测试 4: 错误处理

```typescript
// 网络错误 - 应返回原文
const result = await translator.translate('test', 'en', 'zh');
// 即使失败，也会返回 "test"
```

## 限流策略

为避免被 Bing 封禁，实现了限流：

```typescript
async translateBatch(texts: string[], from: string, to: string): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    results.push(await this.translate(texts[i], from, to));

    // 每个请求之间延迟 100ms
    if (i < texts.length - 1) {
      await this.delay(100);
    }
  }

  return results;
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 限流参数
- **单次翻译**: 无延迟
- **批量翻译**: 每个请求间隔 100ms
- **推荐**: 1000 个单词批量翻译约需 100 秒

## 实际测试流程

### 步骤 1: 准备测试数据

从数据库获取词库单词：

```bash
sqlite3 /www/wwwroot/laravel_db/app_qy_v1_database.sqlite \
  "SELECT word FROM app_qy_v1_vocabulary_words WHERE library_id=1 LIMIT 10;"
```

输出:
```
# 26个英文字母
a
b
c
d
e
f
g
h
i
```

### 步骤 2: 测试 Bing 翻译

在浏览器控制台测试：

```javascript
// 引入翻译器
import { BingTranslator } from './services/translators';

// 创建实例
const translator = new BingTranslator();

// 测试单个单词
translator.translate('hello', 'english', 'chinese')
  .then(result => console.log('Translation:', result));

// 测试批量翻译
const testWords = ['a', 'b', 'c', 'd', 'e'];
translator.translateBatch(testWords, 'english', 'chinese')
  .then(results => console.log('Batch results:', results));
```

### 步骤 3: 在词库详情页测试

1. 打开词库详情页
2. 点击右上角设置图标
3. 选择翻译服务 = "Bing Translator"
4. 启用"自动翻译"
5. 观察单词列表是否显示翻译

## 性能对比

### Bing vs Google vs DeepL

| 特性 | Bing | Google | DeepL |
|------|------|--------|-------|
| API 密钥 | 不需要 ✅ | 不需要 ✅ | 需要 ❌ |
| 免费额度 | 无限制 | 有限制 | 有限制 |
| 翻译质量 | 良好 | 良好 | 优秀 |
| 速度 | 中等 | 快速 | 中等 |
| 限流策略 | 100ms | 50ms | 看API限制 |
| 稳定性 | 中等 | 高 | 高 |

## 可能遇到的问题

### 问题 1: CORS 错误

**症状**: 浏览器控制台显示 CORS 错误

**解决方案**:
1. 使用代理服务器
2. 在后端实现翻译 API
3. 使用浏览器扩展禁用 CORS

### 问题 2: 被封禁 IP

**症状**: 所有请求返回 429 或 403

**解决方案**:
1. 增加延迟时间 (100ms -> 200ms)
2. 使用代理 IP
3. 切换到其他翻译服务

### 问题 3: 解析失败

**症状**: 返回原文而不是翻译

**解决方案**:
1. 检查 Bing 是否更新了页面结构
2. 更新正则表达式或 CSS 选择器
3. 添加更多解析方案

## 优化建议

### 1. 本地缓存

```typescript
const CACHE_KEY_PREFIX = 'bing_trans_';

async translateWithCache(text: string, from: string, to: string): Promise<string> {
  const cacheKey = `${CACHE_KEY_PREFIX}${from}_${to}_${text}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    return cached;
  }

  const result = await this.translate(text, from, to);
  localStorage.setItem(cacheKey, result);

  return result;
}
```

### 2. 并发控制

```typescript
import pLimit from 'p-limit';

const limit = pLimit(3); // 最多 3 个并发请求

async translateBatchParallel(texts: string[], from: string, to: string): Promise<string[]> {
  const promises = texts.map(text =>
    limit(() => this.translate(text, from, to))
  );

  return Promise.all(promises);
}
```

### 3. 重试机制

```typescript
async translateWithRetry(
  text: string,
  from: string,
  to: string,
  maxRetries = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await this.translate(text, from, to);
      if (result !== text) {
        return result; // 翻译成功
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error; // 最后一次尝试失败
      }
      await this.delay(1000 * (i + 1)); // 指数退避
    }
  }

  return text; // 所有尝试失败，返回原文
}
```

## 完整示例

```typescript
import { BingTranslator } from './services/translators';

async function testBingTranslator() {
  const translator = new BingTranslator();

  console.log('=== Bing Translator 测试 ===\n');

  // 测试 1: 英译中
  console.log('测试 1: 英译中');
  const result1 = await translator.translate('hello', 'english', 'chinese');
  console.log(`"hello" -> "${result1}"`);
  console.log();

  // 测试 2: 中译英
  console.log('测试 2: 中译英');
  const result2 = await translator.translate('世界', 'chinese', 'english');
  console.log(`"世界" -> "${result2}"`);
  console.log();

  // 测试 3: 批量翻译
  console.log('测试 3: 批量翻译');
  const words = ['apple', 'banana', 'cat', 'dog', 'elephant'];
  const results = await translator.translateBatch(words, 'english', 'chinese');
  words.forEach((word, i) => {
    console.log(`"${word}" -> "${results[i]}"`);
  });
  console.log();

  console.log('=== 测试完成 ===');
}

// 运行测试
testBingTranslator();
```

## 总结

Bing 翻译器是一个**免费、无需 API 密钥**的翻译解决方案，适合：
- ✅ 个人项目
- ✅ 小规模应用
- ✅ 原型开发
- ✅ 学习和测试

但不适合：
- ❌ 高并发场景
- ❌ 商业应用
- ❌ 需要 100% 稳定性的场景

对于生产环境，建议：
1. 使用官方 API (Azure Translator)
2. 实现多个翻译服务的降级策略
3. 添加完善的缓存和重试机制
