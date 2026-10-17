import Link from "next/link";
import { useState } from "react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Button } from "@/components/ui/Button";
import type { FriendProfile } from "@/lib/api";
import { publicProfileHref } from "@/lib/publicProfile";
import { ChallengeIcon, RemoveFriendIcon } from "./icons";
import {
  FriendSearchField,
  NoFriendMatches,
  matchesFriendQuery,
  normalizeQuery,
} from "./search";

export function FriendList({
  friends,
  busy,
  disabled,
  onRemoveFriend,
  onChallenge,
}: {
  friends: FriendProfile[];
  busy: string | null;
  disabled: boolean;
  onRemoveFriend: (friend: FriendProfile) => void;
  onChallenge: (friendUserId: string) => void;
}) {
  const [query, setQuery] = useState("");

  if (friends.length === 0) {
    return (
      <div className="surface-empty-lg">
        <p className="text-sm font-medium text-primary">No friends yet</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Search for someone&apos;s exact username under Find a friend, or send
          an invite link. Once they accept, you can challenge them or add them
          to a group.
        </p>
      </div>
    );
  }

  const sorted = [...friends].sort(
    (a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online)),
  );
  const onlineCount = friends.filter((f) => f.online).length;
  const q = normalizeQuery(query);
  const visible = q ? sorted.filter((f) => matchesFriendQuery(f, q)) : sorted;

  return (
    <div className="flex flex-col gap-2">
      <FriendSearchField value={query} onChange={setQuery} />
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span
          className={`h-2 w-2 rounded-full ${onlineCount > 0 ? "bg-positive" : "bg-sidebar/25"}`}
          aria-hidden
        />
        {onlineCount > 0
          ? `${onlineCount} online now`
          : "Nobody online right now"}
      </p>
      {visible.length === 0 ? (
        <NoFriendMatches query={query} onClear={() => setQuery("")} />
      ) : (
        <ul className="surface-list bg-white/80">
          {visible.map((f) => {
            const handle = f.username ?? f.name;
            const removing = busy === `remove-${f.userId}`;
            const challenging = busy === `challenge-${f.userId}`;
            return (
              <li
                key={f.userId}
                className="flex items-center gap-3 bg-raised/60 px-3 py-2.5 transition-colors hover:bg-raised"
              >
                <Link
                  href={publicProfileHref(handle)}
                  className="relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40"
                  title={`View ${handle}`}
                >
                  <PlayerAvatar
                    userId={f.userId}
                    avatarId={f.avatarId}
                    avatarUrl={f.avatarUrl}
                    size={36}
                    title={f.name}
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                      f.online ? "bg-positive" : "bg-sidebar/25"
                    }`}
                    title={f.online ? "Online" : "Offline"}
                    aria-hidden
                  />
                </Link>
                <Link
                  href={publicProfileHref(handle)}
                  className="min-w-0 flex-1 outline-none focus-visible:underline"
                >
                  <span className="block truncate text-sm font-medium leading-5 text-primary hover:underline">
                    {f.name}
                  </span>
                  <span
                    className={`block truncate text-[11px] leading-4 ${
                      f.online ? "font-semibold text-positive" : "text-muted"
                    }`}
                  >
                    {f.online ? "Online" : "Offline"}
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={disabled || challenging || removing}
                    onClick={() => onChallenge(f.userId)}
                    aria-label={`Challenge ${f.name} to heads-up`}
                    title={`Challenge ${f.name} to heads-up`}
                    className="inline-flex items-center gap-1.5 shadow-none"
                  >
                    <ChallengeIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {challenging ? "Starting…" : "Challenge"}
                    </span>
                  </Button>
                  <button
                    type="button"
                    disabled={disabled || removing || challenging}
                    onClick={() => onRemoveFriend(f)}
                    aria-label={`Remove ${f.name}`}
                    title={`Remove ${f.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger focus-visible:bg-danger/10 focus-visible:text-danger focus-visible:outline-none disabled:opacity-40"
                  >
                    {removing ? (
                      <span className="text-xs font-bold">…</span>
                    ) : (
                      <RemoveFriendIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
