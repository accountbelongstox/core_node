# [研究] DOM 镜像与远程浏览器同步方案

> **文档类型**：技术调研 / 方案探索，非核心架构文档。
> 本文档记录将本地浏览器页面实时映射到远程机器的可行方案，供后续功能扩展参考。

将本地浏览器页面实时映射到远程机器，远程操作与本地完全同步。

---

## 核心需求

- 本地打开网页（如 google.com），Session/Cookie 保留在本地
- DOM 实时镜像到远程浏览器
- 远程用户的操作（点击、滚动、输入）回传到本地执行
- 本地执行后产生的 DOM 变化再同步回远程

---

## 方案概览

| 方案 | Session在本地 | DOM级同步 | 开源 | 成熟度 | 页面跳转 |
|------|:---:|:---:|:---:|:---:|:---:|
| mozilla/browsermirror | Yes | Yes | Yes | 老项目 | No |
| Cobrowsing 商业方案 | Yes | Yes | No | 生产级 | Yes |
| n.eko 虚拟浏览器 | No(在服务器) | No(视频流) | Yes | 活跃 | Yes |
| 自建 Playwright + WebSocket | Yes | Yes | Yes | 需开发 | Yes |

---

## 方案一：mozilla/browsermirror

- 项目地址：https://github.com/mozilla/browsermirror

### 架构

```
本地浏览器 (Master)                    远程浏览器 (Mirror)
┌──────────────────┐                  ┌──────────────────┐
│ 运行所有 JS       │  ── DOM 推送 ──> │ 只接收 DOM       │
│ 保留 Session      │                  │ 不运行 JS        │
│ 处理所有事件      │ <── 事件回传 ──  │ 捕获用户操作      │
└──────────────────┘                  └──────────────────┘
              │                                │
              └──────── WebSocket 服务器 ───────┘
```

### 工作原理

1. Master 浏览器运行全部 JavaScript，Mirror 端只接收 DOM 元素
2. Mirror 用户点击某元素 → 事件通过 WebSocket 回传 Master
3. Master 将其视为本地点击并执行 → DOM 变化同步回 Mirror
4. 表单输入单独处理（表单状态不直接反映在 DOM 中）

### 局限

- 以 bookmarklet 实现，无法处理 iframe
- 不支持页面跳转（导航到新页面后镜像断开）
- 项目维护不活跃

---

## 方案二：Cobrowsing（协同浏览）商业方案

### 代表产品

| 产品 | 网址 | 特点 |
|------|------|------|
| Surfly | https://www.surfly.com | 代理中间件拦截流量，实时重建 DOM |
| Cobrowse.io | https://cobrowse.io | 支持自托管，可部署到 AWS/Azure/GCP |
| Fullview | https://www.fullview.io | 面向客服场景 |

### 技术原理

```
页面注入 JS（SDK）
    │
    ├── MutationObserver 监听 DOM 变化
    ├── 事件监听器捕获用户操作
    │
    ├──→ WebSocket 同步 DOM 增量到远程
    └──← WebSocket 接收远程操作事件，在本地重放
```

- 只传输 DOM 事件（增量），不传输整个页面，带宽极低
- Session/Cookie 完全保留在本地
- 支持页面跳转、复杂交互

### 缺点

- 商业产品，不开源
- 需要付费或申请试用

---

## 方案三：n.eko 虚拟浏览器

- 项目地址：https://github.com/m1k1o/neko

### 思路

不做 DOM 镜像，而是把完整浏览器运行在服务器 Docker 中，通过 WebRTC 串流画面。

### 部署

```bash
docker run -d --name neko \
  -p 8080:8080 \
  -p 52000-52100:52000-52100/udp \
  -e NEKO_SCREEN=1920x1080@30 \
  -e NEKO_PASSWORD=user \
  -e NEKO_PASSWORD_ADMIN=admin \
  ghcr.io/m1k1o/neko/firefox:latest
```

访问 `http://服务器IP:8080` 即可使用。

### 特点

- 多人共享同一浏览器窗口，键鼠控制可切换
- WebRTC 低延迟，支持音视频
- Session/Cookie 在服务器端（不在本地）
- 支持 Firefox、Chrome、Edge、Brave 等多种浏览器

### 适用场景

- 不要求 Session 在本地
- 需要多人协作观看/操作同一浏览器
- 需要隔离的安全浏览环境

---

## 方案四：自建 DOM 镜像服务（推荐）

基于 WebSocket + MutationObserver，结合现有 claudecode 流式服务器架构自建。

### 架构设计

```
┌─────────────────────────────────────────────────────┐
│                    本地机器                           │
│                                                     │
│  ┌───────────┐     ┌──────────────────┐             │
│  │ 浏览器     │────>│ 注入脚本 (JS)     │             │
│  │ (Master)   │     │                  │             │
│  │ google.com │     │ - MutationObserver│            │
│  │ Session 在此│     │ - 事件监听        │            │
│  └───────────┘     │ - DOM 序列化      │             │
│                    └────────┬─────────┘             │
│                             │ WebSocket             │
│                    ┌────────┴─────────┐             │
│                    │ 中继服务器 (Python) │            │
│                    │ asyncio+websockets│             │
│                    └────────┬─────────┘             │
└─────────────────────────────┼───────────────────────┘
                              │ SSH 隧道 / ngrok / 公网
┌─────────────────────────────┼───────────────────────┐
│                    远程机器  │                        │
│                    ┌────────┴─────────┐             │
│                    │ 浏览器 (Mirror)    │             │
│                    │                  │             │
│                    │ - 接收 DOM 渲染    │             │
│                    │ - 捕获操作回传     │             │
│                    │ - 无 JS 执行      │             │
│                    └──────────────────┘             │
└─────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. Master 端注入脚本

```javascript
// 初始 DOM 快照
function serializeDOM(node) {
    // 递归序列化整个 DOM 树为 JSON
}

