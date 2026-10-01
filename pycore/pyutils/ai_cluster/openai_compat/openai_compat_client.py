# -*- coding: utf-8 -*-
"""The one OpenAI-compatible REST client: chat, vision, model listing, image
generation and bearer JSON reads. Provider differences are data (``CompatProfile``)."""

import base64
from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.http_client import (
    HttpClient,
    HttpConnectError,
    HttpError,
    HttpResponse,
    redacted_http_error,
)

CHAT_TIMEOUT_S = 90.0
LIST_TIMEOUT_S = 20.0
IMAGE_TIMEOUT_S = 120.0
ERROR_BODY_CHARS = 300
DEFAULT_IMAGE_MIME = "image/png"
ERROR_NO_TEXT = "Empty response from provider"
ERROR_NO_MODELS = "No models returned"
ERROR_NO_IMAGE = "Empty / unfetchable image response from provider"
ERROR_TOKEN_INVALID = "Token rejected"
FREE_ROUTER_MODEL = "openrouter/free"
FREE_MODEL_SUFFIX = ":free"

_HTTP = HttpClient(default_timeout=CHAT_TIMEOUT_S)
_TRANSPORT_ERRORS = (HttpError, ValueError)


@dataclass(frozen=True)
class CompatProfile:
    """Wire quirks of one OpenAI-compatible provider."""

    provider: str
    base_url: str
    auth_header: str = "Authorization"
    auth_scheme: str = "Bearer"
    extra_headers: Tuple[Tuple[str, str], ...] = ()
    models_url: str = ""
    models_list_key: str = "data"
    models_id_key: str = "id"
    model_prefix: str = ""
    free_first: bool = False
    static_models: Tuple[str, ...] = ()
    probe_url: str = ""
    result_key: str = ""


def _http_error(response: HttpResponse) -> str:
    return f"HTTP {response.status_code}: {response.text[:ERROR_BODY_CHARS]}"


def message_text(message: Mapping[str, Any]) -> str:
    """Assistant text of a chat message; reasoning models may answer in
    ``reasoning`` / ``reasoning_details`` with an empty ``content``."""
    content = message.get("content") or ""
    if isinstance(content, list):
        content = "".join(
            str(part.get("text") or "") for part in content if isinstance(part, dict)
        )
    if content:
        return str(content)
    if message.get("reasoning"):
        return str(message["reasoning"])
    details = message.get("reasoning_details") or []
    if isinstance(details, list):
        return "".join(
            str(detail.get("text") or "") for detail in details if isinstance(detail, dict)
        )
    return ""


