"use client";

import { TextField } from "@/components/ui/TextField";
import type { FriendProfile } from "@/lib/api";
import { SearchIcon, XIcon } from "./icons";

export function normalizeQuery(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** `query` must already be normalized. */
export function matchesFriendQuery(
  friend: Pick<FriendProfile, "name" | "username">,
  query: string,
): boolean {
  if (!query) return true;
  if (normalizeQuery(friend.name).includes(query)) return true;
  return friend.username
    ? normalizeQuery(friend.username).includes(query)
    : false;
}

export function FriendSearchField({
  value,
  onChange,
  label,
  placeholder = "Search friends",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <TextField
        variant="hud"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Often rendered inside host / create forms; Enter must not submit them.
          if (e.key === "Enter") e.preventDefault();
          if (e.key === "Escape" && value) {
            e.preventDefault();
            e.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        autoComplete="off"
        spellCheck={false}
        className="!mt-0 pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          title="Clear search"
          className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:bg-sidebar/[0.06] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar/40"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function NoFriendMatches({
  query,
  noun = "friends",
  onClear,
}: {
  query: string;
  noun?: string;
  onClear: () => void;
}) {
  return (
    <div className="surface-empty flex flex-wrap items-center justify-between gap-2 py-3 text-xs text-muted">
      <p className="min-w-0 truncate">
        No {noun} match &ldquo;{query.trim()}&rdquo;
      </p>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded-md px-2 py-1 font-semibold text-sidebar transition hover:bg-sidebar/[0.06]"
      >
        Clear
      </button>
    </div>
  );
}
