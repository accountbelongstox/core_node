/**
 * 动态刷新预览：监听 ROSBOT_FLOW_MERMAID.md，变更时重新生成 SVG；
 * 启动本地 HTTP 服务，页面每 1.5 秒刷新一次图。
 * 使用：node pyapps/d3-check/docs/preview_mermaid_watch.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, watch } from "fs";
import { createServer } from "http";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const docDir = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const mdPath = join(docDir, "ROSBOT_FLOW_MERMAID.md");
const outDir = join(docDir, "mermaid_preview");
const outSvg = join(outDir, "ROSBOT_FLOW.svg");
const PORT = 18765;

mkdirSync(outDir, { recursive: true });

function extractFirstMermaid(md) {
  const re = /```mermaid\n([\s\S]*?)```/;
  const m = re.exec(md);
  return m ? m[1] : null;
}

function buildSvg() {
  try {
    const md = readFileSync(mdPath, "utf8");
    const block = extractFirstMermaid(md);
    if (!block) {
      console.log("[watch] No mermaid block, skip.");
      return;
    }
    const mmdPath = join(tmpdir(), `rosbot_flow_${Date.now()}.mmd`);
    writeFileSync(mmdPath, block, "utf8");
    execSync(`npx -y @mermaid-js/mermaid-cli -i "${mmdPath}" -o "${outSvg}"`, {
      stdio: "pipe",
      shell: true,
    });
    console.log("[watch] OK:", outSvg);
  } catch (e) {
    console.error("[watch] Error:", e.message || e);
  }
}

// 先生成一次
buildSvg();

const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ROSBOT Flow Mermaid</title>
  <style>
    body { margin: 0; background: #1e1e1e; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    #box { max-width: 100%; overflow: auto; padding: 16px; }
    #box img { max-width: 100%; height: auto; display: block; }
    .badge { position: fixed; top: 8px; right: 8px; background: #333; color: #0f0; padding: 4px 8px; font-family: monospace; font-size: 12px; }
  </style>
</head>
<body>
  <span class="badge" id="status">OK</span>
  <div id="box"><img id="img" src="ROSBOT_FLOW.svg" alt="Mermaid" /></div>
  <script>
    var img = document.getElementById('img');
    var status = document.getElementById('status');
    setInterval(function() {
      img.src = 'ROSBOT_FLOW.svg?t=' + Date.now();
      img.onerror = function() { status.textContent = 'SVG load err'; };
      img.onload = function() { status.textContent = 'OK ' + new Date().toLocaleTimeString(); };
    }, 1500);
  </script>
</body>
</html>
`;

writeFileSync(join(outDir, "index.html"), indexHtml);

const server = createServer((req, res) => {
  const u = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = u.pathname === "/" ? "/index.html" : u.pathname;
  if (pathname === "/index.html" || pathname === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(indexHtml);
    return;
  }
  if (pathname === "/ROSBOT_FLOW.svg" || pathname.endsWith(".svg")) {
    try {
      const data = readFileSync(join(outDir, "ROSBOT_FLOW.svg"));
      res.setHeader("Content-Type", "image/svg+xml");
      res.end(data);
    } catch (e) {
      res.statusCode = 404;
      res.end("Not found");
    }
    return;
  }
  res.statusCode = 404;
  res.end("Not found");
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log("Preview (auto-refresh every 1.5s):", url);
  const open = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  execSync(`${open} "${url}"`, { stdio: "inherit", shell: true });
});

watch(mdPath, (eventType, filename) => {
  if (filename) {
    console.log("[watch]", mdPath, "changed.");
    buildSvg();
  }
});
console.log("Watching:", mdPath);
