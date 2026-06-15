/**
 * Desktop Manager server (pycore edition).
 *
 * Serves the React/Vite SPA and bridges it to the pycore backend. Gemini has been
 * removed; data comes from the real pycore service instead:
 *
 *   - GET  /api/queue            -> pycore GET  /voice-subtitle/queue (mapped to {items})
 *   - POST /api/queue            -> pycore /voice-subtitle/clear when emptied (client-authoritative cache otherwise)
 *   - /pyapi/*                   -> transparent reverse proxy to the pycore backend (same-origin, no CORS)
 *
 * The three former Gemini endpoints (/api/tts, /api/analyze-screenshot,
 * /api/convert-audio-text) now route to pycore where a clean equivalent exists,
 * and otherwise return an explicit "not configured" response (no mock pretending).
 *
 * Config via env:
 *   PYCORE_UI_PORT   - port this server listens on            (default 15654)
 *   PYCORE_API_BASE  - pycore backend base URL                (default http://localhost:59000)
 *   NODE_ENV         - "production" serves dist/ instead of Vite middleware
 */
import express from "express";
import path from "path";
import http from "http";

const PORT = parseInt(process.env.PYCORE_UI_PORT || "15654", 10);
const PYCORE_API_BASE = (process.env.PYCORE_API_BASE || "http://localhost:59000").replace(/\/+$/, "");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ---------------------------------------------------------------------------
// pycore reverse proxy: /pyapi/* -> PYCORE_API_BASE/*  (keeps the SPA same-origin)
// ---------------------------------------------------------------------------
app.use("/pyapi", async (req, res) => {
  const target = PYCORE_API_BASE + req.url; // req.url is the path after /pyapi
  try {
    const init: RequestInit = {
      method: req.method,
      headers: { "Content-Type": "application/json" },
    };
    if (!["GET", "HEAD"].includes(req.method) && req.body && Object.keys(req.body).length) {
      init.body = JSON.stringify(req.body);
    }
    const upstream = await fetch(target, init);
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type") || "";
    res.setHeader("content-type", ct);
    if (ct.includes("application/json")) {
      res.send(await upstream.text());
    } else {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    }
  } catch (err: any) {
    res.status(502).json({ success: false, error: `pycore unreachable: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// Runtime info: gives the browser the backend WS URL + API base. The page is
// served from :15654 but the pycore RPC WebSocket lives on the backend (:59000),
// so the SPA cannot derive it from window.location — it must ask the server.
// ---------------------------------------------------------------------------
app.get("/api/runtime", (_req, res) => {
  // Connect the page's WebSocket DIRECTLY to the pycore backend (:59000). VERIFIED
  // by a raw handshake test: the backend returns "101 Switching Protocols" and
  // accepts cross-origin WS from this page's origin (http://localhost:15654). The
  // same-origin Node reverse-proxy hop was the actual failure (code=1006 on every
  // attempt, with both a manual http.request proxy and Vite's http-proxy), so we
  // skip the proxy entirely for the WebSocket and let the browser hit :59000.
  const wsUrl = PYCORE_API_BASE.replace(/^http/, "ws") + "/rpc/ws";
  res.json({ wsUrl, apiBase: PYCORE_API_BASE });
});

// ---------------------------------------------------------------------------
// Category mapping: pycore freeform string -> React QueueItem category
// ---------------------------------------------------------------------------
function mapCategory(c: string): string {
  const m: Record<string, string> = {
    normal: "Voice", voice: "Voice", text: "Voice",
    image: "Image", file: "File", task: "Task", video: "Video", window: "Window",
  };
  return m[(c || "").toLowerCase()] || "Voice";
}

async function pycore(pathname: string, init?: RequestInit) {
  const r = await fetch(PYCORE_API_BASE + pathname, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  return r.json();
}

// ---------------------------------------------------------------------------
// Queue: read real pycore data, mapped to the React shape.
// ---------------------------------------------------------------------------
app.get("/api/queue", async (_req, res) => {
  try {
    const data: any = await pycore("/voice-subtitle/queue");
    const raw: any[] = data.queue || [];
    const items = raw.map((it: any, i: number) => ({
      id: `item_${i + 1}`,
      index: i + 1,
      text: it.text || "",
      category: mapCategory(it.category),
      playCount: it.play_count || 0,
      created: it.created_at || new Date().toISOString(),
      status: "completed" as const,
      audioUrl: it.audio_path ? `/pyapi/voice-subtitle/audio?path=${encodeURIComponent(it.audio_path)}` : undefined,
      metadata: { lang: it.lang },
    }));
    res.json({ success: true, items, currentIndex: data.current_index ?? 0 });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message, items: [] });
  }
});

// The React app is client-authoritative for ordering; we only forward destructive
// intent (empty array == clear) to pycore. Fine-grained add/remove sync is TODO.
app.post("/api/queue", async (req, res) => {
  const { items } = req.body || {};
  try {
    if (Array.isArray(items) && items.length === 0) {
      await pycore("/voice-subtitle/clear", { method: "POST", body: "{}" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Former Gemini endpoints -> pycore equivalents (or explicit "not configured").
// ---------------------------------------------------------------------------

// TTS: pycore generates audio server-side via the voice-subtitle add-text pipeline
// (queued, not an immediate base64 stream). We enqueue and report it; the player
// then plays the generated item from the queue.
app.post("/api/tts", async (req, res) => {
  const { text, langs = ["en"], category = "normal" } = req.body || {};
  if (!text) return res.status(400).json({ success: false, error: "text required" });
  try {
    const r: any = await pycore("/voice-subtitle/add-text", {
      method: "POST",
      body: JSON.stringify({ text, langs, category }),
    });
    res.json({ success: r.success !== false, queued: true, task_id: r.task_id, message: "Queued for pycore TTS", audio: "" });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// Screenshot analysis -> pycore screenshot/OCR (TODO: wire to /api/local/screenshot
// or /api/local/image once the desired flow is decided).
app.post("/api/analyze-screenshot", async (_req, res) => {
  res.json({ success: false, configured: false, tasks: [],
             message: "Screenshot analysis is not wired to a pycore endpoint yet." });
});

// Audio -> text (NotebookLM-style) -> pycore audio transcribe. Needs a local path;
// the UI flow for choosing it is TODO, so report not-configured for now.
app.post("/api/convert-audio-text", async (_req, res) => {
  res.json({ success: false, configured: false, subtitles: [], summary: "",
             message: "Audio->text is not wired to a pycore endpoint yet." });
});

// ---------------------------------------------------------------------------
// Vite (dev) / static (prod)
// ---------------------------------------------------------------------------
async function startServer() {
  // Create the HTTP server explicitly so Vite can SHARE it for HMR. In middleware
  // mode you must hand Vite the parent server (`middlewareMode: { server }`); it
  // then attaches its HMR WebSocket to it and React edits hot-reload in the webview.
  // Vite only claims upgrades carrying the `vite-hmr` subprotocol, so it coexists
  // with our /rpc/ws proxy below. (Official: vite.dev server-options middlewareMode.)
  const server = http.createServer(app);

  // Backend host/port for the /rpc/ws WebSocket reverse proxy. Computed up front so
  // both the DEV (Vite proxy) and PROD (manual upgrade) branches can use them.
  const backend = new URL(PYCORE_API_BASE);
  const backendHost = backend.hostname;
  const backendPort = Number(backend.port) || (backend.protocol === "https:" ? 443 : 80);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: { server }, // HMR on, sharing our server
        // Same-origin /rpc/ws -> pycore backend /rpc/ws. Vite uses http-proxy under
        // the hood (ws:true), which frames the WS upgrade correctly — far more robust
        // than a hand-rolled http.request forward. Vite's own HMR socket coexists: it
        // only claims `vite-hmr` subprotocol upgrades, leaving /rpc/ws to this proxy.
        proxy: {
          "/rpc/ws": { target: `ws://${backendHost}:${backendPort}`, ws: true },
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

    // ---------------------------------------------------------------------------
    // PROD-only WebSocket reverse proxy: same-origin /rpc/ws -> pycore /rpc/ws.
    // There's no Vite in production, so we proxy the upgrade ourselves via
    // http.request's `upgrade` event (frames the HTTP handshake correctly).
    // ---------------------------------------------------------------------------
    server.on("upgrade", (req, clientSocket, head) => {
      if (!req.url || !req.url.startsWith("/rpc/ws")) return;
      console.log(`[ws-proxy] ${req.url} -> ${backendHost}:${backendPort}`);
      // Forward the upgrade to the backend; Node builds a valid WS handshake request.
      const proxyReq = http.request({
        host: backendHost,
        port: backendPort,
        method: req.method,
        path: req.url,
        headers: req.headers,
      });
      proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
        // Relay the backend's 101 response to the browser, then bridge the sockets.
        const statusLine = `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage || "Switching Protocols"}\r\n`;
        const headerLines = Object.entries(proxyRes.headers)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("\r\n");
        clientSocket.write(statusLine + headerLines + "\r\n\r\n");
        if (proxyHead && proxyHead.length) clientSocket.write(proxyHead);
        proxySocket.pipe(clientSocket);
        clientSocket.pipe(proxySocket);
        const kill = () => { proxySocket.destroy(); clientSocket.destroy(); };
        proxySocket.on("error", kill);
        clientSocket.on("error", kill);
      });
      proxyReq.on("error", (e: any) => {
        console.error(`[ws-proxy] cannot reach backend ${backendHost}:${backendPort} — ${e.code || ''} ${e.message}`);
        clientSocket.destroy();
      });
      if (head && head.length) proxyReq.write(head);
      proxyReq.end();
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[desktop-manager] UI on http://0.0.0.0:${PORT}  (pycore: ${PYCORE_API_BASE})  [HMR ${process.env.NODE_ENV !== "production" ? "on" : "off"}]`);
  });
}

startServer();
