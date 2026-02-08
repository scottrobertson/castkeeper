export interface HistoryEntry {
  uuid: string;
  played_at: string;
}

interface HistoryYearChange {
  action: number;
  episode: string;
  modifiedAt: string;
}

interface HistoryYearResponse {
  count?: number;
  history?: {
    changes: HistoryYearChange[];
  };
}

async function fetchHistoryYear(token: string, year: number, count: boolean): Promise<HistoryYearResponse> {
  const res = await fetch("https://api.pocketcasts.com/history/year", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ version: "1", count, year }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch history for ${year}: ${res.status}`);
  }

  return await res.json() as HistoryYearResponse;
}

export async function getListenHistory(token: string): Promise<HistoryEntry[]> {
  const currentYear = new Date().getFullYear();
  const seen = new Map<string, string>();

  for (let year = currentYear; year >= 2010; year--) {
    const countRes = await fetchHistoryYear(token, year, true);
    const total = countRes.count ?? 0;
    console.log(`[History] ${year}: API reports ${total} entries`);

    if (total === 0) {
      console.log(`[History] ${year}: no episodes, stopping`);
      break;
    }

    const fullRes = await fetchHistoryYear(token, year, false);
    const changes = fullRes.history?.changes ?? [];
    const playActions = changes.filter(c => c.action === 1);
    const skippedActions = changes.length - playActions.length;

    let newCount = 0;
    let duplicateCount = 0;
    for (const change of playActions) {
      const existing = seen.get(change.episode);
      if (existing === undefined) {
        seen.set(change.episode, change.modifiedAt);
        newCount++;
      } else {
        duplicateCount++;
      }
    }

    console.log(`[History] ${year}: ${changes.length} changes, ${playActions.length} plays (${newCount} new, ${duplicateCount} already seen from later year, ${skippedActions} non-play actions skipped)`);
  }

  const entries: HistoryEntry[] = [];
  for (const [uuid, modifiedAt] of seen) {
    entries.push({
      uuid,
      played_at: new Date(Number(modifiedAt)).toISOString(),
    });
  }

  if (entries.length > 0) {
    const newest = entries.reduce((a, b) => a.played_at > b.played_at ? a : b);
    const oldest = entries.reduce((a, b) => a.played_at < b.played_at ? a : b);
    console.log(`[History] ${entries.length} total unique episodes, date range: ${oldest.played_at} to ${newest.played_at}`);
  }

  return entries;
}
