'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/store';

const FREQUENT = ['🔥', '😂', '👏', '😮', '💀', '😎', '👀', '🤙', '🤠', '🃏'];

const ALL_EMOJIS: { label: string; emojis: string[] }[] = [
  {
    label: 'Frequent',
    emojis: FREQUENT,
  },
  {
    label: 'Reactions',
    emojis: [
      '👍', '👎', '❤️', '💯', '✨', '🎉', '🙌', '💪', '🙏', '🤝',
      '😤', '😭', '🤣', '😅', '😆', '😊', '😉', '😏', '😐', '😑',
      '🙄', '😒', '😬', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥',
      '😓', '🤤', '😴', '🥱', '🤢', '🤮', '🤧', '😷', '🤒', '🤕',
    ],
  },
  {
    label: 'Faces',
    emojis: [
      '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊',
      '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗',
      '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥',
      '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜',
      '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️',
      '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨',
      '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵',
      '🥴', '😠', '😡', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
      '😇', '🥳', '🥺', '🤠', '🤡', '🤥', '🤫', '🤭', '🧐', '🤓',
    ],
  },
  {
    label: 'Gestures',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
      '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
      '👄', '💋', '🩸',
    ],
  },
  {
    label: 'People',
    emojis: [
      '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓',
      '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇',
      '🤦', '🤷', '👮', '🕵️', '💂', '🥷', '👷', '🤴', '👸', '👳',
      '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸',
      '🦹', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '💆', '💇',
      '🚶', '🧍', '🧎', '🏃', '💃', '🕺', '🕴️', '👯', '🧖', '🧗',
      '🤺', '🏇', '⛷️', '🏂', '🏌️', '🏄', '🚣', '🏊', '⛹️', '🏋️',
      '🚴', '🚵', '🤸', '🤼', '🤽', '🤾', '🤹', '🧘', '🛀', '🛌',
    ],
  },
  {
    label: 'Poker & luck',
    emojis: [
      '🃏', '🎰', '🎲', '🎯', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️',
      '💰', '💵', '💸', '💎', '👑', '💍', '🔮', '🧿', '♠️', '♥️',
      '♦️', '♣️', '🂡', '🤞', '🙏', '😈', '👿', '💀', '☠️', '👻',
      '🤖', '👽', '🔥', '💥', '⚡', '🌟', '⭐', '✨', '💫', '🌈',
    ],
  },
  {
    label: 'Animals',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
      '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞',
      '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍',
      '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠',
      '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍',
      '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬',
      '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌',
      '🐕', '🐩', '🦮', '🐈', '🪶', '🐓', '🦃', '🦤', '🦚', '🦜',
      '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥',
      '🐁', '🐀', '🐿️', '🦔',
    ],
  },
  {
    label: 'Food & drink',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
      '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
      '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔',
      '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈',
      '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟',
      '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘',
      '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪',
      '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧',
      '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫',
      '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖',
      '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃',
      '🍸', '🍹', '🧉', '🍾', '🧊',
    ],
  },
  {
    label: 'Activities',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺',
      '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗',
      '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️',
      '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧',
      '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻',
      '🎲', '♟️', '🎯', '🎳', '🎮', '🕹️', '🎰', '🧩',
    ],
  },
  {
    label: 'Travel & places',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵',
      '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
      '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇',
      '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸',
      '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🪝',
      '⛽', '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰',
      '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️',
      '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️',
      '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪',
      '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋',
    ],
  },
  {
    label: 'Objects',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
      '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
      '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
      '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
      '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴',
      '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛',
      '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱',
      '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️',
      '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️',
      '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠',
      '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿',
      '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑',
      '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞',
      '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊',
      '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌',
      '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮',
      '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️',
      '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁',
      '📂', '🗂️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙',
      '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮',
      '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️',
      '🔍', '🔎', '🔏', '🔐', '🔒', '🔓',
    ],
  },
  {
    label: 'Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
      '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
      '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
      '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️',
      '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️',
      '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️',
      '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓',
      '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️',
      '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠',
      'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️',
      '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮',
      '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗',
      '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣',
      '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️',
      '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬',
      '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️',
      '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂',
      '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲',
      '💱', '™️', '©️', '®️', '👁️‍🗨️', '🔚', '🔙', '🔛', '🔝', '🔜',
      '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢',
      '🔵', '🟣', '🟤', '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦',
      '🟪', '🟫', '⬛', '⬜', '◼️', '◻️', '◾', '◽', '▪️', '▫️',
      '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲',
    ],
  },
  {
    label: 'Flags',
    emojis: [
      '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️',
      '🇮🇳', '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇯🇵', '🇰🇷',
      '🇨🇳', '🇧🇷', '🇲🇽', '🇪🇸', '🇮🇹', '🇳🇱', '🇸🇪', '🇳🇴', '🇩🇰',
      '🇫🇮', '🇵🇱', '🇺🇦', '🇷🇺', '🇹🇷', '🇸🇦', '🇦🇪', '🇮🇱', '🇪🇬',
      '🇿🇦', '🇳🇬', '🇰🇪', '🇦🇷', '🇨🇱', '🇨🇴', '🇵🇪', '🇻🇪', '🇨🇺',
      '🇯🇲', '🇳🇿', '🇸🇬', '🇹🇭', '🇻🇳', '🇵🇭', '🇮🇩', '🇲🇾', '🇵🇰',
      '🇧🇩', '🇱🇰', '🇳🇵', '🇧🇹', '🇲🇲', '🇰🇭', '🇱🇦', '🇲🇳', '🇹🇼',
      '🇭🇰', '🇲🇴', '🇵🇹', '🇬🇷', '🇮🇪', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    ],
  },
];

