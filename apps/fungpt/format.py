"""OpenAI-compatible chat completion payloads."""

from __future__ import annotations

import json
import time
import uuid
from typing import Any


def _id() -> str:
    return f"chatcmpl-{uuid.uuid4().hex[:24]}"


def chat_completion_response(text: str, model: str) -> dict[str, Any]:
    return {
        "id": _id(),
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }


def chat_completion_chunk(
    delta: str,
    model: str,
    *,
    finish: bool = False,
    chunk_id: str | None = None,
) -> dict[str, Any]:
    choice: dict[str, Any] = {
        "index": 0,
        "delta": {} if finish else {"content": delta},
        "finish_reason": "stop" if finish else None,
    }
    return {
        "id": chunk_id or _id(),
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [choice],
    }


def sse_line(payload: dict[str, Any] | str) -> str:
    if isinstance(payload, str):
        return f"data: {payload}\n\n"
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
