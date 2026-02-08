import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEpisodeSyncData, getPodcastEpisodeMetadata, getPodcastList, getBookmarks } from "../src/api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("getEpisodeSyncData", () => {
  it("returns parsed sync data on success", async () => {
    const mockResponse = { episodes: [{ uuid: "ep-1", playingStatus: 3 }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await getEpisodeSyncData("my-token", "pod-1");
    expect(result).toEqual(mockResponse);
  });

  it("sends the token and podcast uuid", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ episodes: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getEpisodeSyncData("my-token", "pod-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.pocketcasts.com/user/podcast/episodes",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer my-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uuid: "pod-1" }),
      }
    );
  });

  it("throws when the API returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      })
    );

    await expect(getEpisodeSyncData("bad-token", "pod-1")).rejects.toThrow(
      "Failed to fetch episode sync data for pod-1: 401 Unauthorized"
    );
  });
});

describe("getPodcastEpisodeMetadata", () => {
  it("returns parsed cache data on success", async () => {
    const mockResponse = {
      podcast: {
        uuid: "pod-1",
        title: "Test",
        episodes: [{ uuid: "ep-1", title: "Episode 1" }],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await getPodcastEpisodeMetadata("pod-1");
    expect(result).toEqual(mockResponse);
  });

  it("fetches from cache server with redirect follow", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ podcast: { episodes: [] } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getPodcastEpisodeMetadata("pod-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://cache.pocketcasts.com/mobile/podcast/full/pod-1",
      {
        method: "GET",
        redirect: "follow",
      }
    );
  });

  it("throws when the cache server returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not Found"),
      })
    );

    await expect(getPodcastEpisodeMetadata("pod-1")).rejects.toThrow(
      "Failed to fetch podcast metadata for pod-1: 404 Not Found"
    );
  });
});

describe("getPodcastList", () => {
  it("returns parsed podcast list on success", async () => {
    const mockResponse = { podcasts: [{ uuid: "pod-1", title: "Test" }], folders: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await getPodcastList("my-token");
    expect(result).toEqual(mockResponse);
  });

  it("sends token and empty body to correct endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ podcasts: [], folders: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getPodcastList("my-token");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.pocketcasts.com/user/podcast/list",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer my-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
  });

  it("throws when the API returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      })
    );

    await expect(getPodcastList("bad-token")).rejects.toThrow(
      "Failed to fetch podcast list: 403 Forbidden"
    );
  });
});

describe("getBookmarks", () => {
  it("returns parsed bookmarks on success", async () => {
    const mockResponse = { bookmarks: [{ bookmarkUuid: "bm-1", title: "Test" }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await getBookmarks("my-token");
    expect(result).toEqual(mockResponse);
  });

  it("sends token and empty body to correct endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ bookmarks: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getBookmarks("my-token");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.pocketcasts.com/user/bookmark/list",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer my-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
  });

  it("throws when the API returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      })
    );

    await expect(getBookmarks("bad-token")).rejects.toThrow(
      "Failed to fetch bookmarks: 500 Internal Server Error"
    );
  });
});
