/** Betting-round labels that show as seat popups (not info toasts). */
export function isSeatActionLabel(label: string): boolean {
  const t = label.trim().toLowerCase();
  return /^(fold|check|call|bet|raise|all[-\s]?in)\b/.test(t);
}
