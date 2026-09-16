import type { BotPersonalityId } from './bot.js';
import type { ActionType, PlayerState, Street } from './hand.js';

const BOT_PREFIX = 'bot:';

function isBotId(userId: string | null | undefined): boolean {
  return !!userId && userId.startsWith(BOT_PREFIX);
}

/** What prompted a possible banter line. */
export type BotBanterTrigger =
  | { kind: 'action'; action: ActionType; street: Street }
  | { kind: 'react'; action: ActionType; street: Street }
  | { kind: 'chat_reply' }
  | { kind: 'win' };

/** Optional table facts for template fill / LLM prompts (never hole cards). */
export interface BotBanterContext {
  street?: Street;
  amount?: number;
  pot?: number;
  /** Who just acted or chatted (for react / chat_reply). */
  actorName?: string;
  /** Human chat text (for chat_reply templates; not interpolated by default). */
  message?: string;
  winAmount?: number;
  handName?: string;
}

export type BotBanterBucket =
  | 'fold'
  | 'check'
  | 'call'
  | 'betRaise'
  | 'allin'
  | 'win'
  | 'chatReply';

export function banterBucket(trigger: BotBanterTrigger): BotBanterBucket {
  if (trigger.kind === 'win') return 'win';
  if (trigger.kind === 'chat_reply') return 'chatReply';
  switch (trigger.action) {
    case 'fold':
      return 'fold';
    case 'check':
      return 'check';
    case 'call':
      return 'call';
    case 'bet':
    case 'raise':
      return 'betRaise';
    case 'allin':
      return 'allin';
    default:
      return 'check';
  }
}

/** Base chance a bot speaks for this bucket (before personality scale). */
const BASE_CHANCE: Record<BotBanterBucket, number> = {
  check: 0.05,
  fold: 0.14,
  call: 0.14,
  betRaise: 0.28,
  allin: 0.48,
  win: 0.32,
  chatReply: 0.35,
};

/** Extra multiplier when commenting on someone else's move. */
const REACT_CHANCE_SCALE: Record<BotBanterBucket, number> = {
  check: 0.7,
  fold: 1.05,
  call: 1.1,
  betRaise: 1.25,
  allin: 1.35,
  win: 1,
  chatReply: 1,
};

/** Multiplier on base chance — chatty styles up, tight styles down. */
const CHAT_SCALE: Record<BotPersonalityId, number> = {
  balanced: 1,
  tight: 0.55,
  loose: 1.15,
  aggro: 1.35,
  passive: 0.65,
  maniac: 1.55,
  caller: 0.9,
  nit: 0.4,
  lag: 1.25,
  humanoid: 1.4,
};

const STREET_LABEL: Record<string, string> = {
  preflop: 'preflop',
  flop: 'flop',
  turn: 'turn',
  river: 'river',
};

/** Self-action / win templates. Slots: {name} {street} {amount} {pot} {win} {hand} */
const PHRASES: Record<
  BotPersonalityId,
  Record<Exclude<BotBanterBucket, 'chatReply'>, readonly string[]>
