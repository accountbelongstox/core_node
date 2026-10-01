# -*- coding: utf-8 -*-
"""Qy account session and word groups of the audio orchestration (the session
lives in the pycore auth record, so pycore is authoritative)."""

from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.queue_center_contract import queue_center_endpoint
from pycore.pyutils.laravel.client import laravel_client, laravel_failure
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager

from pycore.pyctl.audio_orchestration import orch_store

_LARAVEL_LOGIN = queue_center_endpoint("orch_login")
_LARAVEL_USER = queue_center_endpoint("orch_user")
_LARAVEL_QUERY_ALL_GROUPS = queue_center_endpoint("orch_query_all_groups")
_LOGIN_TIMEOUT = 60
_GROUPS_PAGE_SIZE = 1000


def _user_view(user: Dict[str, Any], username: Any) -> Dict[str, Any]:
    return {
        "id": user.get("id"),
        "username": user.get("username") or username,
        "native_language": user.get("native_language"),
    }


def auth_login(username: str, password: str, access_token: str = "", base_url: str = "") -> Dict[str, Any]:
    username = (username or "").strip()
    endpoint = urlsplit(base_url) if base_url else None
    token = access_token.strip()
    if endpoint and (endpoint.scheme not in ("http", "https") or not endpoint.netloc or endpoint.username):
        return {"success": False, "error": "invalid Laravel endpoint"}
    endpoint_error = laravel_endpoint_manager.work_endpoint_error(base_url)
    if endpoint_error:
        return {"success": False, "error": endpoint_error, "error_code": endpoint_error}
    if not token and (not username or not password):
        return {"success": False, "error": "username and password are required"}
    try:
        if token:
            resp = laravel_client.get(
                _LARAVEL_USER, headers={"Authorization": f"Bearer {token}"},
                base_url=base_url or None, timeout=_LOGIN_TIMEOUT,
                sensitive_request=True,
            )
        else:
            resp = laravel_client.post(
                _LARAVEL_LOGIN, json={"username": username, "password": password},
                base_url=base_url or None, timeout=_LOGIN_TIMEOUT,
                sensitive_request=True,
            )
        body = resp.json() if resp.content else {}
    except (OSError, ValueError) as exc:
        ColorPrint.yellow(f"[AudioOrch] login failed (base={base_url or 'resolved'}): {exc}")
        failure = laravel_failure(exc)
        return {"success": False, "error": failure["error_code"], **failure}
    if resp.status_code != 200 or not isinstance(body, dict):
        message = body.get("error") or body.get("message") if isinstance(body, dict) else None
        return {
            "success": False, "error": str(message or f"HTTP {resp.status_code}"),
            "error_code": "QY_ACCOUNT_AUTH_REQUIRED" if resp.status_code == 401 else "QY_ACCOUNT_REQUEST_FAILED",
        }
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    if not token:
        token_data = body.get("login_token") or body.get("token") or data.get("login_token") or data.get("token") or data.get("access_token")
        if isinstance(token_data, dict):
            token_data = token_data.get("accessToken") or token_data.get("access_token")
        token = token_data if isinstance(token_data, str) else ""
    if body.get("success") is False or not token:
        return {"success": False, "error": str(body.get("message") or "login rejected")}
    user = data.get("user") if isinstance(data.get("user"), dict) else data
    if not user.get("id") and body.get("id"):
        user = body
    if not user.get("id") and isinstance(body.get("user"), dict):
        user = body["user"]
    if access_token and not user.get("id"):
        return {"success": False, "error": "Qy account verification failed"}
    username = str(user.get("username") or username)
    if not orch_store.save_auth(username, token, user, base_url):
        return {"success": False, "error": "Qy account session could not be persisted"}
    return {
        "success": True,
        "logged_in": True,
        "username": username,
        "user": _user_view(user, username),
    }


def auth_status() -> Dict[str, Any]:
    record = orch_store.load_auth()
    if not record:
        return {"success": True, "logged_in": False}
    user = record.get("user") if isinstance(record.get("user"), dict) else {}
    return {
        "success": True,
        "logged_in": True,
        "username": record.get("username"),
        "user": _user_view(user, record.get("username")),
        "logged_at": record.get("logged_at"),
    }


def auth_logout(expected_user_id: Optional[int] = None) -> Dict[str, Any]:
    record = orch_store.load_auth() or {}
    user = record.get("user") or {}
    if expected_user_id is not None and user.get("id") != expected_user_id:
        return {"success": True, "logged_in": False}
    if not orch_store.clear_auth():
        return {"success": False, "error": "Qy account session could not be cleared"}
    return {"success": True, "logged_in": False}


