#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Qwen3-TTS Web UI tester (pycore-backed).

Run with no arguments to open a local browser UI: upload or paste text from any
file, synthesize speech via pycore.pyutils.tts, and play the result inline.

Optional CLI diagnostics (backward compatible):
  python qwen3tts_tester.py --import-only
  python qwen3tts_tester.py --verify-weights
  python qwen3tts_tester.py --engine --lang en
  python qwen3tts_tester.py --batch-test --lang en
  python qwen3tts_tester.py --batch-test --batch-size 8 --batch-items 16

Batch / parallel generation uses the official list API (non_streaming_mode=True).
Max parallel is auto-tuned from GPU VRAM + utilization; override with --batch-size
or env QWEN3TTS_MAX_PARALLEL. Docs:
  https://qwenlm-qwen3-tts.mintlify.app/guides/batch-processing
"""

import argparse
import importlib.util
import json
import mimetypes
import os
import shutil
import socket
import sys
import threading
import time
import traceback
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote, urlparse

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
AITOOLS_DIR = str(SCRIPT_DIR)
PROJECT_ROOT_STR = str(PROJECT_ROOT)

DEFAULT_TEXT_EN = "Hello! This is a Qwen3-TTS validation sample."
DEFAULT_TEXT_ZH = "你好，这是 Qwen3 语音合成测试。"

WEB_HOST = "127.0.0.1"
WEB_PORT_START = 18765
WEB_PORT_TRIES = 32
MAX_TEXT_CHARS = 8000
TEXT_FILE_SUFFIXES = {
    ".txt", ".md", ".markdown", ".json", ".xml", ".html", ".htm",
    ".csv", ".tsv", ".log", ".yaml", ".yml", ".ini", ".cfg", ".py",
    ".js", ".ts", ".vue", ".css", ".sql", ".rst", ".tex",
}

_jobs_lock = threading.Lock()
_jobs: Dict[str, Dict[str, Any]] = {}
_output_dir: Optional[Path] = None


def _bootstrap_cache_env() -> None:
    """Set CORE_NODE_CACHE_DIR before pycore import (system_paths needs it on Windows)."""
    cache_root = (os.environ.get("CORE_NODE_CACHE_DIR") or r"D:\www\cache").strip()
    os.environ.setdefault("CORE_NODE_CACHE_DIR", cache_root)
    os.environ.setdefault("HF_HOME", str(Path(cache_root) / "huggingface"))
    os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "3600")


def _ensure_project_paths() -> None:
    if AITOOLS_DIR not in sys.path:
        sys.path.insert(0, AITOOLS_DIR)
    if PROJECT_ROOT_STR not in sys.path:
        sys.path.insert(0, PROJECT_ROOT_STR)


def _load_hf_secret():
    _ensure_project_paths()
    from hf_secret import ensure_hf_token
    return ensure_hf_token


def _load_qwen_tts():
    try:
        from qwen_tts import Qwen3TTSModel
        return Qwen3TTSModel, True
    except ImportError:
        return None, False


def _load_weights_module():
    _bootstrap_cache_env()
    _ensure_project_paths()
    from pycore.pyutils.tts import qwen3tts_weights
    return qwen3tts_weights


def _load_engine_module():
    _bootstrap_cache_env()
    _ensure_project_paths()
    from pycore.pyutils.tts import qwen3tts_engine
    return qwen3tts_engine


def _load_tts_params():
    _bootstrap_cache_env()
    _ensure_project_paths()
    from pycore.pyutils.tts.tts_engine_params import get_tts_engine_params
    return get_tts_engine_params("qwen3tts")


def _output_root() -> Path:
    global _output_dir
    if _output_dir is None:
        _bootstrap_cache_env()
        _ensure_project_paths()
        from pycore.pygvar import PYTOOLS_TMP_DIR
        root = Path(PYTOOLS_TMP_DIR) / "qwen3tts_tester"
        root.mkdir(parents=True, exist_ok=True)
        _output_dir = root
    return _output_dir


def _require_pytorch():
    try:
        import torch
        return torch
    except ImportError:
        print("[ERROR] PyTorch (torch) is not installed in this Python environment.")
        print("        Install torch first, then run this script again.")
        print("        https://pytorch.org/get-started/locally/")
        sys.exit(1)


def _resolve_device(requested: str):
    torch = _require_pytorch()
    want = (requested or "auto").strip() or "auto"
    if want != "auto":
        return want, torch
    dev = "cuda:0" if torch.cuda.is_available() else "cpu"
    return dev, torch


def _speaker_presets() -> Dict[str, List[str]]:
    return {
        "en": ["Ryan", "Aiden", "Emma", "Sophia"],
        "zh": ["Vivian", "Serena", "Uncle_Fu", "Dylan"],
        "ja": ["Ono_Anna", "Hina"],
        "ko": ["Sohee", "Hyunwoo"],
        "de": ["Ryan"],
        "fr": ["Ryan"],
        "ru": ["Ryan"],
        "pt": ["Ryan"],
        "es": ["Ryan"],
        "it": ["Ryan"],
    }


def _default_speaker(lang: str) -> str:
    code = (lang or "en").strip().lower()[:2]
    presets = _speaker_presets()
    options = presets.get(code) or presets["en"]
    return options[0]


def check_import(verbose: bool = True) -> bool:
    spec_ok = False
    try:
        spec_ok = importlib.util.find_spec("qwen_tts") is not None
    except Exception:
        spec_ok = False

    model_cls, import_ok = _load_qwen_tts()

    if verbose:
        print("[CHECK] importlib.util.find_spec('qwen_tts'):", "OK" if spec_ok else "missing")
        print("[CHECK] from qwen_tts import Qwen3TTSModel:", "OK" if import_ok else "ImportError")
        if import_ok:
            print(f"[CHECK] Qwen3TTSModel: {model_cls}")
        else:
            print("[HINT]  pip install -U qwen-tts")
            print("[HINT]  Or run Step61_InstallQwen3Tts.ps1 / 140_install_qwen3tts.sh")

    return spec_ok and import_ok


def _print_redownload_hints(model_id: str | None = None) -> None:
    weights = _load_weights_module()
    print()
    for line in weights.redownload_hint_lines(model_id):
        print(line)


def _engine_status() -> Dict[str, Any]:
    engine = _load_engine_module()
    weights = _load_weights_module()
    params = _load_tts_params()
    model_id = weights.resolve_model_id()
    device, torch = _resolve_device(os.environ.get("QWEN3TTS_DEVICE") or "auto")
    weights_ok, _, weight_detail = weights.audit_local_weights(verbose=False)
    return {
        "package_available": engine.available(),
        "model_loaded": engine.is_model_loaded(),
        "model_id": model_id,
        "device": device,
        "cuda_available": bool(torch.cuda.is_available()),
        "weights_ok": weights_ok,
        "weights_detail": weight_detail,
        "last_error": engine.last_synth_error(),
        "params": params,
        "speaker_presets": _speaker_presets(),
        "max_text_chars": MAX_TEXT_CHARS,
        "long_wait": bool(params.get("long_wait")),
        "note": params.get("note") or "",
    }


def _read_text_file(path: Path) -> Tuple[str, str]:
    suffix = path.suffix.lower()
    if suffix and suffix not in TEXT_FILE_SUFFIXES:
        return "", f"Unsupported file type: {suffix}"
    raw = path.read_bytes()
    if not raw:
        return "", "File is empty"
    if b"\x00" in raw[:4096]:
        return "", "Binary file is not supported; use a text file"
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "gbk", "latin-1"):
        try:
            text = raw.decode(encoding)
            return text.strip(), ""
        except UnicodeDecodeError:
            continue
    return "", "Could not decode file as text"


def _normalize_job_text(text: str, language: str) -> str:
    cleaned = (text or "").strip()
    if cleaned:
        return cleaned[:MAX_TEXT_CHARS]
    if (language or "en").lower().startswith("zh"):
        return DEFAULT_TEXT_ZH
    return DEFAULT_TEXT_EN


def _run_synthesis_job(
    job_id: str,
    text: str,
    language: str,
    speaker: str,
    instruct: str,
    source_name: str,
) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        job["status"] = "running"
        job["started_at"] = time.time()

    _bootstrap_cache_env()
    _ensure_project_paths()
    _load_hf_secret()()

    from pycore.pyutils.tts.tts_orchestrator import tts_test

    sample = _normalize_job_text(text, language)
    out_dir = _output_root()
    stamp = int(time.time() * 1000)
    out_path = out_dir / f"qwen3tts_{stamp}_{job_id[:8]}.mp3"

    t0 = time.monotonic()
    result = tts_test(
        engine="qwen3tts",
        text=sample,
        language=language or "en",
        speaker=(speaker or "").strip() or None,
        instruct=(instruct or "").strip() or None,
    )
    elapsed_ms = round((time.monotonic() - t0) * 1000)

    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        job["elapsed_ms"] = elapsed_ms
        job["text"] = sample
        job["language"] = language or "en"
        job["speaker"] = speaker or _default_speaker(language)
        job["instruct"] = (instruct or "").strip()
        job["source_name"] = source_name or "textarea"
        job["finished_at"] = time.time()

        if result.get("success") and result.get("path"):
            src = Path(str(result["path"]))
            if src.exists() and src.stat().st_size > 0:
                if src.resolve() != out_path.resolve():
                    shutil.copy2(src, out_path)
                job["status"] = "done"
                job["audio_name"] = out_path.name
                job["bytes"] = out_path.stat().st_size
                job["error"] = None
                return

        job["status"] = "error"
        job["error"] = result.get("error") or "Synthesis failed"
        job["audio_name"] = None
        job["bytes"] = 0


def _start_job(
    text: str,
    language: str,
    speaker: str,
    instruct: str,
    source_name: str,
) -> Dict[str, Any]:
    job_id = uuid.uuid4().hex
    job = {
        "id": job_id,
        "status": "queued",
        "created_at": time.time(),
        "audio_name": None,
        "error": None,
    }
    with _jobs_lock:
        _jobs[job_id] = job

    worker = threading.Thread(
        target=_run_synthesis_job,
        name=f"Qwen3TtsJob-{job_id[:8]}",
        args=(job_id, text, language, speaker, instruct, source_name),
        daemon=True,
    )
    worker.start()
    return {"job_id": job_id, "status": "queued"}


def _job_snapshot(job_id: str) -> Optional[Dict[str, Any]]:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        return dict(job)


def _pick_port(host: str, start: int, tries: int) -> int:
    for offset in range(tries):
        port = start + offset
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind((host, port))
            return port
        except OSError:
            continue
        finally:
            probe.close()
    return start


def _html_page(status: Dict[str, Any]) -> str:
    status_json = json.dumps(status, ensure_ascii=False)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Qwen3-TTS Tester</title>
  <style>
    :root {{
      --bg: #0f1419;
      --panel: #1a2332;
      --border: #2d3a4f;
      --text: #e7ecf3;
      --muted: #8b9cb3;
      --accent: #3d8bfd;
      --accent-2: #20c997;
      --danger: #ff6b6b;
      --warn: #ffd166;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: linear-gradient(160deg, #0b1020 0%, #121a2b 55%, #0f1419 100%);
      color: var(--text);
      min-height: 100vh;
    }}
    .wrap {{ max-width: 980px; margin: 0 auto; padding: 24px 18px 40px; }}
    h1 {{ margin: 0 0 6px; font-size: 1.6rem; }}
    .sub {{ color: var(--muted); margin-bottom: 18px; font-size: 0.95rem; }}
    .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
    @media (max-width: 760px) {{ .grid {{ grid-template-columns: 1fr; }} }}
    .card {{
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 14px;
    }}
    label {{ display: block; font-size: 0.78rem; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--muted); margin-bottom: 6px; }}
    input[type="text"], select, textarea {{
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #0f1724;
      color: var(--text);
      padding: 10px 12px;
      font-size: 0.95rem;
    }}
    textarea {{ min-height: 180px; resize: vertical; line-height: 1.45; }}
    .dropzone {{
      border: 2px dashed var(--border);
      border-radius: 10px;
      padding: 18px;
      text-align: center;
      color: var(--muted);
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      margin-bottom: 12px;
    }}
    .dropzone.drag {{ border-color: var(--accent); background: #122033; color: var(--text); }}
    .row {{ display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }}
    .row > * {{ flex: 1; min-width: 140px; }}
    button {{
      border: 0;
      border-radius: 8px;
      padding: 11px 16px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.95rem;
    }}
    .primary {{ background: var(--accent); color: #fff; }}
    .primary:disabled {{ opacity: 0.55; cursor: not-allowed; }}
    .ghost {{ background: transparent; color: var(--text); border: 1px solid var(--border); }}
    .status-pill {{
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 700;
      margin-right: 6px;
    }}
    .ok {{ background: #163d2f; color: var(--accent-2); }}
    .bad {{ background: #3d1c1c; color: var(--danger); }}
    .warn {{ background: #3d3318; color: var(--warn); }}
    .meta {{ font-size: 0.86rem; color: var(--muted); line-height: 1.5; }}
    .meta code {{ color: #b8c9e6; }}
    #progress {{ min-height: 1.2rem; margin-top: 10px; color: var(--warn); }}
    #error {{ color: var(--danger); margin-top: 8px; white-space: pre-wrap; }}
    audio {{ width: 100%; margin-top: 10px; }}
    .history {{ font-size: 0.86rem; }}
    .history li {{ margin-bottom: 6px; }}
    .hint {{ font-size: 0.82rem; color: var(--muted); margin-top: 6px; }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Qwen3-TTS Tester</h1>
    <p class="sub">Upload any text file or paste content, synthesize via pycore, and play inline.</p>

    <div class="card" id="statusCard">
      <div class="row" id="statusRow"></div>
      <p class="meta" id="statusNote"></p>
    </div>

    <div class="card">
      <label>Text source</label>
      <div class="dropzone" id="dropzone">
        Drop a text file here or click to browse<br>
        <span class="hint">.txt .md .json .html .py and other text formats</span>
        <input type="file" id="fileInput" hidden>
      </div>
      <p class="meta" id="fileMeta">No file loaded</p>
      <label for="text">Text to synthesize</label>
      <textarea id="text" placeholder="Paste text or load a file..."></textarea>
      <p class="hint" id="charCount">0 / {MAX_TEXT_CHARS} characters</p>
    </div>

    <div class="card grid">
      <div>
        <label for="language">Language</label>
        <select id="language"></select>
      </div>
      <div>
        <label for="speaker">Speaker (CustomVoice preset)</label>
        <select id="speaker"></select>
        <input type="text" id="speakerCustom" placeholder="Or type a custom speaker name" style="margin-top:8px;">
      </div>
    </div>

    <div class="card">
      <label for="instruct">Style instruction (optional)</label>
      <input type="text" id="instruct" placeholder="e.g. cheerful and energetic, speak slowly">
      <p class="hint">Maps to QWEN3TTS_INSTRUCT — emotion, pace, or delivery style.</p>
    </div>

    <div class="card row">
      <button class="primary" id="generateBtn">Generate &amp; Play</button>
      <button class="ghost" id="sampleBtn">Load sample text</button>
      <button class="ghost" id="clearBtn">Clear</button>
    </div>

    <div class="card">
      <div id="progress"></div>
      <div id="error"></div>
      <audio id="player" controls autoplay></audio>
      <p class="meta" id="resultMeta"></p>
    </div>

    <div class="card history">
      <label>Recent runs</label>
      <ul id="history"></ul>
    </div>
  </div>

  <script>
    const STATUS = {status_json};
    const speakerPresets = STATUS.speaker_presets || {{}};
    const langSelect = document.getElementById("language");
    const speakerSelect = document.getElementById("speaker");
    const speakerCustom = document.getElementById("speakerCustom");
    const textArea = document.getElementById("text");
    const fileInput = document.getElementById("fileInput");
    const dropzone = document.getElementById("dropzone");
    const generateBtn = document.getElementById("generateBtn");
    const player = document.getElementById("player");
    const progressEl = document.getElementById("progress");
    const errorEl = document.getElementById("error");
    const resultMeta = document.getElementById("resultMeta");
    const historyEl = document.getElementById("history");
    const charCount = document.getElementById("charCount");
    const fileMeta = document.getElementById("fileMeta");
    let loadedFileName = "";
    let pollTimer = null;
    const history = [];

    function pill(ok, label) {{
      const cls = ok ? "ok" : "bad";
      return `<span class="status-pill ${{cls}}">${{label}}</span>`;
    }}

    function renderStatus() {{
      const row = document.getElementById("statusRow");
      row.innerHTML = [
        pill(STATUS.package_available, STATUS.package_available ? "qwen-tts OK" : "qwen-tts missing"),
        pill(STATUS.weights_ok, STATUS.weights_ok ? "weights OK" : "weights check"),
        pill(STATUS.model_loaded, STATUS.model_loaded ? "model loaded" : "model idle"),
        pill(STATUS.cuda_available, STATUS.cuda_available ? "CUDA" : "CPU"),
      ].join("");
      document.getElementById("statusNote").innerHTML =
        `Model <code>${{STATUS.model_id}}</code> on <code>${{STATUS.device}}</code>. ` +
        (STATUS.note || "") +
        (STATUS.long_wait ? " First run may take 2-5 minutes." : "");
      const options = (STATUS.params && STATUS.params.language_options) || [];
      langSelect.innerHTML = options.map(o =>
        `<option value="${{o.value}}">${{o.label}}</option>`
      ).join("");
      refreshSpeakers();
    }}

    function refreshSpeakers() {{
      const lang = langSelect.value || "en";
      const presets = speakerPresets[lang] || speakerPresets.en || ["Ryan"];
      speakerSelect.innerHTML = presets.map(name =>
        `<option value="${{name}}">${{name}}</option>`
      ).join("");
    }}

    function updateCharCount() {{
      const n = textArea.value.length;
      charCount.textContent = `${{n}} / {MAX_TEXT_CHARS} characters`;
    }}

    function setTextFromFile(name, content) {{
      loadedFileName = name || "";
      textArea.value = (content || "").slice(0, {MAX_TEXT_CHARS});
      fileMeta.textContent = loadedFileName
        ? `Loaded: ${{loadedFileName}} (${{textArea.value.length}} chars)`
        : "No file loaded";
      updateCharCount();
    }}

    function readFile(file) {{
      const reader = new FileReader();
      reader.onload = () => setTextFromFile(file.name, String(reader.result || ""));
      reader.onerror = () => {{ errorEl.textContent = "Failed to read file in browser"; }};
      reader.readAsText(file);
    }}

    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {{
      if (fileInput.files && fileInput.files[0]) readFile(fileInput.files[0]);
    }});
    dropzone.addEventListener("dragover", (e) => {{
      e.preventDefault();
      dropzone.classList.add("drag");
    }});
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
    dropzone.addEventListener("drop", (e) => {{
      e.preventDefault();
      dropzone.classList.remove("drag");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
    }});

    langSelect.addEventListener("change", refreshSpeakers);
    textArea.addEventListener("input", updateCharCount);

    document.getElementById("sampleBtn").addEventListener("click", () => {{
      const lang = langSelect.value || "en";
      const sample = lang.startsWith("zh")
        ? {json.dumps(DEFAULT_TEXT_ZH, ensure_ascii=False)}
        : {json.dumps(DEFAULT_TEXT_EN)};
      setTextFromFile("sample", sample);
    }});

    document.getElementById("clearBtn").addEventListener("click", () => {{
      textArea.value = "";
      loadedFileName = "";
      fileMeta.textContent = "No file loaded";
      errorEl.textContent = "";
      progressEl.textContent = "";
      resultMeta.textContent = "";
      player.removeAttribute("src");
      updateCharCount();
    }});

    function resolvedSpeaker() {{
      const custom = (speakerCustom.value || "").trim();
      return custom || speakerSelect.value || "Ryan";
    }}

    async function pollJob(jobId) {{
      const resp = await fetch(`/api/job/${{jobId}}`);
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Job not found");
      const job = data.job;
      if (job.status === "queued") {{
        progressEl.textContent = "Queued...";
      }} else if (job.status === "running") {{
        progressEl.textContent = "Synthesizing... (cold start can take several minutes)";
      }} else if (job.status === "done") {{
        progressEl.textContent = "";
        const url = `/audio/${{encodeURIComponent(job.audio_name)}}?t=${{Date.now()}}`;
        player.src = url;
        player.load();
        player.play().catch(() => {{}});
        resultMeta.textContent =
          `${{job.bytes}} bytes in ${{job.elapsed_ms}} ms | ` +
          `${{job.language}} / ${{job.speaker}}` +
          (job.instruct ? ` | instruct: ${{job.instruct}}` : "") +
          (job.source_name ? ` | source: ${{job.source_name}}` : "");
        history.unshift({{
          when: new Date().toLocaleTimeString(),
          chars: (job.text || "").length,
          ms: job.elapsed_ms,
          url,
        }});
        historyEl.innerHTML = history.slice(0, 8).map(h =>
          `<li>${{h.when}} — ${{h.chars}} chars, ${{h.ms}} ms <a href="${{h.url}}" target="_blank">audio</a></li>`
        ).join("");
        generateBtn.disabled = false;
        return;
      }} else if (job.status === "error") {{
        throw new Error(job.error || "Synthesis failed");
      }}
      pollTimer = setTimeout(() => pollJob(jobId), 1200);
    }}

    generateBtn.addEventListener("click", async () => {{
      errorEl.textContent = "";
      resultMeta.textContent = "";
      const text = textArea.value.trim();
      if (!text) {{
        errorEl.textContent = "Enter text or load a file first.";
        return;
      }}
      generateBtn.disabled = true;
      progressEl.textContent = "Submitting...";
      if (pollTimer) clearTimeout(pollTimer);
      try {{
        const resp = await fetch("/api/synthesize", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{
            text,
            language: langSelect.value || "en",
            speaker: resolvedSpeaker(),
            instruct: (document.getElementById("instruct").value || "").trim(),
            source_name: loadedFileName || "textarea",
          }}),
        }});
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || "Request failed");
        await pollJob(data.job_id);
      }} catch (err) {{
        errorEl.textContent = String(err.message || err);
        progressEl.textContent = "";
        generateBtn.disabled = false;
      }}
    }});

    renderStatus();
    updateCharCount();
  </script>
</body>
</html>"""


