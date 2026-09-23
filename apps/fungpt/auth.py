"""Optional Bearer auth for the FunGPT sidecar."""

from __future__ import annotations

import os

from fastapi import Header, HTTPException


def configured_api_key() -> str | None:
    key = (os.environ.get("FUNGPT_API_KEY") or os.environ.get("BANTER_LLM_API_KEY") or "").strip()
    return key or None


async def require_api_key(authorization: str | None = Header(default=None)) -> None:
    expected = configured_api_key()
    if not expected:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[len("Bearer ") :].strip()
    if token != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")
