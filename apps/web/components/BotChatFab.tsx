'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOT_CHAT_ASSISTANT_LABELS } from '@/lib/api/botChat';

const FAB_ICON_PX = 44;

/** Fixed entry to `/chat` — chip icon + label, bottom-right (above mobile tab bar). */
export function BotChatFab() {
  const pathname = usePathname();
  if (pathname === '/chat' || pathname.startsWith('/chat/')) return null;

  const label = `Open ${BOT_CHAT_ASSISTANT_LABELS.cohere}`;

  return (
    <Link
      href="/chat"
      className="bot-chat-fab group"
      aria-label={label}
      title={label}
    >
      <span className="bot-chat-fab-shell">
        <span className="bot-chat-fab-avatar">
          <Image
            src="/icon-192.png"
            alt=""
            width={FAB_ICON_PX}
            height={FAB_ICON_PX}
            unoptimized
            className="h-full w-full object-cover"
            draggable={false}
          />
        </span>
        <span className="bot-chat-fab-label">Chat</span>
      </span>
    </Link>
  );
}