class Qwen3TtsWebHandler(BaseHTTPRequestHandler):
    """HTTP handler for the Qwen3-TTS tester UI."""

    server_version = "Qwen3TtsTester/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[web] {self.address_string()} {fmt % args}")

    def _send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        parsed = json.loads(raw.decode("utf-8"))
        if isinstance(parsed, dict):
            return parsed
        return {}

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            status = _engine_status()
            page = _html_page(status).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(page)))
            self.end_headers()
            self.wfile.write(page)
            return

        if path == "/api/status":
            self._send_json({"ok": True, "status": _engine_status()})
            return

        if path.startswith("/api/job/"):
            job_id = path.split("/api/job/", 1)[-1].strip()
            job = _job_snapshot(job_id)
            if job is None:
                self._send_json({"ok": False, "error": "job not found"}, status=404)
                return
            self._send_json({"ok": True, "job": job})
            return

        if path.startswith("/audio/"):
            name = unquote(path.split("/audio/", 1)[-1].split("?", 1)[0])
            safe_name = Path(name).name
            if not safe_name or safe_name != name:
                self.send_error(400, "invalid audio name")
                return
            audio_path = _output_root() / safe_name
            if not audio_path.is_file():
                self.send_error(404, "audio not found")
                return
            mime, _ = mimetypes.guess_type(str(audio_path))
            if not mime:
                mime = "audio/mpeg"
            data = audio_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_error(404, "not found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/synthesize":
            body = self._read_json_body()
            text = str(body.get("text") or "")
            language = str(body.get("language") or "en")
            speaker = str(body.get("speaker") or "")
            instruct = str(body.get("instruct") or "")
            source_name = str(body.get("source_name") or "textarea")

            file_path = str(body.get("file_path") or "").strip()
            if file_path:
                disk_text, disk_err = _read_text_file(Path(file_path))
                if disk_err:
                    self._send_json({"ok": False, "error": disk_err}, status=400)
                    return
                text = disk_text
                source_name = Path(file_path).name

            if not text.strip():
                self._send_json({"ok": False, "error": "empty text"}, status=400)
                return

            started = _start_job(text, language, speaker, instruct, source_name)
            self._send_json({"ok": True, **started})
            return

        if path == "/api/load-file":
            body = self._read_json_body()
            file_path = str(body.get("file_path") or "").strip()
            if not file_path:
                self._send_json({"ok": False, "error": "file_path required"}, status=400)
                return
            text, err = _read_text_file(Path(file_path))
            if err:
                self._send_json({"ok": False, "error": err}, status=400)
                return
            self._send_json({
                "ok": True,
                "text": text[:MAX_TEXT_CHARS],
                "chars": len(text[:MAX_TEXT_CHARS]),
                "name": Path(file_path).name,
            })
            return

        self.send_error(404, "not found")


def run_web_ui(host: str = WEB_HOST, port: Optional[int] = None, open_browser: bool = True) -> None:
    _bootstrap_cache_env()
    _ensure_project_paths()
    _load_hf_secret()()

    chosen_port = port or _pick_port(host, WEB_PORT_START, WEB_PORT_TRIES)
    httpd = ThreadingHTTPServer((host, chosen_port), Qwen3TtsWebHandler)
    url = f"http://{host}:{chosen_port}/"

    print()
    print("[INFO] Qwen3-TTS Web UI (pycore)")
    print(f"[INFO] URL: {url}")
    print(f"[INFO] Output dir: {_output_root()}")
    status = _engine_status()
    print(f"[INFO] Package: {'OK' if status['package_available'] else 'missing'}")
    print(f"[INFO] Model:   {status['model_id']} ({status['device']})")
    if status.get("long_wait"):
        print("[INFO] First synthesis may take 2-5 minutes while weights load.")
    print("[INFO] Press Ctrl+C to stop.")
    print()

    if open_browser:
        threading.Thread(
            target=lambda: webbrowser.open(url, new=1),
            name="Qwen3TtsOpenBrowser",
            daemon=True,
        ).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print()
        print("[INFO] Stopping web UI.")
    finally:
        httpd.server_close()


def test_synthesis(
    model_name: str | None = None,
    text: str | None = None,
    lang: str = "en",
    device: str = "auto",
    output_wav: Path | None = None,
) -> bool:
    if not check_import(verbose=True):
        return False

    weights = _load_weights_module()
    _load_hf_secret()()

    model_cls, _ = _load_qwen_tts()
    if model_cls is None:
        return False

    dev, torch = _resolve_device(device)
    model_id = (model_name or "").strip() or weights.resolve_model_id()
    local_path = Path(model_id)
    if local_path.is_dir():
        ok, _, _ = weights.audit_local_weights(verbose=True)
        if not ok:
            fallback = weights.sentinel_model_id(weights.staging_dir()) or weights.resolve_model_id()
            print(f"[WARN] Falling back to Hugging Face repo id: {fallback}")
            model_id = fallback

    sample_text = (text or "").strip()
    if not sample_text:
        sample_text = DEFAULT_TEXT_ZH if lang.lower().startswith("zh") else DEFAULT_TEXT_EN

    lang_map = {
        "en": "English",
        "zh": "Chinese",
        "ja": "Japanese",
        "ko": "Korean",
    }
    speaker_map = {
        "en": "Ryan",
        "zh": "Vivian",
        "ja": "Ono_Anna",
        "ko": "Sohee",
    }
    lang_code = (lang or "en").strip().lower()[:2]
    qwen_language = lang_map.get(lang_code, "Auto")
    speaker = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip() or speaker_map.get(lang_code, "Ryan")
    instruct = (os.environ.get("QWEN3TTS_INSTRUCT") or "").strip()

    out_path = output_wav or (Path.cwd() / "qwen3tts_test.wav")
    dtype = torch.float32 if dev == "cpu" else torch.bfloat16

    print()
    print(f"[INFO] Model:   {model_id}")
    print(f"[INFO] Device:  {dev}")
    print(f"[INFO] Lang:    {qwen_language} (speaker={speaker})")
    print(f"[INFO] Text:    {sample_text}")
    print(f"[INFO] Output:  {out_path}")
    print()

    try:
        print("[RUN] Loading Qwen3TTSModel...")
        kwargs = {"device_map": dev, "dtype": dtype}
        try:
            model = model_cls.from_pretrained(model_id, **kwargs)
        except TypeError:
            kwargs.pop("dtype", None)
            model = model_cls.from_pretrained(model_id, **kwargs)
        print("[OK] Model loaded")

        gen_kwargs = {
            "text": sample_text,
            "language": qwen_language,
            "speaker": speaker,
        }
        if instruct:
            gen_kwargs["instruct"] = instruct
            print(f"[INFO] Instruct: {instruct}")

        print("[RUN] Generating speech...")
        wavs, sr = model.generate_custom_voice(**gen_kwargs)

        import soundfile as sf

        out_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(out_path), wavs[0], int(sr))
        print(f"[OK] Wrote {out_path} ({int(sr)} Hz)")

        print()
        print("[SUCCESS] ========================================")
        print("[SUCCESS]   Qwen3-TTS synthesis test passed")
        print("[SUCCESS] ========================================")
        return True

    except Exception as exc:
        print(f"[ERROR] Synthesis test failed: {exc}")
        err_text = str(exc).lower()
        if "incomplete metadata" in err_text or "safetensor" in err_text:
            _print_redownload_hints(model_id if "/" in model_id else None)
        traceback.print_exc()
        return False


