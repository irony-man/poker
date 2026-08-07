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
  onClose,
  closeLabel = 'Hide',
}: {
  onSend: (text: string) => void;
  onEmoji: (emoji: string) => void;
  onClose?: () => void;
  closeLabel?: string;
}) {
  const chat = useSession((s) => s.chat);
  const emojiBurst = useSession((s) => s.emojiBurst);
  const scroller = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const pick = (emoji: string) => {
    onEmoji(emoji);
    setPickerOpen(false);
  };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-[#f4eeec] via-mushroom to-[#e8ddd9] text-ink-strong">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-sidebar/10 bg-white/55 px-4 py-3.5 backdrop-blur-sm">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-sidebar">
          Chat
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-sidebar/15 bg-white px-3 py-1.5 text-[10px] font-display font-semibold uppercase tracking-wider text-ink-strong-muted shadow-[0_2px_8px_rgb(29_4_50/0.06)] transition hover:border-sidebar/30 hover:text-sidebar"
          >
            {closeLabel}
          </button>
        )}
      </header>

      {/* Messages */}
      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-4 sm:px-4"
      >
        {chat.length === 0 ? (
          <div className="flex h-full min-h-[10rem] flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-sidebar/10 bg-white text-2xl shadow-[0_6px_18px_rgb(29_4_50/0.08)]">
              💬
            </div>
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-sidebar">
              Quiet so far
            </p>
            <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-ink-strong-muted">
              Drop a reaction or say hi when the hand gets interesting.
            </p>
          </div>
        ) : (
          chat.map((m, i) => {
            const isSystem = m.userId === 'system';
            if (isSystem) {
              const name = m.name?.trim();
              const isDealer = !name || name.toLowerCase() === 'dealer';
              const isHandResult =
                /\bwins\b/i.test(m.text) || /^split pot\b/i.test(m.text.trim());
              if (isHandResult) {
                return (
                  <div
                    key={`${m.at}-${i}`}
                    className="mx-auto my-2 w-full max-w-[95%] rounded-xl bg-sidebar px-3.5 py-2.5 text-center shadow-[0_6px_16px_rgb(29_4_50/0.18)]"
                    role="status"
                  >
                    <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-mushroom/70">
                      Hand complete
                    </p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-mushroom">
                      {m.text}
                    </p>
                  </div>
                );
              }
              return (
                <div
                  key={`${m.at}-${i}`}
                  className="mx-auto max-w-[95%] rounded-full border border-sidebar/10 bg-white/55 px-3.5 py-1.5 text-center text-[12px] text-ink-strong-muted"
                >
                  {isDealer ? (
                    <span className="italic">{m.text}</span>
                  ) : (
                    <span>
                      <span className="font-display font-semibold not-italic text-sidebar">
                        {name}
                      </span>{' '}
                      <span className="italic">{m.text}</span>
                    </span>
                  )}
                </div>
              );
            }
            return (
              <div
                key={`${m.at}-${i}`}
                className="rounded-2xl border border-sidebar/8 bg-white/80 px-3.5 py-2.5 shadow-[0_2px_10px_rgb(29_4_50/0.05)]"
              >
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-sidebar">
                  {m.name}
                </p>
                <p className="mt-1 break-words text-sm leading-snug text-ink-strong">{m.text}</p>
              </div>
            );
          })
        )}
      </div>

      {emojiBurst && (
        <div className="pointer-events-none absolute inset-x-0 top-1/4 z-10 text-center text-4xl animate-bounce">
          {emojiBurst.emoji}
        </div>
      )}

      {/* Emoji picker overlay */}
      {pickerOpen && (
        <div className="absolute inset-x-0 bottom-[8.75rem] z-20 mx-3 max-h-[50%] overflow-hidden rounded-2xl border border-sidebar/12 bg-white shadow-[0_18px_40px_rgb(29_4_50/0.14)]">
          <div className="flex items-center justify-between border-b border-sidebar/10 px-3 py-2">
            <span className="text-[10px] font-display font-semibold uppercase tracking-[0.16em] text-sidebar">
              Reactions
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="rounded-full px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wider text-ink-strong-muted hover:bg-sidebar/8 hover:text-sidebar"
            >
              Close
            </button>
          </div>
          <div className="max-h-[min(40vh,18rem)] overflow-y-auto">
            {ALL_EMOJIS.map((group) => (
              <div key={group.label} className="border-b border-sidebar/8 last:border-b-0">
                <div className="sticky top-0 bg-mushroom/95 px-3 py-1.5 text-[10px] font-display font-semibold uppercase tracking-[0.14em] text-sidebar/65 backdrop-blur">
                  {group.label}
                </div>
                <div className="flex flex-wrap gap-0.5 px-2 pb-2 pt-0.5">
                  {uniqueEmojis(group.emojis).map((e) => (
                    <button
                      key={`${group.label}-${e}`}
                      type="button"
                      onClick={() => pick(e)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-lg transition hover:bg-sidebar/8 active:scale-90"
                      aria-label={`React ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-sidebar/10 bg-white/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-sm sm:px-3.5">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {FREQUENT.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => pick(e)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-lg transition hover:border-sidebar/12 hover:bg-sidebar/8 active:scale-90"
              aria-label={`React ${e}`}
            >
              {e}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            className={`ml-0.5 rounded-full border px-3 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider transition ${
              pickerOpen
                ? 'border-sidebar bg-sidebar text-mushroom'
                : 'border-sidebar/15 bg-white text-sidebar hover:border-sidebar/30'
            }`}
            aria-expanded={pickerOpen}
            aria-label="All emojis"
          >
            {pickerOpen ? 'Close' : 'More'}
          </button>
        </div>

        <form
          className="flex items-center gap-2 rounded-2xl border border-sidebar/12 bg-white p-1.5 pl-3 shadow-[0_4px_16px_rgb(29_4_50/0.06)]"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            name="text"
            maxLength={280}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the table…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink-strong outline-none placeholder:text-ink-strong-muted/55"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="shrink-0 rounded-xl bg-gradient-to-b from-[#341252] to-sidebar px-4 py-2.5 text-[11px] font-display font-bold uppercase tracking-wider text-mushroom shadow-[0_6px_14px_rgb(29_4_50/0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
