# -*- coding: utf-8 -*-
"""Transport-neutral RPC request parsing, dispatch, and byte response encoding."""

from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from typing import Any, AsyncIterator, Dict, Mapping, Optional, Tuple

from pycore.pyfoundations.elastic_worker_pool import ElasticWorkerPool
from pycore.pyfoundations.json_codec import json_codec
from pycore.pyfoundations.network_constants import (
    HTTP_API_PREFIX,
    HTTP_JSON_CONTENT_TYPE as RPC_JSON_CONTENT_TYPE,
)
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.rpc_response import RpcExecutionResponse
from pycore.pyutils.common.idempotent_jobs import CLIENT_TASK_ID_PARAM, ClientTaskIdConflict, IdempotentJobs
from pycore.pyutils.rpc.dispatcher import HttpDispatcher, HttpRoute


RPC_TEXT_CONTENT_TYPE = "text/plain"
RPC_ROUTE_THREAD_NAME = "RpcRouteThread"
RPC_ROUTE_IDLE_SECONDS = 60.0
# Multipart bodies stream into spooled parts with no total deadline; file
# parts reach handlers as upload objects and services enforce size caps.
RPC_MULTIPART_CONTENT_TYPE = "multipart/form-data"
RPC_RELAY_MULTIPART_PAYLOADS = frozenset({"multipart-form"})
RPC_RELAY_JSON_OR_MULTIPART_PAYLOADS = frozenset({"json-or-multipart-form"})
RPC_RELAY_JSON_PAYLOADS = frozenset(
    {
        "json-object",
        "bounded-json-or-opaque-response",
    }
)
RPC_RELAY_RESPONSE_ONLY_PAYLOADS = frozenset({"opaque-response-bytes"})


class RpcExecutionError(ValueError):
    """Relay-safe route, method, policy, or request decoding failure."""

    def __init__(self, code: str, status_code: int) -> None:
        super().__init__(str(code))
        self.code = str(code)
        self.status_code = int(status_code)


def _set_future_result(future: "asyncio.Future[Any]", result: Any) -> None:
    if not future.done():
        future.set_result(result)


def _set_future_exception(future: "asyncio.Future[Any]", error: BaseException) -> None:
    if not future.done():
        future.set_exception(error)


def _bounce_to_loop(loop: Any, setter: Any, future: "asyncio.Future[Any]", value: Any) -> None:
    """Complete ``future`` from a worker thread; a loop that already ended (timed-out relay call) drops it."""
    if not loop.is_closed():
        loop.call_soon_threadsafe(setter, future, value)


