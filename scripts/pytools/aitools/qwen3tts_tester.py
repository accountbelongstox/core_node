#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Qwen3-TTS Web UI tester (pycore-backed).

qwen-tts hard-pins transformers==4.57.3, which conflicts with this (main)
interpreter's transformers==4.46.x (parler-tts pin). So qwen-tts is NEVER imported
here; the tester launches the official HTTP api server (qwen3tts_api_server.py) in
the DEDICATED venv (pycore.pyutils.tts.qwen3tts_venv) and talks to it over HTTP via
pycore.pyutils.tts.qwen3tts_service. The subprocess stdout (model loading) streams
to this console, and every HTTP request/response is logged in full.

Run with no arguments to open a local browser UI: upload or paste text from any
file, synthesize speech through the isolated server, and play the result inline.

Optional CLI diagnostics:
  python qwen3tts_tester.py --import-only      # isolated venv availability
  python qwen3tts_tester.py --verify-weights   # local weights integrity
  python qwen3tts_tester.py --text "Hello" --lang en
  python qwen3tts_tester.py --engine --lang en
  python qwen3tts_tester.py --batch-test --lang en --batch-items 8

Batch / parallel generation uses the official list API (non_streaming_mode=True),
auto-tuned server-side from GPU VRAM; override with --batch-size or env
QWEN3TTS_MAX_PARALLEL. Docs:
  https://qwenlm-qwen3-tts.mintlify.app/guides/batch-processing
