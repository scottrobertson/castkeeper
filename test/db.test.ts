import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { getExistingEpisodeUuids, updateEpisodeSyncData, insertNewEpisodes, getEpisodes, getEpisodeCount, savePodcasts, getPodcasts, getPodcastCount, saveBookmarks, getBookmarks } from "../src/db";
import type { NewEpisode } from "../src/db";
import type { PodcastListResponse, BookmarkListResponse } from "../src/types";

function makeNewEpisode(overrides: Partial<NewEpisode> = {}): NewEpisode {
  return {
    uuid: "ep-1",
    url: "https://example.com/ep1.mp3",
    title: "Test Episode",
    podcast_title: "Test Podcast",
    podcast_uuid: "pod-1",
    published: "2024-01-15T10:00:00Z",
    duration: 3600,
    file_type: "audio/mpeg",
    size: "50000000",
    playing_status: 3,
    played_up_to: 3600,
    is_deleted: 0,
    starred: 0,
    episode_type: "full",
    episode_season: 1,
    episode_number: 1,
    author: "Test Author",
    slug: "test-episode",
    podcast_slug: "test-podcast",
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

function makeBookmark(overrides: Partial<BookmarkListResponse["bookmarks"][number]> = {}) {
  return {
    bookmarkUuid: "bm-1",
    podcastUuid: "pod-1",
    episodeUuid: "ep-1",
    time: 980,
    title: "Test Bookmark",
    createdAt: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

beforeEach(async () => {
  await env.DB.exec("DROP TABLE IF EXISTS episodes");
  await env.DB.exec("DROP TABLE IF EXISTS podcasts");
  await env.DB.exec("DROP TABLE IF EXISTS bookmarks");
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("insertNewEpisodes", () => {
  it("inserts episodes", async () => {
    await insertNewEpisodes(env.DB, [makeNewEpisode()]);
    expect(await getEpisodeCount(env.DB)).toBe(1);
  });

  it("upserts on duplicate uuid", async () => {
    await insertNewEpisodes(env.DB, [makeNewEpisode({ title: "Original Title" })]);
    await insertNewEpisodes(env.DB, [makeNewEpisode({ title: "Updated Title" })]);

    expect(await getEpisodeCount(env.DB)).toBe(1);
    const episodes = await getEpisodes(env.DB);
    expect(episodes[0].title).toBe("Updated Title");
  });
});

describe("getExistingEpisodeUuids", () => {
  it("returns empty set for empty db", async () => {
    const result = await getExistingEpisodeUuids(env.DB, ["ep-1"]);
    expect(result.size).toBe(0);
  });

  it("returns existing uuids", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-1" }),
      makeNewEpisode({ uuid: "ep-2" }),
    ]);

    const result = await getExistingEpisodeUuids(env.DB, ["ep-1", "ep-2", "ep-3"]);
    expect(result.size).toBe(2);
    expect(result.has("ep-1")).toBe(true);
    expect(result.has("ep-2")).toBe(true);
    expect(result.has("ep-3")).toBe(false);
  });

  it("returns empty set for empty input", async () => {
    const result = await getExistingEpisodeUuids(env.DB, []);
    expect(result.size).toBe(0);
  });
});

describe("updateEpisodeSyncData", () => {
  it("updates sync fields on existing episodes", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-1", playing_status: 2, played_up_to: 1800 }),
    ]);

    await updateEpisodeSyncData(env.DB, [{
      uuid: "ep-1",
      playing_status: 3,
      played_up_to: 3600,
      starred: 1,
      is_deleted: 0,
    }]);

    const episodes = await getEpisodes(env.DB);
    expect(episodes[0].playing_status).toBe(3);
    expect(episodes[0].played_up_to).toBe(3600);
    expect(episodes[0].starred).toBe(1);
  });
});

describe("getEpisodes", () => {
  it("orders by status then published date", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-played", playing_status: 3, published: "2024-03-01T00:00:00Z" }),
      makeNewEpisode({ uuid: "ep-progress", playing_status: 2, published: "2024-01-01T00:00:00Z" }),
      makeNewEpisode({ uuid: "ep-not-started", playing_status: 1, published: "2024-02-01T00:00:00Z" }),
    ]);

    const episodes = await getEpisodes(env.DB);
    expect(episodes).toHaveLength(3);
    expect(episodes[0].uuid).toBe("ep-progress");
    expect(episodes[1].uuid).toBe("ep-played");
    expect(episodes[2].uuid).toBe("ep-not-started");
  });

  it("respects limit parameter", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-1", published: "2024-01-01T00:00:00Z" }),
      makeNewEpisode({ uuid: "ep-2", published: "2024-02-01T00:00:00Z" }),
      makeNewEpisode({ uuid: "ep-3", published: "2024-03-01T00:00:00Z" }),
    ]);

    const episodes = await getEpisodes(env.DB, 2);
    expect(episodes).toHaveLength(2);
  });
});

describe("getEpisodeCount", () => {
  it("returns correct count", async () => {
    expect(await getEpisodeCount(env.DB)).toBe(0);

    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-1" }),
      makeNewEpisode({ uuid: "ep-2" }),
    ]);

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

describe("saveBookmarks", () => {
  it("inserts bookmarks", async () => {
    const result = await saveBookmarks(env.DB, {
      bookmarks: [makeBookmark()],
    });
    expect(result.total).toBe(1);
  });

  it("upserts on duplicate bookmark_uuid", async () => {
    await saveBookmarks(env.DB, {
      bookmarks: [makeBookmark({ title: "Original" })],
    });

    const result = await saveBookmarks(env.DB, {
      bookmarks: [makeBookmark({ title: "Updated" })],
    });
    expect(result.total).toBe(1);

    const bookmarks = await getBookmarks(env.DB);
    expect(bookmarks[0].title).toBe("Updated");
  });

  it("marks missing bookmarks as deleted", async () => {
    await saveBookmarks(env.DB, {
      bookmarks: [
        makeBookmark({ bookmarkUuid: "bm-1", title: "Stays" }),
        makeBookmark({ bookmarkUuid: "bm-2", title: "Gets Removed" }),
      ],
    });

    await saveBookmarks(env.DB, {
      bookmarks: [makeBookmark({ bookmarkUuid: "bm-1", title: "Stays" })],
    });

    const bookmarks = await getBookmarks(env.DB);
    expect(bookmarks).toHaveLength(2);
    expect(bookmarks[0].title).toBe("Stays");
    expect(bookmarks[0].deleted_at).toBeNull();
    expect(bookmarks[1].title).toBe("Gets Removed");
    expect(bookmarks[1].deleted_at).not.toBeNull();
  });

  it("restores deleted bookmarks when re-added", async () => {
    await saveBookmarks(env.DB, {
      bookmarks: [makeBookmark({ bookmarkUuid: "bm-1" })],
    });

    await saveBookmarks(env.DB, { bookmarks: [] });
    let bookmarks = await getBookmarks(env.DB);
    expect(bookmarks[0].deleted_at).not.toBeNull();

    await saveBookmarks(env.DB, {
      bookmarks: [makeBookmark({ bookmarkUuid: "bm-1" })],
    });
    bookmarks = await getBookmarks(env.DB);
    expect(bookmarks[0].deleted_at).toBeNull();
  });
});
