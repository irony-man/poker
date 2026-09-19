import unittest
from unittest.mock import patch

try:
    from fastapi.testclient import TestClient
    from server import app

    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False


@unittest.skipUnless(HAS_FASTAPI, "fastapi not installed")
class ServerTests(unittest.TestCase):
    def test_health(self):
        client = TestClient(app)
        res = client.get("/health")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["ok"])
        self.assertIn("boostbot", body["models"])
        self.assertIn("banterbot", body["models"])

    @patch("server.complete", return_value="Nice raise.")
    @patch("server.model_available", return_value=True)
    def test_non_stream_completion(self, _available, complete_fn):
        client = TestClient(app)
        res = client.post(
            "/v1/chat/completions",
            json={
                "model": "banterbot",
                "messages": [
                    {"role": "system", "content": "Be brief."},
                    {"role": "user", "content": "Hi"},
                ],
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload["choices"][0]["message"]["content"], "Nice raise.")
        self.assertEqual(payload["model"], "banterbot")
        complete_fn.assert_called_once()
        prompt = complete_fn.call_args[0][1]
        self.assertIn("Be brief.", prompt)
        self.assertIn("Hi", prompt)

    def test_unknown_model(self):
        client = TestClient(app)
        res = client.post(
            "/v1/chat/completions",
            json={"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]},
        )
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
