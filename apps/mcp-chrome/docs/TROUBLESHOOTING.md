# 🚀 Installation and Connection Issues

### If Connection Fails After Clicking the Connect Button on the Extension

1. **Check if mcp-chrome-bridge is installed successfully**, ensure it's globally installed

```bash
mcp-chrome-bridge -V
```

<img width="612" alt="Screenshot 2025-06-11 15 09 57" src="https://github.com/user-attachments/assets/59458532-e6e1-457c-8c82-3756a5dbb28e" />

2. **Check if the manifest file is in the correct directory**

Windows path: C:\Users\xxx\AppData\Roaming\Google\Chrome\NativeMessagingHosts

Mac path: /Users/xxx/Library/Application\ Support/Google/Chrome/NativeMessagingHosts

If the npm package is installed correctly, a file named `com.chromemcp.nativehost.json` should be generated in this directory

3. **Check if there are logs in the npm package installation directory**
   You need to check your installation path (if unclear, open the manifest file in step 2, the path field shows the installation directory). For example, if the installation path is as follows, check the log contents:

C:\Users\admin\AppData\Local\nvm\v20.19.2\node_modules\mcp-chrome-bridge\dist\logs

<img width="804" alt="Screenshot 2025-06-11 15 09 41" src="https://github.com/user-attachments/assets/ce7b7c94-7c84-409a-8210-c9317823aae1" />

4. **Check if you have execution permissions**
   You need to check your installation path (if unclear, open the manifest file in step 2, the path field shows the installation directory). For example, if the Mac installation path is as follows:

`xxx/node_modules/mcp-chrome-bridge/dist/run_host.sh`

Check if this script has execution permissions

---

## 🔊 Audio Recording Troubleshooting

### Recording stops immediately or never starts

- Ensure the active tab is not a Chrome system page (`chrome://` or another extension page); those cannot be captured.
- Confirm the popup shows at least one enabled API server or that an MCP tool call passed `apiServers`.
- If the microphone prompt was dismissed previously, re-enable it via Chrome → Settings → Privacy & Security → Site Settings → Microphone.

### Laravel/AppQyV1 endpoint rejects uploads

- The extension emits WebM/Opus. Convert to a supported format (mp3/wav/ogg) before calling `AppQyV1WordDataSubmissionController`.
  ```bash
  ffmpeg -i chunk.webm -ar 44100 -ac 2 output.mp3
  ```
- Verify the form fields being appended: `chunkIndex`, `timestamp`, `isFinal`, and all `sessionMetadata` entries such as `word`, `type`, `quality`, `source`.
- For chunked uploads, collect each part in order (`chunkIndex`) and only attempt conversion when `isFinal=true`.

### Metadata is missing on the server

- Make sure the popup's **Session Metadata (JSON)** block contains valid JSON (the panel now shows validation errors).
- When triggering recordings from MCP tools, include the `sessionMetadata` object inside `chrome_audio_start`.
- WebSocket servers should listen for the first text frame `{ "type": "metadata", "data": {...} }` before consuming binary audio.

### WebSocket receives only metadata but no audio

- Confirm the endpoint URL uses `ws://`/`wss://`. If you provide `http://`, the extension automatically rewrites it, but proxies/firewalls might still block the request.
- Check DevTools → chrome-extension://... → Background page → Console for `[Audio Offscreen]` logs to verify events.
- Reduce `chunkInterval` if the server expects smaller packets (default 1000 ms).
