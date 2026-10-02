# -*- coding: utf-8 -*-
"""Relay execution result repository mixin."""

from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, Optional

from pycore.pyfoundations.time_utils import utc_now_iso


class StateRpcRepositoryMixin:
    """Compose relay execution persistence into the shared state repository."""

    def ensure_relay_execution_result(
        self,
        operation_id: str,
        request_digest: str,
        route: str,
        retry_policy: str,
    ) -> Dict[str, Any]:
        """Create one Relay result slot and reject digest reuse conflicts."""
        now = utc_now_iso()
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
        now = utc_now_iso()
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
