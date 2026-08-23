# -*- coding: utf-8 -*-
"""RPC idempotency, Relay execution, and durable delivery repository mixin."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


class StateRpcRepositoryMixin:
    """Compose RPC-specific persistence into the shared state repository."""
    def _delivery_envelope(
        self,
        client_id: str,
        event_id: str,
        seq: int,
        topic: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "type": "server_event",
            "client_id": client_id,
            "event_id": event_id,
            "seq": seq,
            "topic": topic,
            "entity_id": payload.get("operation_id"),
            "revision": int(payload.get("operation_revision") or 0),
            "requires_ack": True,
            "payload": payload,
        }

    def _get_existing_delivery(
        self,
        cursor: sqlite3.Cursor,
        client_id: str,
        event_id: str,
    ) -> Optional[Dict[str, Any]]:
        cursor.execute(
            """
            SELECT seq, topic, payload_json
            FROM rpc_client_delivery
            WHERE client_id = ? AND event_id = ?
            """,
            (client_id, event_id),
        )
        row = cursor.fetchone()
        if not row:
            return None
        payload = json.loads(row[2]) if row[2] else {}
        return self._delivery_envelope(client_id, event_id, int(row[0]), row[1], payload)

    def _advance_contiguous_offset(self, cursor: sqlite3.Cursor, client_id: str) -> int:
        cursor.execute(
            "SELECT highest_contiguous_acked_seq FROM rpc_client_offset WHERE client_id = ?",
            (client_id,),
        )
        row = cursor.fetchone()
        offset = int(row[0]) if row and row[0] is not None else 0
        cursor.execute(
            """
            SELECT seq FROM rpc_client_delivery
            WHERE client_id = ? AND status = 'acked' AND seq > ?
            ORDER BY seq ASC
            """,
            (client_id, offset),
        )
        expected = offset + 1
        for (seq_value,) in cursor.fetchall():
            if int(seq_value) != expected:
                break
            offset = expected
            expected += 1
        cursor.execute(
            """
            INSERT INTO rpc_client_offset (client_id, highest_contiguous_acked_seq, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(client_id) DO UPDATE SET
                highest_contiguous_acked_seq = excluded.highest_contiguous_acked_seq,
                updated_at = excluded.updated_at
            """,
            (client_id, offset, self._now_iso()),
        )
        return offset

    def append_client_delivery(
        self,
        client_id: str,
        event_id: str,
        topic: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        payload_json = json.dumps(payload)
        with self.transaction() as cursor:
            existing = self._get_existing_delivery(cursor, client_id, event_id)
            if existing is not None:
                return existing
            seq = self._next_client_seq(cursor, client_id)
            cursor.execute(
                """
                INSERT INTO rpc_client_delivery (
                    client_id, event_id, seq, topic, payload_json,
                    status, attempt, error_json, sent_at, acked_at
                ) VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, NULL)
                """,
                (client_id, event_id, seq, topic, payload_json),
            )
        return self._delivery_envelope(client_id, event_id, seq, topic, payload)


    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def get_idempotent_operation_id(
        self,
        client_id: str,
        idempotency_key: str,
        route: str,
    ) -> Optional[str]:
        with self.read_transaction() as cursor:
            cursor.execute(
                """
                SELECT operation_id FROM rpc_command_idempotency
                WHERE client_id = ? AND idempotency_key = ? AND route = ?
                """,
                (client_id, idempotency_key, route),
            )
            row = cursor.fetchone()
            if not row or not row[0]:
                return None
            return str(row[0])

    def get_command_idempotency(
        self,
        client_id: str,
        route: str,
        idempotency_key: str,
    ) -> Optional[Dict[str, Any]]:
        with self.read_transaction() as cursor:
            cursor.execute(
                """
                SELECT status, response_json, error_json, operation_id
                FROM rpc_command_idempotency
                WHERE client_id = ? AND idempotency_key = ? AND route = ?
                """,
                (client_id, idempotency_key, route),
            )
            row = cursor.fetchone()
            if not row:
                return None
            response_json = json.loads(row[1]) if row[1] else None
            error_json = json.loads(row[2]) if row[2] else None
            return {
                "status": row[0],
                "response_json": response_json,
                "error_json": error_json,
                "operation_id": row[3],
            }

    def save_idempotency_record(
        self,
        client_id: str,
        idempotency_key: str,
        route: str,
        operation_id: str,
        status: str = "accepted",
        response_json: Optional[Dict[str, Any]] = None,
        error_json: Optional[Dict[str, Any]] = None,
        request_hash: Optional[str] = None,
    ) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO rpc_command_idempotency (
                    client_id, idempotency_key, route, operation_id,
                    request_hash, status, response_json, error_json,
                    expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(client_id, idempotency_key, route) DO UPDATE SET
                    operation_id = excluded.operation_id,
                    status = excluded.status,
                    response_json = excluded.response_json,
                    error_json = excluded.error_json
                """,
                (
                    client_id,
                    idempotency_key,
                    route,
                    operation_id,
                    request_hash,
                    status,
                    json.dumps(response_json) if response_json else None,
                    json.dumps(error_json) if error_json else None,
                    None,
                    self._now_iso(),
                ),
            )

    def save_command_idempotency_pending(
        self,
        client_id: str,
        route: str,
        idempotency_key: str,
        request_id: Optional[str] = None,
    ) -> bool:
        """Insert pending idempotency row; returns False if already completed."""
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT status FROM rpc_command_idempotency
                WHERE client_id = ? AND idempotency_key = ? AND route = ?
                """,
                (client_id, idempotency_key, route),
            )
            row = cursor.fetchone()
            if row and str(row[0]) == "completed":
                return False
            cursor.execute(
                """
                INSERT INTO rpc_command_idempotency (
                    client_id, idempotency_key, route, operation_id,
                    request_hash, status, response_json, error_json,
                    expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)
                ON CONFLICT(client_id, idempotency_key, route) DO UPDATE SET
                    status = CASE
                        WHEN rpc_command_idempotency.status = 'completed'
                        THEN rpc_command_idempotency.status
                        ELSE 'pending'
                    END
                """,
                (
                    client_id,
                    idempotency_key,
                    route,
                    request_id,
                    request_id,
                    self._now_iso(),
                ),
            )
            return True

    def save_command_idempotency_response(
        self,
        client_id: str,
        route: str,
        idempotency_key: str,
        response_json: Dict[str, Any],
        status: str = "completed",
        error_json: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO rpc_command_idempotency (
                    client_id, idempotency_key, route, operation_id,
                    request_hash, status, response_json, error_json,
                    expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
                ON CONFLICT(client_id, idempotency_key, route) DO UPDATE SET
                    status = excluded.status,
                    response_json = excluded.response_json,
                    error_json = excluded.error_json
                """,
                (
                    client_id,
                    idempotency_key,
                    route,
                    response_json.get("request_id"),
                    response_json.get("request_id"),
                    status,
                    json.dumps(response_json),
                    json.dumps(error_json) if error_json else None,
                    self._now_iso(),
                ),
            )

    def ensure_relay_execution_result(
        self,
        operation_id: str,
        request_digest: str,
        route: str,
        retry_policy: str,
    ) -> Dict[str, Any]:
        """Create one Relay result slot and reject digest reuse conflicts."""
        now = self._now_iso()
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT OR IGNORE INTO relay_execution_results (
                    operation_id, request_digest, route, retry_policy,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    operation_id,
                    request_digest,
                    route,
                    retry_policy,
                    now,
                    now,
                ),
            )
            cursor.execute(
                """
                SELECT operation_id, request_digest, route, retry_policy,
                       response_status, response_headers_json, response_body,
                       response_has_body, response_digest, response_length,
                       response_outcome, created_at, updated_at
                FROM relay_execution_results
                WHERE operation_id = ?
                """,
                (operation_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise RuntimeError("relay_execution_result_missing")
            if str(row[1]) != str(request_digest):
                raise ValueError("relay_operation_request_digest_conflict")
            if str(row[2]) != str(route):
                raise ValueError("relay_operation_route_conflict")
            if str(row[3]) != str(retry_policy):
                raise ValueError("relay_operation_retry_policy_conflict")
            return self._relay_execution_result(row)

    def get_relay_execution_result(
        self,
        operation_id: str,
    ) -> Optional[Dict[str, Any]]:
        with self.read_transaction() as cursor:
            cursor.execute(
                """
                SELECT operation_id, request_digest, route, retry_policy,
                       response_status, response_headers_json, response_body,
                       response_has_body, response_digest, response_length,
                       response_outcome, created_at, updated_at
                FROM relay_execution_results
                WHERE operation_id = ?
                """,
                (operation_id,),
            )
            row = cursor.fetchone()
            return self._relay_execution_result(row) if row else None

    def save_relay_execution_response(
        self,
        operation_id: str,
        request_digest: str,
        status_code: int,
        headers: Dict[str, str],
        body: bytes,
        has_body: bool,
        response_digest: str,
        response_outcome: str,
    ) -> Dict[str, Any]:
        """Persist an exact response once; identical retries are no-ops."""
        now = self._now_iso()
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT request_digest, response_digest, response_outcome
                FROM relay_execution_results
                WHERE operation_id = ?
                """,
                (operation_id,),
            )
            current = cursor.fetchone()
            if not current:
                raise RuntimeError("relay_execution_result_missing")
            if str(current[0]) != str(request_digest):
                raise ValueError("relay_operation_request_digest_conflict")
            existing_digest = str(current[1] or "")
            if existing_digest and existing_digest != str(response_digest):
                raise ValueError("relay_operation_response_digest_conflict")
            existing_outcome = str(current[2] or "")
            if existing_outcome and existing_outcome != str(response_outcome):
                raise ValueError("relay_operation_response_outcome_conflict")
            if not existing_digest:
                cursor.execute(
                    """
                    UPDATE relay_execution_results
                    SET response_status = ?, response_headers_json = ?,
                        response_body = ?, response_has_body = ?, response_digest = ?,
                        response_length = ?, response_outcome = ?, updated_at = ?
                    WHERE operation_id = ? AND response_digest IS NULL
                    """,
                    (
                        int(status_code),
                        json.dumps(headers, ensure_ascii=False),
                        sqlite3.Binary(body),
                        1 if has_body else 0,
                        response_digest,
                        len(body),
                        str(response_outcome),
                        now,
                        operation_id,
                    ),
                )
        result = self.get_relay_execution_result(operation_id)
        if result is None:
            raise RuntimeError("relay_execution_result_missing")
        return result

    @staticmethod
    def _relay_execution_result(row: tuple) -> Dict[str, Any]:
        return {
            "operation_id": str(row[0]),
            "request_digest": str(row[1]),
            "route": str(row[2]),
            "retry_policy": str(row[3]),
            "response_status": int(row[4]) if row[4] is not None else None,
            "response_headers": json.loads(row[5]) if row[5] else {},
            "response_body": bytes(row[6]) if row[6] is not None else None,
            "response_has_body": bool(row[7]),
            "response_digest": str(row[8] or ""),
            "response_length": int(row[9]) if row[9] is not None else None,
            "response_outcome": str(row[10] or ""),
            "created_at": str(row[11]),
            "updated_at": str(row[12]),
        }

    def authenticate_client_session(
        self,
        client_id: str,
        resume_token: Optional[str],
    ) -> Tuple[bool, str]:
        """
        Validate or create a durable client session.

        Returns (authenticated, resume_token). When authentication fails the token is empty.
        """
        with self.read_transaction() as cursor:
            cursor.execute(
                "SELECT resume_token FROM rpc_client_sessions WHERE client_id = ?",
                (client_id,),
            )
            row = cursor.fetchone()
            if row:
                stored = str(row[0])
                return (True, stored) if resume_token and resume_token == stored else (False, "")

        now = self._now_iso()
        new_token = uuid.uuid4().hex
        with self.transaction() as cursor:
            cursor.execute(
                "SELECT resume_token FROM rpc_client_sessions WHERE client_id = ?",
                (client_id,),
            )
            row = cursor.fetchone()
            if row:
                stored = str(row[0])
                return (True, stored) if resume_token and resume_token == stored else (False, "")
            cursor.execute(
                """
                INSERT INTO rpc_client_sessions (client_id, resume_token, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (client_id, new_token, now, now),
            )
            return True, new_token

    def _next_client_seq(self, cursor: sqlite3.Cursor, client_id: str) -> int:
        cursor.execute(
            "SELECT MAX(seq) FROM rpc_client_delivery WHERE client_id = ?",
            (client_id,),
        )
        row = cursor.fetchone()
        current = int(row[0]) if row and row[0] is not None else 0
        return current + 1

    def enqueue_client_event(
        self,
        client_id: str,
        topic: str,
        payload: Dict[str, Any],
        event_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        revision: int = 0,
        causation_id: Optional[str] = None,
        audience: str = "client",
    ) -> Dict[str, Any]:
        event_id = event_id or uuid.uuid4().hex
        created_at = self._now_iso()
        payload_json = json.dumps(payload)
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT OR IGNORE INTO rpc_event_outbox (
                    event_id, topic, entity_type, entity_id, revision,
                    causation_id, payload_json, audience, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    topic,
                    entity_type,
                    entity_id,
                    revision,
                    causation_id,
                    payload_json,
                    audience,
                    created_at,
                ),
            )
            existing = self._get_existing_delivery(cursor, client_id, event_id)
            if existing is not None:
                return existing
            seq = self._next_client_seq(cursor, client_id)
            cursor.execute(
                """
                INSERT INTO rpc_client_delivery (
                    client_id, event_id, seq, topic, payload_json,
                    status, attempt, error_json, sent_at, acked_at
                ) VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, NULL)
                """,
                (client_id, event_id, seq, topic, payload_json),
            )
        return self._delivery_envelope(
            client_id,
            event_id,
            seq,
            topic,
            payload,
        )

    def mark_delivery_sent(self, client_id: str, event_id: str) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                UPDATE rpc_client_delivery
                SET status = 'sent', sent_at = ?
                WHERE client_id = ? AND event_id = ?
                """,
                (self._now_iso(), client_id, event_id),
            )

    def ack_client_delivery(self, client_id: str, event_id: str, seq: int) -> bool:
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT seq, status FROM rpc_client_delivery
                WHERE client_id = ? AND event_id = ?
                """,
                (client_id, event_id),
            )
            row = cursor.fetchone()
            if not row or int(row[0]) != int(seq):
                return False
            cursor.execute(
                """
                UPDATE rpc_client_delivery
                SET status = 'acked', acked_at = ?
                WHERE client_id = ? AND event_id = ?
                """,
                (self._now_iso(), client_id, event_id),
            )
            self._advance_contiguous_offset(cursor, client_id)
            return True

    def get_client_offset(self, client_id: str) -> int:
        with self.read_transaction() as cursor:
            cursor.execute(
                "SELECT highest_contiguous_acked_seq FROM rpc_client_offset WHERE client_id = ?",
                (client_id,),
            )
            row = cursor.fetchone()
            return int(row[0]) if row and row[0] is not None else 0

    def list_durable_client_ids(self) -> List[str]:
        with self.read_transaction() as cursor:
            cursor.execute(
                """
                SELECT client_id FROM rpc_client_offset
                UNION
                SELECT DISTINCT client_id FROM rpc_client_delivery
                """
            )
            return [str(row[0]) for row in cursor.fetchall() if row and row[0]]

    def replay_unacked_deliveries(
        self,
        client_id: str,
        after_seq: int = 0,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        with self.read_transaction() as cursor:
            cursor.execute(
                """
                SELECT event_id, seq, topic, payload_json
                FROM rpc_client_delivery
                WHERE client_id = ? AND seq > ? AND status != 'acked'
                ORDER BY seq ASC LIMIT ?
                """,
                (client_id, after_seq, limit),
            )
            rows = cursor.fetchall()
        deliveries: List[Dict[str, Any]] = []
        for event_id, seq, topic, payload_json in rows:
            payload = json.loads(payload_json) if payload_json else {}
            deliveries.append(
                {
                    "type": "server_event",
                    "client_id": client_id,
                    "event_id": event_id,
                    "seq": int(seq),
                    "topic": topic,
                    "requires_ack": True,
                    "payload": payload,
                }
            )
        return deliveries


