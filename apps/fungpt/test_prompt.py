import unittest

from format import chat_completion_chunk, chat_completion_response, sse_line
from prompt import deltas_from_accumulated, messages_to_prompt, resolve_model


class ResolveModelTests(unittest.TestCase):
    def test_aliases(self):
        self.assertEqual(resolve_model("banter"), "banterbot")
        self.assertEqual(resolve_model("BanterBot"), "banterbot")
        self.assertEqual(resolve_model(None), "banterbot")

    def test_unknown(self):
        with self.assertRaises(ValueError):
            resolve_model("boostbot")
        with self.assertRaises(ValueError):
            resolve_model("gpt-4")


class PromptTests(unittest.TestCase):
    def test_system_and_user(self):
        prompt = messages_to_prompt(
            [
                {"role": "system", "content": "You are BanterBot."},
                {"role": "user", "content": "Hi"},
            ]
        )
        self.assertIn("<|im_start|>system\nYou are BanterBot.<|im_end|>", prompt)
        self.assertTrue(prompt.endswith("<|im_start|>user\nHi<|im_end|>\n<|im_start|>assistant\n"))

    def test_history_turns(self):
        prompt = messages_to_prompt(
            [
                {"role": "system", "content": "sys"},
                {"role": "user", "content": "one"},
                {"role": "assistant", "content": "two"},
                {"role": "user", "content": "three"},
            ]
        )
        self.assertIn("<|im_start|>user\none<|im_end|>", prompt)
        self.assertIn("<|im_start|>assistant\ntwo<|im_end|>", prompt)
        self.assertTrue(prompt.endswith("<|im_start|>user\nthree<|im_end|>\n<|im_start|>assistant\n"))

    def test_honors_poker_system_prompt(self):
        prompt = messages_to_prompt(
            [
                {"role": "system", "content": "You are AceBot at a cash table."},
                {"role": "user", "content": "Reply with only the chat line."},
            ]
        )
        self.assertIn("AceBot at a cash table", prompt)
        self.assertNotIn("Roast Master", prompt)


class FormatTests(unittest.TestCase):
    def test_completion_mapping(self):
        payload = chat_completion_response("Nice raise.", "banterbot")
        self.assertEqual(payload["object"], "chat.completion")
        self.assertEqual(payload["model"], "banterbot")
        self.assertEqual(payload["choices"][0]["message"]["content"], "Nice raise.")

    def test_chunk_and_sse(self):
        chunk = chat_completion_chunk("Hi", "banterbot", chunk_id="chatcmpl-test")
        self.assertEqual(chunk["choices"][0]["delta"]["content"], "Hi")
        line = sse_line(chunk)
        self.assertTrue(line.startswith("data: "))
        self.assertTrue(line.endswith("\n\n"))
        self.assertEqual(sse_line("[DONE]"), "data: [DONE]\n\n")

    def test_accumulated_deltas(self):
        self.assertEqual(list(deltas_from_accumulated(["H", "He", "Hel", "Hello"])), ["H", "e", "l", "lo"])


if __name__ == "__main__":
    unittest.main()
