"""Lazy FunGPT InternLM loaders. Weights stay under FUNGPT_ROOT."""

from __future__ import annotations

import os
import sys
import threading
import types
from pathlib import Path
from typing import Any, Iterable

from prompt import MODEL_REL_PATHS, deltas_from_accumulated, resolve_model

DEFAULT_FUNGPT_ROOT = "/home/shivam/work/FunGPT"

_lock = threading.Lock()
_models: dict[str, Any] = {}


def fungpt_root() -> Path:
    return Path(os.environ.get("FUNGPT_ROOT", DEFAULT_FUNGPT_ROOT)).expanduser().resolve()


def model_dir(model_id: str) -> Path:
    resolved = resolve_model(model_id)
    return fungpt_root() / MODEL_REL_PATHS[resolved]


def model_available(model_id: str) -> bool:
    path = model_dir(model_id)
    if not (path / "config.json").is_file():
        return False
    return any(path.glob("*.safetensors")) or any(path.glob("*.bin"))


def _ensure_streamlit_stub() -> None:
    """FunGPT's GenerationConfig module imports streamlit even for offline use."""
    if "streamlit" in sys.modules:
        return
    try:
        import streamlit  # noqa: F401
    except ImportError:
        stub = types.ModuleType("streamlit")
        stub.sidebar = types.SimpleNamespace(
            subheader=lambda *a, **k: None,
            checkbox=lambda *a, **k: False,
            slider=lambda *a, **k: 0,
            selectbox=lambda *a, **k: None,
            button=lambda *a, **k: False,
        )
        sys.modules["streamlit"] = stub


def _internlm_class():
    root = str(fungpt_root())
    if root not in sys.path:
        sys.path.insert(0, root)
    _ensure_streamlit_stub()
    from LLM.models.internlm2_5_7b_chat import InternLM  # type: ignore

    return InternLM


def get_model(model_id: str):
    resolved = resolve_model(model_id)
    with _lock:
        cached = _models.get(resolved)
        if cached is not None:
            return cached
        path = model_dir(resolved)
        InternLM = _internlm_class()
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
