# -*- coding: utf-8 -*-
"""The one OpenAI-compatible REST client: chat, vision, model listing, image
generation and bearer JSON reads. Provider differences are data (``CompatProfile``),
including each provider's historical error texts, empty-response rules and retries."""

import base64
import http
import random
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Optional, Tuple

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.ai_request_failures import free_image_model_unavailable, paid_model_refused
from pycore.pyutils.common.http_client import (
    HttpConnectError,
    HttpConnectTimeout,
    HttpError,
    HttpReadTimeout,
    HttpResponse,
    HttpTimeoutError,
    http_client,
    redacted_http_error,
)

LIST_TIMEOUT_S = 20.0
IMAGE_FETCH_TIMEOUT_S = 120.0
DEFAULT_CHAT_TEMPERATURE = 0.7
DEFAULT_CHAT_MAX_TOKENS = 2048
ERROR_BODY_CHARS = 300
IMAGE_ERROR_BODY_CHARS = 200
DEFAULT_IMAGE_MIME = "image/png"
ERROR_NO_TEXT = "Empty response from provider"
ERROR_NO_MODELS = "No models returned"
ERROR_NO_IMAGE = "Empty / unfetchable image response from provider"
ERROR_TOKEN_INVALID = "Token rejected"
FREE_ROUTER_MODEL = "openrouter/free"
FREE_MODEL_SUFFIX = ":free"
ERROR_STYLE_HTTP = "http"
ERROR_STYLE_REQUESTS = "requests"
ERROR_STYLE_OPENAI_SDK = "openai_sdk"
SDK_CONNECTION_ERROR = "Connection error."
SDK_TIMEOUT_ERROR = "Request timed out."
RETRY_STATUS_CODES = frozenset({408, 409, 429})
RETRY_INITIAL_S = 0.5
RETRY_MAX_S = 8.0
RETRY_AFTER_MAX_S = 60.0
RETRY_JITTER = 0.25
CATALOG_CACHE_TTL_S = 600.0
CATALOG_CACHE_SIGNAL = "pyutils.ai_cluster.openai_compat.catalog"
IMAGE_MODALITY = "image"

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
    list_timeout: Any = LIST_TIMEOUT_S
    chat_temperature: Optional[float] = DEFAULT_CHAT_TEMPERATURE
    chat_max_tokens: Optional[int] = DEFAULT_CHAT_MAX_TOKENS
    chat_extra: Tuple[Tuple[str, Any], ...] = ()
    model_aliases: Tuple[Tuple[str, str], ...] = ()
    error_style: str = ERROR_STYLE_HTTP
    error_hints: Tuple[Tuple[int, str], ...] = ()
    chat_error_hints: Tuple[Tuple[int, str], ...] = ()
    empty_models_error: str = ERROR_NO_MODELS
    empty_models_ok: bool = False
    catalog_fallback: bool = False
    reasoning_fallback: bool = False
    no_choices_error: str = ERROR_NO_TEXT
    empty_text_error: str = ERROR_NO_TEXT
    retries: int = 0
    free_only: bool = False


def _transport_text(exc: BaseException, style: str) -> str:
    """Error text of a transport failure, in the provider's historical client
    wording so failure classification and cooldown rules stay identical."""
    if style == ERROR_STYLE_OPENAI_SDK:
        return SDK_TIMEOUT_ERROR if isinstance(exc, HttpTimeoutError) else SDK_CONNECTION_ERROR
    detail = redacted_http_error(exc)
    if isinstance(exc, HttpConnectTimeout):
        return f"ConnectTimeoutError: connect timeout ({detail})"
    if isinstance(exc, HttpReadTimeout):
        return f"Read timed out. ({detail})"
    if isinstance(exc, HttpConnectError):
        if "not resolvable" in detail:
            return f"NameResolutionError: Failed to resolve ({detail})"
        return f"Failed to establish a new connection: {detail}"
    return detail


