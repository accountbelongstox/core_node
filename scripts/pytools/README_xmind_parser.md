# XMind 解析工具

这是一个用于解析 XMind 文件的 Python 工具，支持将 XMind 文件转换为 JSON 或 XML 格式。

## 功能特性

- ✅ 自动检测并安装 `xmindparser` 包
- ✅ 支持 XMindPro 和 XMindZen 文件格式
- ✅ 输出为 JSON 或 XML 格式
- ✅ 支持命令行参数
- ✅ 支持输出到文件
- ✅ 支持显示主题ID和空值控制
- ✅ 支持获取 XMindZen 原始 JSON 内容

## 安装依赖

工具会自动安装所需的依赖包：

```bash
pip install xmindparser
# 如果需要 XML 输出，还需要安装：
pip install dicttoxml
```

## 使用方法

### 基本用法

```bash
# 解析 XMind 文件并输出 JSON
python xmind_parser.py your_file.xmind

# 解析 XMind 文件并输出 XML
python xmind_parser.py your_file.xmind --format xml

# 输出到文件
python xmind_parser.py your_file.xmind --output result.json
```

### 命令行参数

```bash
python xmind_parser.py <xmind_file_path> [选项]

位置参数:
  file_path              XMind 文件路径

选项:
  -h, --help             显示帮助信息
  --format, -f {json,xml} 输出格式 (默认: json)
  --output, -o OUTPUT    输出文件路径
  --show-topic-id        显示主题ID
  --show-empty           显示空值
  --zen-json             仅显示 XMindZen 原始 JSON（如果适用）
  --test-only            仅测试包导入，不解析文件
```

### 使用示例

#### 1. 基本解析
```bash
python xmind_parser.py example.xmind
```

#### 2. 输出为 XML 格式
```bash
python xmind_parser.py example.xmind --format xml
```

#### 3. 保存到文件
```bash
python xmind_parser.py example.xmind --output parsed_result.json
```

#### 4. 显示主题ID
```bash
python xmind_parser.py example.xmind --show-topic-id
```

#### 5. 显示空值
```bash
python xmind_parser.py example.xmind --show-empty
```

#### 6. 获取 XMindZen 原始 JSON
```bash
python xmind_parser.py zen_file.xmind --zen-json
```

#### 7. 仅测试包导入
```bash
python xmind_parser.py test.xmind --test-only
```

## 输出格式

### JSON 格式示例
```json
[
  {
    "title": "中心主题",
    "topics": [
      {
        "title": "分支1",
        "topics": [
          {
            "title": "子分支1-1"
          },
          {
            "title": "子分支1-2"
          }
        ]
      },
      {
        "title": "分支2",
        "topics": [
          {
            "title": "子分支2-1"
          }
        ]
      }
    ]
  }
]
```

### XML 格式示例
```xml
<?xml version="1.0" encoding="UTF-8"?>
<xmind_data>
  <item>
    <title>中心主题</title>
    <topics>
      <item>
        <title>分支1</title>
        <topics>
          <item>
            <title>子分支1-1</title>
          </item>
          <item>
            <title>子分支1-2</title>
          </item>
        </topics>
      </item>
      <item>
        <title>分支2</title>
        <topics>
          <item>
            <title>子分支2-1</title>
          </item>
        </topics>
      </item>
    </topics>
  </item>
</xmind_data>
```

## 支持的 XMind 功能

### XMindPro 支持的功能
- ✅ 基本主题结构
- ✅ 子主题
- ✅ 主题标题
- ✅ 主题备注
- ✅ 主题标签
- ✅ 主题链接
- ✅ 主题图标

### XMindZen 支持的功能
- ✅ 基本主题结构
- ✅ 子主题
- ✅ 主题标题
- ✅ 贴纸（解析为图片类型）
- ✅ 标注（解析为列表类型）
- ✅ 原始 JSON 内容获取

### 不支持的功能
- ❌ 任务信息（Pro 功能）
- ❌ 音频备注
- ❌ 浮动主题
- ❌ 链接主题
- ❌ 摘要信息
- ❌ 关系信息
- ❌ 边界信息
- ❌ 附件对象（仅显示为 [Attachment] - 名称）
- ❌ 图片对象（仅显示为 [Image]）
- ❌ 富文本格式（备注中的富文本解析为纯文本）

## 错误处理

工具包含完善的错误处理机制：

1. **包导入失败**：自动尝试安装 `xmindparser` 包
2. **文件不存在**：显示错误信息并退出
3. **解析失败**：显示详细错误信息
4. **编码问题**：使用 UTF-8 编码处理文件
5. **权限问题**：显示权限相关错误信息

## 测试

运行测试脚本验证工具功能：

```bash
python test_xmind_parser.py
```

测试脚本会：
1. 创建一个测试 XMind 文件
2. 测试 JSON 解析功能
3. 测试文件输出功能
4. 清理测试文件

## 注意事项

1. **文件格式**：确保输入的是有效的 XMind 文件（.xmind 扩展名）
2. **编码**：工具使用 UTF-8 编码，确保系统支持
3. **权限**：确保有读取输入文件和写入输出文件的权限
4. **内存**：大型 XMind 文件可能需要较多内存
5. **网络**：首次运行需要网络连接来安装依赖包

## 故障排除

### 常见问题

1. **包安装失败**
   ```bash
   # 手动安装
   pip install xmindparser
   pip install dicttoxml  # 如果需要 XML 输出
   ```

2. **编码错误**
   - 确保系统支持 UTF-8 编码
   - 在 Windows 上可能需要设置环境变量

3. **文件解析失败**
   - 检查文件是否为有效的 XMind 文件
   - 尝试用 XMind 软件打开文件确认文件完整性

4. **权限错误**
   - 确保有读取输入文件的权限
   - 确保有写入输出目录的权限

## 更新日志

- **v1.0.0**：初始版本
  - 支持基本的 XMind 文件解析
  - 支持 JSON 和 XML 输出
  - 自动包安装功能
  - 命令行参数支持