def test_batch(
    model_name: str | None = None,
    lang: str = "en",
    device: str = "auto",
    batch_size: int | None = None,
    batch_items: int | None = None,
    output_dir: Path | None = None,
) -> bool:
    """Official batch API throughput test with GPU-aware max parallel."""
    if not check_import(verbose=True):
        return False

    from qwen3tts_batch import run_batch_test

    weights = _load_weights_module()
    _load_hf_secret()()

    model_cls, _ = _load_qwen_tts()
    if model_cls is None:
        return False

    dev, torch = _resolve_device(device)
    model_id = (model_name or "").strip() or weights.resolve_model_id()
    local_path = Path(model_id)
    if local_path.is_dir():
        ok, _, _ = weights.audit_local_weights(verbose=True)
        if not ok:
            fallback = weights.sentinel_model_id(weights.staging_dir()) or weights.resolve_model_id()
            print(f"[WARN] Falling back to Hugging Face repo id: {fallback}")
            model_id = fallback

    dtype = torch.float32 if dev == "cpu" else torch.bfloat16
    out_dir = output_dir or (Path.cwd() / "qwen3tts_batch_out")

    try:
        ok, report = run_batch_test(
            model_cls=model_cls,
            model_id=model_id,
            device=dev,
            dtype=dtype,
            lang=lang,
            batch_size=batch_size,
            item_count=batch_items,
            output_dir=out_dir,
        )
        if not ok:
            err = report.get("error") or "batch test failed"
            print(f"[ERROR] {err}")
            return False
        return True
    except Exception as exc:
        print(f"[ERROR] Batch test failed: {exc}")
        err_text = str(exc).lower()
        if "out of memory" in err_text or "cuda" in err_text:
            print("[HINT] Reduce --batch-size or use the 0.6B model on smaller GPUs.")
        if "incomplete metadata" in err_text or "safetensor" in err_text:
            _print_redownload_hints(model_id if "/" in model_id else None)
        traceback.print_exc()
        return False


