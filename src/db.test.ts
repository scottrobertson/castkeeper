import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { saveHistory, getEpisodes, getEpisodeCount } from "./db";
import type { HistoryResponse } from "./types";

function makeEpisode(overrides: Partial<HistoryResponse["episodes"][number]> = {}) {
  return {
    uuid: "ep-1",
    url: "https://example.com/ep1.mp3",
    title: "Test Episode",
    podcastTitle: "Test Podcast",
    podcastUuid: "pod-1",
    published: "2024-01-15T10:00:00Z",
    duration: 3600,
    fileType: "audio/mpeg",
    size: "50000000",
    playingStatus: 3,
    playedUpTo: 3600,
    isDeleted: false,
    starred: false,
    episodeType: "full",
    episodeSeason: 1,
    episodeNumber: 1,
    author: "Test Author",
    bookmarks: [],
    ...overrides,
  };
}

beforeEach(async () => {
  await env.DB.exec("DROP TABLE IF EXISTS episodes");
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("saveHistory", () => {
  it("inserts episodes", async () => {
    const history: HistoryResponse = {
      episodes: [makeEpisode()],
    };

    const result = await saveHistory(env.DB, history);
    expect(result.total).toBe(1);
  });

  it("upserts on duplicate uuid", async () => {
    const history: HistoryResponse = {
      episodes: [makeEpisode({ title: "Original Title" })],
    };
    await saveHistory(env.DB, history);

    const updated: HistoryResponse = {
      episodes: [makeEpisode({ title: "Updated Title" })],
    };
    const result = await saveHistory(env.DB, updated);
    expect(result.total).toBe(1);

    const episodes = await getEpisodes(env.DB);
    expect(episodes[0].title).toBe("Updated Title");
  });
});

describe("getEpisodes", () => {
  it("returns episodes ordered by published desc", async () => {
    const history: HistoryResponse = {
      episodes: [
        makeEpisode({ uuid: "ep-old", published: "2024-01-01T00:00:00Z", title: "Old" }),
        makeEpisode({ uuid: "ep-new", published: "2024-06-01T00:00:00Z", title: "New" }),
      ],
    };
    await saveHistory(env.DB, history);

    const episodes = await getEpisodes(env.DB);
    expect(episodes).toHaveLength(2);
    expect(episodes[0].title).toBe("New");
    expect(episodes[1].title).toBe("Old");
  });

  it("respects limit parameter", async () => {
    const history: HistoryResponse = {
      episodes: [
        makeEpisode({ uuid: "ep-1", published: "2024-01-01T00:00:00Z" }),
        makeEpisode({ uuid: "ep-2", published: "2024-02-01T00:00:00Z" }),
        makeEpisode({ uuid: "ep-3", published: "2024-03-01T00:00:00Z" }),
      ],
    };
    await saveHistory(env.DB, history);

    const episodes = await getEpisodes(env.DB, 2);
    expect(episodes).toHaveLength(2);
  });
});

describe("getEpisodeCount", () => {
  it("returns correct count", async () => {
    expect(await getEpisodeCount(env.DB)).toBe(0);

    const history: HistoryResponse = {
      episodes: [
        makeEpisode({ uuid: "ep-1" }),
        makeEpisode({ uuid: "ep-2" }),
      ],
    };
    await saveHistory(env.DB, history);

    expect(await getEpisodeCount(env.DB)).toBe(2);
  });
});
