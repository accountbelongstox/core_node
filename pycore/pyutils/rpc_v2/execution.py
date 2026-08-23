# -*- coding: utf-8 -*-
"""Transport-neutral RPC request parsing, dispatch, and byte response encoding."""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, Dict, Mapping, Optional

from pycore.pyfoundations.network_constants import HTTP_API_PREFIX
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.common.rpc_response import RpcExecutionResponse
from pycore.pyutils.rpc_v2.dispatcher import HttpDispatcher, HttpRoute


RPC_JSON_CONTENT_TYPE = "application/json"
RPC_TEXT_CONTENT_TYPE = "text/plain"


class RpcExecutionError(ValueError):
    """Relay-safe route, method, policy, or request decoding failure."""

    def __init__(self, code: str, status_code: int) -> None:
        super().__init__(str(code))
        self.code = str(code)
        self.status_code = int(status_code)


class RpcExecutionKernel:
    """One route table and execution pipeline shared by HTTP and Relay."""

    def __init__(self) -> None:
        self.dispatcher = HttpDispatcher(sync_invoker=self._invoke_sync_handler)

    @staticmethod
    async def _invoke_sync_handler(handler: Any, arguments: tuple) -> Any:
        return await await_bus_task(
            handler,
            *arguments,
            thread_name="RpcRouteThread",
        )

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
        return await self.dispatcher.dispatch(route, params, request_id, context)

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
        payload = json.loads(body.decode("utf-8"))
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
        params = self.decode_request_params(
            normalized_method,
            query,
            body,
            content_type,
        )
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
            retry_policy=policy.get("retry"),
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
            fastapi = get_third_package_fastapi()
            encoded = fastapi.encoders.jsonable_encoder(result)
            body = json.dumps(
                encoded,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            ).encode("utf-8")
            response = RpcExecutionResponse(
                200,
                {"Content-Type": RPC_JSON_CONTENT_TYPE},
                body,
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
        body = json.dumps(
            {
                "success": False,
                "error": {"code": str(code)},
                "request_id": str(request_id),
            },
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        ).encode("utf-8")
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


rpc_execution_kernel = RpcExecutionKernel()


__all__ = [
    "RpcExecutionError",
    "RpcExecutionKernel",
    "RpcExecutionResponse",
    "rpc_execution_kernel",
]