> = {
  balanced: {
    fold: [
      'Alright, folding the {street}.',
      'Not this time — I am out.',
      "I'll pass on this one.",
      'Out. Pot can go elsewhere.',
    ],
    check: ['Check. See what develops.', 'Go ahead — checking.', 'Nothing urgent here, check.'],
    call: [
      "I'll call {amount} and see a card.",
      'Ok, calling into {pot}.',
      'Call. Keeping the pot honest.',
    ],
    betRaise: [
      "Let's build it a bit — betting {amount}.",
      'Raise on the {street}. Paying to play.',
      'Putting in {amount}. Make a decision.',
    ],
    allin: [
      "I'm shoving — all in.",
      'Ship it. Stack in the middle.',
      'All in on the {street}. Your move.',
    ],
    win: [
      'Nice pot — took {win}.',
      'That one is mine{hand}.',
      'Took it. Good timing this hand.',
    ],
  },
  tight: {
    fold: ['Fold. Too thin on the {street}.', 'No. Passing.', 'Obvious fold for me.'],
    check: ['Check.', '…check.'],
    call: ['Call {amount}. Fine.', 'Minimum call.'],
    betRaise: ['Raise. Value.', 'Betting {amount}. Strong.'],
    allin: ['All in. Committed.', 'Nuts or nothing — all in.'],
    win: ['Good. Expected{hand}.', 'Correct. Took {win}.'],
  },
  loose: {
    fold: [
      'Gotta fold one sometime on the {street}.',
      'Alright, out — even I have limits.',
      'Whoops, folding this mess.',
    ],
    check: ['Check for now. Floating free.', 'Checking. Still in the mix.'],
    call: [
      "I'll look — call {amount}.",
      'Call me curious. In for {amount}.',
      'Why not call into {pot}?',
    ],
    betRaise: [
      'Spraying a bit — bet {amount}.',
      'Raise on the {street} — live a little.',
      'Pot getting spicy. Putting in {amount}.',
    ],
    allin: ['YOLO shove!', "All in, let's dance.", 'Ship it baby — {street} chaos.'],
    win: [
      'Variance loves me — scooped {win}.',
      'Another one{hand}!',
      'Told you I play everything.',
    ],
  },
  aggro: {
    fold: ['Fine. Fold. You got lucky, {name}.', 'Whatever. Folding the {street}.', 'You win this round.'],
    check: ['Check. Trap maybe.', 'Go on. Checking.'],
    call: ["Call {amount}. Don't get cute.", "I'll call that. Stay sharp."],
    betRaise: [
      'Raise. Pay up — {amount}.',
      'Betting {amount}. Respect it.',
      "I'm taking this pot on the {street}.",
    ],
    allin: [
      'All in. Call if you dare.',
      'Shove. Make a decision.',
      'Stack on the line — {street} all in.',
    ],
    win: ['Easy. Took {win}.', 'As planned{hand}.', 'Keep paying me.'],
  },
  passive: {
    fold: ['Folding quietly on the {street}.', 'Not for me.', "I'll sit this out."],
    check: ['Check please.', 'Happy to check here.'],
    call: ['Just a call of {amount}.', 'Call, nothing fancy into {pot}.'],
    betRaise: ['Small bet — {amount}.', 'Raise a little on the {street}.', "I'll put some in."],
    allin: ['All in… okay.', "Guess I'm all in on the {street}.", 'Here goes — shipping it.'],
    win: ['Oh, nice — {win}.', 'That worked out{hand}.', 'Pleasant surprise.'],
  },
  maniac: {
    fold: [
      'Boring fold on the {street}.',
      'Fine, take it {name}.',
      'Folding is for nerds… this once.',
    ],
    check: ['Check? Temporary.', 'Trap mode. Checking.'],
    call: ['Call {amount}! Chaos pending.', "I'll call anything once."],
    betRaise: [
      'RAISE {amount}. Panic.',
      'Bet big or go home — {street}.',
      'Pressure cooker. {amount} in.',
    ],
    allin: ['ALL IN!!!!', 'Shove city on the {street}.', 'Lights out — all in.'],
    win: ['HAHA mine! Scooped {win}.', 'Print money{hand}.', 'You love me really.'],
  },
  caller: {
    fold: ['Even I fold sometimes on the {street}.', 'Okay, folding.', 'Not calling that, {name}.'],
    check: ['Check.', 'Free card? Checking.'],
    call: [
      'Call {amount}. Always.',
      "I'm a calling station — in for {amount}.",
      'Call into {pot}. Sue me.',
    ],
    betRaise: ['Rare raise from me — {amount}.', 'Betting… feels weird on the {street}.', 'Okay, raise.'],
    allin: ['All in call energy.', "I'm in for all of it.", 'Shove / call life on the {street}.'],
    win: ['Calling paid off — {win}.', 'See? Patience{hand}.', 'Nice pot.'],
  },
  nit: {
    fold: ['Fold.', 'Obvious fold on the {street}.', 'Pass.'],
    check: ['Check.'],
    call: ['Call {amount}.', 'Minimum.'],
    betRaise: ['Raise {amount}.', 'Strong. Betting.'],
    allin: ['All in.', 'Nuts or nothing.'],
    win: ['Correct. {win}.', 'GG{hand}.'],
  },
  lag: {
    fold: ['Selective fold on the {street}.', 'Releasing.', 'Not today, {name}.'],
    check: ['Check. Planning.', 'Slowplay maybe — check.'],
    call: ['Call {amount} with a plan.', 'Floating the {street}.', "I'll call into {pot}."],
    betRaise: [
      'Aggression time — {amount}.',
      'Raise on the {street} — apply pressure.',
      'Betting the story for {amount}.',
    ],
    allin: ['All in. Commit.', 'Polarized shove on the {street}.', 'Ship it.'],
    win: ['Line worked — {win}.', 'Aggression pays{hand}.', 'Good timing.'],
  },
  humanoid: {
    fold: [
      'Yeah, I gotta let that go on the {street}.',
      'Not loving my hand here.',
      'Alright, fold. You can have it, {name}.',
    ],
    check: ['Check.', 'Nothing special — check.', 'Go ahead. Checking.'],
    call: [
      "I'll call {amount} and see a card.",
      'Hmm… calling into {pot}.',
      "Okay, I'm calling. Pot odds feel fine.",
    ],
    betRaise: [
      "I'm betting {amount} on the {street}.",
      'Raise — feels right.',
      "Let's charge a bit. Putting you to a decision.",
    ],
    allin: [
      "Alright, I'm all in.",
      'Shipping it on the {street}.',
      'This is the spot — all in.',
    ],
    win: [
      'I needed that one — {win}.',
      'Nice, good runout{hand}.',
      'That pot helps. Appreciate the action.',
    ],
  },
};

