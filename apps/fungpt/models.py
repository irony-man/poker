"""Lazy BanterBot InternLM loaders."""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any, Iterable

from loader.internlm_chat import InternLM
from prompt import deltas_from_accumulated, resolve_model

APP_ROOT = Path(__file__).resolve().parent
DEFAULT_BANTERBOT_WEIGHTS = APP_ROOT / "weights" / "BanterBot_1_8b-chat"

_lock = threading.Lock()
_models: dict[str, Any] = {}


def banterbot_weights_dir() -> Path:
    override = (os.environ.get("BANTERBOT_WEIGHTS_DIR") or "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return DEFAULT_BANTERBOT_WEIGHTS


def model_dir(model_id: str) -> Path:
    resolve_model(model_id)
    return banterbot_weights_dir()


def model_available(model_id: str) -> bool:
    path = model_dir(model_id)
    if not (path / "config.json").is_file():
        return False
    return any(path.glob("*.safetensors")) or any(path.glob("*.bin"))


def get_model(model_id: str):
    resolved = resolve_model(model_id)
    with _lock:
        cached = _models.get(resolved)
        if cached is not None:
            return cached
        path = model_dir(resolved)
        llm = InternLM(model_path=str(path))
        _models[resolved] = llm
        return llm


def _gen_kwargs(
    *,
    max_tokens: int | None,
    temperature: float | None,
    top_p: float | None,
) -> dict[str, Any]:
    return {
        "max_new_tokens": max(1, int(max_tokens)) if max_tokens is not None else 256,
        "temperature": float(temperature) if temperature is not None else 0.8,
        "top_p": float(top_p) if top_p is not None else 0.8,
        "do_sample": True,
        "repetition_penalty": 1.005,
    }


def generate_deltas(
    model_id: str,
    prompt: str,
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
) -> Iterable[str]:
    llm = get_model(model_id)
    kwargs = _gen_kwargs(max_tokens=max_tokens, temperature=temperature, top_p=top_p)
    yield from deltas_from_accumulated(llm.generate(prompt, **kwargs))


def complete(
    model_id: str,
    prompt: str,
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
) -> str:
    return "".join(
        generate_deltas(
            model_id,
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
        )
    )
