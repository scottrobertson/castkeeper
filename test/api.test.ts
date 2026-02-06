import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEpisodeSyncData, getPodcastEpisodeMetadata } from "../src/api";

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
        text: () => Promise.resolve("Unauthorized"),
      })
    );

    await expect(getEpisodeSyncData("bad-token", "pod-1")).rejects.toThrow(
      "Failed to fetch episode sync data for pod-1"
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
        text: () => Promise.resolve("Not Found"),
      })
    );

    await expect(getPodcastEpisodeMetadata("pod-1")).rejects.toThrow(
      "Failed to fetch podcast metadata for pod-1"
    );
  });
});