function uniqueEmojis(list: string[]) {
  return [...new Set(list)];
}

export function ChatPanel({
  onSend,
  onEmoji,
}: {
  onSend: (text: string) => void;
  onEmoji: (emoji: string) => void;
}) {
  const chat = useSession((s) => s.chat);
  const emojiBurst = useSession((s) => s.emojiBurst);
  const scroller = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const pick = (emoji: string) => {
    onEmoji(emoji);
    setPickerOpen(false);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-ink-panel">
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-mushroom/12 px-4 py-3 pr-16">
        <span className="text-[11px] font-display font-semibold uppercase tracking-[0.2em] text-mushroom/80">
          Chat
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-positive animate-live-blink" />
      </div>
      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 text-sm">
        {chat.length === 0 && (
          <p className="text-cream/35 text-xs font-medium tracking-wide">No messages yet…</p>
        )}
        {chat.map((m, i) => {
          const isSystem = m.userId === 'system';
          return (
            <div
              key={`${m.at}-${i}`}
              className={isSystem ? 'text-cream/60 italic border-l-2 border-mushroom/25 pl-2' : ''}
            >
              <span
                className={`font-display font-semibold tracking-wide ${
                  isSystem ? 'text-mushroom/65 not-italic' : 'text-brass-light'
                }`}
              >
                {m.name}
              </span>
              <span className="text-cream/30"> · </span>
              <span className="break-words font-medium">{m.text}</span>
            </div>
          );
        })}
      </div>
      {emojiBurst && (
        <div className="pointer-events-none absolute inset-x-0 top-1/4 z-10 text-center text-4xl animate-bounce">
          {emojiBurst.emoji}
        </div>
      )}
      {pickerOpen && (
        <div className="absolute inset-x-0 bottom-[7.5rem] z-20 mx-2 max-h-[55%] overflow-y-auto rounded border border-mushroom/20 bg-ink shadow-[0_12px_40px_rgba(14,6,24,0.55)]">
          {ALL_EMOJIS.map((group) => (
            <div key={group.label} className="border-b border-mushroom/10 last:border-b-0">
              <div className="sticky top-0 bg-ink-panel/95 px-3 py-1.5 text-[10px] font-display font-semibold uppercase tracking-[0.18em] text-mushroom/70 backdrop-blur">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-0.5 px-2 pb-2">
                {uniqueEmojis(group.emojis).map((e) => (
                  <button
                    key={`${group.label}-${e}`}
                    type="button"
                    onClick={() => pick(e)}
                    className="rounded border border-transparent px-1.5 py-1 text-lg hover:border-mushroom/30 hover:bg-mushroom/10 active:scale-90 transition"
                    aria-label={`React ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="shrink-0 flex flex-wrap items-center justify-center gap-1 px-3 py-2 border-t border-mushroom/10">
        {FREQUENT.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => pick(e)}
            className="rounded border border-transparent px-2.5 py-2 hover:border-mushroom/30 hover:bg-mushroom/10 text-lg active:scale-90 transition"
            aria-label={`React ${e}`}
          >
            {e}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          className={`rounded border px-2.5 py-2 text-xs font-display font-semibold uppercase tracking-wider transition ${
            pickerOpen
              ? 'border-mushroom/45 bg-mushroom/15 text-mushroom'
              : 'border-transparent text-cream/55 hover:border-mushroom/30 hover:bg-mushroom/10 hover:text-cream'
          }`}
          aria-expanded={pickerOpen}
          aria-label="All emojis"
        >
          {pickerOpen ? 'Close' : 'All'}
        </button>
      </div>
      <form
        className="shrink-0 flex gap-2 p-3 border-t border-mushroom/12"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const text = String(fd.get('text') ?? '').trim();
          if (text) onSend(text);
          e.currentTarget.reset();
        }}
      >
        <input
          name="text"
          maxLength={280}
          placeholder="Say something…"
          className="flex-1 rounded border border-mushroom/15 bg-ink px-2 py-1.5 text-sm outline-none focus:border-mushroom/45"
        />
        <button
          type="submit"
          className="rounded border border-mushroom/20 bg-gradient-to-b from-[#341252] to-sidebar px-3 text-xs font-display font-bold uppercase tracking-wider text-mushroom"
        >
          Send
        </button>
      </form>
    </div>
  );
}
