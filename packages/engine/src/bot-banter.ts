import type { BotPersonalityId } from './bot.js';
import type { ActionType, Street } from './hand.js';

/** What prompted a possible banter line. */
export type BotBanterTrigger =
  | { kind: 'action'; action: ActionType; street: Street }
  | { kind: 'win' };

export type BotBanterBucket = 'fold' | 'check' | 'call' | 'betRaise' | 'allin' | 'win';

export function banterBucket(trigger: BotBanterTrigger): BotBanterBucket {
  if (trigger.kind === 'win') return 'win';
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
  betRaise: 0.24,
  allin: 0.42,
  win: 0.3,
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

const PHRASES: Record<BotPersonalityId, Record<BotBanterBucket, readonly string[]>> = {
  balanced: {
    fold: ['Alright, folding.', 'Not this time.', "I'll pass.", 'Out.'],
    check: ['Check.', 'Go ahead.', 'Nothing here.'],
    call: ['Call.', "I'll see it.", 'Ok, call.'],
    betRaise: ['Betting.', 'Raise.', "Let's build it a bit."],
    allin: ['All in.', "I'm shoving.", 'Ship it.'],
    win: ['Nice pot.', 'That one is mine.', 'Took it.'],
  },
  tight: {
    fold: ['Fold.', 'No.', 'Passing.', 'Too thin.'],
    check: ['Check.', '…'],
    call: ['Call.', 'Fine.'],
    betRaise: ['Raise.', 'Value.'],
    allin: ['All in.', 'Committed.'],
    win: ['Good.', 'Expected.'],
  },
  loose: {
    fold: ['Gotta fold one sometime.', 'Alright, out.', 'Whoops, folding.'],
    check: ['Check for now.', 'Floating free.'],
    call: ["I'll look.", 'Call me curious.', 'Why not.'],
    betRaise: ['Spraying a bit.', 'Raise — live a little.', 'Pot getting spicy.'],
    allin: ['YOLO shove!', "All in, let's dance.", 'Ship it baby.'],
    win: ['Variance loves me.', 'Another one!', 'Told you I play everything.'],
  },
  aggro: {
    fold: ['Fine. Fold.', 'You got lucky.', 'Whatever.'],
    check: ['Check. Trap maybe.', 'Go on.'],
    call: ["Call. Don't get cute.", "I'll call that."],
    betRaise: ['Raise. Pay up.', 'Betting. Respect it.', "I'm taking this pot."],
    allin: ['All in. Call if you dare.', 'Shove. Make a decision.', 'Stack on the line.'],
    win: ['Easy.', 'As planned.', 'Keep paying me.'],
  },
  passive: {
    fold: ['Folding quietly.', 'Not for me.', "I'll sit this out."],
    check: ['Check please.', 'Happy to check.'],
    call: ['Just a call.', 'Call, nothing fancy.'],
    betRaise: ['Small bet.', 'Raise a little.', "I'll put some in."],
    allin: ['All in… okay.', "Guess I'm all in.", 'Here goes.'],
    win: ['Oh, nice.', 'That worked out.', 'Pleasant surprise.'],
  },
  maniac: {
    fold: ['Boring fold.', 'Fine, take it.', 'Folding is for nerds… this once.'],
    check: ['Check? Temporary.', 'Trap mode.'],
    call: ['Call! Chaos pending.', "I'll call anything once."],
    betRaise: ['RAISE. Panic.', 'Bet big or go home.', 'Pressure cooker.'],
    allin: ['ALL IN!!!!', 'Shove city.', 'Lights out — all in.'],
    win: ['HAHA mine!', 'Print money.', 'You love me really.'],
  },
  caller: {
    fold: ['Even I fold sometimes.', 'Okay, folding.', 'Not calling that.'],
    check: ['Check.', 'Free card?'],
    call: ['Call. Always.', "I'm a calling station, sue me.", 'Call.'],
    betRaise: ['Rare raise from me.', 'Betting… feels weird.', 'Okay, raise.'],
    allin: ['All in call energy.', "I'm in for all of it.", 'Shove / call life.'],
    win: ['Calling paid off.', 'See? Patience.', 'Nice.'],
  },
  nit: {
    fold: ['Fold.', 'Obvious fold.', 'Pass.'],
    check: ['Check.'],
    call: ['Call.', 'Minimum.'],
    betRaise: ['Raise.', 'Strong.'],
    allin: ['All in.', 'Nuts or nothing.'],
    win: ['Correct.', 'GG.'],
  },
  lag: {
    fold: ['Selective fold.', 'Releasing.', 'Not today.'],
    check: ['Check. Planning.', 'Slowplay maybe.'],
    call: ['Call with a plan.', 'Floating.', "I'll call."],
    betRaise: ['Aggression time.', 'Raise — apply pressure.', 'Betting the story.'],
    allin: ['All in. Commit.', 'Polarized shove.', 'Ship it.'],
    win: ['Line worked.', 'Aggression pays.', 'Good timing.'],
  },
  humanoid: {
    fold: [
      'Yeah, I gotta let that go.',
      'Not loving my hand here.',
      'Alright, fold.',
      'You can have it.',
    ],
    check: ['Check.', 'Nothing special — check.', 'Go ahead.'],
    call: [
      "I'll call and see a card.",
      'Hmm… call.',
      "Okay, I'm calling.",
      'Pot odds say call.',
    ],
    betRaise: [
      "I'm betting this.",
      'Raise — feels right.',
      "Let's charge a bit.",
      'Putting you to a decision.',
    ],
    allin: [
      "Alright, I'm all in.",
      'Shipping it.',
      'This is the spot — all in.',
      'Stack in the middle.',
    ],
    win: [
      'I needed that one.',
      'Nice, good runout.',
      'That pot helps.',
      'Appreciate the action.',
    ],
  },
};

export interface MaybeBotBanterOpts {
  personalityId: BotPersonalityId;
  trigger: BotBanterTrigger;
  /** Injectable RNG in [0, 1). Defaults to Math.random. */
  rng?: () => number;
}

/**
 * Sparse personality-flavored table chat after a bot move or win.
 * Returns null most of the time (probability gates).
 */
export function maybeBotBanter(opts: MaybeBotBanterOpts): string | null {
  const rng = opts.rng ?? Math.random;
  const bucket = banterBucket(opts.trigger);
  const base = BASE_CHANCE[bucket];
  const scale = CHAT_SCALE[opts.personalityId] ?? 1;
  const chance = Math.min(0.85, base * scale);
  if (rng() >= chance) return null;

  const pool = PHRASES[opts.personalityId]?.[bucket] ?? PHRASES.balanced[bucket];
  if (!pool.length) return null;
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx] ?? null;
}

/** Delay before posting banter so it trails the action log. */
export function botBanterDelayMs(rng: () => number = Math.random): number {
  return 400 + Math.floor(rng() * 800);
}

/** Exported for tests — base × scale, capped. */
export function botBanterChance(
  personalityId: BotPersonalityId,
  trigger: BotBanterTrigger,
): number {
  const bucket = banterBucket(trigger);
  return Math.min(0.85, BASE_CHANCE[bucket] * (CHAT_SCALE[personalityId] ?? 1));
}