"""

import argparse
import base64
import json
import mimetypes
import os
import socket
import sys
import threading
import time
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
DEFAULT_TEXT_ZH = "Hello, this is a Qwen3-TTS validation sample for Chinese mode."

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
_service_lock = threading.Lock()
_service: Any = None


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


def _load_service_module():
    _bootstrap_cache_env()
    _ensure_project_paths()
    from pycore.pyutils.tts import qwen3tts_service
    return qwen3tts_service


def _service_output(line: str) -> None:
    """Stream a raw line from the isolated api-server subprocess to the console."""
    print(f"[qwen3tts-server] {line}")


def _service_log(msg: str) -> None:
    print(msg)


def _get_service():
    """Lazily build the shared Qwen3-TTS service client (subprocess in isolated venv)."""
    global _service
    with _service_lock:
        if _service is not None:
            return _service
        svc_mod = _load_service_module()
        weights = _load_weights_module()
        model_id = weights.resolve_model_id()
        device = (os.environ.get("QWEN3TTS_DEVICE") or "").strip() or None
        env_port = (os.environ.get("QWEN3TTS_PORT") or "").strip()
        _service = svc_mod.Qwen3TtsService(
            host=(os.environ.get("QWEN3TTS_HOST") or "127.0.0.1").strip() or "127.0.0.1",
            port=int(env_port) if env_port.isdigit() else None,
            model_id=model_id,
            device=device,
            on_output=_service_output,
            log=_service_log,
        )
        return _service


def _load_weights_module():
    _bootstrap_cache_env()
    _ensure_project_paths()
    from pycore.pyutils.tts import qwen3tts_weights
    return qwen3tts_weights


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
    """qwen-tts pins transformers==4.57.3 and cannot be imported in this (main)
    interpreter, so readiness is the isolated venv, not an in-process import."""
    _bootstrap_cache_env()
    _ensure_project_paths()
    from pycore.pyutils.tts import qwen3tts_venv
    py = qwen3tts_venv.resolve_python()
    ready = py is not None

    if verbose:
        print("[CHECK] isolated Qwen3-TTS venv:", "OK" if ready else "missing")
        if ready:
            print(f"[CHECK] venv python: {py}")
            print(f"[CHECK] api server:  {_get_service().api_server_path()}")
        else:
            print("[HINT]  qwen-tts requires transformers==4.57.3, which conflicts with")
            print("[HINT]  the main interpreter's transformers==4.46.x (parler-tts pin).")
            print("[HINT]  It runs in a DEDICATED venv - provision it with:")
            print("[HINT]    scripts/shells/win/install_powershells/Step61_InstallQwen3Tts.ps1")
            print("[HINT]    scripts/shells/linux/debian/install_shells/140_install_qwen3tts.sh")

    return ready


def _print_redownload_hints(model_id: str | None = None) -> None:
    weights = _load_weights_module()
    print()
    for line in weights.redownload_hint_lines(model_id):
        print(line)


def _engine_status() -> Dict[str, Any]:
    svc_mod = _load_service_module()
    weights = _load_weights_module()
    params = _load_tts_params()
    model_id = weights.resolve_model_id()
    weights_ok, _, weight_detail = weights.audit_local_weights(verbose=False)
    venv_ready = svc_mod.venv_ready()

    svc = _get_service()
    health = svc.health() if svc.port else None
    server_running = health is not None
    model_loaded = bool((health or {}).get("model_loaded"))
    device = (health or {}).get("device") or (os.environ.get("QWEN3TTS_DEVICE") or "auto")
    last_error = (health or {}).get("load_error")

    return {
        "package_available": venv_ready,
        "engine_available": venv_ready,
        "server_running": server_running,
        "model_loaded": model_loaded,
        "model_id": model_id,
        "device": device,
        "cuda_available": str(device).lower().startswith("cuda"),
        "weights_ok": weights_ok,
        "weights_detail": weight_detail,
        "last_error": last_error,
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


def _generate_via_service(
    text: str,
    language: str,
    speaker: str,
    instruct: str,
    output_wav: Path,
) -> Tuple[bool, Optional[str]]:
    """Synthesize through the isolated Qwen3-TTS api-server subprocess over HTTP and
    write the returned WAV bytes. All HTTP request/response detail is logged by the
    service; the model-loading process streams from the subprocess to the console."""
    svc = _get_service()
    if not svc.is_running():
        if not svc.start(wait_healthy=True, timeout=180.0):
            return False, "Qwen3-TTS isolated api server failed to start (see console log)."

    lang_code = (language or "en").strip().lower()[:2]
    picked_speaker = (speaker or "").strip() or _default_speaker(lang_code)
    ok, audio, meta = svc.synthesize(
        text=text,
        language=language or "en",
        speaker=picked_speaker,
        instruct=instruct,
        fmt="wav",
    )
    if not ok or not audio:
        err_text = str(meta.get("error") or "Qwen3-TTS synthesis failed")
        if "incomplete metadata" in err_text.lower() or "safetensor" in err_text.lower():
            _print_redownload_hints()
        return False, err_text

    output_wav.parent.mkdir(parents=True, exist_ok=True)
    output_wav.write_bytes(audio)
    if output_wav.exists() and output_wav.stat().st_size > 0:
        return True, None
    return False, "Qwen3-TTS wrote an empty audio file"


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

    sample = _normalize_job_text(text, language)
    out_dir = _output_root()
    stamp = int(time.time() * 1000)
    out_path = out_dir / f"qwen3tts_{stamp}_{job_id[:8]}.wav"

    t0 = time.monotonic()
    ok, error = _generate_via_service(
        sample,
        language or "en",
        speaker,
        instruct,
        out_path,
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

        if ok:
            job["status"] = "done"
            job["audio_name"] = out_path.name
            job["bytes"] = out_path.stat().st_size
            job["error"] = None
            return

        job["status"] = "error"
        job["error"] = error or "Synthesis failed"
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
        pill(STATUS.package_available, STATUS.package_available ? "venv OK" : "venv missing"),
        pill(STATUS.server_running, STATUS.server_running ? "server up" : "server down"),
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
    svc = _get_service()

    print()
    print("[INFO] Qwen3-TTS Web UI (pycore)")
    print(f"[INFO] URL: {url}")
    print(f"[INFO] Output dir: {_output_root()}")
    weights = _load_weights_module()
    from pycore.pyutils.tts import qwen3tts_venv as _qv
    print(f"[INFO] Model:   {weights.resolve_model_id()}")
    print(f"[INFO] Venv:    {_qv.venv_dir()} "
          f"({'ready' if _qv.venv_ready() else 'will build with --system-site-packages on start'})")
    print("[INFO] Starting isolated Qwen3-TTS api server (model loading streams below)...")
    print("[INFO] Press Ctrl+C to stop.")
    print()

    started = svc.start(wait_healthy=True, timeout=180.0)
    if started:
        # Warm the model now so the loading process is visible before the first synth.
        threading.Thread(
            target=lambda: svc.load_model(timeout=1800.0),
            name="Qwen3TtsWarmup",
            daemon=True,
        ).start()
    else:
        print("[WARN] Isolated api server did not start; synthesis will report the reason.")

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
        svc.stop()


def test_synthesis(
    model_name: str | None = None,
    text: str | None = None,
    lang: str = "en",
    device: str = "auto",
    output_wav: Path | None = None,
) -> bool:
    """Single-shot CLI synthesis through the isolated api-server subprocess."""
    if not check_import(verbose=True):
        return False

    weights = _load_weights_module()
    _load_hf_secret()()

    model_id = (model_name or "").strip() or weights.resolve_model_id()
    sample_text = (text or "").strip()
    if not sample_text:
        sample_text = DEFAULT_TEXT_ZH if lang.lower().startswith("zh") else DEFAULT_TEXT_EN

    lang_code = (lang or "en").strip().lower()[:2]
    speaker = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip() or _default_speaker(lang_code)
    instruct = (os.environ.get("QWEN3TTS_INSTRUCT") or "").strip()
    out_path = output_wav or (Path.cwd() / "qwen3tts_test.wav")

    svc = _get_service()
    if (model_name or "").strip():
        svc.model_id = model_name.strip()
    if device and device.strip().lower() != "auto":
        svc.device = device.strip()

    print()
    print(f"[INFO] Model:   {svc.model_id or model_id}")
    print(f"[INFO] Device:  {svc.device or 'auto'}")
    print(f"[INFO] Lang:    {lang} (speaker={speaker})")
    print(f"[INFO] Text:    {sample_text}")
    print(f"[INFO] Output:  {out_path}")
    if instruct:
        print(f"[INFO] Instruct: {instruct}")
    print()

    print("[RUN] Starting isolated api server (model loading streams below)...")
    if not svc.start(wait_healthy=True, timeout=180.0):
        print("[ERROR] Isolated Qwen3-TTS api server failed to start.")
        return False

    print("[RUN] Generating speech...")
    ok, error = _generate_via_service(sample_text, lang, speaker, instruct, out_path)
    svc.stop()

    if ok:
        print(f"[OK] Wrote {out_path}")
        print()
        print("[SUCCESS] ========================================")
        print("[SUCCESS]   Qwen3-TTS synthesis test passed")
        print("[SUCCESS] ========================================")
        return True

    print(f"[ERROR] Synthesis test failed: {error}")
    return False


def test_batch(
    model_name: str | None = None,
    lang: str = "en",
    device: str = "auto",
    batch_size: int | None = None,
    batch_items: int | None = None,
    output_dir: Path | None = None,
) -> bool:
    """Batch / parallel synthesis via the isolated api server (/synthesize_batch).
    Max parallel is auto-tuned server-side from GPU VRAM; override with --batch-size
    (forwarded as QWEN3TTS_MAX_PARALLEL) or env."""
    if not check_import(verbose=True):
        return False

    weights = _load_weights_module()
    _load_hf_secret()()
    model_id = (model_name or "").strip() or weights.resolve_model_id()

    lang_code = (lang or "en").strip().lower()[:2]
    n = batch_items if (batch_items and batch_items > 0) else max(4, (batch_size or 4))
    combos = [("us", "female"), ("uk", "female"), ("us", "male"), ("uk", "male")]
    variants = [
        {"key": f"v{i}", "accent": combos[i % len(combos)][0], "gender": combos[i % len(combos)][1]}
        for i in range(n)
    ]
    sample_text = DEFAULT_TEXT_ZH if lang_code == "zh" else DEFAULT_TEXT_EN
    out_dir = output_dir or (Path.cwd() / "qwen3tts_batch_out")
    out_dir.mkdir(parents=True, exist_ok=True)

    svc = _get_service()
    if (model_name or "").strip():
        svc.model_id = model_name.strip()
    if device and device.strip().lower() != "auto":
        svc.device = device.strip()
    if batch_size and batch_size > 0:
        os.environ["QWEN3TTS_MAX_PARALLEL"] = str(batch_size)

    print()
    print(f"[INFO] Model:    {svc.model_id or model_id}")
    print(f"[INFO] Variants: {n}")
    print(f"[INFO] Output:   {out_dir}")
    print()
    print("[RUN] Starting isolated api server (model loading streams below)...")
    if not svc.start(wait_healthy=True, timeout=180.0):
        print("[ERROR] Isolated Qwen3-TTS api server failed to start.")
        return False

    ok, results, meta = svc.synthesize_batch(sample_text, lang, variants, fmt="wav")
    svc.stop()
    if not ok:
        print(f"[ERROR] Batch test failed: {meta.get('error')}")
        return False

    written = 0
    for item in results:
        if not item or not item.get("ok") or not item.get("audio_base64"):
            print(f"[WARN] variant {(item or {}).get('key', '?')} failed: {(item or {}).get('error')}")
            continue
        data = base64.b64decode(item["audio_base64"])
        dest = out_dir / f"qwen3tts_batch_{item['key']}.wav"
        dest.write_bytes(data)
        written += 1
        print(f"[OK] {dest} ({len(data)} bytes)")

    print(f"[INFO] Batch done in {meta.get('elapsed_ms')} ms; {written}/{n} written")
    return written > 0


def test_engine(
    text: str | None = None,
    lang: str = "en",
    output_mp3: Path | None = None,
) -> bool:
    """Synthesis through the isolated api server, matching what the pycore engine
    resolves to (qwen-tts cannot be imported in this interpreter)."""
    if not check_import(verbose=True):
        return False

    sample_text = (text or DEFAULT_TEXT_EN).strip()
    out_path = output_mp3 or (Path.cwd() / "qwen3tts_engine_test.wav")
    fmt = "wav" if out_path.suffix.lower() == ".wav" else "mp3"
    lang_code = (lang or "en").strip().lower()[:2]
    speaker = (os.environ.get("QWEN3TTS_SPEAKER") or "").strip() or _default_speaker(lang_code)
    instruct = (os.environ.get("QWEN3TTS_INSTRUCT") or "").strip()

    svc = _get_service()
    print()
    print(f"[INFO] Isolated venv ready: {_load_service_module().venv_ready()}")
    print(f"[INFO] Text:   {sample_text}")
    print(f"[INFO] Output: {out_path} (format={fmt})")
    if fmt == "mp3":
        print("[INFO] mp3 output needs ffmpeg in the venv; use a .wav output to avoid it.")
    print()

    print("[RUN] Starting isolated api server (model loading streams below)...")
    if not svc.start(wait_healthy=True, timeout=180.0):
        print("[ERROR] Isolated Qwen3-TTS api server failed to start.")
        return False

    ok, audio, meta = svc.synthesize(sample_text, lang, speaker, instruct, fmt=fmt)
    svc.stop()
    if ok and audio:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(audio)
        print(f"[OK] Engine wrote {out_path} ({len(audio)} bytes)")
        print("[SUCCESS] Qwen3-TTS (isolated) synthesis passed")
        return True

    err = str(meta.get("error") or "unknown error")
    print(f"[ERROR] Engine synthesis failed: {err}")
    if "incomplete metadata" in err.lower() or "safetensor" in err.lower():
        _print_redownload_hints()
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Qwen3-TTS Web UI and synthesis tester")
    parser.add_argument(
        "--import-only",
        action="store_true",
        help="Only check the isolated Qwen3-TTS venv availability",
    )
    parser.add_argument(
        "--verify-weights",
        action="store_true",
        help="Audit local D:/www/cache/pycore/qwen3tts/weights integrity",
    )
    parser.add_argument(
        "--engine",
        action="store_true",
        help="Synthesize via the isolated api server (what the pycore engine resolves to)",
    )
    parser.add_argument(
        "--batch-test",
        action="store_true",
        help="Run batch/parallel synthesis via the isolated api server (/synthesize_batch)",
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
        help="Output path; .wav (no ffmpeg) or .mp3 (needs ffmpeg in the venv)",
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