def _status_text(
    response: HttpResponse,
    style: str,
    hints: Tuple[Tuple[int, str], ...] = (),
    body_chars: int = ERROR_BODY_CHARS,
) -> str:
    hint = dict(hints).get(response.status_code)
    if hint:
        return f"HTTP {response.status_code} - {hint}"
    if style == ERROR_STYLE_REQUESTS:
        side = "Client" if response.status_code < 500 else "Server"
        try:
            reason = http.HTTPStatus(response.status_code).phrase
        except ValueError:
            reason = ""
        return f"{response.status_code} {side} Error: {reason} for url: {response.url}"
    if style == ERROR_STYLE_OPENAI_SDK:
        return f"Error code: {response.status_code} - {response.text[:body_chars]}"
    return f"HTTP {response.status_code}: {response.text[:body_chars]}"


def _zero_price(value: Any) -> bool:
    if isinstance(value, str):
        return value in ("0", "0.0")
    return type(value) in (int, float) and value == 0


def is_free_model(row: Mapping[str, Any]) -> bool:
    """OpenRouter free-model rule (same as Laravel ``OpenRouterClient::isFreeModel``):
    the id carries the ``:free`` variant suffix, or prompt AND completion pricing
    are zero; ``openrouter/free`` routes to free models only.
    https://openrouter.ai/docs/api-reference/limits
    https://openrouter.ai/docs/guides/routing/routers/free-router"""
    model_id = str(row.get("id") or "")
    if model_id.endswith(FREE_MODEL_SUFFIX) or model_id == FREE_ROUTER_MODEL:
        return True
    pricing = row.get("pricing") or {}
    return _zero_price(pricing.get("prompt")) and _zero_price(pricing.get("completion"))