/** Reactions to another player's move. Prefer lines that use {name} when available. */
const REACT_PHRASES: Record<
  BotPersonalityId,
  Record<Exclude<BotBanterBucket, 'win' | 'chatReply'>, readonly string[]>
> = {
    balanced: {
      fold: [
        'Wise fold on the {street}, {name}.',
        '{name} folds — noted.',
        'Alright, {name} is out.',
      ],
      check: ['{name} checks. Okay.', 'Check from {name} — we keep going.'],
      call: [
        '{name} calls {amount}. Interesting.',
        'Call into {pot} from {name}.',
        '{name} sticks around on the {street}.',
      ],
      betRaise: [
        'Big move from {name} — {amount}.',
        '{name} raises on the {street}. Respect.',
        'Pressure from {name}. Pot is {pot}.',
      ],
      allin: [
        '{name} is all in! Wow.',
        'Shove from {name} on the {street}.',
        '{name} ships it. Decision time.',
      ],
    },
    tight: {
      fold: ['{name} folds. Correct.', 'Good fold, {name}.'],
      check: ['{name} checks.'],
      call: ['{name} calls {amount}.'],
      betRaise: ['{name} bets {amount}. Strong?', '{name} raises. Careful.'],
      allin: ['{name} all in. Polarized.', 'Shove from {name}.'],
    },
    loose: {
      fold: ['Aww {name} folded the fun away.', '{name} out on the {street}. More for us.'],
      check: ['{name} checks — free card vibes.'],
      call: ['{name} calls {amount}? Love the action.', 'Yes {name}, keep calling.'],
      betRaise: [
        '{name} pumps it to {amount}! Spicy.',
        'Raise war with {name} on the {street}.',
        '{name} is spraying. Pot {pot}.',
      ],
      allin: ['{name} YOLO shove!!', '{name} all in on the {street} — chaos!'],
    },
    aggro: {
      fold: ['Fold already, {name}? Soft.', '{name} folds. Weak.'],
      check: ['{name} checks. Go ahead then.'],
      call: ['{name} calls {amount}. Still here.', "Calling me, {name}? Fine."],
      betRaise: [
        '{name} raises {amount}. Bring it.',
        "Don't bluff me on the {street}, {name}.",
        '{name} wants the pot. We will see.',
      ],
      allin: ['{name} shoves. Call or fold — pick.', 'All in from {name}. Make them sweat.'],
    },
    passive: {
      fold: ['Okay, {name} folded gently.', '{name} sits out the {street}.'],
      check: ['{name} checks. Peaceful.'],
      call: ['{name} calls {amount}. Nice and steady.'],
      betRaise: ['Oh, {name} bet {amount}. Alright then.', '{name} raises on the {street}.'],
      allin: ['Oh my — {name} is all in.', '{name} shipped it. Gulp.'],
    },
    maniac: {
      fold: ['{name} folded? Cowardice!', 'Boring fold from {name}.'],
      check: ['{name} checks. Temporary peace.'],
      call: ['{name} calls {amount}! Feed the chaos!', '{name} stuck to the pot.'],
      betRaise: [
        '{name} RAISES {amount}!! LETS GO',
        'Fire from {name} on the {street}!',
        '{name} is cooking. Pot {pot}.',
      ],
      allin: ['{name} ALL IN!!!! INSANE', '{name} shoved the {street} — beautiful.'],
    },
    caller: {
      fold: ['Even {name} folds sometimes.', '{name} gave up on the {street}.'],
      check: ['{name} checks.'],
      call: ['{name} calls {amount} — my kind of player.', 'Call club: welcome {name}.'],
      betRaise: ['Rare aggression from {name}? {amount}.', '{name} bets. I might call later.'],
      allin: ['{name} all in. I would probably call.', 'Shove from {name} — classic.'],
    },
    nit: {
      fold: ['{name} folds. Fine.', 'Fold from {name}.'],
      check: ['{name} checks.'],
      call: ['{name} calls {amount}.'],
      betRaise: ['{name} bets {amount}.', '{name} raises.'],
      allin: ['{name} all in.', 'Shove. {name}.'],
    },
    lag: {
      fold: ['{name} releases on the {street}.', 'Selective fold from {name}.'],
      check: ['{name} checks. Planning?'],
      call: ['{name} floats for {amount}.', '{name} calls into {pot}.'],
      betRaise: [
        '{name} applies pressure — {amount}.',
        'Story bet from {name} on the {street}.',
        '{name} raises. Line reading time.',
      ],
      allin: ['Polarized shove from {name}.', '{name} commits all in on the {street}.'],
    },
    humanoid: {
      fold: [
        'Fair fold, {name} — {street} can be tricky.',
        '{name} lets it go. Respect.',
      ],
      check: ['{name} checks. Okay, we keep it calm.'],
      call: [
        '{name} calls {amount} — pot odds make sense.',
        "I'll note that call from {name} into {pot}.",
      ],
      betRaise: [
        'Solid bet from {name} for {amount}.',
        '{name} raises on the {street}. Putting me to a decision.',
        'Aggression from {name}. Pot is {pot} now.',
      ],
      allin: [
        'Whoa — {name} is all in.',
        '{name} ships it on the {street}. Big spot.',
      ],
    },
  };