def test_engine(
    text: str | None = None,
    lang: str = "en",
    output_mp3: Path | None = None,
) -> bool:
    if not check_import(verbose=True):
        return False

    _bootstrap_cache_env()
    _ensure_project_paths()
    _load_hf_secret()()

    try:
        from pycore.pyutils.tts import qwen3tts_engine
    except Exception as exc:
        print(f"[ERROR] Failed to import pycore qwen3tts_engine: {exc}")
        traceback.print_exc()
        return False

    sample_text = (text or DEFAULT_TEXT_EN).strip()
    out_path = output_mp3 or (Path.cwd() / "qwen3tts_engine_test.mp3")

    print()
    print(f"[INFO] Engine available(): {qwen3tts_engine.available()}")
    print(f"[INFO] Text:   {sample_text}")
    print(f"[INFO] Output: {out_path}")
    print()

    ok = qwen3tts_engine.synthesize(sample_text, lang, out_path)
    if ok:
        print(f"[OK] Engine wrote {out_path}")
        print("[SUCCESS] pycore qwen3tts_engine synthesis passed")
        return True

    err = qwen3tts_engine.last_synth_error()
    print(f"[ERROR] Engine synthesis failed: {err or 'unknown error'}")
    err_text = (err or "").lower()
    if "incomplete metadata" in err_text or "safetensor" in err_text:
        _print_redownload_hints()
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Qwen3-TTS Web UI and synthesis tester")
    parser.add_argument(
        "--import-only",
        action="store_true",
        help="Only check qwen_tts import availability",
    )
    parser.add_argument(
        "--verify-weights",
        action="store_true",
        help="Audit local D:/www/cache/pycore/qwen3tts/weights integrity",
    )
    parser.add_argument(
        "--engine",
        action="store_true",
        help="Run synthesis via pycore.pyutils.tts.qwen3tts_engine",
    )
    parser.add_argument(
        "--batch-test",
        action="store_true",
        help="Run official batch/parallel API test (list inputs, non_streaming_mode=True)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=None,
        help="Override auto GPU-tuned batch size for --batch-test",
    )
    parser.add_argument(
        "--batch-items",
        type=int,
        default=None,
        help="Number of sample texts for --batch-test (default: 2x batch size, min 4)",
    )
    parser.add_argument("--model", default=None, help="HF model id or local weights path")
    parser.add_argument("--device", default="auto", help="cpu | cuda:0 | auto")
    parser.add_argument("--lang", default="en", help="Language code (en, zh, ja, ko, ...)")
    parser.add_argument("--text", default=None, help="Text to synthesize")
    parser.add_argument(
        "--output",
        default=None,
        help="Output path (.wav for direct test, .mp3 for --engine)",
    )
    parser.add_argument("--port", type=int, default=None, help="Web UI port (default: auto)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser tab")

    args = parser.parse_args()

    if args.import_only:
        ok = check_import(verbose=True)
        sys.exit(0 if ok else 1)

    if args.verify_weights:
        weights = _load_weights_module()
        ok, _, _ = weights.audit_local_weights(verbose=True)
        if not ok:
            _print_redownload_hints()
        sys.exit(0 if ok else 1)

    if args.engine:
        out = Path(args.output) if args.output else None
        ok = test_engine(text=args.text, lang=args.lang, output_mp3=out)
        sys.exit(0 if ok else 1)

    if args.batch_test:
        out_dir = Path(args.output) if args.output else None
        ok = test_batch(
            model_name=args.model,
            lang=args.lang,
            device=args.device,
            batch_size=args.batch_size,
            batch_items=args.batch_items,
            output_dir=out_dir,
        )
        sys.exit(0 if ok else 1)

    has_direct_flags = any([
        args.model,
        args.text,
        args.output,
        args.device != "auto",
        args.lang != "en",
    ])
    if has_direct_flags:
        out = Path(args.output) if args.output else None
        ok = test_synthesis(
            model_name=args.model,
            text=args.text,
            lang=args.lang,
            device=args.device,
            output_wav=out,
        )
        sys.exit(0 if ok else 1)

    run_web_ui(port=args.port, open_browser=not args.no_browser)


if __name__ == "__main__":
    main()
