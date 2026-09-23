"""InternLM2 chat prompt formatting (Streamlit-free FunGPT equivalent)."""

from __future__ import annotations

from typing import Iterable, Mapping, Sequence

USER_TURN = "<|im_start|>user\n{user}<|im_end|>\n"
ASSISTANT_TURN = "<|im_start|>assistant\n{assistant}<|im_end|>\n"
QUERY_TAIL = "<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n"

MODEL_ALIASES = {
    "banter": "banterbot",
    "banterbot": "banterbot",
}


def resolve_model(name: str | None) -> str:
    key = (name or "banterbot").strip().lower()
    if key not in MODEL_ALIASES:
        raise ValueError(f"Unknown model {name!r}; expected banterbot")
    return MODEL_ALIASES[key]


def messages_to_prompt(messages: Sequence[Mapping[str, str]]) -> str:
    """Build an InternLM2 chat string from OpenAI-style messages.

    Honors caller system prompts (table banter sends its own). The last
    user message becomes the current query; earlier turns are history.
    """
    system_parts: list[str] = []
    turns: list[tuple[str, str]] = []
    for raw in messages:
        role = str(raw.get("role") or "").strip().lower()
        content = str(raw.get("content") or "").strip()
        if not content:
            continue
        if role == "system":
            system_parts.append(content)
        elif role in ("user", "assistant"):
            turns.append((role, content))

    system = "\n\n".join(system_parts)
    prompt = f"<s><|im_start|>system\n{system}<|im_end|>\n"

    history = turns[:-1] if turns else []
    last = turns[-1] if turns else None
    for role, content in history:
        if role == "user":
            prompt += USER_TURN.format(user=content)
        else:
            prompt += ASSISTANT_TURN.format(assistant=content)

    if last and last[0] == "user":
        prompt += QUERY_TAIL.format(user=last[1])
    elif last and last[0] == "assistant":
        prompt += ASSISTANT_TURN.format(assistant=last[1])
        prompt += "<|im_start|>assistant\n"
    else:
        prompt += "<|im_start|>assistant\n"
    return prompt


def deltas_from_accumulated(chunks: Iterable[str]) -> Iterable[str]:
    """Convert FunGPT's accumulated streamer chunks into token deltas."""
    prev = ""
    for acc in chunks:
        if not isinstance(acc, str):
            continue
        if acc.startswith(prev):
            delta = acc[len(prev) :]
        else:
            delta = acc
        prev = acc
        if delta:
            yield delta