class RpcExecutionKernel:
    """One route table and execution pipeline shared by HTTP and Relay."""

    def __init__(self) -> None:
        self._route_workers = ElasticWorkerPool(RPC_ROUTE_THREAD_NAME, RPC_ROUTE_IDLE_SECONDS)
        self.dispatcher = HttpDispatcher(sync_invoker=self._invoke_sync_handler)

    async def _invoke_sync_handler(self, handler: Any, arguments: tuple) -> Any:
        """Run a synchronous handler on a reusable route worker; the loop never starts a thread."""
        loop = asyncio.get_running_loop()
        future: "asyncio.Future[Any]" = loop.create_future()

        def job() -> None:
            try:
                result = handler(*arguments)
            except Exception as exc:  # bounce the exception onto the loop thread
                _bounce_to_loop(loop, _set_future_exception, future, exc)
                return
            _bounce_to_loop(loop, _set_future_result, future, result)

        self._route_workers.submit(job)
        return await future

    def register(
        self,
        path: str,
        handler: Any,
        **options: Any,
    ) -> HttpRoute:
        return self.dispatcher.register(path, handler, **options)

    async def dispatch(
        self,
        route: HttpRoute,
        params: Dict[str, Any],
        request_id: str,
        context: Dict[str, Any],
    ) -> Any:
        """Dispatch one call; a ``client_task_id`` makes it run once per
        client and route (repeats join the in-flight run or replay the cached
        success); a repeat with a different request is rejected with 409."""
        client_task_id = str(params.get(CLIENT_TASK_ID_PARAM) or "").strip()
        try:
            return await rpc_jobs.run_async(
                client_task_id,
                lambda: self.dispatcher.dispatch(route, params, request_id, context),
                job_key=f"{self.client_scope(context)}|{route.path}|{client_task_id}",
                fingerprint=self.request_fingerprint(params) if client_task_id else "",
            )
        except ClientTaskIdConflict as error:
            raise RpcExecutionError(error.code, 409) from error

    @staticmethod
    def client_scope(context: Mapping[str, Any]) -> str:
        """Idempotency owner: the relay owner/pairing, or the direct client."""
        if context.get("transport") == "relay":
            return f"relay:{context.get('user_id') or ''}:{context.get('pairing_id') or ''}"
        client = context.get("client_id") or context.get("browser_id") or context.get("remote_addr") or ""
        return f"http:{client}"

    @staticmethod
    def request_fingerprint(params: Mapping[str, Any]) -> str:
        """SHA-256 of the canonical request params (upload parts by name, type and size)."""
        def describe(value: Any) -> Any:
            return {
                "filename": getattr(value, "filename", None),
                "content_type": getattr(value, "content_type", None),
                "size": getattr(value, "size", None),
            }

        canonical = json.dumps(
            {key: value for key, value in params.items() if key != CLIENT_TASK_ID_PARAM},
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
            default=describe,
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def is_multipart(content_type: str) -> bool:
        return str(content_type or "").split(";", 1)[0].strip().lower() == RPC_MULTIPART_CONTENT_TYPE

    async def decode_multipart_params(
        self,
        query: Mapping[str, Any],
        content_type: str,
        stream: AsyncIterator[bytes],
    ) -> Tuple[Dict[str, Any], Any]:
        """The one multipart parser (local HTTP and relay): returns (params, form);
        a repeated field becomes a list. The caller closes ``form`` once the
        route has run."""
        fastapi = get_third_package_fastapi()
        parser = fastapi.MultiPartParser(fastapi.Headers({"content-type": str(content_type)}), stream)
        try:
            form = await parser.parse()
        except fastapi.MultiPartException as error:
            raise RpcExecutionError("request_body_multipart_invalid", 400) from error
        fields: Dict[str, Any] = {}
        for key, value in form.multi_items():
            name = str(key)
            if name not in fields:
                fields[name] = value
            elif isinstance(fields[name], list):
                fields[name].append(value)
            else:
                fields[name] = [fields[name], value]
        return {**self._query_params(query), **fields}, form

    def decode_request_params(
        self,
        method: str,
        query: Mapping[str, Any],
        body: bytes,
        content_type: str,
    ) -> Dict[str, Any]:
        params = self._query_params(query)
        if str(method or "GET").upper() == "GET" or not body:
            return params
        normalized_type = str(content_type or "").lower()
        if normalized_type.startswith(RPC_TEXT_CONTENT_TYPE):
            params["text"] = body.decode("utf-8", errors="replace")
            return params
        try:
            payload = json_codec.decode(body)
        except json_codec.DecodeError as error:
            raise RpcExecutionError("request_body_json_invalid", 400) from error
        if not isinstance(payload, dict):
            raise RpcExecutionError("request_body_not_object", 400)
        return {**params, **payload}

    async def execute_relay_async(
        self,
        method: str,
        path: str,
        query: Mapping[str, Any],
        headers: Mapping[str, Any],
        body: bytes,
        operation_id: str,
        pairing_id: str,
        user_id: str,
    ) -> RpcExecutionResponse:
        route_path = self.route_path(path)
        normalized_method = str(method or "GET").upper()
        route = self.dispatcher.get(route_path)
        if route is None:
            raise RpcExecutionError("route_not_found", 404)
        if normalized_method not in route.methods:
            raise RpcExecutionError("method_not_allowed", 405)
        policy = relay_contract.route_policy(route_path, normalized_method)
        if str(policy.get("exposure") or "denied") != "relay":
            raise RpcExecutionError("route_relay_denied", 403)
        content_type = self._header(headers, "content-type")
        self._validate_relay_payload(
            str(policy.get("payload") or "none"),
            normalized_method,
            body,
            content_type,
        )
        form = None
        if self.is_multipart(content_type):
            params, form = await self.decode_multipart_params(query, content_type, _single_chunk(body))
        else:
            params = self.decode_request_params(normalized_method, query, body, content_type)
        request_id = str(operation_id or uuid.uuid4().hex)
        context = {
            "transport": "relay",
            "request_id": request_id,
            "operation_id": operation_id,
            "pairing_id": pairing_id,
            "user_id": user_id,
            "client_id": pairing_id,
            "browser_id": pairing_id,
            "remote_addr": None,
            "user_agent": None,
            "method": normalized_method,
            "path": route_path,
            "path_params": {},
            "headers": self.filtered_headers(headers, "request"),
            "relay_policy": dict(policy),
            "relay_permission": str(policy.get("permission") or ""),
            "relay_payload_profile": str(policy.get("payload") or ""),
        }
        relay_activity_log.info(
            "rpc.dispatch.started",
            operation_id=operation_id,
            method=normalized_method,
            route=route_path,
            delivery=policy.get("delivery"),
            permission=policy.get("permission"),
            payload_profile=policy.get("payload"),
            body_length=len(body),
        )
        contract_timeout = relay_contract.duration("execution_timeout_seconds")
        timeout_candidates = [contract_timeout]
        policy_timeout = float(policy.get("timeout_seconds") or 0)
        if policy_timeout > 0:
            timeout_candidates.append(policy_timeout)
        if route.timeout is not None and route.timeout > 0:
            timeout_candidates.append(float(route.timeout))
        execution_timeout = min(timeout_candidates)
        context["execution_timeout_seconds"] = execution_timeout
        try:
            result = await asyncio.wait_for(
                self.dispatch(route, params, request_id, context),
                timeout=execution_timeout,
            )
        except asyncio.TimeoutError as exc:
            raise TimeoutError("rpc_execution_timeout") from exc
        finally:
            if form is not None:
                await form.close()
        response = self.encode_result(result, request_id, filter_for_relay=True)
        relay_activity_log.success(
            "rpc.dispatch.completed",
            operation_id=operation_id,
            method=normalized_method,
            route=route_path,
            status=response.status_code,
            body=response.body,
        )
        return response

    def execute_relay(
        self,
        method: str,
        path: str,
        query: Mapping[str, Any],
        headers: Mapping[str, Any],
        body: bytes,
        operation_id: str,
        pairing_id: str,
        user_id: str,
    ) -> RpcExecutionResponse:
        return asyncio.run(
            self.execute_relay_async(
                method,
                path,
                query,
                headers,
                body,
                operation_id,
                pairing_id,
                user_id,
            )
        )

    def encode_result(
        self,
        result: Any,
        request_id: str,
        filter_for_relay: bool = False,
    ) -> RpcExecutionResponse:
        if result is None:
            response = RpcExecutionResponse(204, {}, b"", False)
        elif hasattr(result, "status_code") and hasattr(result, "body"):
            status_code = int(getattr(result, "status_code"))
            has_body = status_code not in (204, 304)
            response = RpcExecutionResponse(
                status_code,
                {
                    str(key): str(value)
                    for key, value in dict(getattr(result, "headers", {}) or {}).items()
                },
                (
                    bytes(getattr(result, "body") or b"")
                    if has_body
                    else b""
                ),
                has_body,
            )
        else:
            response = RpcExecutionResponse(
                200,
                {"Content-Type": RPC_JSON_CONTENT_TYPE},
                json_codec.encode(result, default=get_third_package_fastapi().encoders.jsonable_encoder),
            )
        headers = dict(response.headers)
        headers["X-Request-ID"] = str(request_id)
        if filter_for_relay:
            headers = self.filtered_headers(headers, "response")
        return RpcExecutionResponse(
            response.status_code,
            headers,
            response.body,
            response.has_body,
        )

    @staticmethod
    def error_response(
        code: str,
        status_code: int,
        request_id: str,
    ) -> RpcExecutionResponse:
        body = json_codec.encode({
            "success": False,
            "error": {"code": str(code)},
            "request_id": str(request_id),
        })
        return RpcExecutionResponse(
            int(status_code),
            {
                "Content-Type": RPC_JSON_CONTENT_TYPE,
                "X-Request-ID": str(request_id),
            },
            body,
        )

    @staticmethod
    def route_path(path: str) -> str:
        normalized = str(path or "").strip().strip("/")
        prefix = str(HTTP_API_PREFIX or "").strip().strip("/")
        if prefix and normalized.startswith(prefix + "/"):
            normalized = normalized[len(prefix) + 1 :]
        return normalized

    @staticmethod
    def _query_params(query: Mapping[str, Any]) -> Dict[str, Any]:
        return {str(key): value for key, value in dict(query or {}).items()}

    @staticmethod
    def _validate_relay_payload(
        payload_profile: str,
        method: str,
        body: bytes,
        content_type: str,
    ) -> None:
        normalized_profile = str(payload_profile or "none")
        normalized_type = str(content_type or "").split(";", 1)[0].strip().lower()
        if normalized_profile in RPC_RELAY_RESPONSE_ONLY_PAYLOADS:
            if str(method).upper() != "GET" or body:
                raise RpcExecutionError("relay_request_payload_forbidden", 400)
            return
        if normalized_profile in RPC_RELAY_JSON_OR_MULTIPART_PAYLOADS:
            if normalized_type == RPC_MULTIPART_CONTENT_TYPE and str(method).upper() == "POST":
                return
            normalized_profile = "json-object"
        if normalized_profile in RPC_RELAY_MULTIPART_PAYLOADS:
            if str(method).upper() != "POST" or normalized_type != RPC_MULTIPART_CONTENT_TYPE:
                raise RpcExecutionError("relay_request_content_type_invalid", 415)
            return
        if normalized_profile in RPC_RELAY_JSON_PAYLOADS:
            if str(method).upper() == "GET" and body:
                raise RpcExecutionError("relay_request_payload_forbidden", 400)
            if body and not (
                normalized_type == RPC_JSON_CONTENT_TYPE
                or normalized_type.endswith("+json")
            ):
                raise RpcExecutionError("relay_request_content_type_invalid", 415)
            return
        raise RpcExecutionError("relay_request_payload_profile_denied", 403)

    @staticmethod
    def _header(headers: Mapping[str, Any], name: str) -> str:
        normalized_name = str(name).lower()
        for key, value in dict(headers or {}).items():
            if str(key).lower() == normalized_name:
                return str(value)
        return ""

    @staticmethod
    def filtered_headers(
        headers: Mapping[str, Any],
        direction: str,
    ) -> Dict[str, str]:
        allowed = set(relay_contract.allowed_headers(direction))
        limit = relay_contract.limit("header_value_bytes")
        return {
            str(key).lower(): str(value)
            for key, value in dict(headers or {}).items()
            if str(key).lower() in allowed
            and len(str(value).encode("utf-8")) <= limit
        }


async def _single_chunk(body: bytes) -> AsyncIterator[bytes]:
    """A buffered relay body as the byte stream the multipart parser reads."""
    yield bytes(body or b"")


# The one client-keyed job table of the RPC surface (all routes, HTTP and relay).
rpc_jobs = IdempotentJobs("rpc")
rpc_execution_kernel = RpcExecutionKernel()


__all__ = [
    "RpcExecutionError",
    "RpcExecutionKernel",
    "RpcExecutionResponse",
    "rpc_execution_kernel",
]