// 监听 DOM 变化（增量）
const observer = new MutationObserver((mutations) => {
    const changes = mutations.map(m => ({
        type: m.type,
        target: getNodePath(m.target),
        addedNodes: [...m.addedNodes].map(serializeDOM),
        removedNodes: [...m.removedNodes].map(n => getNodePath(n)),
        attributeName: m.attributeName,
        newValue: m.target.getAttribute?.(m.attributeName)
    }));
    ws.send(JSON.stringify({ type: 'dom_mutation', changes }));
});
observer.observe(document, {
    childList: true, subtree: true,
    attributes: true, characterData: true
});

// 接收远程操作并在本地执行
ws.onmessage = (msg) => {
    const event = JSON.parse(msg.data);
    if (event.type === 'click') {
        const el = resolveNodePath(event.path);
        el?.click();
    } else if (event.type === 'input') {
        const el = resolveNodePath(event.path);
        if (el) { el.value = event.value; el.dispatchEvent(new Event('input')); }
    } else if (event.type === 'scroll') {
        window.scrollTo(event.x, event.y);
    }
};
```

#### 2. Mirror 端渲染脚本

```javascript
// 接收初始 DOM 快照并渲染
ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === 'dom_snapshot') {
        document.open();
        document.write(data.html);
        document.close();
        stripScripts(); // 移除所有 <script>，Mirror 不执行 JS
    } else if (data.type === 'dom_mutation') {
        applyMutations(data.changes); // 增量更新 DOM
    }
};

// 捕获操作回传给 Master
document.addEventListener('click', (e) => {
    ws.send(JSON.stringify({
        type: 'click',
        path: getNodePath(e.target)
    }));
    e.preventDefault();
}, true);

document.addEventListener('input', (e) => {
    ws.send(JSON.stringify({
        type: 'input',
        path: getNodePath(e.target),
        value: e.target.value
    }));
}, true);
```

#### 3. 中继服务器 (Python)

```python
# 复用 claudecode/server.py 的 WebSocket 架构
# Master 和 Mirror 都连接到此服务器
# 服务器负责转发消息：Master ↔ Mirror

import asyncio
import websockets

masters = set()
mirrors = set()

async def handler(ws, path):
    if path == "/master":
        masters.add(ws)
        async for msg in ws:
            # Master 的 DOM 变化 → 广播给所有 Mirror
            for mirror in mirrors:
                await mirror.send(msg)
    elif path == "/mirror":
        mirrors.add(ws)
        async for msg in ws:
            # Mirror 的操作事件 → 转发给 Master
            for master in masters:
                await master.send(msg)
```

### 需要解决的关键问题

| 问题 | 解决思路 |
|------|---------|
| 节点定位 | 使用 XPath 或 CSS 路径唯一标识 DOM 节点 |
| 页面跳转 | 监听 `beforeunload` / `popstate`，跳转后重新发送完整快照 |
| iframe | 递归注入脚本到每个 iframe |
| CSS 样式同步 | 序列化 `<style>` 和 `<link>` 标签，内联关键样式 |
| 图片/字体等资源 | Mirror 端通过代理加载，或将资源 base64 内联 |
| 性能优化 | 批量合并 mutation，throttle 滚动事件，只传增量 |

---

## 网络连通方案

无论选择哪种方案，本地与远程之间需要网络通道：

### SSH 反向隧道（最简单）

```bash
# 在本地执行，将本地 WebSocket 端口映射到远程
ssh -R 9090:localhost:8080 user@remote-server
```

### ngrok（临时公网访问）

```bash
ngrok http 8080
# 生成类似 https://xxxx.ngrok.io 的公网地址
```

### Cloudflare Tunnel（长期稳定）

```bash
cloudflared tunnel --url http://localhost:8080
```

### Tailscale（组网方案）

```bash
# 两台机器都安装 tailscale 后自动组网
tailscale up
# 直接通过 tailscale IP 互访
```

---

## 参考链接

- [mozilla/browsermirror](https://github.com/mozilla/browsermirror) - Mozilla DOM 镜像项目
- [Pamblam/browser-mirror](https://github.com/Pamblam/browser-mirror) - 多浏览器状态共享
- [fooby/mirror-dom](https://github.com/fooby/mirror-dom) - 多客户端 DOM 镜像
- [n.eko](https://github.com/m1k1o/neko) - 自托管虚拟浏览器 (Docker + WebRTC)
- [Surfly](https://www.surfly.com) - 商业协同浏览方案
- [Cobrowse.io](https://cobrowse.io) - 可自托管的协同浏览
- [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) - DOM 变化监听 API
