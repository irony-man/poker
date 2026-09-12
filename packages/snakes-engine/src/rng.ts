export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export const defaultRollDie = rollDie;