def message_text(message: Mapping[str, Any], reasoning_fallback: bool = True) -> str:
    """Assistant text of a chat message; reasoning models may answer in
    ``reasoning`` / ``reasoning_details`` with an empty ``content``."""
    content = message.get("content") or ""
    if isinstance(content, list):
        content = "".join(
            str(part.get("text") or "") for part in content if isinstance(part, dict)
        )
    if content or not reasoning_fallback:
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

    def _send_once(
        self,
        method: str,
        url: str,
        payload: Any,
        timeout: Any,
        auth: bool,
    ) -> Tuple[Optional[HttpResponse], Optional[BaseException]]:
        headers = self.headers(json_body=payload is not None) if auth else {}
        options: Dict[str, Any] = {"json": payload} if payload is not None else {"timeout": timeout}
        try:
            return http_client.request(method, url, headers=headers, **options), None
        except _TRANSPORT_ERRORS as exc:
            ColorPrint.yellow(f"[openai_compat] {self.profile.provider} {method} failed: {redacted_http_error(exc)}")
            return None, exc

    @staticmethod
    def _retry_delay(response: Optional[HttpResponse], backoff: Backoff) -> float:
        header = (response.headers.get("retry-after-ms") or "") if response is not None else ""
        if header.replace(".", "", 1).isdigit():
            return float(header) / 1000.0
        header = (response.headers.get("retry-after") or "") if response is not None else ""
        if header.replace(".", "", 1).isdigit() and float(header) <= RETRY_AFTER_MAX_S:
            return float(header)
        return backoff.next_delay() * (1.0 - RETRY_JITTER * random.random())

    @staticmethod
    def _retryable(response: Optional[HttpResponse], exc: Optional[BaseException]) -> bool:
        if response is None:
            return isinstance(exc, HttpError)
        return response.status_code in RETRY_STATUS_CODES or response.status_code >= 500

    def _send(
        self,
        method: str,
        url: str,
        payload: Any = None,
        timeout: Any = None,
        auth: bool = True,
    ) -> Tuple[Optional[HttpResponse], Optional[str], bool]:
        """(response, error, provider_reached) for one request; never raises. A
        request with a body is progress-driven by the HTTP client (no total
        timeout). ``retries`` repeats retryable failures with jittered backoff."""
        request_timeout = self.profile.list_timeout if timeout is None else timeout
        backoff = Backoff(RETRY_INITIAL_S, RETRY_MAX_S)
        attempt = 0
        while True:
            response, exc = self._send_once(method, url, payload, request_timeout, auth)
            if attempt >= self.profile.retries or not self._retryable(response, exc):
                break
            attempt += 1
            time.sleep(self._retry_delay(response, backoff))
        if response is None:
            return None, _transport_text(exc, self.profile.error_style), not isinstance(exc, HttpConnectError)
        return response, None, True

    def get_json(self, url: str, timeout: Any = None) -> Tuple[Any, Optional[str]]:
        """(parsed JSON, None) or (None, error) for a bearer GET."""
        response, error, _reached = self._send("GET", url, timeout=timeout)
        if response is None:
            return None, error
        if not response.ok:
            return None, _status_text(response, self.profile.error_style, self.profile.error_hints)
        try:
            return response.json(), None
        except ValueError as exc:
            ColorPrint.yellow(f"[openai_compat] {self.profile.provider} GET returned invalid JSON: {exc}")
            return None, str(exc)

    def _unwrap(self, data: Any) -> Any:
        if self.profile.result_key and isinstance(data, dict):
            return data.get(self.profile.result_key) or data
        return data

    def catalog_rows(
        self,
        timeout: Any = None,
        cached: bool = False,
        output_modality: str = "",
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """(catalog model rows, error); free-only providers see free rows only.
        ``cached`` reuses a fresh THREAD_BUS copy (free-model guard lookups)."""
        cache_key = f"{CATALOG_CACHE_SIGNAL}.{self.profile.provider}.{output_modality}"
        if cached:
            entry = THREAD_BUS.get_signal(cache_key, {}) or {}
            if entry and time.time() - float(entry.get("ts") or 0.0) < CATALOG_CACHE_TTL_S:
                return list(entry.get("rows") or []), None
        url = self.profile.models_url or f"{self.profile.base_url}/models"
        if output_modality:
            url = f"{url}?output_modalities={output_modality}"
        data, error = self.get_json(url, timeout)
        if error:
            return [], error
        raw = data.get(self.profile.models_list_key) if self.profile.models_list_key else data
        rows = [
            row for row in (raw if isinstance(raw, list) else [])
            if isinstance(row, dict) and row.get(self.profile.models_id_key)
            and (not self.profile.free_only or is_free_model(row))
        ]
        THREAD_BUS.signal(cache_key, {"ts": time.time(), "rows": rows})
        return rows, None

    def list_models(self, timeout: Any = None) -> Tuple[List[str], Optional[str]]:
        """(model ids, error). Static catalogs need no network call."""
        if self.profile.static_models:
            return list(self.profile.static_models), None
        rows, error = self.catalog_rows(timeout)
        if error:
            return [], error
        ids = [str(row[self.profile.models_id_key]) for row in rows]
        if not ids:
            return [], None if self.profile.empty_models_ok else self.profile.empty_models_error
        return self._order_models(ids), None

    def allows_model(self, model: str) -> bool:
        """Free-only providers accept a model only when the free rule holds,
        by id or by its catalog pricing."""
        if not self.profile.free_only or is_free_model({"id": model}):
            return True
        rows, _error = self.catalog_rows(cached=True)
        return any(str(row.get("id")) == model for row in rows)

    def free_image_model(self) -> Tuple[str, Optional[str]]:
        """(free image-output model id, None) or ('', coded reason)."""
        rows, error = self.catalog_rows(cached=True, output_modality=IMAGE_MODALITY)
        for row in rows:
            modalities = (row.get("architecture") or {}).get("output_modalities") or []
            if IMAGE_MODALITY in modalities:
                return str(row["id"]), None
        return "", error or free_image_model_unavailable(self.profile.provider)

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
        response, error, _reached = self._send("GET", self.profile.probe_url)
        if response is None:
            return False, error
        if response.status_code != 200:
            return False, f"{ERROR_TOKEN_INVALID}: {_status_text(response, self.profile.error_style)}"
        return True, None

    def resolve_model(self, model: str) -> str:
        """Provider short-name aliases resolve to full model ids."""
        return dict(self.profile.model_aliases).get(model, model)

    def chat(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """``{success, text, message, model, provider, error, provider_reached}``.
        Sampling defaults and empty-response rules come from the profile."""
        model = self.resolve_model(model)
        if not self.allows_model(model):
            return {
                "success": False, "text": "", "message": {}, "model": model,
                "provider": self.profile.provider,
                "error": paid_model_refused(self.profile.provider, model),
                "provider_reached": False,
            }
        payload: Dict[str, Any] = {"model": model, "messages": messages}
        if self.profile.chat_temperature is not None:
            payload["temperature"] = self.profile.chat_temperature
        if self.profile.chat_max_tokens is not None:
            payload["max_tokens"] = self.profile.chat_max_tokens
        payload.update(dict(self.profile.chat_extra))
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
            "POST", f"{self.profile.base_url}/chat/completions", payload,
        )
        out["provider_reached"] = reached
        if response is None:
            out["error"] = error
            return out
        if not response.ok:
            hints = self.profile.chat_error_hints or self.profile.error_hints
            out["error"] = _status_text(response, self.profile.error_style, hints)
            return out
        try:
            data = self._unwrap(response.json())
        except ValueError as exc:
            ColorPrint.yellow(f"[openai_compat] {self.profile.provider} chat returned invalid JSON: {exc}")
            out["error"] = str(exc)
            return out
        choices = data.get("choices") if isinstance(data, dict) else None
        if not choices:
            out["error"] = self.profile.no_choices_error
            return out
        message = choices[0].get("message") or {}
        out["message"] = message
        out["text"] = message_text(message, self.profile.reasoning_fallback)
        out["success"] = bool(out["text"])
        if not out["success"]:
            out["error"] = self.profile.empty_text_error
        return out

    def fetch_image(self, url: str, timeout: Any = IMAGE_FETCH_TIMEOUT_S) -> Tuple[str, str]:
        """(base64, mime) of an image URL, or ('', '') when unfetchable."""
        if not url:
            return "", ""
        response, _error, _reached = self._send("GET", url, timeout=timeout, auth=False)
        if response is None or response.status_code != 200 or not response.content:
            return "", ""
        mime = (response.headers.get("Content-Type") or DEFAULT_IMAGE_MIME).split(";")[0].strip()
        return base64.b64encode(response.content).decode("ascii"), mime or DEFAULT_IMAGE_MIME

    def generate_image(
        self,
        model: str,
        prompt: str,
        size: str,
        size_param: str = "size",
        response_format: Optional[str] = None,
        url: str = "",
        send_n: bool = True,
        empty_error: str = ERROR_NO_IMAGE,
        fetch_timeout: Any = IMAGE_FETCH_TIMEOUT_S,
    ) -> Dict[str, Any]:
        """OpenAI images API: ``{success, image_base64, mime, error}``."""
        payload: Dict[str, Any] = {"prompt": prompt, size_param: size}
        if send_n:
            payload["n"] = 1
        if model:
            payload["model"] = model
        if response_format:
            payload["response_format"] = response_format
        target = url or f"{self.profile.base_url}/images/generations"
        out: Dict[str, Any] = {"success": False, "image_base64": "", "mime": "", "error": None}
        response, error, _reached = self._send("POST", target, payload)
        if response is None:
            out["error"] = error
            return out
        if response.status_code != 200:
            out["error"] = _status_text(response, ERROR_STYLE_HTTP, (), IMAGE_ERROR_BODY_CHARS)
            return out
        try:
            data = response.json() or {}
        except ValueError as exc:
            ColorPrint.yellow(f"[openai_compat] {self.profile.provider} image returned invalid JSON: {exc}")
            out["error"] = str(exc)
            return out
        rows = data.get("data") or data.get("images") or []
        entry = rows[0] if rows and isinstance(rows[0], dict) else {}
        if entry.get("b64_json"):
            b64, mime = str(entry["b64_json"]), DEFAULT_IMAGE_MIME
        else:
            b64, mime = self.fetch_image(str(entry.get("url") or ""), fetch_timeout)
        if not b64:
            out["error"] = empty_error
            return out
        out.update(success=True, image_base64=b64, mime=mime)
        return out


__all__ = [
    "CompatProfile",
    "FREE_ROUTER_MODEL",
    "OpenAICompatClient",
    "is_free_model",
    "message_text",
]
