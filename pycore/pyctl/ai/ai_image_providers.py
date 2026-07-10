#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai_image_providers - the 16 text->image provider helpers + size helpers.

Each ``_generate_image_with_*`` helper turns a prompt + size + model into an
image (writing the unified IMAGE contract into the shared ``out`` dict), self-
checking its key so a keyless provider falls through cheaply with no network
call. The orchestrator facade (ai_gateway.generate_image) orders + fallback-runs
them via ``_IMAGE_DISPATCH`` (free-first by ``_IMAGE_PREFERENCE``) with a hard
per-provider time bound.

NOTE: the zhipuai cogview provider uses model "cogview-3" (NOT cogview-3-flash) -
preserve that exactly; cogview-3 is the free tier entry.

Signers (Spark HMAC / Bedrock SigV4 / Vertex OAuth) live in ai_image_signers;
the image HTTP timeout lives in ai_gateway_state.

TODO (deferred reuse batch): merge the 6 OpenAI-compatible image helpers
(openai / openrouter / stepfun / qianfan / siliconflow / volcano) with
ai_compat_helpers into a shared OpenAI-images client.
"""

import base64
import json
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote

from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.ai_cluster.gemini.gemini_client import GeminiClient
from pycore.pyctl.ai.ai_keys import (
    base_url, extra_secret, image_first_secret, image_model,
)
from pycore.pyctl.ai.ai_gateway_state import _IMG_HTTP_TIMEOUT
from pycore.pyctl.ai.ai_image_signers import (
    _spark_tti_signed_url, _aws_sigv4_headers, _vertex_access_token,
)

# Gemini image models size by aspect ratio ("1:1", "16:9"…), not pixels; any
# other ``size`` value is ignored and the model default applies.
_ASPECT_RATIO_RE = re.compile(r"^\d{1,2}:\d{1,2}$")


def _orientation(aspect: Optional[str]) -> str:
    """Square / landscape / portrait from the gateway aspect shape ('W:H')."""
    if not aspect or not _ASPECT_RATIO_RE.match(aspect):
        return "square"
    w, h = aspect.split(":")
    try:
        wi, hi = int(w), int(h)
    except ValueError:
        return "square"
    if wi == hi:
        return "square"
    return "landscape" if wi > hi else "portrait"


# Per-provider pixel-size menus. Each image API accepts only a fixed set of
# sizes (and DashScope uses 'W*H', not 'W x H'); map the requested aspect to the
# provider's nearest supported size.
_IMAGE_SIZES = {
    "openai":    {"square": "1024x1024", "landscape": "1792x1024", "portrait": "1024x1792"},
    "zhipuai":   {"square": "1024x1024", "landscape": "1344x768",  "portrait": "768x1344"},
    "dashscope": {"square": "1024*1024", "landscape": "1280*720",  "portrait": "720*1280"},
    "stepfun":   {"square": "1024x1024", "landscape": "1280x800",  "portrait": "800x1280"},
    "qianfan":   {"square": "1024x1024", "landscape": "1024x768",  "portrait": "768x1024"},
    "siliconflow": {"square": "1024x1024", "landscape": "1280x960", "portrait": "960x1280"},
}

# Spark's tti body takes width/height as separate ints (allowed menu), not a
# size string - keep its own orientation map.
_SPARK_SIZES = {"square": (1024, 1024), "landscape": (1280, 720), "portrait": (720, 1280)}


def _provider_image_size(provider: str, aspect: Optional[str]) -> str:
    """Nearest provider-supported pixel size for the requested aspect."""
    return _IMAGE_SIZES[provider][_orientation(aspect)]


def _fetch_image_b64(url: str) -> Tuple[str, str]:
    """Download an image URL (providers that return a URL, not inline base64)
    and return (base64, mime). Returns ('', '') on any failure."""
    if not url:
        return "", ""
    requests = get_third_package_requests()
    resp = requests.get(url, timeout=_IMG_HTTP_TIMEOUT)
    if resp.status_code != 200 or not resp.content:
        return "", ""
    mime = (resp.headers.get("Content-Type") or "image/png").split(";")[0].strip() or "image/png"
    return base64.b64encode(resp.content).decode("ascii"), mime


def _generate_image_with_gemini(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    key = image_first_secret("gemini")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("gemini")
    out["model"] = use_model
    aspect = size if (size and _ASPECT_RATIO_RE.match(size)) else None
    client = GeminiClient(api_key=key, default_model=use_model)
    res = client.generate_image(prompt=prompt, model=use_model, aspect_ratio=aspect)
    if res.get("success") and res.get("image_base64"):
        out["success"] = True
        out["image_base64"] = res["image_base64"]
        out["mime"] = res.get("mime_type") or "image/png"
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def _generate_image_with_openai(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """OpenAI Images API backup (POST /v1/images/generations -> b64_json)."""
    key = image_first_secret("openai")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("openai") or "dall-e-3"
    out["model"] = use_model
    requests = get_third_package_requests()
    body: Dict[str, Any] = {"model": use_model, "prompt": prompt, "n": 1,
                            "size": _provider_image_size("openai", size)}
    # gpt-image-1 always returns b64_json and REJECTS response_format; only the
    # dall-e-* models accept (and need) it to return base64 instead of a URL.
    if use_model.startswith("dall-e"):
        body["response_format"] = "b64_json"
    # Honor a custom OpenAI-compatible base (OPENAI_BASE_URL) - many deployments
    # route "openai" through a proxy whose key is NOT valid on api.openai.com;
    # default to the real API otherwise.
    api = (get_secret_key_indexed("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=body, timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    b64 = data[0].get("b64_json") if data else None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_openrouter(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """OpenRouter image backup - chat completions with modalities:['image','text'];
    the chosen image model returns an inline data-URI we decode to base64."""
    key = image_first_secret("openrouter")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("openrouter") or "google/gemini-2.5-flash-image"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("openrouter") or "https://openrouter.ai/api/v1"
    resp = requests.post(
        f"{api}/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model,
              "messages": [{"role": "user", "content": prompt}],
              "modalities": ["image", "text"]},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    msg = (((resp.json() or {}).get("choices") or [{}])[0]).get("message") or {}
    images = msg.get("images") or []
    url = (images[0].get("image_url") or {}).get("url", "") if images else ""
    if url.startswith("data:"):
        head, _, b64 = url.partition(",")
        if b64:
            out["success"] = True
            out["image_base64"] = b64
            out["mime"] = head[5:].split(";")[0] or "image/png"
            return out
    out["error"] = "Empty image response from provider"
    return out


def _generate_image_with_zhipuai(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Zhipu BigModel image backup - cogview-3 is FREE. Sync POST to
    /api/paas/v4/images/generations; the response carries an image URL."""
    key = image_first_secret("zhipuai")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("zhipuai") or "cogview-3"
    out["model"] = use_model
    requests = get_third_package_requests()
    resp = requests.post(
        "https://open.bigmodel.cn/api/paas/v4/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt,
              "size": _provider_image_size("zhipuai", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    url = data[0].get("url") if data else ""
    b64, mime = _fetch_image_b64(url)
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = mime
    else:
        out["error"] = "Empty / unfetchable image response from provider"
    return out


def _generate_image_with_dashscope(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Alibaba DashScope Tongyi-Wanxiang image backup (free-trial quota). ASYNC:
    submit a synthesis task, then poll /tasks/{id} until SUCCEEDED for the URL."""
    key = image_first_secret("dashscope")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("dashscope") or "wanx2.1-t2i-turbo"
    out["model"] = use_model
    requests = get_third_package_requests()
    submit = requests.post(
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "X-DashScope-Async": "enable"},
        json={"model": use_model, "input": {"prompt": prompt},
              "parameters": {"size": _provider_image_size("dashscope", size), "n": 1}},
        timeout=30,
    )
    if submit.status_code != 200:
        out["error"] = f"HTTP {submit.status_code}: {submit.text[:200]}"
        return out
    task_id = ((submit.json() or {}).get("output") or {}).get("task_id")
    if not task_id:
        out["error"] = "no task_id returned"
        return out
    # Poll (capped) - DashScope text-to-image is async; this is a low-preference
    # backup so the bounded wait rarely runs.
    deadline = time.time() + 45
    while time.time() < deadline:
        time.sleep(3)
        poll = requests.get(
            f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}",
            headers={"Authorization": f"Bearer {key}"}, timeout=20)
        if poll.status_code != 200:
            continue
        output = (poll.json() or {}).get("output") or {}
        status = output.get("task_status")
        if status == "SUCCEEDED":
            results = output.get("results") or []
            b64, mime = _fetch_image_b64(results[0].get("url") if results else "")
            if b64:
                out["success"] = True
                out["image_base64"] = b64
                out["mime"] = mime
            else:
                out["error"] = "task succeeded but image url missing/unfetchable"
            return out
        if status == "FAILED":
            out["error"] = output.get("message") or "synthesis task failed"
            return out
    out["error"] = "image synthesis task timed out"
    return out


def _generate_image_with_stepfun(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """StepFun image backup (paid, OpenAI-compatible /images/generations)."""
    key = image_first_secret("stepfun")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("stepfun") or "step-1x-medium"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("stepfun") or "https://api.stepfun.com/v1"
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt, "response_format": "b64_json",
              "size": _provider_image_size("stepfun", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    entry = data[0] if data else {}
    b64 = entry.get("b64_json")
    if not b64 and entry.get("url"):
        b64, mime = _fetch_image_b64(entry["url"])
        if b64:
            out["success"] = True
            out["image_base64"] = b64
            out["mime"] = mime
            return out
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_qianfan(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Baidu Qianfan ERNIE iRAG image backup (bearer, OpenAI-style
    /v2/images/generations; the response carries an image URL)."""
    key = image_first_secret("qianfan")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("qianfan") or "irag-1.0"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("qianfan") or "https://qianfan.baidubce.com/v2"
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt,
              "size": _provider_image_size("qianfan", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    b64, mime = _fetch_image_b64(data[0].get("url") if data else "")
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = mime
    else:
        out["error"] = "Empty / unfetchable image response from provider"
    return out


def _generate_image_with_spark(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """iFlytek Spark image backup (free 5000-point quota). Uses the
    APP_ID/API_KEY/API_SECRET triple (NOT the chat api_password); base64 image is
    returned inline in payload.choices.text."""
    app_id = get_secret_key_indexed("SPARK_APP_ID")
    api_key = get_secret_key_indexed("SPARK_API_KEY")
    api_secret = get_secret_key_indexed("SPARK_API_SECRET")
    if not (app_id and api_key and api_secret):
        out["error"] = "Spark image needs SPARK_APP_ID / SPARK_API_KEY / SPARK_API_SECRET"
        return out
    out["model"] = model or image_model("spark") or "spark-tti-v2.1"
    width, height = _SPARK_SIZES[_orientation(size)]
    requests = get_third_package_requests()
    resp = requests.post(
        _spark_tti_signed_url(api_key, api_secret),
        json={"header": {"app_id": app_id},
              "parameter": {"chat": {"domain": "general", "width": width, "height": height}},
              "payload": {"message": {"text": [{"role": "user", "content": prompt}]}}},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    body = resp.json() or {}
    header = body.get("header") or {}
    if header.get("code", 0) != 0:
        out["error"] = f"spark code {header.get('code')}: {header.get('message')}"
        return out
    texts = ((body.get("payload") or {}).get("choices") or {}).get("text") or []
    b64 = texts[0].get("content") if texts else ""
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_cloudflare(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Cloudflare Workers AI image backup (free neuron budget). SDXL returns raw
    PNG bytes from POST .../accounts/{id}/ai/run/{model}."""
    token = image_first_secret("cloudflare")
    account = extra_secret("cloudflare")  # CLOUDFLARE_ACCOUNT_ID
    if not token or not account:
        out["error"] = "Cloudflare needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID"
        return out
    use_model = model or image_model("cloudflare") or "@cf/stabilityai/stable-diffusion-xl-base-1.0"
    out["model"] = use_model
    requests = get_third_package_requests()
    resp = requests.post(
        f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{use_model}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"prompt": prompt}, timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    ctype = (resp.headers.get("Content-Type") or "").lower()
    if ctype.startswith("image/"):
        out["success"] = True
        out["image_base64"] = base64.b64encode(resp.content).decode("ascii")
        out["mime"] = ctype.split(";")[0]
        return out
    # Some Workers AI image models return JSON {result:{image:<b64>}} instead.
    try:
        b64 = ((resp.json() or {}).get("result") or {}).get("image")
    except Exception:  # noqa: BLE001
        b64 = None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty / unknown response from provider"
    return out


def _generate_image_with_siliconflow(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """SiliconFlow image backup (aggregates Kolors/FLUX/SDXL; very low cost).
    OpenAI-style /images/generations returning an image URL."""
    key = image_first_secret("siliconflow")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("siliconflow") or "Kwai-Kolors/Kolors"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("siliconflow") or "https://api.siliconflow.cn/v1"
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt,
              "image_size": _provider_image_size("siliconflow", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = resp.json() or {}
    imgs = data.get("images") or data.get("data") or []
    url = imgs[0].get("url", "") if imgs and isinstance(imgs[0], dict) else ""
    b64, mime = _fetch_image_b64(url)
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = mime
    else:
        out["error"] = "Empty / unfetchable image response from provider"
    return out


def _generate_image_with_pollinations(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Pollinations.ai - FREE, NO API KEY. GET the prompt URL -> image bytes."""
    use_model = model or image_model("pollinations") or "flux"
    out["model"] = use_model
    requests = get_third_package_requests()
    width, height = _SPARK_SIZES[_orientation(size)]
    url = (f"https://image.pollinations.ai/prompt/{quote(prompt[:1500])}"
           f"?width={width}&height={height}&model={use_model}&nologo=true")
    resp = requests.get(url, timeout=_IMG_HTTP_TIMEOUT)
    if resp.status_code != 200 or not resp.content:
        out["error"] = f"HTTP {resp.status_code}"
        return out
    ctype = (resp.headers.get("Content-Type") or "image/jpeg").split(";")[0].strip()
    if not ctype.startswith("image/"):
        out["error"] = f"non-image response ({ctype})"
        return out
    out["success"] = True
    out["image_base64"] = base64.b64encode(resp.content).decode("ascii")
    out["mime"] = ctype
    return out


def _generate_image_with_imagen(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Google Imagen 4 via the Gemini API key (generativelanguage :predict).

    Imagen 3 (imagen-3.0-generate-002) was SHUT DOWN on the Gemini API (returns
    HTTP 404 "not found for API version v1beta / not supported for predict"), so
    the default is the current GA model imagen-4.0-generate-001. Other valid IDs:
    imagen-4.0-fast-generate-001, imagen-4.0-ultra-generate-001.
    """
    key = image_first_secret("imagen")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("imagen") or "imagen-4.0-generate-001"
    out["model"] = use_model
    requests = get_third_package_requests()
    aspect = size if (size and _ASPECT_RATIO_RE.match(size)) else "1:1"
    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{use_model}:predict?key={key}",
        headers={"Content-Type": "application/json"},
        json={"instances": [{"prompt": prompt}],
              "parameters": {"sampleCount": 1, "aspectRatio": aspect}},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    preds = (resp.json() or {}).get("predictions") or []
    b64 = preds[0].get("bytesBase64Encoded") if preds else None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = preds[0].get("mimeType") or "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_azure(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Azure OpenAI DALL-E 3 (api-key header; endpoint + deployment from secrets)."""
    key = image_first_secret("azure")
    endpoint = (extra_secret("azure", "AZURE_OPENAI_ENDPOINT") or "").rstrip("/")
    if not key or not endpoint:
        out["error"] = "Azure needs AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT"
        return out
    deployment = (extra_secret("azure", "AZURE_OPENAI_IMAGE_DEPLOYMENT")
                  or model or image_model("azure") or "dall-e-3")
    out["model"] = deployment
    requests = get_third_package_requests()
    resp = requests.post(
        f"{endpoint}/openai/deployments/{deployment}/images/generations?api-version=2024-02-01",
        headers={"api-key": key, "Content-Type": "application/json"},
        json={"prompt": prompt, "n": 1, "size": _provider_image_size("openai", size)},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    entry = data[0] if data else {}
    b64 = entry.get("b64_json")
    if not b64 and entry.get("url"):
        b64, mime = _fetch_image_b64(entry["url"])
        if b64:
            out["success"] = True
            out["image_base64"] = b64
            out["mime"] = mime
            return out
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


def _generate_image_with_volcano(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """ByteDance Doubao Seedream via Volcano Ark (OpenAI-style /images/generations)."""
    key = image_first_secret("volcano")
    if not key:
        out["error"] = "No API key configured"
        return out
    use_model = model or image_model("volcano") or "doubao-seedream-3-0-t2i-250415"
    out["model"] = use_model
    requests = get_third_package_requests()
    api = base_url("volcano") or "https://ark.cn-beijing.volces.com/api/v3"
    resp = requests.post(
        f"{api}/images/generations",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": use_model, "prompt": prompt,
              "size": _provider_image_size("openai", size), "response_format": "url"},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    data = (resp.json() or {}).get("data") or []
    entry = data[0] if data else {}
    if entry.get("b64_json"):
        out["success"] = True
        out["image_base64"] = entry["b64_json"]
        out["mime"] = "image/png"
        return out
    b64, mime = _fetch_image_b64(entry.get("url", ""))
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = mime
    else:
        out["error"] = "Empty / unfetchable image response from provider"
    return out


def _generate_image_with_bedrock(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """AWS Bedrock Titan Image Generator (SigV4-signed invoke)."""
    access_key = image_first_secret("bedrock")  # AWS_ACCESS_KEY_ID
    secret_key = extra_secret("bedrock", "AWS_SECRET_ACCESS_KEY")
    if not access_key or not secret_key:
        out["error"] = "Bedrock needs AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY"
        return out
    region = extra_secret("bedrock", "AWS_REGION") or "us-east-1"
    use_model = model or image_model("bedrock") or "amazon.titan-image-generator-v1"
    out["model"] = use_model
    width, height = _SPARK_SIZES[_orientation(size)]
    body = json.dumps({
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {"text": prompt[:512]},
        "imageGenerationConfig": {"numberOfImages": 1, "width": width, "height": height},
    }).encode("utf-8")
    host = f"bedrock-runtime.{region}.amazonaws.com"
    path = f"/model/{quote(use_model, safe='')}/invoke"
    now = datetime.now(timezone.utc)
    headers = _aws_sigv4_headers(
        access_key, secret_key, region, "bedrock", host, path, body,
        now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d"))
    requests = get_third_package_requests()
    resp = requests.post(f"https://{host}{path}", headers=headers, data=body, timeout=_IMG_HTTP_TIMEOUT)
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    payload = resp.json() or {}
    images = payload.get("images") or []
    if images:
        out["success"] = True
        out["image_base64"] = images[0]
        out["mime"] = "image/png"
    else:
        out["error"] = payload.get("error") or "Empty response from provider"
    return out


def _generate_image_with_vertex(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Google Vertex AI Imagen via SERVICE-ACCOUNT OAuth (true Vertex endpoint)."""
    sa_json = image_first_secret("vertex")
    project = extra_secret("vertex", "VERTEX_PROJECT_ID")
    if not sa_json or not project:
        out["error"] = "Vertex needs GOOGLE_VERTEX_SA_JSON + VERTEX_PROJECT_ID"
        return out
    region = extra_secret("vertex", "VERTEX_REGION") or "us-central1"
    use_model = model or image_model("vertex") or "imagen-3.0-generate-002"
    out["model"] = use_model
    token, err = _vertex_access_token(sa_json)
    if not token:
        out["error"] = err or "could not obtain access token"
        return out
    requests = get_third_package_requests()
    aspect = size if (size and _ASPECT_RATIO_RE.match(size)) else "1:1"
    url = (f"https://{region}-aiplatform.googleapis.com/v1/projects/{project}"
           f"/locations/{region}/publishers/google/models/{use_model}:predict")
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"instances": [{"prompt": prompt}],
              "parameters": {"sampleCount": 1, "aspectRatio": aspect}},
        timeout=_IMG_HTTP_TIMEOUT,
    )
    if resp.status_code != 200:
        out["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
        return out
    preds = (resp.json() or {}).get("predictions") or []
    b64 = preds[0].get("bytesBase64Encoded") if preds else None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = preds[0].get("mimeType") or "image/png"
    else:
        out["error"] = "Empty response from provider"
    return out


# Image-capable provider dispatch (each helper self-checks its key, so a keyless
# provider falls through cheaply with no network call).
_IMAGE_DISPATCH = {
    "gemini": _generate_image_with_gemini,
    "zhipuai": _generate_image_with_zhipuai,
    "dashscope": _generate_image_with_dashscope,
    "qianfan": _generate_image_with_qianfan,
    "cloudflare": _generate_image_with_cloudflare,
    "siliconflow": _generate_image_with_siliconflow,
    "volcano": _generate_image_with_volcano,
    "spark": _generate_image_with_spark,
    "pollinations": _generate_image_with_pollinations,
    "openrouter": _generate_image_with_openrouter,
    "openai": _generate_image_with_openai,
    "imagen": _generate_image_with_imagen,
    "azure": _generate_image_with_azure,
    "stepfun": _generate_image_with_stepfun,
    "bedrock": _generate_image_with_bedrock,
    "vertex": _generate_image_with_vertex,
}

# generate_image() preference: genuinely-FREE image backends first (gemini flash
# image, zhipu cogview-3, dashscope wanx free-trial, baidu iRAG, iFlytek
# Spark), then metered/paid ones. Lower rank = tried first; unknown sort last.
# Genuinely-FREE image backends FIRST. Google has NO free image model as of 2026:
# gemini-2.5-flash-image / Imagen 4 are PAID-only and the old free
# gemini-2.0-flash image preview was shut down 2026-06-01 (verified via
# ai.google.dev/gemini-api/docs/pricing). So the paid Google routes (gemini image,
# imagen, vertex) - plus openai/azure/stepfun/bedrock - sink BELOW the free ones;
# keyless Pollinations is the guaranteed free fallback. This makes "free-first"
# actually hold instead of burning the first slot on a gemini 429 every cycle.
_IMAGE_PREFERENCE = {
    "zhipuai": 0, "dashscope": 1, "qianfan": 2, "cloudflare": 3,
    "siliconflow": 4,
    "pollinations": 5,  # free + NO key -> reliable guaranteed fallback
    "gemini": 6, "openrouter": 7, "volcano": 8, "spark": 9,
    "imagen": 10, "azure": 11, "openai": 12, "stepfun": 13,
    "bedrock": 14, "vertex": 15,
}