class OpenAICompatClient:
    """One provider key bound to one ``CompatProfile``."""

    def __init__(self, profile: CompatProfile, api_key: str) -> None:
        self.profile = profile
        self.api_key = api_key

    def headers(self, json_body: bool = False) -> Dict[str, str]:
        auth = f"{self.profile.auth_scheme} {self.api_key}".strip()
        headers = {self.profile.auth_header: auth, "Accept": "application/json"}
        headers.update(dict(self.profile.extra_headers))
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers

    def _send(
        self,
        method: str,
        url: str,
        payload: Any = None,
        timeout: float = CHAT_TIMEOUT_S,
        auth: bool = True,
    ) -> Tuple[Optional[HttpResponse], Optional[str], bool]:
        """(response, error, provider_reached) for one request; never raises."""
        headers = self.headers(json_body=payload is not None) if auth else {}
        try:
            response = _HTTP.request(method, url, json=payload, timeout=timeout, headers=headers)
        except _TRANSPORT_ERRORS as exc:
            error = redacted_http_error(exc)
            ColorPrint.yellow(f"[openai_compat] {self.profile.provider} {method} failed: {error}")
            return None, error, not isinstance(exc, HttpConnectError)
        return response, None, True

    def get_json(self, url: str, timeout: float = LIST_TIMEOUT_S) -> Tuple[Any, Optional[str]]:
        """(parsed JSON, None) or (None, error) for a bearer GET."""
        response, error, _reached = self._send("GET", url, timeout=timeout)
        if response is None:
            return None, error
        if not response.ok:
            return None, _http_error(response)
        try:
            return response.json(), None
        except ValueError as exc:
            ColorPrint.yellow(f"[openai_compat] {self.profile.provider} GET returned invalid JSON: {exc}")
            return None, str(exc)

    def _unwrap(self, data: Any) -> Any:
        if self.profile.result_key and isinstance(data, dict):
            return data.get(self.profile.result_key) or data
        return data

    def list_models(self) -> Tuple[List[str], Optional[str]]:
        """(model ids, error). Static catalogs need no network call."""
        if self.profile.static_models:
            return list(self.profile.static_models), None
        url = self.profile.models_url or f"{self.profile.base_url}/models"
        data, error = self.get_json(url)
        if error:
            return [], error
        rows = data.get(self.profile.models_list_key) if self.profile.models_list_key else data
        ids = [
            str(row.get(self.profile.models_id_key) or "")
            for row in (rows if isinstance(rows, list) else [])
            if isinstance(row, dict) and row.get(self.profile.models_id_key)
        ]
        if not ids:
            return [], ERROR_NO_MODELS
        return self._order_models(ids), None

    def _order_models(self, ids: List[str]) -> List[str]:
        if self.profile.free_first:
            if FREE_ROUTER_MODEL in ids:
                return [FREE_ROUTER_MODEL] + [i for i in ids if i != FREE_ROUTER_MODEL]
            free = [i for i in ids if i.endswith(FREE_MODEL_SUFFIX)]
            return free + [i for i in ids if not i.endswith(FREE_MODEL_SUFFIX)]
        if self.profile.model_prefix:
            preferred = [i for i in ids if i.startswith(self.profile.model_prefix)]
            return preferred or ids
        return ids

    def validate_token(self) -> Tuple[bool, Optional[str]]:
        """Cheap key check against ``probe_url`` (no inference spend)."""
        response, error, _reached = self._send("GET", self.profile.probe_url, timeout=LIST_TIMEOUT_S)
        if response is None:
            return False, error
        if response.status_code != 200:
            return False, f"{ERROR_TOKEN_INVALID}: {_http_error(response)}"
        return True, None

    def chat(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        extra: Optional[Dict[str, Any]] = None,
        timeout: float = CHAT_TIMEOUT_S,
    ) -> Dict[str, Any]:
        """``{success, text, message, model, provider, error, provider_reached}``."""
        payload: Dict[str, Any] = {"model": model, "messages": messages}
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        payload.update(extra or {})
        out: Dict[str, Any] = {
            "success": False,
            "text": "",
            "message": {},
            "model": model,
            "provider": self.profile.provider,
            "error": None,
            "provider_reached": False,
        }
        response, error, reached = self._send(
            "POST", f"{self.profile.base_url}/chat/completions", payload, timeout,
        )
        out["provider_reached"] = reached
        if response is None:
            out["error"] = error
            return out
        if not response.ok:
            out["error"] = _http_error(response)
            return out
        try:
            data = self._unwrap(response.json())
        except ValueError as exc:
            ColorPrint.yellow(f"[openai_compat] {self.profile.provider} chat returned invalid JSON: {exc}")
            out["error"] = str(exc)
            return out
        choices = data.get("choices") if isinstance(data, dict) else None
        message = (choices[0].get("message") or {}) if choices else {}
        out["message"] = message
        out["text"] = message_text(message)
        out["success"] = bool(out["text"])
        if not out["success"]:
            out["error"] = ERROR_NO_TEXT
        return out

    def fetch_image(self, url: str) -> Tuple[str, str]:
        """(base64, mime) of an image URL, or ('', '') when unfetchable."""
        if not url:
            return "", ""
        response, _error, _reached = self._send("GET", url, timeout=IMAGE_TIMEOUT_S, auth=False)
        if response is None or response.status_code != 200 or not response.content:
            return "", ""
        mime = (response.headers.get("Content-Type") or DEFAULT_IMAGE_MIME).split(";")[0].strip()
        return base64.b64encode(response.content).decode("ascii"), mime or DEFAULT_IMAGE_MIME

    def image_entry(self, entry: Mapping[str, Any]) -> Tuple[str, str]:
        """(base64, mime) of one images-API result entry (inline b64 or URL)."""
        if entry.get("b64_json"):
            return str(entry["b64_json"]), DEFAULT_IMAGE_MIME
        return self.fetch_image(str(entry.get("url") or ""))

    def generate_image(
        self,
        model: str,
        prompt: str,
        size: str,
        size_param: str = "size",
        response_format: Optional[str] = None,
        url: str = "",
    ) -> Dict[str, Any]:
        """OpenAI images API: ``{success, image_base64, mime, error}``."""
        payload: Dict[str, Any] = {"prompt": prompt, "n": 1, size_param: size}
        if model:
            payload["model"] = model
        if response_format:
            payload["response_format"] = response_format
        target = url or f"{self.profile.base_url}/images/generations"
        out: Dict[str, Any] = {"success": False, "image_base64": "", "mime": "", "error": None}
        response, error, _reached = self._send("POST", target, payload, IMAGE_TIMEOUT_S)
        if response is None:
            out["error"] = error
            return out
        if response.status_code != 200:
            out["error"] = _http_error(response)
            return out
        try:
            data = response.json() or {}
        except ValueError as exc:
            ColorPrint.yellow(f"[openai_compat] {self.profile.provider} image returned invalid JSON: {exc}")
            out["error"] = str(exc)
            return out
        rows = data.get("data") or data.get("images") or []
        entry = rows[0] if rows and isinstance(rows[0], dict) else {}
        b64, mime = self.image_entry(entry)
        if not b64:
            out["error"] = ERROR_NO_IMAGE
            return out
        out.update(success=True, image_base64=b64, mime=mime)
        return out


__all__ = [
    "CompatProfile",
    "OpenAICompatClient",
    "message_text",
]
