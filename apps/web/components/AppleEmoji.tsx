'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { appleEmojiUrl } from '@/lib/appleEmoji';

type AppleEmojiProps = {
  emoji: string;
  /** Pixel size (width & height). Defaults to 1em via CSS when omitted. */
  size?: number;
  className?: string;
  title?: string;
  /** Decorative (hide from AT) when the parent already has an aria-label. */
  decorative?: boolean;
};

/**
 * Renders a Unicode emoji as Apple-style artwork (consistent across OS).
 * Falls back to the native glyph if the CDN image fails.
 */
export function AppleEmoji({
  emoji,
  size,
  className = '',
  title,
  decorative = false,
}: AppleEmojiProps) {
  const url = useMemo(() => appleEmojiUrl(emoji), [emoji]);
  const [failedEmoji, setFailedEmoji] = useState<string | null>(null);
  const failed = failedEmoji === emoji;

  if (!emoji || !url || failed) {
    return (
      <span
        className={className}
        title={title}
        aria-hidden={decorative || undefined}
        style={size ? { fontSize: size, lineHeight: 1 } : undefined}
      >
        {emoji}
      </span>
    );
  }

  const style: CSSProperties = {
    width: size ?? '1.15em',
    height: size ?? '1.15em',
    display: 'inline-block',
    verticalAlign: '-0.15em',
    objectFit: 'contain',
  };

  return (
    <img
      src={url}
      alt={decorative ? '' : emoji}
      title={title ?? emoji}
      draggable={false}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      aria-hidden={decorative || undefined}
      onError={() => setFailedEmoji(emoji)}
    />
  );
}

const EMOJI_CHUNK =
  /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3/gu;

/** Inline-replace emoji graphemes in chat / labels with Apple artwork. */
export function AppleEmojiText({
  text,
  className,
  emojiSize,
}: {
  text: string;
  className?: string;
  emojiSize?: number;
}) {
  const parts = useMemo(() => splitEmojiText(text), [text]);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === 'emoji' ? (
          <AppleEmoji key={`${part.value}-${i}`} emoji={part.value} size={emojiSize} />
        ) : (
          <span key={`t-${i}`}>{part.value}</span>
        ),
      )}
    </span>
  );
}

function splitEmojiText(text: string): { type: 'text' | 'emoji'; value: string }[] {
  const out: { type: 'text' | 'emoji'; value: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(EMOJI_CHUNK)) {
    const start = match.index ?? 0;
    if (start > last) out.push({ type: 'text', value: text.slice(last, start) });
    out.push({ type: 'emoji', value: match[0]! });
    last = start + match[0]!.length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  if (out.length === 0) out.push({ type: 'text', value: text });
  return out;
}
