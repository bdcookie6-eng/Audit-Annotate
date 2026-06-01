"""
Shared-auth middleware for the Audit-Annotate FastAPI service.

When deployed behind the Express host app, every request must carry a
short-lived JWT signed with the AUDIT_SECRET shared between Express and
FastAPI.  In development (AUDIT_SECRET not set) auth is skipped so the
service can be tested standalone.
"""

import os
import time
import hmac
import hashlib
import base64
import json
import logging
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

SECRET = os.getenv("AUDIT_SECRET", "")


def _verify_token(token: str) -> dict:
    """Verify a simple HMAC-signed audit token and return its payload."""
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
        expected_sig = hmac.new(
            SECRET.encode(),
            f"{header_b64}.{payload_b64}".encode(),
            hashlib.sha256,
        ).digest()
        actual_sig = base64.urlsafe_b64decode(sig_b64 + "==")
        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("bad signature")
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
        if payload.get("exp", 0) < time.time():
            raise ValueError("token expired")
        return payload
    except Exception as exc:
        raise HTTPException(401, f"Invalid audit token: {exc}") from exc


class AuditAuthMiddleware(BaseHTTPMiddleware):
    """
    Require a valid audit token on every non-health request when
    AUDIT_SECRET is configured.  In standalone / dev mode (no secret)
    all requests pass through.
    """

    EXEMPT = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        if not SECRET:
            # Dev mode — no secret configured, skip auth entirely
            return await call_next(request)

        path = request.url.path
        if path in self.EXEMPT:
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        # Also accept token from query param for SSE streams (EventSource)
        token = request.query_params.get("audit_token", "")

        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

        if not token:
            raise HTTPException(401, "Missing audit token")

        payload = _verify_token(token)
        request.state.user_id = payload.get("sub", "unknown")
        return await call_next(request)
