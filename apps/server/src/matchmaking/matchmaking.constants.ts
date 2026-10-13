/** Seats on every matchmade public table. */
export const MATCHMADE_MAX_SEATS = 6;
/** Bots fill every seat on a new table not taken by a matched player. */
export const MATCHMADE_TARGET_PLAYERS = MATCHMADE_MAX_SEATS;
/** A matched player's seat is held this long for them to arrive before backfill may take it. */
export const MATCHMADE_RESERVATION_MS = 30_000;
export const MATCHMADE_HOST_USER_ID = 'felt-house';
export const MATCHMADE_TABLE_NAME = 'Public table';
