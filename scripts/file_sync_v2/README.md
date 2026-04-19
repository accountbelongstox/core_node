# 文件同步工具（file_sync）

一个基于 Python 的轻量级文件同步工具：
- `server.py` 作为接收端（服务端）
- `client.py` 作为发送端（客户端）

客户端会先做一次全量同步，随后通过文件监听（watch）或轮询（poll）持续增量同步。

## 功能概览

- 服务端启动时显示随机两位配对码；客户端在终端交互输入，无需在配置里写配对字符串。
- 首次全量同步 + 后续增量同步。
- 支持一个客户端同步到多个服务端（`servers` 列表）。
- 支持按服务端开关同步：`servers[].enabled`。
  - `true`：参与同步
  - `false`：跳过该服务端
  - 从 `false` 改回 `true` 后，会先对该服务端做一次全量同步，再继续增量。
- 支持每个服务端独立同步规则：`servers[].include` / `servers[].exclude`。
  - 可让不同服务端在同一轮同步中接收不同文件集合。
- 支持全局排除目录/文件（顶层 `exclude`）。

## 目录与配置文件

- `client.py`：客户端入口
- `server.py`：服务端入口
- `client_config.json`：客户端配置
- `server_config.json`：服务端配置
- `.sync_client_state.json`：客户端同步状态文件（自动生成）

## 使用方法

### 1) 配置服务端

编辑 `server_config.json`：

```json
{
  "host": "0.0.0.0",
  "port": 18765,
  "root": "/path/to/server/sync/root"
}
```

说明：
- `root` 是服务端接收并落盘的根目录；配对码以控制台打印为准。

### 2) 启动服务端

```bash
python3 server.py
```

### 3) 配置客户端

编辑 `client_config.json`（推荐多服务端写法）：

```json
{
  "include": ["src/**", "*.md"],
  "exclude": ["build/**"],
  "servers": [
    {
      "host": "1.2.3.4",
      "port": 18765,
      "enabled": true
    },
    {
      "host": "10.0.0.8",
      "port": 18765,
      "enabled": true,
      "include": ["assets/**"],
      "exclude": []
    }
  ],
  "local_dir": "../../",
  "use_watch": true,
  "watch_debounce_seconds": 0.35,
  "interval_seconds": 2.0
}
```

说明：
- `servers` 优先于旧字段 `server_host/server_port` 解析。
- `enabled` 不写时默认 `true`，且必须是布尔值（`true/false`）。
- 顶层 `include` / `exclude` 可作为默认规则；当 `servers[i]` 未显式配置同名字段时会继承。
- `servers[i].include` / `servers[i].exclude` 为可选数组，元素必须是非空字符串通配符。
- 当 `include` 为空时表示“不过滤（全部允许）”。
- 最终生效顺序：先应用顶层 `exclude`（全局扫描排除），再应用每个服务端的 `include/exclude`（节点内显式配置优先）。

### 4) 启动客户端

```bash
python3 client.py
```

## 依赖说明

- Python 3
- 可选：`watchdog`
  - 若安装并启用 `use_watch=true`，使用文件事件监听增量同步。
  - 未安装时会提示并可退回轮询模式（或将 `use_watch` 设为 `false`）。

## 当前限制

- 服务端规则变更（例如 `include/exclude` 修改）建议重启客户端使规则立即一致生效。
