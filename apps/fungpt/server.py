"""OpenAI-compatible FastAPI wrapper around FunGPT InternLM checkpoints."""

from __future__ import annotations

import asyncio
import queue
import threading
from typing import Any, AsyncIterator, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from format import chat_completion_chunk, chat_completion_response, sse_line
from models import complete, generate_deltas, model_available
from prompt import messages_to_prompt, resolve_model

app = FastAPI(title="Pokr FunGPT", version="0.1.0")


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = "banterbot"
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float | None = None
    top_p: float | None = None
    max_tokens: int | None = None
    stream: bool = False


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        import torch

        device = "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        device = "unknown"
    models = {
        "boostbot": model_available("boostbot"),
        "banterbot": model_available("banterbot"),
    }
    return {"ok": True, "device": device, "models": models}


def _gen_args(body: ChatCompletionRequest) -> dict[str, Any]:
    return {
        "max_tokens": body.max_tokens,
        "temperature": body.temperature,
        "top_p": body.top_p,
    }


@app.post("/v1/chat/completions")
async def chat_completions(body: ChatCompletionRequest):
    try:
        model_id = resolve_model(body.model)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not model_available(model_id):
        raise HTTPException(
            status_code=503,
            detail=f"Weights for {model_id} are not available under FUNGPT_ROOT",
        )

    prompt = messages_to_prompt([m.model_dump() for m in body.messages])
    kwargs = _gen_args(body)

    if body.stream:
        return StreamingResponse(
            _stream(model_id, prompt, kwargs),
            media_type="text/event-stream",
        )

    try:
        text = await asyncio.to_thread(complete, model_id, prompt, **kwargs)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - model runtime
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return chat_completion_response(text, model_id)


async def _stream(model_id: str, prompt: str, kwargs: dict[str, Any]) -> AsyncIterator[str]:
    q: queue.Queue[str | None] = queue.Queue()
    chunk_id = chat_completion_chunk("", model_id)["id"]

    def produce() -> None:
        try:
            for delta in generate_deltas(model_id, prompt, **kwargs):
                q.put(delta)
        except Exception as exc:
            q.put(f"__error__:{exc}")
        finally:
            q.put(None)

    threading.Thread(target=produce, daemon=True).start()
    while True:
        item = await asyncio.to_thread(q.get)
        if item is None:
            break
        if isinstance(item, str) and item.startswith("__error__:"):
            err = {"error": {"message": item[len("__error__:") :]}}
            yield sse_line(err)
            return
        yield sse_line(chat_completion_chunk(item, model_id, chunk_id=chunk_id))
    yield sse_line(chat_completion_chunk("", model_id, finish=True, chunk_id=chunk_id))
    yield sse_line("[DONE]")
