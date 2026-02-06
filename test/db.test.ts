import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { saveHistory, getEpisodes, getEpisodeCount, savePodcasts, getPodcasts, getPodcastCount } from "../src/db";
import type { HistoryResponse, PodcastListResponse } from "../src/types";

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
    slug: "test-episode",
    podcastSlug: "test-podcast",
    ...overrides,
  };
}

function makePodcast(overrides: Partial<PodcastListResponse["podcasts"][number]> = {}) {
  return {
    uuid: "pod-1",
    title: "Test Podcast",
    author: "Test Author",
    description: "A test podcast",
    url: "https://example.com/feed",
    slug: "test-podcast",
    dateAdded: "2024-01-01T00:00:00Z",
    folderUuid: "",
    sortPosition: 1,
    isPrivate: false,
    autoStartFrom: 0,
    autoSkipLast: 0,
    episodesSortOrder: 3,
    lastEpisodeUuid: "ep-1",
    lastEpisodePublished: "2024-01-15T10:00:00Z",
    unplayed: false,
    lastEpisodePlayingStatus: 3,
    lastEpisodeArchived: false,
    descriptionHtml: "<p>A test podcast</p>",
    settings: {},
    ...overrides,
  };
}

beforeEach(async () => {
  await env.DB.exec("DROP TABLE IF EXISTS episodes");
  await env.DB.exec("DROP TABLE IF EXISTS podcasts");
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

describe("savePodcasts", () => {
  it("inserts podcasts", async () => {
    const podcastList: PodcastListResponse = {
      podcasts: [makePodcast()],
      folders: [],
    };

    const result = await savePodcasts(env.DB, podcastList);
    expect(result.total).toBe(1);
  });

  it("upserts on duplicate uuid", async () => {
    const podcastList: PodcastListResponse = {
      podcasts: [makePodcast({ title: "Original" })],
      folders: [],
    };
    await savePodcasts(env.DB, podcastList);

    const updated: PodcastListResponse = {
      podcasts: [makePodcast({ title: "Updated" })],
      folders: [],
    };
    const result = await savePodcasts(env.DB, updated);
    expect(result.total).toBe(1);

    const podcasts = await getPodcasts(env.DB);
    expect(podcasts[0].title).toBe("Updated");
  });

  it("marks missing podcasts as deleted", async () => {
    const initial: PodcastListResponse = {
      podcasts: [
        makePodcast({ uuid: "pod-1", title: "Stays" }),
        makePodcast({ uuid: "pod-2", title: "Gets Removed" }),
      ],
      folders: [],
    };
    await savePodcasts(env.DB, initial);

    const afterRemoval: PodcastListResponse = {
      podcasts: [makePodcast({ uuid: "pod-1", title: "Stays" })],
      folders: [],
    };
    await savePodcasts(env.DB, afterRemoval);

    const podcasts = await getPodcasts(env.DB);
    expect(podcasts).toHaveLength(2);
    expect(podcasts[0].title).toBe("Stays");
    expect(podcasts[0].deleted_at).toBeNull();
    expect(podcasts[1].title).toBe("Gets Removed");
    expect(podcasts[1].deleted_at).not.toBeNull();
  });

  it("restores deleted podcasts when re-added", async () => {
    const initial: PodcastListResponse = {
      podcasts: [makePodcast({ uuid: "pod-1" })],
      folders: [],
    };
    await savePodcasts(env.DB, initial);

    // Remove it
    await savePodcasts(env.DB, { podcasts: [], folders: [] });
    let podcasts = await getPodcasts(env.DB);
    expect(podcasts[0].deleted_at).not.toBeNull();

    // Re-add it
    await savePodcasts(env.DB, initial);
    podcasts = await getPodcasts(env.DB);
    expect(podcasts[0].deleted_at).toBeNull();
  });
});

describe("getPodcasts", () => {
  it("returns podcasts ordered by sort_position", async () => {
    const podcastList: PodcastListResponse = {
      podcasts: [
        makePodcast({ uuid: "pod-2", sortPosition: 20, title: "Second" }),
        makePodcast({ uuid: "pod-1", sortPosition: 10, title: "First" }),
      ],
      folders: [],
    };
    await savePodcasts(env.DB, podcastList);

    const podcasts = await getPodcasts(env.DB);
    expect(podcasts).toHaveLength(2);
    expect(podcasts[0].title).toBe("First");
    expect(podcasts[1].title).toBe("Second");
  });
});

describe("getPodcastCount", () => {
  it("returns correct count", async () => {
    expect(await getPodcastCount(env.DB)).toBe(0);

    const podcastList: PodcastListResponse = {
      podcasts: [
        makePodcast({ uuid: "pod-1" }),
        makePodcast({ uuid: "pod-2" }),
      ],
      folders: [],
    };
    await savePodcasts(env.DB, podcastList);

    expect(await getPodcastCount(env.DB)).toBe(2);
  });
});
