import type { BotBanterContext, BotBanterTrigger, BotPersonalityId } from '@poker/engine';
import { apiBase, sessionHeaders } from '@/lib/api/client';
import { readStoredSession } from '@/lib/session';

/**
 * Ask the Nest API for an LLM (or template) banter line.
 * Returns null on miss, network error, or when not signed in.
 */
export async function fetchBotBanterLine(opts: {
  personalityId: BotPersonalityId;
  botName: string;
  trigger: BotBanterTrigger;
  context?: BotBanterContext;
  /** Skip chance gate — caller already rolled. */
  force?: boolean;
}): Promise<string | null> {
  const session = readStoredSession();
  if (!session?.sessionToken) return null;
  try {
    const res = await fetch(`${apiBase()}/api/bot-banter`, {
      method: 'POST',
      headers: sessionHeaders(session.sessionToken),
      body: JSON.stringify({
        personalityId: opts.personalityId,
        botName: opts.botName,
        trigger: opts.trigger,
        context: opts.context,
        force: opts.force ?? true,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string | null };
    return typeof data.text === 'string' && data.text.trim() ? data.text.trim() : null;
  } catch {
    return null;
  }
}
