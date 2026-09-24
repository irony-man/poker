import { apiBase, parseError, sessionHeaders } from '@/lib/api/client';

export type BotChatPersona = 'banter';

export type BotChatRole = 'user' | 'assistant';

export interface BotChatTurn {
  role: BotChatRole;
  content: string;
}

export async function streamBotChat(opts: {
  sessionToken: string;
  messages: BotChatTurn[];
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
  /** Always BanterBot; kept optional for callers. */
  persona?: BotChatPersona;
}): Promise<string> {
  const res = await fetch(`${apiBase()}/api/bot-chat`, {
    method: 'POST',
    headers: sessionHeaders(opts.sessionToken),
    body: JSON.stringify({
      persona: opts.persona ?? 'banter',
      messages: opts.messages,
      // Non-stream: reliable through Next.js /api rewrite (SSE is often buffered).
      stream: false,
    }),
    signal: opts.signal,
  });

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    throw new Error(await parseError(res, 'Bot chat is not available'));
  }

  if (!contentType.includes('text/event-stream') || !res.body) {
    const data = (await res.json()) as { text?: string; error?: string };
    if (data.error) throw new Error(data.error);
    const text = data.text?.trim() ?? '';
    if (!text) throw new Error('Bot chat is not available');
    opts.onDelta(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let assembled = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      let parsed: { delta?: string; error?: string };
      try {
        parsed = JSON.parse(data) as { delta?: string; error?: string };
      } catch {
        continue;
      }
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.delta) {
        assembled += parsed.delta;
        opts.onDelta(parsed.delta);
      }
    }
  }
  if (!assembled.trim()) throw new Error('Bot chat is not available');
  return assembled;
}
