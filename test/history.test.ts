import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getListenHistory } from "../src/history";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function mockFetchSequence(responses: Array<{ ok: boolean; status?: number; body: unknown }>) {
  const fn = vi.fn();
  for (const res of responses) {
    fn.mockResolvedValueOnce({
      ok: res.ok,
      status: res.status ?? 200,
      json: () => Promise.resolve(res.body),
      text: () => Promise.resolve(JSON.stringify(res.body)),
    });
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("getListenHistory", () => {
  it("returns empty array when current year has 0 entries", async () => {
    mockFetchSequence([
      { ok: true, body: { count: 0 } },
    ]);

    const result = await getListenHistory("my-token");
    expect(result).toEqual([]);
  });

  it("fetches count then full data for each year until count is 0", async () => {
    const mockFetch = mockFetchSequence([
      { ok: true, body: { count: 1 } },
      { ok: true, body: { history: { changes: [{ action: 1, episode: "ep-1", modifiedAt: "1700000000000" }] } } },
      { ok: true, body: { count: 0 } },
    ]);

    await getListenHistory("my-token");

    expect(mockFetch).toHaveBeenCalledWith("https://api.pocketcasts.com/history/year", {
      method: "POST",
      headers: { Authorization: "Bearer my-token", "Content-Type": "application/json" },
      body: JSON.stringify({ version: "1", count: true, year: 2024 }),
    });

    expect(mockFetch).toHaveBeenCalledWith("https://api.pocketcasts.com/history/year", {
      method: "POST",
      headers: { Authorization: "Bearer my-token", "Content-Type": "application/json" },
      body: JSON.stringify({ version: "1", count: false, year: 2024 }),
    });

    expect(mockFetch).toHaveBeenCalledWith("https://api.pocketcasts.com/history/year", {
      method: "POST",
      headers: { Authorization: "Bearer my-token", "Content-Type": "application/json" },
      body: JSON.stringify({ version: "1", count: true, year: 2023 }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("filters to only play actions (action === 1)", async () => {
    mockFetchSequence([
      { ok: true, body: { count: 3 } },
      {
        ok: true,
        body: {
          history: {
            changes: [
              { action: 1, episode: "ep-1", modifiedAt: "1700000000000" },
              { action: 2, episode: "ep-2", modifiedAt: "1700000001000" },
              { action: 1, episode: "ep-3", modifiedAt: "1700000002000" },
            ],
          },
        },
      },
      { ok: true, body: { count: 0 } },
    ]);

    const result = await getListenHistory("my-token");
    expect(result).toHaveLength(2);

    const uuids = result.map(e => e.uuid);
    expect(uuids).toContain("ep-1");
    expect(uuids).toContain("ep-3");
    expect(uuids).not.toContain("ep-2");
  });

  it("deduplicates episodes keeping the most recent year (iterated first)", async () => {
    mockFetchSequence([
      { ok: true, body: { count: 1 } },
      { ok: true, body: { history: { changes: [{ action: 1, episode: "ep-1", modifiedAt: "1700000000000" }] } } },
      { ok: true, body: { count: 1 } },
      { ok: true, body: { history: { changes: [{ action: 1, episode: "ep-1", modifiedAt: "1600000000000" }] } } },
      { ok: true, body: { count: 0 } },
    ]);

    const result = await getListenHistory("my-token");
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe("ep-1");
    expect(result[0].played_at).toBe(new Date(1700000000000).toISOString());
  });

  it("converts modifiedAt epoch milliseconds to ISO timestamp", async () => {
    const epochMs = "1705312800000"; // 2024-01-15T10:00:00.000Z

    mockFetchSequence([
      { ok: true, body: { count: 1 } },
      { ok: true, body: { history: { changes: [{ action: 1, episode: "ep-1", modifiedAt: epochMs }] } } },
      { ok: true, body: { count: 0 } },
    ]);

    const result = await getListenHistory("my-token");
    expect(result).toHaveLength(1);
    expect(result[0].played_at).toBe(new Date(Number(epochMs)).toISOString());
  });

  it("collects episodes across multiple years", async () => {
    mockFetchSequence([
      { ok: true, body: { count: 1 } },
      { ok: true, body: { history: { changes: [{ action: 1, episode: "ep-2024", modifiedAt: "1700000000000" }] } } },
      { ok: true, body: { count: 1 } },
      { ok: true, body: { history: { changes: [{ action: 1, episode: "ep-2023", modifiedAt: "1672531200000" }] } } },
      { ok: true, body: { count: 0 } },
    ]);

    const result = await getListenHistory("my-token");
    expect(result).toHaveLength(2);

    const uuids = result.map(e => e.uuid);
    expect(uuids).toContain("ep-2024");
    expect(uuids).toContain("ep-2023");
  });

  it("handles missing history.changes gracefully", async () => {
    mockFetchSequence([
      { ok: true, body: { count: 1 } },
      { ok: true, body: {} },
      { ok: true, body: { count: 0 } },
    ]);

    const result = await getListenHistory("my-token");
    expect(result).toEqual([]);
  });

  it("throws when API returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      })
    );

    await expect(getListenHistory("bad-token")).rejects.toThrow(
      "Failed to fetch history for 2024: 401"
    );
  });
});
