## 🚀 安装和连接问题

### 常见问题

#### 连接成功，但是服务启动失败

启动失败基本上都是**权限问题**或者用包管理工具安装的**node**导致的启动脚本找不到对应的node，核心排查流程

1. npm包全局安装后，确认清单文件com.chromemcp.nativehost.json的位置，里面有一个**path**字段，指向的是一个启动脚本:

1.1 **检查mcp-chrome-bridge是否安装成功**，确保是**全局安装**的

```bash
mcp-chrome-bridge -V
```

<img width="612" alt="截屏2025-06-11 15 09 57" src="https://github.com/user-attachments/assets/59458532-e6e1-457c-8c82-3756a5dbb28e" />

1.2 **检查清单文件是否已放在正确目录**

windows路径：C:\Users\xxx\AppData\Roaming\Google\Chrome\NativeMessagingHosts

mac路径： /Users/xxx/Library/Application\ Support/Google/Chrome/NativeMessagingHosts

如果npm包安装正常的话，这个目录下会生成一个`com.chromemcp.nativehost.json`

```json
{
  "name": "com.chromemcp.nativehost",
  "description": "Node.js Host for Browser Bridge Extension",
  "path": "/Users/xxx/Library/pnpm/global/5/.pnpm/mcp-chrome-bridge@1.0.23/node_modules/mcp-chrome-bridge/dist/run_host.sh",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/"]
}
```

> 如果发现没有此清单文件，可以尝试命令行执行：`mcp-chrome-bridge register`

2. Chrome浏览器会找到上面的清单文件指向的脚本路径来执行该脚本，同时会在/Users/xxx/Library/pnpm/global/5/.pnpm/mcp-chrome-bridge@1.0.23/node_modules/mcp-chrome-bridge/dist/（windows的自行查看清单文件对应的目录）下生成logs文件夹，里面会记录日志

具体要看你的安装路径（如果不清楚，可以打开上面提到的清单文件，里面的path就是安装目录），比如安装路径如下：看下日志的内容
C:\Users\admin\AppData\Local\nvm\v20.19.2\node_modules\mcp-chrome-bridge\dist\logs
<img width="804" alt="截屏2025-06-11 15 09 41" src="https://github.com/user-attachments/assets/ce7b7c94-7c84-409a-8210-c9317823aae1" />

3. 一般失败的原因就是两种

3.1. run_host.sh(windows是run_host.bat)没有执行权限：此时你可以自行赋予权限，参考：https://github.com/hangwin/mcp-chrome/issues/22#issuecomment-2990636930。 脚本路径在上述的清单文件可以查看

3.2. 脚本找不到node，因为你可能电脑上装了不同版本的node，脚本确认不了你把npm包装在哪个node底下了，不同的人可能用了不同的node版本管理工具，导致找不到，
参考：https://github.com/hangwin/mcp-chrome/issues/29#issuecomment-3003513940 （这个点目前正在优化中）

3.3 如果排除了以上两种原因都不行，则查看日志目录的日志，然后提issue

#### 工具执行超时

有可能长时间连接的时候session会超时，这个时候重新连接即可

#### 效果问题

不同的agent，不同的模型使用工具的效果是不一样的，这些都需要你自行尝试，我更推荐用聪明的agent，比如augment，claude code等等...

---

## 🔊 音频录制排障

### 刚开始就失败 / 录音立即结束

- 确认当前标签页不是 `chrome://` 或扩展页面，这些页面无法录音。
- 弹窗中至少需要一个启用的 API 服务器；使用 MCP 工具时务必传入 `apiServers`。
- 如果之前禁用了麦克风权限，请在 Chrome → 设置 → 隐私和安全性 → 网站设置 → 麦克风 中重新开启。

### Laravel/AppQyV1 拒绝上传

- 扩展输出 WebM/Opus，需先用 FFmpeg 转码成 mp3/wav/ogg 再交给 `AppQyV1WordDataSubmissionController`。
  ```bash
  ffmpeg -i chunk.webm -ar 44100 -ac 2 output.mp3
  ```
- HTTP 请求会附带 `chunkIndex`、`timestamp`、`isFinal` 以及所有 `sessionMetadata` 字段（例如 `word`、`type`、`quality`、`source`），请确保后端读取这些字段。
- 若使用 chunk 模式，请依据 `chunkIndex` 组装，在 `isFinal=true` 时再触发转码。

### 服务器缺少元数据

- 弹窗的 Session Metadata 输入框必须填写合法 JSON，最新版本会提示错误信息。
- 通过 MCP 工具调度时记得在 `chrome_audio_start` 里传入 `sessionMetadata` 对象。
- WebSocket 服务端需先消费首个文本帧 `{ "type": "metadata", "data": {...} }`，之后才是二进制音频。

### WebSocket 只有 metadata，没有音频帧

- 确认 URL 为 `ws://` 或 `wss://`。传入 `http://` 时扩展会尝试替换，但仍可能被代理阻断。
- 打开扩展后台页关注 `[Audio Offscreen]` 日志，确认是否真正开始推流。
- 如需缩短延迟，可将 `chunkInterval` 调小（默认 1000ms）。