/** Replies to human table chat. Slots: {name} */
const CHAT_REPLY_PHRASES: Record<BotPersonalityId, readonly string[]> = {
  balanced: [
    'Ha, {name}. Fair point.',
    'Heard you, {name}.',
    'Alright {name}, noted.',
    'Interesting take from {name}.',
    "I'm listening, {name}.",
    'True enough, {name}.',
  ],
  tight: [
    'Noted, {name}.',
    'Mm. {name}.',
    'Okay.',
    'Quiet table works for me, {name}.',
    'Fine.',
  ],
  loose: [
    'Haha {name}, love the chatter!',
    'Say more, {name} — keep it spicy.',
    '{name} bringing the vibes.',
    'Yes {name}! Table talk is free.',
    "I'm here for it, {name}.",
  ],
  aggro: [
    'Talk is cheap, {name}. Play cards.',
    'Whatever you say, {name}.',
    'Save it for the river, {name}.',
    'Bold words from {name}.',
    "Don't distract me, {name}.",
  ],
  passive: [
    'Oh, hello {name}.',
    'Nice of you to say, {name}.',
    'I appreciate that, {name}.',
    'Okay {name}, thanks for chatting.',
    'Pleasant as always, {name}.',
  ],
  maniac: [
    'HAHA {name}!!! YELL IT LOUDER',
    '{name} is cooking in chat!!',
    'YES {name} FEED THE CHAOS',
    'Table talk from {name}? Absolute cinema.',
    '{name} said something wild and I love it.',
  ],
  caller: [
    "I'll call that comment, {name}.",
    'Chat call from me too, {name}.',
    'Yeah {name}, I hear you.',
    'Calling stations listen, {name}.',
    'Alright {name}, keep talking.',
  ],
  nit: [
    'Quiet.',
    'Focus, {name}.',
    'Cards only.',
    'Noted.',
    '{name}.',
  ],
  lag: [
    'Clever line in chat, {name}.',
    'Pressure works in words too, {name}.',
    'Reading you, {name}.',
    'Interesting timing from {name}.',
    "I'll remember that, {name}.",
  ],
  humanoid: [
    'Haha fair, {name}.',
    'I get what you mean, {name}.',
    'Good one, {name}.',
    'Yeah {name}, that tracks.',
    "Appreciate you saying that, {name}.",
    'Chat keeps the table human — thanks {name}.',
  ],
};

