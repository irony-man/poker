'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOT_CHAT_ASSISTANT_LABELS } from '@/lib/api/botChat';

const FAB_AVATAR_PX = 56;

/** Fixed entry to `/chat` — poker chip avatar, bottom-right (above mobile tab bar). */
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
      <span
        className="bot-chat-fab-avatar relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-panel transition group-hover:scale-[1.04] group-active:scale-[0.98]"
        style={{ width: FAB_AVATAR_PX, height: FAB_AVATAR_PX }}
      >
        <Image
          src="/icon-192.png"
          alt=""
          width={FAB_AVATAR_PX}
          height={FAB_AVATAR_PX}
          unoptimized
          className="h-[88%] w-[88%] object-contain drop-shadow-[0_2px_6px_rgb(29_4_50/0.2)]"
          draggable={false}
        />
      </span>
      <span className="bot-chat-fab-label" aria-hidden>
        Chat
      </span>
    </Link>
  );
}
