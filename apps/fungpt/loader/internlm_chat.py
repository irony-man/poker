"""
InternLM2 chat wrapper for local BanterBot checkpoints.

Adapted from FunGPT LLM/models/internlm2_5_7b_chat.py (offline inference only).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from threading import Thread
from typing import Optional, Union

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer


@dataclass
class GenerationConfig:
    max_new_tokens: int = 256
    top_p: float = 0.8
    temperature: float = 0.8
    do_sample: bool = True
    repetition_penalty: float = 1.005


class InternLM:
    def __init__(self, mode: str = "offline", model_path: Union[str, Path] = ""):
        self.mode = mode
        self.model, self.tokenizer = self.init_model(model_path)
        self.history = None
        assert self.mode == "offline", "InternLM wrapper supports offline mode only"

    def init_model(self, model_path: Union[str, Path]):
        path = Path(model_path).expanduser().resolve()
        if not path.is_dir():
            raise FileNotFoundError(
                f"LLM weights not found at:\n  {path}\n\n"
                "Download BanterBot weights, for example:\n"
                "  ./scripts/download-banterbot-weights.sh"
            )
        if not (path / "config.json").is_file():
            raise FileNotFoundError(
                f"Invalid model directory (missing config.json):\n  {path}"
            )
        has_weights = any(path.glob("*.safetensors")) or any(path.glob("*.bin"))
        if not has_weights:
            raise FileNotFoundError(
                f"Model at {path} is incomplete (no .bin / .safetensors weights).\n"
                "Wait for the download to finish or run: ./scripts/download-banterbot-weights.sh"
            )

        load_kwargs = {
            "trust_remote_code": True,
            "local_files_only": True,
        }
        if torch.cuda.is_available():
            load_kwargs["device_map"] = "auto"
        else:
            load_kwargs["device_map"] = "cpu"
            load_kwargs["torch_dtype"] = torch.float32

        model = AutoModelForCausalLM.from_pretrained(str(path), **load_kwargs).eval()
        tokenizer = AutoTokenizer.from_pretrained(
            str(path),
            trust_remote_code=True,
            local_files_only=True,
        )
        return model, tokenizer

    def _eos_token_ids(self):
        eos_ids = [self.tokenizer.eos_token_id]
        try:
            im_end = self.tokenizer.convert_tokens_to_ids("<|im_end|>")
            if im_end is not None and im_end not in eos_ids:
                eos_ids.append(im_end)
        except (KeyError, ValueError, TypeError):
            pass
        return [i for i in eos_ids if i is not None]

    @torch.inference_mode()
    def generate(
        self,
        prompt,
        generation_config: Optional[GenerationConfig] = None,
        **kwargs,
    ):
        if generation_config is None:
            generation_config = GenerationConfig()

        device = next(self.model.parameters()).device
        inputs = self.tokenizer([prompt], return_tensors="pt", padding=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        input_len = inputs["input_ids"].shape[-1]

        max_new_tokens = kwargs.get("max_new_tokens", generation_config.max_new_tokens)
        if "max_length" in kwargs and kwargs["max_length"]:
            max_new_tokens = min(
                max_new_tokens,
                max(16, int(kwargs["max_length"]) - input_len),
            )

        streamer = TextIteratorStreamer(
            self.tokenizer,
            skip_prompt=True,
            skip_special_tokens=True,
        )
        gen_kwargs = {
            **inputs,
            "max_new_tokens": max_new_tokens,
            "top_p": kwargs.get("top_p", generation_config.top_p),
            "temperature": kwargs.get("temperature", generation_config.temperature),
            "do_sample": kwargs.get("do_sample", generation_config.do_sample),
            "repetition_penalty": kwargs.get(
                "repetition_penalty",
                generation_config.repetition_penalty,
            ),
            "eos_token_id": self._eos_token_ids(),
            "streamer": streamer,
        }

        thread = Thread(target=self.model.generate, kwargs=gen_kwargs)
        thread.start()

        accumulated = ""
        for chunk in streamer:
            accumulated += chunk
            yield accumulated

        thread.join()
