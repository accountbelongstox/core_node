#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai_image_providers - the text->image provider helpers + size helpers.

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

The OpenAI-style image providers (openai / zhipuai / stepfun / qianfan /
siliconflow / volcano / azure) share one images call on the OpenAI-compatible
client, driven by each provider's ``image_api`` registry quirks.
"""

import base64
import json
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyutils.ai_cluster.gemini.gemini_client import GeminiClient
from pycore.pyutils.ai_cluster.openai_compat.openai_compat_client import (
    CompatProfile,
    OpenAICompatClient,
)
from pycore.pyutils.common.ai_request_failures import paid_model_refused
from pycore.pyutils.common.http_client import HttpError, HttpResponse, RESPONSE_IMAGE, http_client, redacted_http_error
from pycore.pyctl.ai.ai_keys import (
    PROVIDERS, base_url, compat_client, extra_secret, image_first_secret, image_model,
)
from pycore.pyctl.ai.ai_gateway_state import _IMG_HTTP_TIMEOUT
from pycore.pyctl.ai.ai_image_signers import (
    _spark_tti_signed_url, _aws_sigv4_headers, _vertex_access_token,
)

ERROR_NO_KEY = "No API key configured"
ERROR_EMPTY = "Empty response from provider"
ERROR_EMPTY_IMAGE = "Empty image response from provider"
ERROR_UNFETCHABLE = "Empty / unfetchable image response from provider"
AZURE_IMAGE_API_VERSION = "2024-02-01"
DASHSCOPE_SYNTHESIS_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
DASHSCOPE_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"
DASHSCOPE_POLL_TIMEOUT_S = 20
DASHSCOPE_POLL_INTERVAL_S = 3
DASHSCOPE_POLL_BUDGET_S = 45

# Gemini image models size by aspect ratio ("1:1", "16:9"...), not pixels; any
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


# Spark / Bedrock / Pollinations take width/height ints, not a size string.
_SPARK_SIZES = {"square": (1024, 1024), "landscape": (1280, 720), "portrait": (720, 1280)}


def _provider_image_size(provider: str, aspect: Optional[str]) -> str:
    """Nearest provider-supported pixel size (``image_api.sizes``) for the aspect."""
    return PROVIDERS[provider]["image_api"]["sizes"][_orientation(aspect)]


def _http_failure(response: HttpResponse) -> str:
    return f"HTTP {response.status_code}: {response.text[:200]}"


def _send(provider: str, method: str, url: str, **options: Any) -> Tuple[Optional[HttpResponse], Optional[str]]:
    """One bespoke provider request; transport failures become an error value.
    A request with a body asks for a generation (``image`` response profile,
    bounded by the contract response wait)."""
    if any(options.get(name) is not None for name in ("json", "body", "form", "files")):
        options["response"] = RESPONSE_IMAGE
    else:
        options.setdefault("timeout", _IMG_HTTP_TIMEOUT)
    try:
        return http_client.request(method, url, **options), None
    except HttpError as exc:
        error = redacted_http_error(exc)
        ColorPrint.yellow(f"[ai_image] {provider} {method} failed: {error}")
        return None, error


def _apply(out: Dict[str, Any], res: Dict[str, Any]) -> Dict[str, Any]:
    if res.get("success"):
        out.update(success=True, image_base64=res["image_base64"], mime=res["mime"])
    else:
        out["error"] = res.get("error") or ERROR_EMPTY
    return out


def _generate_openai_style(
    provider: str, prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """OpenAI-style ``{base}/images/generations`` with the provider's ``image_api`` quirks."""
    key = image_first_secret(provider)
    if not key:
        out["error"] = ERROR_NO_KEY
        return out
    use_model = model or image_model(provider)
    out["model"] = use_model
    quirks = PROVIDERS[provider]["image_api"]
    response_format = quirks.get("response_format")
    prefix = quirks.get("b64_model_prefix")
    if prefix:
        # gpt-image-1 always returns b64 and rejects response_format; dall-e-* needs it.
        response_format = "b64_json" if use_model.startswith(prefix) else None
    secret_url = quirks.get("base_url_secret")
    custom_base = (get_secret_key_indexed(secret_url) or "").rstrip("/") if secret_url else ""
    return _apply(out, compat_client(provider, key).generate_image(
        use_model, prompt, _provider_image_size(provider, size),
        size_param=quirks.get("size_param", "size"),
        response_format=response_format,
        url=f"{custom_base}/images/generations" if custom_base else "",
        send_n=bool(quirks.get("send_n")),
        empty_error=quirks.get("empty_error") or ERROR_UNFETCHABLE,
        fetch_timeout=_IMG_HTTP_TIMEOUT,
    ))