def _groups_failure(code: str, detail: str = "") -> Dict[str, Any]:
    return {"error_code": code, "detail": detail[:200]}


def _fetch_word_groups(record: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Paginated /query_all_groups walk with the stored bearer token.
    Returns ``(groups, None)`` or ``([], failure)``."""
    token = str(record.get("token") or "")
    if not token:
        return [], _groups_failure("QY_ACCOUNT_AUTH_REQUIRED")
    groups: List[Dict[str, Any]] = []
    start = 0
    while True:
        try:
            resp = laravel_client.get(
                _LARAVEL_QUERY_ALL_GROUPS,
                params={"start": start, "limit": _GROUPS_PAGE_SIZE, "with_words": 0},
                headers={"Authorization": f"Bearer {token}"},
                base_url=record.get("base_url") or None,
                timeout=_LOGIN_TIMEOUT,
            )
            body = resp.json() if resp.status_code == 200 else None
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[AudioOrch] word groups fetch failed (start={start}): {exc}")
            return [], laravel_failure(exc)
        if resp.status_code != 200:
            if resp.status_code == 401 and orch_store.auth_token() == token:
                orch_store.clear_auth()
            return [], _groups_failure("QY_WORD_GROUPS_FAILED", f"word groups HTTP {resp.status_code}")
        data = body.get("data") if isinstance(body, dict) else None
        page = data.get("groups") if isinstance(data, dict) else None
        if not isinstance(page, list):
            return [], _groups_failure("QY_WORD_GROUPS_FAILED", "word groups payload invalid")
        groups.extend(g for g in page if isinstance(g, dict) and g.get("gid"))
        if len(page) < _GROUPS_PAGE_SIZE:
            return groups, None
        start += _GROUPS_PAGE_SIZE


def _default_group_id(groups: List[Dict[str, Any]]) -> Optional[str]:
    for group in groups:
        if group.get("is_default"):
            return str(group["gid"])
    for group in groups:
        if group.get("is_language_default") and str(group.get("language") or "") == "en":
            return str(group["gid"])
    for group in groups:
        if group.get("is_language_default"):
            return str(group["gid"])
    return str(groups[0]["gid"]) if groups else None


def auth_groups(refresh: bool = False) -> Dict[str, Any]:
    """Word groups + the selected read-baseline group, served from the auth
    record cache; ``refresh=True`` re-pulls from Laravel."""
    record = orch_store.load_auth()
    if not record:
        return {"success": True, "logged_in": False, "word_groups": [], "word_group_id": None}
    groups = record.get("word_groups")
    if refresh or not isinstance(groups, list):
        groups, failure = _fetch_word_groups(record)
        if failure is not None:
            return {
                "success": False,
                "logged_in": True,
                "error": failure["error_code"],
                "detail": failure.get("detail") or "",
                "word_groups": record.get("word_groups") if isinstance(record.get("word_groups"), list) else [],
                "word_group_id": record.get("word_group_id"),
            }
        selected = str(record.get("word_group_id") or "")
        if not any(str(group.get("gid")) == selected for group in groups):
            selected = _default_group_id(groups) or ""
        updated = orch_store.update_auth({"word_groups": groups, "word_group_id": selected or None})
        if updated is None:
            return {"success": False, "logged_in": False, "error": "Qy account session expired", "word_groups": [], "word_group_id": None}
        record = updated
    return {
        "success": True,
        "logged_in": True,
        "word_groups": record.get("word_groups") or [],
        "word_group_id": record.get("word_group_id"),
    }


def auth_select_group(group_id: str) -> Dict[str, Any]:
    group_id = str(group_id or "").strip()
    record = orch_store.load_auth()
    if not record:
        return {"success": False, "logged_in": False, "error": "not logged in"}
    groups = record.get("word_groups") if isinstance(record.get("word_groups"), list) else []
    if not any(str(group.get("gid")) == group_id for group in groups):
        return {"success": False, "error": "QY_WORD_GROUP_NOT_FOUND"}
    if orch_store.update_auth({"word_group_id": group_id}) is None:
        return {"success": False, "error": "word group selection could not be persisted"}
    return {"success": True, "logged_in": True, "word_groups": groups, "word_group_id": group_id}


__all__ = [
    "auth_groups",
    "auth_login",
    "auth_logout",
    "auth_select_group",
    "auth_status",
]
