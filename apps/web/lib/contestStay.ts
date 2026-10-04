const stayKey = (contestId: string) => `pokr-contest-stay:${contestId}`;

/** After a finished table, stay on the contest page (do not auto-join the table). */
export function rememberStayOnContest(contestId: string): void {
  try {
    sessionStorage.setItem(stayKey(contestId), '1');
  } catch {
    /* ignore */
  }
}

export function clearStayOnContest(contestId: string): void {
  try {
    sessionStorage.removeItem(stayKey(contestId));
  } catch {
    /* ignore */
  }
}

export function shouldStayOnContest(contestId: string): boolean {
  try {
    if (sessionStorage.getItem(stayKey(contestId)) === '1') return true;
    return new URLSearchParams(window.location.search).get('from') === 'table';
  } catch {
    return false;
  }
}