const SLOT_RE = /\{(name|street|amount|pot|win|hand)\}/g;

function slotValues(ctx: BotBanterContext | undefined): Record<string, string | undefined> {
  const street =
    ctx?.street && STREET_LABEL[ctx.street] ? STREET_LABEL[ctx.street] : undefined;
  const hand =
    ctx?.handName && ctx.handName !== 'Uncontested' ? ` with ${ctx.handName}` : '';
  return {
    // Default so react templates still fill when caller omitted a name.
    name: ctx?.actorName?.trim() || 'they',
    street,
    amount: ctx?.amount != null ? String(ctx.amount) : undefined,
    pot: ctx?.pot != null ? String(ctx.pot) : undefined,
    win: ctx?.winAmount != null ? String(ctx.winAmount) : undefined,
    hand: hand || undefined,
  };
}

/** Fill template slots; returns null if a required slot is missing. */
export function fillBanterTemplate(
  template: string,
  ctx?: BotBanterContext,
): string | null {
  const values = slotValues(ctx);
  let missing = false;
  const filled = template.replace(SLOT_RE, (_, key: string) => {
    const v = values[key];
    if (v === undefined || v === '') {
      // {hand} may be empty string meaning "omit" — treat missing handName as empty ok
      if (key === 'hand') return '';
      missing = true;
      return '';
    }
    return v;
  });
  if (missing) return null;
  return filled.replace(/\s{2,}/g, ' ').trim();
}

function poolFor(
  personalityId: BotPersonalityId,
  trigger: BotBanterTrigger,
): readonly string[] {
  if (trigger.kind === 'chat_reply') {
    return CHAT_REPLY_PHRASES[personalityId] ?? CHAT_REPLY_PHRASES.balanced;
  }
  const bucket = banterBucket(trigger);
  if (trigger.kind === 'react') {
    if (bucket === 'win' || bucket === 'chatReply') {
      return PHRASES[personalityId]?.win ?? PHRASES.balanced.win;
    }
    const react = REACT_PHRASES[personalityId]?.[bucket] ?? REACT_PHRASES.balanced[bucket];
    return react;
  }
  if (bucket === 'chatReply') return CHAT_REPLY_PHRASES[personalityId] ?? CHAT_REPLY_PHRASES.balanced;
  return PHRASES[personalityId]?.[bucket] ?? PHRASES.balanced[bucket];
}

function hasSlots(template: string): boolean {
  return /\{(name|street|amount|pot|win|hand)\}/.test(template);
}

function streetFromTrigger(trigger: BotBanterTrigger): Street | undefined {
  if (trigger.kind === 'action' || trigger.kind === 'react') return trigger.street;
  return undefined;
}

function eligibleLines(
  personalityId: BotPersonalityId,
  trigger: BotBanterTrigger,
  ctx?: BotBanterContext,
): string[] {
  const pool = poolFor(personalityId, trigger);
  const mergedCtx: BotBanterContext = {
    ...ctx,
    street: ctx?.street ?? streetFromTrigger(trigger),
  };
  const filled: string[] = [];
  for (const raw of pool) {
    const line = fillBanterTemplate(raw, mergedCtx);
    if (line) filled.push(line);
  }
  // If every line needed missing context, fall back to slot-free lines.
  if (filled.length === 0) {
    for (const raw of pool) {
      if (!hasSlots(raw)) filled.push(raw);
    }
  }
  return filled;
}

export interface MaybeBotBanterOpts {
  personalityId: BotPersonalityId;
  trigger: BotBanterTrigger;
  context?: BotBanterContext;
  /** Injectable RNG in [0, 1). Defaults to Math.random. */
  rng?: () => number;
}

