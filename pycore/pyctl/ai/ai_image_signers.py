#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from google.oauth2 import service_account as _gcp_service_account
from google.auth.transport.requests import Request as _GcpAuthRequest
"""
ai_image_signers - pure crypto / auth signers for the image-generation providers.

Three self-contained signing helpers used only by ai_image_providers:
  - _spark_tti_signed_url  : iFlytek Spark host/date/request-line HMAC-SHA256.
  - _aws_sigv4_headers     : minimal AWS SigV4 (stdlib only, no boto3) for Bedrock.
  - _vertex_access_token   : Google service-account JSON -> short-lived OAuth
                             access token (cached in _vertex_token_cache).

These are PURE functions over their inputs (plus the Vertex token cache, which is
local to this module - it is NOT part of the shared gateway singleton state in
ai_gateway_state; it caches only Vertex SA tokens and is read by exactly one
caller). Keeping them out of ai_image_providers lets that module stay focused on
HTTP request/response shaping.
"""

import base64
import hashlib
import hmac
import json
import time
from email.utils import formatdate
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote

from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized

# Optional: google-auth for Vertex AI service-account OAuth (RS256 JWT -> token).
try:
    _GCP_AUTH_AVAILABLE = True
except Exception:  # noqa: BLE001 - optional dep; Vertex helper guards on this flag
    _gcp_service_account = None
    _GcpAuthRequest = None
    _GCP_AUTH_AVAILABLE = False


# --------------------------------------------------------------------------- #
# iFlytek Spark text-to-image (tti) HMAC signer                                #
# --------------------------------------------------------------------------- #
_SPARK_TTI_HOST = "spark-api.cn-huabei-1.xf-yun.com"
_SPARK_TTI_PATH = "/v2.1/tti"


def _spark_tti_signed_url(api_key: str, api_secret: str) -> str:
    """Build the query-param-signed Spark tti URL (iFlytek's standard
    host/date/request-line HMAC-SHA256 scheme)."""
    date = formatdate(timeval=None, localtime=False, usegmt=True)
    origin = f"host: {_SPARK_TTI_HOST}\ndate: {date}\nPOST {_SPARK_TTI_PATH} HTTP/1.1"
    signature = base64.b64encode(
        hmac.new(api_secret.encode(), origin.encode(), hashlib.sha256).digest()).decode()
    auth_origin = (f'api_key="{api_key}", algorithm="hmac-sha256", '
                   f'headers="host date request-line", signature="{signature}"')
    authorization = base64.b64encode(auth_origin.encode()).decode()
    qs = f"authorization={quote(authorization)}&date={quote(date)}&host={_SPARK_TTI_HOST}"
    return f"https://{_SPARK_TTI_HOST}{_SPARK_TTI_PATH}?{qs}"


# --------------------------------------------------------------------------- #
# AWS SigV4 signer (Bedrock)                                                   #
# --------------------------------------------------------------------------- #
def _aws_sigv4_headers(access_key: str, secret_key: str, region: str, service: str,
                       host: str, path: str, body: bytes,
                       amz_date: str, date_stamp: str) -> Dict[str, str]:
    """Minimal AWS SigV4 signer (stdlib only) for Bedrock - no boto3 dependency."""
    payload_hash = hashlib.sha256(body).hexdigest()
    canonical_headers = (f"content-type:application/json\nhost:{host}\n"
                         f"x-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n")
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"
    canonical_request = f"POST\n{path}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
    algorithm = "AWS4-HMAC-SHA256"
    scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = (f"{algorithm}\n{amz_date}\n{scope}\n"
                      f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}")

    def _sign(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    k_date = _sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, service)
    k_signing = _sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    authorization = (f"{algorithm} Credential={access_key}/{scope}, "
                     f"SignedHeaders={signed_headers}, Signature={signature}")
    return {"Content-Type": "application/json", "X-Amz-Date": amz_date,
            "X-Amz-Content-Sha256": payload_hash, "Authorization": authorization}


# --------------------------------------------------------------------------- #
# Vertex AI service-account OAuth                                             #
# --------------------------------------------------------------------------- #
# Vertex OAuth access-token cache (keyed by SA client_email; tokens last ~1h).
# Local to this module - NOT shared gateway singleton state (ai_gateway_state).
_vertex_token_cache: Dict[str, Dict[str, Any]] = {}
_VERTEX_TOKEN_QUEUE = 'pyctl.ai.vertex_token_cache'
_VERTEX_TOKEN_WORKER = SerializedWorkerThread(
    _VERTEX_TOKEN_QUEUE,
    'VertexTokenCacheThread',
)
_VERTEX_TOKEN_WORKER.start()


def _refresh_vertex_access_token(sa_json_str: str) -> Tuple[Optional[str], Optional[str]]:
    """Service-account JSON -> short-lived OAuth access token (cached). Returns
    (token, None) or (None, error)."""
    if not _GCP_AUTH_AVAILABLE:
        return None, "google-auth not installed (pip install google-auth)"
    try:
        info = json.loads(sa_json_str)
    except Exception:  # noqa: BLE001
        return None, "invalid service-account JSON"
    cache_key = f"{info.get('client_email', '')}:{info.get('private_key_id', '')}"
    now = time.time()
    cached = _vertex_token_cache.get(cache_key)
    if cached and cached["exp"] - 60 > now:
        return cached["token"], None
    try:
        creds = _gcp_service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(_GcpAuthRequest())
    except Exception as e:  # noqa: BLE001
        return None, f"OAuth refresh failed: {e}"
    _vertex_token_cache[cache_key] = {"token": creds.token, "exp": now + 3000}
    return creds.token, None


def _vertex_access_token(sa_json_str: str) -> Tuple[Optional[str], Optional[str]]:
    """Resolve a Vertex token on the cache owner thread."""
    return call_serialized(
        _VERTEX_TOKEN_QUEUE,
        _refresh_vertex_access_token,
        sa_json_str,
        timeout=60.0,
    )