def _generate_image_with_gemini(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    key = image_first_secret("gemini")
    if not key:
        out["error"] = ERROR_NO_KEY
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
    return _generate_openai_style("openai", prompt, size, model, out)


def _generate_image_with_openrouter(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Chat completions with modalities ['image', 'text'] on a FREE image-output
    model only; the model returns an inline data URI."""
    key = image_first_secret("openrouter")
    if not key:
        out["error"] = ERROR_NO_KEY
        return out
    client = compat_client("openrouter", key)
    use_model = model or image_model("openrouter")
    if use_model and not client.allows_model(use_model):
        return _coded_failure(out, use_model, paid_model_refused("openrouter", use_model))
    if not use_model:
        use_model, reason = client.free_image_model()
        if not use_model:
            return _coded_failure(out, "", reason)
    out["model"] = use_model
    bare = CompatProfile(
        provider="openrouter", base_url=base_url("openrouter"),
        chat_temperature=None, chat_max_tokens=None, error_style="http",
        no_choices_error=ERROR_EMPTY_IMAGE, empty_text_error=ERROR_EMPTY_IMAGE,
    )
    res = OpenAICompatClient(bare, key).chat(
        [{"role": "user", "content": prompt}], use_model,
        extra={"modalities": ["image", "text"]},
    )
    images = res["message"].get("images") or []
    url = str((images[0].get("image_url") or {}).get("url") or "") if images else ""
    head, _, b64 = url.partition(",")
    if url.startswith("data:") and b64:
        out.update(success=True, image_base64=b64, mime=head[5:].split(";")[0] or "image/png")
        return out
    out["error"] = res["error"] or ERROR_EMPTY_IMAGE
    return out


def _coded_failure(out: Dict[str, Any], model: str, reason: Any) -> Dict[str, Any]:
    """A refusal before any request: coded error (``error_code`` + params)."""
    out["model"] = model
    out["error"] = str(reason)
    out["error_code"] = getattr(reason, "code", None)
    out["error_params"] = dict(getattr(reason, "params", {}) or {})
    return out


def _generate_image_with_zhipuai(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    return _generate_openai_style("zhipuai", prompt, size, model, out)


def _generate_image_with_dashscope(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Tongyi Wanxiang (free-trial quota). ASYNC: submit a synthesis task, then
    poll the task until SUCCEEDED for the image URL."""
    key = image_first_secret("dashscope")
    if not key:
        out["error"] = ERROR_NO_KEY
        return out
    use_model = model or image_model("dashscope")
    out["model"] = use_model
    client = compat_client("dashscope", key)
    submit, error = _send(
        "dashscope", "POST", DASHSCOPE_SYNTHESIS_URL,
        headers={**client.headers(json_body=True), "X-DashScope-Async": "enable"},
        json={"model": use_model, "input": {"prompt": prompt},
              "parameters": {"size": _provider_image_size("dashscope", size), "n": 1}},
    )
    if submit is None or submit.status_code != 200:
        out["error"] = error or _http_failure(submit)
        return out
    task_id = ((submit.json() or {}).get("output") or {}).get("task_id")
    if not task_id:
        out["error"] = "no task_id returned"
        return out
    deadline = time.time() + DASHSCOPE_POLL_BUDGET_S
    while time.time() < deadline:
        time.sleep(DASHSCOPE_POLL_INTERVAL_S)
        data, _poll_error = client.get_json(
            DASHSCOPE_TASK_URL.format(task_id=task_id), timeout=DASHSCOPE_POLL_TIMEOUT_S,
        )
        output = (data or {}).get("output") or {}
        status = output.get("task_status")
        if status == "SUCCEEDED":
            results = output.get("results") or []
            b64, mime = client.fetch_image(results[0].get("url") if results else "", _IMG_HTTP_TIMEOUT)
            if b64:
                out.update(success=True, image_base64=b64, mime=mime)
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
    return _generate_openai_style("stepfun", prompt, size, model, out)


def _generate_image_with_qianfan(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    return _generate_openai_style("qianfan", prompt, size, model, out)


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
    resp, error = _send(
        "spark", "POST",
        _spark_tti_signed_url(api_key, api_secret),
        json={"header": {"app_id": app_id},
              "parameter": {"chat": {"domain": "general", "width": width, "height": height}},
              "payload": {"message": {"text": [{"role": "user", "content": prompt}]}}},
    )
    if resp is None or resp.status_code != 200:
        out["error"] = error or _http_failure(resp)
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
        out["error"] = ERROR_EMPTY
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
    resp, error = _send(
        "cloudflare", "POST",
        f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{use_model}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"prompt": prompt},
    )
    if resp is None or resp.status_code != 200:
        out["error"] = error or _http_failure(resp)
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
    except ValueError as exc:
        ColorPrint.yellow(f"[ai_image] cloudflare returned neither image nor JSON: {exc}")
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
    return _generate_openai_style("siliconflow", prompt, size, model, out)


def _generate_image_with_pollinations(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    """Pollinations.ai - FREE, NO API KEY. GET the prompt URL -> image bytes."""
    use_model = model or image_model("pollinations") or "flux"
    out["model"] = use_model
    width, height = _SPARK_SIZES[_orientation(size)]
    url = (f"https://image.pollinations.ai/prompt/{quote(prompt[:1500])}"
           f"?width={width}&height={height}&model={use_model}&nologo=true")
    resp, error = _send("pollinations", "GET", url)
    if resp is None or resp.status_code != 200 or not resp.content:
        out["error"] = error or f"HTTP {resp.status_code}"
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
        out["error"] = ERROR_NO_KEY
        return out
    use_model = model or image_model("imagen") or "imagen-4.0-generate-001"
    out["model"] = use_model
    aspect = size if (size and _ASPECT_RATIO_RE.match(size)) else "1:1"
    resp, error = _send(
        "imagen", "POST",
        f"https://generativelanguage.googleapis.com/v1beta/models/{use_model}:predict?key={key}",
        headers={"Content-Type": "application/json"},
        json={"instances": [{"prompt": prompt}],
              "parameters": {"sampleCount": 1, "aspectRatio": aspect}},
    )
    if resp is None or resp.status_code != 200:
        out["error"] = error or _http_failure(resp)
        return out
    preds = (resp.json() or {}).get("predictions") or []
    b64 = preds[0].get("bytesBase64Encoded") if preds else None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = preds[0].get("mimeType") or "image/png"
    else:
        out["error"] = ERROR_EMPTY
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
                  or model or image_model("azure"))
    out["model"] = deployment
    client = OpenAICompatClient(
        CompatProfile(provider="azure", base_url=endpoint, auth_header="api-key", auth_scheme=""), key,
    )
    return _apply(out, client.generate_image(
        "", prompt, _provider_image_size("openai", size),
        empty_error=ERROR_EMPTY,
        fetch_timeout=_IMG_HTTP_TIMEOUT,
        url=f"{endpoint}/openai/deployments/{deployment}/images/generations"
            f"?api-version={AZURE_IMAGE_API_VERSION}",
    ))


def _generate_image_with_volcano(
    prompt: str, size: Optional[str], model: Optional[str], out: Dict[str, Any]
) -> Dict[str, Any]:
    return _generate_openai_style("volcano", prompt, size, model, out)


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
    resp, error = _send("bedrock", "POST", f"https://{host}{path}", headers=headers, body=body)
    if resp is None or resp.status_code != 200:
        out["error"] = error or _http_failure(resp)
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
    aspect = size if (size and _ASPECT_RATIO_RE.match(size)) else "1:1"
    url = (f"https://{region}-aiplatform.googleapis.com/v1/projects/{project}"
           f"/locations/{region}/publishers/google/models/{use_model}:predict")
    resp, error = _send(
        "vertex", "POST",
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"instances": [{"prompt": prompt}],
              "parameters": {"sampleCount": 1, "aspectRatio": aspect}},
    )
    if resp is None or resp.status_code != 200:
        out["error"] = error or _http_failure(resp)
        return out
    preds = (resp.json() or {}).get("predictions") or []
    b64 = preds[0].get("bytesBase64Encoded") if preds else None
    if b64:
        out["success"] = True
        out["image_base64"] = b64
        out["mime"] = preds[0].get("mimeType") or "image/png"
    else:
        out["error"] = ERROR_EMPTY
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
