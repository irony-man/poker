/** Stack trace when available, for log lines. */
export function errorText(err: unknown): string {
  return err instanceof Error ? (err.stack ?? err.message) : String(err);
}
