# CodeSync AI 通信与文档互传 API

## 1. 目标与数据方向

CodeSync workspace API 是远端 AI、DEV 与 client 代码目录之间的通信接口。服务运行在 client，连接由 DEV 主动发起。

标准流程：

1. 远端 AI 向 client 上传修复说明文档。
2. DEV 从 client 获取 `docs_fix` 中最新的修复说明。
3. DEV 分页读取 client 的 `docs_fix` 文档清单，并按已知相对路径读取所需代码文件。
4. DEV 根据最新文档修改代码。
5. DEV 使用文件版本条件把修改写回 client。

接口不会删除文件，也不会访问 `core_node` 根目录以外的路径。

## 2. 运行条件

- 服务端角色必须是 `client`。
- `light` 模式不开放 workspace API。
- 当前 CLIENT CodeSync Base URL 为 `http://43.163.112.77:59000/code-sync`。
- 公网通信必须使用 TLS 反向代理、VPN 或 SSH 隧道，不能直接暴露明文的 59000 端口。
- 完整 pycore/FastAPI 和独立 `pyservice codesync run` 使用同一套业务实现与接口路径。

## 3. 固定认证

所有 workspace API 请求必须携带固定 Bearer 密钥。密钥的唯一来源是
`pycore/pyutils/codesync/workspace_auth.py` 中的 `WORKSPACE_SHARED_SECRET`；调用端必须先从该代码文件加载密钥，再构造 `Authorization` 请求头，不在文档、调用脚本或其他配置中复制密钥值。

Python 调用示例：

```python
import json
import urllib.request

from pycore.pyutils.codesync.workspace_auth import WORKSPACE_SHARED_SECRET


CLIENT_BASE_URL = "http://43.163.112.77:59000/code-sync"
WORKSPACE_URL = f"{CLIENT_BASE_URL}/workspace"
REQUEST_HEADERS = {
    "Accept": "application/json",
    "Authorization": f"Bearer {WORKSPACE_SHARED_SECRET}",
}

request = urllib.request.Request(WORKSPACE_URL, headers=REQUEST_HEADERS, method="GET")
with urllib.request.urlopen(request, timeout=15) as response:
    capabilities = json.load(response)
```

PowerShell 调用示例同样从代码文件读取，不写入或输出密钥：

```powershell
$workspaceRoot = (Resolve-Path -LiteralPath '.').Path
$authFile = Join-Path $workspaceRoot 'pycore\pyutils\codesync\workspace_auth.py'
$clientBaseUrl = 'http://43.163.112.77:59000/code-sync'
$authSource = Get-Content -LiteralPath $authFile -Raw
$tokenMatch = [regex]::Match($authSource, 'cncs_[0-9a-f]+')
$requestHeaders = @{}

if (-not $tokenMatch.Success) {
    throw 'Workspace Bearer token was not found in workspace_auth.py'
}

$requestHeaders['Accept'] = 'application/json'
$requestHeaders['Authorization'] = "Bearer $($tokenMatch.Value)"
Invoke-RestMethod -Uri "$clientBaseUrl/workspace" -Method Get -Headers $requestHeaders -TimeoutSec 15
```

