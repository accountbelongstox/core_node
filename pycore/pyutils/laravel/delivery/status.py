# -*- coding: utf-8 -*-
"""Delivery status: per-kind queue counters and the outbox overview."""

from typing import Any, Dict, List, Tuple

from pycore.database.repositories.laravel_delivery_repository import STATE_DEAD_LETTER, STATE_PENDING
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.laravel.delivery.model import PAYLOAD_STAGE, active_namespace
from pycore.pyutils.laravel.delivery.reconciler import delivery_reconciler
from pycore.pyutils.laravel.delivery.scheduler import delivery_scheduler
from pycore.pyutils.laravel.delivery.store import delivery_store
from pycore.pyutils.laravel.endpoint_manager import LARAVEL_ONLINE_SIGNAL, laravel_endpoint_manager


def _by_stage(pending: List[Dict[str, Any]], steps: Tuple[str, ...]) -> Dict[str, int]:
    by_stage: Dict[str, int] = {PAYLOAD_STAGE: 0, **{step: 0 for step in steps}}
    for group in pending:
        if group["stage"]:
            by_stage[group["stage"]] = by_stage.get(group["stage"], 0) + group["count"]
    return by_stage


def _scoped_stats(kind: str, namespace: str, groups: List[Dict[str, Any]], steps: Tuple[str, ...]) -> Dict[str, Any]:
    pending = [group for group in groups if group["state"] == STATE_PENDING]
    scoped = delivery_store.scoped_metrics(kind, namespace)
    metrics = scoped["metrics"]
    return {
        "pending": sum(group["count"] for group in pending),
        "in_flight": sum(group["leased"] for group in pending),
        "dead_letter": sum(group["count"] for group in groups if group["state"] == STATE_DEAD_LETTER),
        "by_stage": _by_stage(pending, steps),
        "next_retry_at": min((group["next_attempt_at"] for group in pending), default=None) or None,
        "delivered_state": scoped["delivered_state"],
        "last_error": scoped["last_error"],
        "delivered": int(metrics.get("delivered") or 0),
        "failures": int(metrics.get("failures") or 0),
        "last_delivered_at": metrics.get("last_delivered_at"),
        "last_failure": metrics.get("last_error") or "",
        "last_failure_at": metrics.get("last_error_at"),
        "diff": delivery_reconciler.diff_status(namespace, kind),
    }


def kind_stats(kind: str) -> Dict[str, Any]:
    """Queue counters of one kind; every server entry says whether it is the
    selected one, whether it is offline, and how many rows are parked (queued
    for a server that is not selected, so not attempted)."""
    definition = delivery_store.definition(kind)
    groups = delivery_store.stage_counts(kind)
    # Servers with live rows, a diff status or delivery metrics: a server whose
    # rows were all delivered still reports its delivered/failure counts.
    namespaces = sorted(
        {group["namespace"] for group in groups}
        | set(delivery_reconciler.diff_namespaces(kind))
        | set(delivery_store.metric_namespaces(kind))
    )
    steps = definition.steps if definition else ()
    by_namespace = {
        namespace: _scoped_stats(kind, namespace, [group for group in groups if group["namespace"] == namespace], steps)
        for namespace in namespaces
    }
    pending = [group for group in groups if group["state"] == STATE_PENDING]
    selected = active_namespace()
    for namespace, entry in by_namespace.items():
        entry["selected"] = namespace == selected
        entry["offline"] = laravel_endpoint_manager.namespace_reachable(namespace) is False
        entry["parked"] = 0 if namespace == selected else entry["pending"]
    entries = list(by_namespace.values())
    return {
        "kind": kind,
        "registered": definition is not None,
        "inventory": definition is not None and definition.inventory is not None,
        "total": sum(group["count"] for group in groups),
        "pending": sum(group["count"] for group in pending),
        "in_flight": sum(group["leased"] for group in pending),
        "dead_letter": sum(group["count"] for group in groups if group["state"] == STATE_DEAD_LETTER),
        "delivered_receipts": sum(entry["delivered_state"] for entry in entries),
        "by_stage": _by_stage(pending, steps),
        "oldest_pending_at": min((group["oldest"] for group in pending), default=None),
        "next_retry_at": min((group["next_attempt_at"] for group in pending), default=None) or None,
        "last_error": next((entry["last_error"] for entry in entries if entry["last_error"]), ""),
        "delivered": sum(entry["delivered"] for entry in entries),
        "failures": sum(entry["failures"] for entry in entries),
        "last_delivered_at": max((entry["last_delivered_at"] or 0 for entry in entries), default=0) or None,
        "last_failure": next((entry["last_failure"] for entry in entries if entry["last_failure"]), ""),
        "last_failure_at": max((entry["last_failure_at"] or 0 for entry in entries), default=0) or None,
        "running": delivery_store.running(kind),
        "by_namespace": by_namespace,
        "parked": sum(entry["parked"] for entry in entries),
    }


def outbox_status() -> Dict[str, Any]:
    online = THREAD_BUS.get_signal(LARAVEL_ONLINE_SIGNAL) or {}
    return {
        "kinds": {name: kind_stats(name) for name in delivery_store.kinds()},
        "servers": laravel_endpoint_manager.known_servers(),
        "active_namespace": active_namespace(),
        "selected_namespace": active_namespace(),
        "offline_namespaces": delivery_scheduler.offline_namespaces(),
        "reconciling": delivery_reconciler.reconciling_namespaces(),
        "laravel_online_at": online.get("at") if isinstance(online, dict) else None,
        "laravel_base_url": laravel_endpoint_manager.get_active_base_url(),
    }
