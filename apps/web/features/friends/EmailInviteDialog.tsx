'use client';

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FORM_FIELD_CLASS } from '@/components/ui/TextField';
import { sendFriendEmailInvites, type EmailInviteOutcome } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/store';
import { toast } from '@/lib/toast';
import { InviteDialog } from './InviteDialog';
import { MailIcon, XIcon } from './icons';

const MAX_EMAILS = 10;
const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const SEPARATORS = /[\s,;]+/;

export function isValidInviteEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function parseInviteEmails(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw
    .split(SEPARATORS)
    .map((p) => p.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (isValidInviteEmail(p)) valid.push(p);
    else invalid.push(p);
  }
  return { valid, invalid };
}

/** Append new chips, skipping case-insensitive duplicates. */
function addChips(current: string[], parts: string[]): string[] {
  const seen = new Set(current.map((c) => c.toLowerCase()));
  const next = [...current];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p || seen.has(p.toLowerCase())) continue;
    seen.add(p.toLowerCase());
    next.push(p);
  }
  return next;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Toast text from the server counts; only non-zero parts are shown. */
export function emailInviteSummary(o: EmailInviteOutcome): string {
  const parts: string[] = [];
  if (o.requested > 0) parts.push(`Friend request sent to ${plural(o.requested, 'player', 'players')}`);
  if (o.accepted > 0) parts.push(`Now friends with ${plural(o.accepted, 'player', 'players')}`);
  if (o.emailed > 0) parts.push(`Invite emailed to ${o.emailed}`);
  if (o.alreadyConnected > 0) {
    parts.push(`${o.alreadyConnected} already your friend or requested`);
  }
  if (o.skipped > 0) parts.push(`${o.skipped} skipped (already invited today or daily limit)`);
  return parts.join(' · ');
}

function EmailChip({
  email,
  invalid,
  disabled,
  onRemove,
}: {
  email: string;
  invalid: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-lg border py-1 pl-2.5 pr-1 text-sm font-medium',
        invalid
          ? 'border-danger/40 bg-danger/10 text-danger'
          : 'border-sidebar/15 bg-sidebar/10 text-[rgb(22_12_40)]',
      )}
      title={invalid ? 'Not a valid email' : email}
    >
      <span className="min-w-0 truncate">{email}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${email}`}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md opacity-70 transition hover:bg-sidebar/15 hover:opacity-100"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function EmailInviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sessionToken = useSession((s) => s.sessionToken);
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only finished chips are validated. A complete draft also counts, so
  // "Invite" works without pressing Enter first.
  const { valid, invalid } = useMemo(() => {
    const parsed = parseInviteEmails(chips.join(' '));
    const d = draft.trim();
    const isNew = !parsed.valid.some((v) => v.toLowerCase() === d.toLowerCase());
    if (d && isValidInviteEmail(d) && isNew) parsed.valid.push(d);
    return parsed;
  }, [chips, draft]);
  const tooMany = valid.length > MAX_EMAILS;

  const close = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  function commitDraft(value = draft) {
    const parts = value.split(SEPARATORS);
    if (parts.every((p) => !p.trim())) {
      setDraft('');
      return;
    }
    setChips((prev) => addChips(prev, parts));
    setDraft('');
  }

  function onDraftChange(value: string) {
    if (!SEPARATORS.test(value)) {
      setDraft(value);
      return;
    }
    // Separator typed or a list pasted: everything before the last separator becomes chips.
    const parts = value.split(SEPARATORS);
    const rest = parts.pop() ?? '';
    setChips((prev) => addChips(prev, parts));
    setDraft(rest);
  }

  function onDraftKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && draft.trim()) {
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === 'Backspace' && !draft && chips.length > 0) {
      e.preventDefault();
      setChips((prev) => prev.slice(0, -1));
    }
  }

  function removeChip(email: string) {
    setChips((prev) => prev.filter((c) => c !== email));
    inputRef.current?.focus();
  }

  async function invite() {
    if (draft.trim() && !isValidInviteEmail(draft.trim())) {
      commitDraft();
      return;
    }
    if (!sessionToken || valid.length === 0 || tooMany || invalid.length > 0) return;
    commitDraft();
    setBusy(true);
    setError(null);
    try {
      const outcome = await sendFriendEmailInvites(valid, { sessionToken, silent: true });
      const handled =
        outcome.requested + outcome.accepted + outcome.emailed + outcome.alreadyConnected;
      if (handled === 0) {
        setError('No invites sent. You may have already invited these addresses today, or hit the daily limit.');
        return;
      }
      const message = emailInviteSummary(outcome);
      if (outcome.requested + outcome.accepted + outcome.emailed > 0) toast.success(message);
      else toast.info(message);
      setChips([]);
      setDraft('');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invites');
    } finally {
      setBusy(false);
    }
  }

  return (
    <InviteDialog
      open={open}
      onClose={close}
      initialFocusRef={inputRef}
      icon={<MailIcon className="h-7 w-7" />}
      title="Email Invite"
      description="Players already on Pokr get a friend request. Everyone else gets an email invite."
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void invite();
        }}
      >
        <div>
          <div
            className={cn(
              FORM_FIELD_CLASS,
              'flex min-h-28 cursor-text flex-wrap content-start items-center gap-1.5 px-2 py-2 focus-within:border-sidebar/40 focus-within:ring-2 focus-within:ring-sidebar/10',
              busy && 'opacity-60',
            )}
            onClick={() => inputRef.current?.focus()}
          >
            {chips.map((email) => (
              <EmailChip
                key={email.toLowerCase()}
                email={email}
                invalid={!isValidInviteEmail(email)}
                disabled={busy}
                onRemove={() => removeChip(email)}
              />
            ))}
            <input
              ref={inputRef}
              type="text"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={onDraftKeyDown}
              onBlur={() => commitDraft()}
              placeholder="Email address"
              aria-label="Email addresses"
              maxLength={254}
              disabled={busy}
              className="min-w-[10rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm shadow-none outline-none ring-0 placeholder:text-[rgb(58_40_82)]/75 focus:outline-none focus:ring-0 focus-visible:outline-none"
            />
          </div>
          <p className="text-xs text-muted mt-1.5">Separate multiple addresses with comma or space.</p>
        </div>
        {invalid.length > 0 ? (
          <p role="alert" className="text-xs font-semibold text-danger">
            Not a valid email: {invalid.slice(0, 3).join(', ')}
            {invalid.length > 3 ? ` and ${invalid.length - 3} more` : ''}
          </p>
        ) : null}
        {tooMany ? (
          <p role="alert" className="text-xs font-semibold text-danger">
            You can invite up to {MAX_EMAILS} addresses at a time.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          disabled={busy || valid.length === 0 || tooMany || invalid.length > 0}
          className="min-h-11 w-full mt-5"
        >
          {busy ? 'Sending…' : valid.length > 1 ? `Invite ${valid.length}` : 'Invite'}
        </Button>
      </form>
    </InviteDialog>
  );
}