认证失败时返回：

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="codesync-workspace"
Content-Type: application/json
```

```json
{
  "success": false,
  "error": "Workspace authorization is required"
}
```

HTTP 路由不保存密钥，只把 `Authorization` 交给业务服务层统一校验。

## 4. 通用协议

- 请求和响应使用 UTF-8 JSON。
- 文件内容使用标准 Base64，字段名为 `content_base64`。
- 文件版本使用原始字节内容的 SHA-256。
- 成功读取或写入文件时，响应 JSON 包含 `sha256` 和带双引号的 `etag`，HTTP 响应同时包含 `ETag` 头。
- 所有文件路径必须是相对于 `core_node` 根目录的 `/` 分隔路径。
- 路径在访问前会解析符号链接和 `..`，解析结果必须仍位于 `core_node` 内。
- 文件清单只枚举 `docs_fix` 顶层的 `.md` 常规文件，不递归扫描整个 `core_node`，也不返回符号链接。
- 单文件读取与条件写入仍可访问 `core_node` 内的任意合法相对路径，不受文档清单范围影响。

## 5. 获取接口能力

```http
GET /code-sync/workspace HTTP/1.1
Host: CLIENT_HOST:59000
Authorization: Bearer <shared-secret>
```

成功响应包含数据方向、根目录名称、文档清单范围、分页限制、文件编码、传输安全要求、条件写入规则以及全部 workspace 路由。

## 6. 获取 `docs_fix` 文档清单

```http
GET /code-sync/workspace/files?limit=1000&include_hash=true&cursor= HTTP/1.1
Host: CLIENT_HOST:59000
Authorization: Bearer <shared-secret>
```

查询参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `cursor` | string | 空 | 上一页返回的 `next_cursor` |
| `limit` | integer | `1000` | 每页 1 至 5000 个文件 |
| `include_hash` | boolean | `false` | 是否计算每个文件的 SHA-256 |

响应示例：

```json
{
  "success": true,
  "files": [
    {
      "path": "docs_fix/FIX_EXAMPLE.md",
      "size": 1280,
      "mtime_ns": 1787200000000000000,
      "sha256": "03f1..."
    }
  ],
  "count": 1,
  "next_cursor": "docs_fix/FIX_EXAMPLE.md",
  "has_more": true
}
```

当 `has_more` 为 `true` 时，下一次请求必须把 `next_cursor` 原样作为 `cursor`。重复请求直到 `has_more` 为 `false`，即可获得 `docs_fix` 顶层的全部 Markdown 文档。枚举使用 `os.scandir()` 的目录项元数据，并对文件名显式排序；分页限制在这个有界目录内执行，不再遍历整个工作区。

实现依据：[Python `os.scandir()` 官方文档](https://docs.python.org/3/library/os.html#os.scandir)说明目录项可提供文件类型和属性信息，从而减少额外系统调用，同时明确指出返回顺序不保证；[`os.DirEntry.is_file()` 官方文档](https://docs.python.org/3/library/os.html#os.DirEntry.is_file)规定 `follow_symlinks=False` 时只接受非符号链接的常规文件。

## 7. 读取文件

`path` 应进行 URL 编码。

```http
GET /code-sync/workspace/file?path=pycore%2Fexample.py HTTP/1.1
Host: CLIENT_HOST:59000
Authorization: Bearer <shared-secret>
```

响应示例：

```http
HTTP/1.1 200 OK
ETag: "03f1..."
Content-Type: application/json
```

```json
{
  "success": true,
  "path": "pycore/example.py",
  "content_base64": "IyBleGFtcGxlCg==",
  "size": 10,
  "mtime_ns": 1787200000000000000,
  "sha256": "03f1...",
  "etag": "\"03f1...\""
}
```

DEV 必须保存本次读取返回的 ETag，并在修改已有文件时放入 `If-Match`。

## 8. 写回文件

### 8.1 更新已有文件

```http
PUT /code-sync/workspace/file?path=pycore%2Fexample.py HTTP/1.1
Host: CLIENT_HOST:59000
Authorization: Bearer <shared-secret>
If-Match: "03f1..."
Content-Type: application/json
```

```json
{
  "content_base64": "IyB1cGRhdGVkCg==",
  "content_sha256": "f94a..."
}
```

### 8.2 新建文件

```http
PUT /code-sync/workspace/file?path=pycore%2Fnew_file.py HTTP/1.1
Host: CLIENT_HOST:59000
Authorization: Bearer <shared-secret>
If-None-Match: *
Content-Type: application/json
```

```json
{
  "content_base64": "IyBuZXcgZmlsZQo=",
  "content_sha256": "32b0..."
}
```

`content_sha256` 可以省略；提供时必须与解码后的原始字节完全一致，否则返回 422。

成功响应示例：

```json
{
  "success": true,
  "path": "pycore/example.py",
  "created": false,
  "changed": true,
  "size": 10,
  "mtime_ns": 1787200000000000000,
  "sha256": "f94a...",
  "etag": "\"f94a...\""
}
```

写入使用同目录临时文件和原子替换。更新已有文件时保留原文件模式。

## 9. 上传修复文档

```http
POST /code-sync/workspace/documents HTTP/1.1
Host: CLIENT_HOST:59000
Authorization: Bearer <shared-secret>
Content-Type: application/json
```

```json
{
  "title": "Fix terminal state serialization",
  "content": "## Problem\n\nDescribe the required code alignment here."
}
```

规则：

- `title` 和 `content` 必须是字符串，`title` 去除首尾空白后不能为空。
- 文件写入 `docs_fix/<safe-title>-<title-sha256-prefix>.md`。
- 文档头部包含 `codesync_document`、`document_id`、`title` 和 UTC `updated_at` 标记。
- `document_id` 是 `SHA-256(title + NUL + content)`。
- 相同标题和内容重复上传时不写磁盘，返回 `changed: false`。
- 相同标题但内容变化时更新同一个文档文件。
- 首次创建返回 201；更新或幂等命中返回 200。

## 10. 获取最新修复文档

```http
GET /code-sync/workspace/documents/latest HTTP/1.1
Host: CLIENT_HOST:59000
Authorization: Bearer <shared-secret>
```

服务从 `docs_fix` 顶层选择修改时间最新的 `.md` 常规文件，不进入子目录。

API 创建的文档会解析并返回原始 `title` 与正文 `content`；已有的普通 Markdown 文档返回文件名作为标题、完整文件内容作为正文。

响应示例：

```json
{
  "success": true,
  "path": "docs_fix/Fix_terminal_state_serialization-a1b2c3d4e5f6.md",
  "title": "Fix terminal state serialization",
  "content": "## Problem\n\nDescribe the required code alignment here.",
  "document_id": "9bc1...",
  "updated_at": "2026-08-20T10:30:00+00:00",
  "mtime_ns": 1787200000000000000,
  "size": 320,
  "sha256": "d430...",
  "etag": "\"d430...\""
}
```

## 11. 幂等与冲突处理

文件写回按最小步骤处理：

1. 验证相对路径与根目录边界。
2. 解码 Base64 并验证可选的 `content_sha256`。
3. 在写锁内读取当前文件摘要。
4. 如果当前内容已经等于待写内容，直接返回 200 和 `changed: false`。
5. 内容不同时再检查 `If-Match` 或 `If-None-Match`。
6. 前置条件成功后执行原子写入。

因此，第一次写入成功但响应丢失时，DEV 可以安全重试同一个请求。即使旧 ETag 已失效，只要目标内容已经等于请求内容，重试仍返回成功；如果 client 文件已被其他修改覆盖，则返回 412，不会覆盖新内容。

文档上传独立计算 `document_id`，只跳过完全相同的标题和内容，不会从整个入口提前跳过其他文档更新。

## 12. 状态码

| 状态码 | 含义 |
| --- | --- |
| `200` | 读取、更新或幂等重试成功 |
| `201` | 文件或文档首次创建成功 |
| `400` | 路径、Base64、标题、正文或分页参数无效 |
| `401` | Bearer 密钥缺失或错误 |
| `404` | 文件或 `docs_fix` 文档不存在 |
| `409` | 目标路径存在但不是常规文件 |
| `412` | `If-Match` 或 `If-None-Match` 前置条件失败 |
| `422` | `content_sha256` 与请求内容不一致 |
| `428` | 写文件时未提供必须的条件请求头 |
| `503` | 节点不是 client，或 client 运行在 light 模式 |

错误响应格式：

```json
{
  "success": false,
  "error": "Error description"
}
```

## 13. 推荐的 DEV 对齐流程

1. 调用 `GET /workspace` 确认 client 能力。
2. 调用 `GET /workspace/documents/latest`，记录文档 SHA-256。
3. 分页调用 `GET /workspace/files`，获取 `docs_fix` 顶层文档清单。
4. 根据修复文档给出的相对路径，调用 `GET /workspace/file` 获取源文件及 ETag。
5. 在 DEV 端完成最小范围修改。
6. 对已有文件使用 `If-Match`，对新文件使用 `If-None-Match: *`。
7. 如果收到 412，重新读取文件和最新文档，重新对齐后再提交。
8. 写回成功后可再次读取目标文件，比较返回的 SHA-256。

## 14. 代码一致性验证

| 协议项 | 权威实现 | 验证结论 |
| --- | --- | --- |
| 固定 Bearer 密钥与常量时间比较 | `pycore/pyutils/codesync/workspace_auth.py`、`pycore/pyutils/common/http_auth.py` | 一致 |
| client 与 light 模式门禁 | `pycore/pyutils/codesync/service.py` | 一致 |
| 统一路由路径 | `pycore/pyutils/codesync/routes.py` | 一致 |
| FastAPI 路由 | `pycore/callmodule/rpc_routes/code_sync_routes.py` | 一致 |
| 独立 HTTP 路由 | `pycore/pyutils/codesync/http_server.py` | 一致 |
| `docs_fix` 有界文档清单、文件读取、条件写回 | `pycore/pyutils/codesync/workspace_exchange.py` | 一致 |
| 文档上传与最新文档读取 | `pycore/pyutils/codesync/workspace_exchange.py` | 一致 |
| 路径边界和原子写入 | `pycore/pyutils/codesync/file_operations.py` | 一致 |

本次修改只进行了协议与源代码的静态一致性检查。按项目约束，没有启动服务，也没有创建或运行测试。