/** Chance gate only — used before async LLM calls. */
export function shouldAttemptBotBanter(opts: MaybeBotBanterOpts): boolean {
  const rng = opts.rng ?? Math.random;
  return rng() < botBanterChance(opts.personalityId, opts.trigger);
}

/**
 * Pick a template line without rolling chance (LLM fallback / forced pick).
 * Returns null only if the pool is empty after fill.
 */
export function pickBotBanterLine(opts: MaybeBotBanterOpts): string | null {
  const rng = opts.rng ?? Math.random;
  const lines = eligibleLines(opts.personalityId, opts.trigger, opts.context);
  if (!lines.length) return null;
  const idx = Math.min(lines.length - 1, Math.floor(rng() * lines.length));
  return lines[idx] ?? null;
}

/**
 * Sparse personality-flavored table chat after a bot move, react, or win.
 * Returns null most of the time (probability gates).
 */
export function maybeBotBanter(opts: MaybeBotBanterOpts): string | null {
  if (!shouldAttemptBotBanter(opts)) return null;
  return pickBotBanterLine(opts);
}

/** Delay before posting banter so it trails the action log. */
export function botBanterDelayMs(rng: () => number = Math.random): number {
  return 400 + Math.floor(rng() * 800);
}

/** Exported for tests — base × scale × react scale, capped. */
export function botBanterChance(
  personalityId: BotPersonalityId,
  trigger: BotBanterTrigger,
): number {
  const bucket = banterBucket(trigger);
  const reactScale = trigger.kind === 'react' ? REACT_CHANCE_SCALE[bucket] : 1;
  return Math.min(0.85, BASE_CHANCE[bucket] * (CHAT_SCALE[personalityId] ?? 1) * reactScale);
}

export interface BanterBotSeat {
  userId: string | null;
  name: string | null;
  status: PlayerState['status'];
}

/**
 * Pick one still-in-hand bot to react to another's move.
 * Prefers `active`/`allin`; excludes `excludeUserId`.
 */
export function pickReactingBot(
  players: readonly BanterBotSeat[],
  excludeUserId: string | null | undefined,
  rng: () => number = Math.random,
): { userId: string; name: string } | null {
  const candidates = players.filter(
    (p) =>
      p.userId &&
      isBotId(p.userId) &&
      p.userId !== excludeUserId &&
      (p.status === 'active' || p.status === 'allin'),
  );
  if (!candidates.length) return null;
  const idx = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  const pick = candidates[idx]!;
  return {
    userId: pick.userId!,
    name: pick.name?.trim() || 'Bot',
  };
}

export interface ResolveChatReplyBotResult {
  userId: string;
  name: string;
  /** True when the human @mentioned this bot by name. */
  mentioned: boolean;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Resolve which bot should reply to human table chat.
 * Prefers `@BotName` mention; else an in-hand bot; else any seated bot.
 */
export function resolveChatReplyBot(
  players: readonly BanterBotSeat[],
  text: string,
  excludeUserId: string | null | undefined,
  rng: () => number = Math.random,
): ResolveChatReplyBotResult | null {
  const bots = players.filter(
    (p) => p.userId && isBotId(p.userId) && p.userId !== excludeUserId && p.status !== 'empty',
  );
  if (!bots.length) return null;

  const raw = text ?? '';
  // Match @Name where Name can include letters/digits/spaces up to next @ or punctuation end.
  const mentionRe = /@([A-Za-z0-9][A-Za-z0-9 _'-]{0,31})/g;
  let match: RegExpExecArray | null;
  while ((match = mentionRe.exec(raw)) !== null) {
    const mentioned = normalizeName(match[1] ?? '');
    if (!mentioned) continue;
    const hit = bots.find((b) => {
      const n = normalizeName(b.name ?? '');
      return n === mentioned || n.startsWith(mentioned) || mentioned.startsWith(n);
    });
    if (hit?.userId) {
      return {
        userId: hit.userId,
        name: hit.name?.trim() || 'Bot',
        mentioned: true,
      };
    }
  }

  const inHand = bots.filter((p) => p.status === 'active' || p.status === 'allin');
  const pool = inHand.length > 0 ? inHand : bots;
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  const pick = pool[idx]!;
  return {
    userId: pick.userId!,
    name: pick.name?.trim() || 'Bot',
    mentioned: false,
  };
}
