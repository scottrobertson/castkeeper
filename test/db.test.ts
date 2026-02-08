import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { getExistingEpisodeUuids, updateEpisodeSyncData, insertNewEpisodes, getEpisodes, getEpisodeCount, savePodcasts, getPodcasts, getPodcastCount, saveBookmarks, getBookmarks, getPodcastsWithStats, getBookmarksWithEpisodes, updateEpisodePlayedAt, parseFilters } from "../src/db";
import type { NewEpisode, EpisodeFilter } from "../src/db";
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
  it("orders by played_at descending, nulls last, then by published date", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-no-date", playing_status: 3, published: "2024-03-01T00:00:00Z" }),
      makeNewEpisode({ uuid: "ep-older", playing_status: 3, published: "2024-01-01T00:00:00Z" }),
      makeNewEpisode({ uuid: "ep-recent", playing_status: 2, published: "2024-02-01T00:00:00Z" }),
    ]);

    // Set played_at on two of them
    await env.DB.exec("UPDATE episodes SET played_at = '2024-03-10T12:00:00Z' WHERE uuid = 'ep-recent'");
    await env.DB.exec("UPDATE episodes SET played_at = '2024-03-05T12:00:00Z' WHERE uuid = 'ep-older'");

    const episodes = await getEpisodes(env.DB);
    expect(episodes).toHaveLength(3);
    expect(episodes[0].uuid).toBe("ep-recent");
    expect(episodes[1].uuid).toBe("ep-older");
    expect(episodes[2].uuid).toBe("ep-no-date");
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

describe("getPodcastsWithStats", () => {
  it("returns zero stats with no episodes", async () => {
    await savePodcasts(env.DB, {
      podcasts: [makePodcast()],
      folders: [],
    });

    const podcasts = await getPodcastsWithStats(env.DB);
    expect(podcasts).toHaveLength(1);
    expect(podcasts[0].total_episodes).toBe(0);
    expect(podcasts[0].played_count).toBe(0);
    expect(podcasts[0].starred_count).toBe(0);
    expect(podcasts[0].total_played_time).toBe(0);
  });

  it("returns correct aggregation with episodes", async () => {
    await savePodcasts(env.DB, {
      podcasts: [makePodcast()],
      folders: [],
    });

    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-1", playing_status: 3, played_up_to: 3600, starred: 1 }),
      makeNewEpisode({ uuid: "ep-2", playing_status: 2, played_up_to: 1800, starred: 0 }),
      makeNewEpisode({ uuid: "ep-3", playing_status: 1, played_up_to: 0, starred: 0 }),
    ]);

    const podcasts = await getPodcastsWithStats(env.DB);
    expect(podcasts).toHaveLength(1);
    expect(podcasts[0].total_episodes).toBe(3);
    expect(podcasts[0].played_count).toBe(1);
    expect(podcasts[0].starred_count).toBe(1);
    expect(podcasts[0].total_played_time).toBe(5400);
  });
});

describe("parseFilters", () => {
  it("returns valid filters", () => {
    const result = parseFilters(["archived", "played", "starred"]);
    expect(result).toEqual(["archived", "played", "starred"]);
  });

  it("rejects invalid filter values", () => {
    const result = parseFilters(["archived", "invalid", "hacked", "played"]);
    expect(result).toEqual(["archived", "played"]);
  });

  it("returns empty array for no valid filters", () => {
    const result = parseFilters(["bad", "values"]);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    const result = parseFilters([]);
    expect(result).toEqual([]);
  });

  it("accepts all valid filter values", () => {
    const result = parseFilters(["archived", "in_progress", "played", "not_started", "starred"]);
    expect(result).toEqual(["archived", "in_progress", "played", "not_started", "starred"]);
  });
});

describe("getEpisodes with filters", () => {
  it("filters by played status", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-played", playing_status: 3 }),
      makeNewEpisode({ uuid: "ep-progress", playing_status: 2 }),
      makeNewEpisode({ uuid: "ep-not-started", playing_status: 1 }),
    ]);

    const played = await getEpisodes(env.DB, undefined, undefined, ["played"]);
    expect(played).toHaveLength(1);
    expect(played[0].uuid).toBe("ep-played");
  });

  it("filters by in_progress status", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-played", playing_status: 3 }),
      makeNewEpisode({ uuid: "ep-progress", playing_status: 2 }),
    ]);

    const inProgress = await getEpisodes(env.DB, undefined, undefined, ["in_progress"]);
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0].uuid).toBe("ep-progress");
  });

  it("filters by starred", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-starred", starred: 1 }),
      makeNewEpisode({ uuid: "ep-not-starred", starred: 0 }),
    ]);

    const starred = await getEpisodes(env.DB, undefined, undefined, ["starred"]);
    expect(starred).toHaveLength(1);
    expect(starred[0].uuid).toBe("ep-starred");
  });

  it("filters by archived (is_deleted)", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-archived", is_deleted: 1 }),
      makeNewEpisode({ uuid: "ep-active", is_deleted: 0 }),
    ]);

    const archived = await getEpisodes(env.DB, undefined, undefined, ["archived"]);
    expect(archived).toHaveLength(1);
    expect(archived[0].uuid).toBe("ep-archived");
  });

  it("filters by not_started status", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-not-started", playing_status: 1 }),
      makeNewEpisode({ uuid: "ep-played", playing_status: 3 }),
    ]);

    const notStarted = await getEpisodes(env.DB, undefined, undefined, ["not_started"]);
    expect(notStarted).toHaveLength(1);
    expect(notStarted[0].uuid).toBe("ep-not-started");
  });
});

describe("getEpisodeCount with filters", () => {
  it("counts only matching episodes", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-1", playing_status: 3 }),
      makeNewEpisode({ uuid: "ep-2", playing_status: 2 }),
      makeNewEpisode({ uuid: "ep-3", playing_status: 3 }),
    ]);

    expect(await getEpisodeCount(env.DB, ["played"])).toBe(2);
    expect(await getEpisodeCount(env.DB, ["in_progress"])).toBe(1);
    expect(await getEpisodeCount(env.DB)).toBe(3);
  });
});

describe("updateEpisodePlayedAt", () => {
  it("returns zeros for empty input", async () => {
    const result = await updateEpisodePlayedAt(env.DB, []);
    expect(result).toEqual({ updated: 0, skipped: 0 });
  });

  it("sets played_at when it was null", async () => {
    await insertNewEpisodes(env.DB, [makeNewEpisode({ uuid: "ep-1" })]);

    const result = await updateEpisodePlayedAt(env.DB, [
      { uuid: "ep-1", played_at: "2024-06-15T12:00:00.000Z" },
    ]);

    expect(result).toEqual({ updated: 1, skipped: 0 });

    const eps = await getEpisodes(env.DB);
    expect(eps[0].played_at).toBe("2024-06-15T12:00:00.000Z");
  });

  it("updates played_at when new timestamp is more recent", async () => {
    await insertNewEpisodes(env.DB, [makeNewEpisode({ uuid: "ep-1" })]);
    await env.DB.exec("UPDATE episodes SET played_at = '2024-01-01T00:00:00.000Z' WHERE uuid = 'ep-1'");

    const result = await updateEpisodePlayedAt(env.DB, [
      { uuid: "ep-1", played_at: "2024-06-15T12:00:00.000Z" },
    ]);

    expect(result).toEqual({ updated: 1, skipped: 0 });

    const eps = await getEpisodes(env.DB);
    expect(eps[0].played_at).toBe("2024-06-15T12:00:00.000Z");
  });

  it("skips when existing played_at is newer", async () => {
    await insertNewEpisodes(env.DB, [makeNewEpisode({ uuid: "ep-1" })]);
    await env.DB.exec("UPDATE episodes SET played_at = '2024-12-01T00:00:00.000Z' WHERE uuid = 'ep-1'");

    const result = await updateEpisodePlayedAt(env.DB, [
      { uuid: "ep-1", played_at: "2024-06-15T12:00:00.000Z" },
    ]);

    expect(result).toEqual({ updated: 0, skipped: 1 });

    const eps = await getEpisodes(env.DB);
    expect(eps[0].played_at).toBe("2024-12-01T00:00:00.000Z");
  });

  it("skips episodes not in the database", async () => {
    const result = await updateEpisodePlayedAt(env.DB, [
      { uuid: "nonexistent", played_at: "2024-06-15T12:00:00.000Z" },
    ]);

    expect(result).toEqual({ updated: 0, skipped: 1 });
  });

  it("handles a mix of updates and skips", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-1" }),
      makeNewEpisode({ uuid: "ep-2" }),
      makeNewEpisode({ uuid: "ep-3" }),
    ]);

    // ep-1: no played_at (null) -> should update
    // ep-2: older played_at -> should update
    await env.DB.exec("UPDATE episodes SET played_at = '2024-01-01T00:00:00.000Z' WHERE uuid = 'ep-2'");
    // ep-3: newer played_at -> should skip
    await env.DB.exec("UPDATE episodes SET played_at = '2024-12-01T00:00:00.000Z' WHERE uuid = 'ep-3'");

    const result = await updateEpisodePlayedAt(env.DB, [
      { uuid: "ep-1", played_at: "2024-06-15T12:00:00.000Z" },
      { uuid: "ep-2", played_at: "2024-06-15T12:00:00.000Z" },
      { uuid: "ep-3", played_at: "2024-06-15T12:00:00.000Z" },
      { uuid: "ep-missing", played_at: "2024-06-15T12:00:00.000Z" },
    ]);

    expect(result).toEqual({ updated: 2, skipped: 2 });
  });

  it("skips when existing played_at equals new value", async () => {
    await insertNewEpisodes(env.DB, [makeNewEpisode({ uuid: "ep-1" })]);
    await env.DB.exec("UPDATE episodes SET played_at = '2024-06-15T12:00:00.000Z' WHERE uuid = 'ep-1'");

    const result = await updateEpisodePlayedAt(env.DB, [
      { uuid: "ep-1", played_at: "2024-06-15T12:00:00.000Z" },
    ]);

    expect(result).toEqual({ updated: 0, skipped: 1 });
  });

  it("moves played_at forward then refuses to move it backward", async () => {
    await insertNewEpisodes(env.DB, [makeNewEpisode({ uuid: "ep-1" })]);

    // First listen: sets played_at from null
    const first = await updateEpisodePlayedAt(env.DB, [
      { uuid: "ep-1", played_at: "2024-03-01T10:00:00.000Z" },
    ]);
    expect(first).toEqual({ updated: 1, skipped: 0 });

    let eps = await getEpisodes(env.DB);
    expect(eps[0].played_at).toBe("2024-03-01T10:00:00.000Z");

    // Re-listen: moves played_at forward
    const second = await updateEpisodePlayedAt(env.DB, [
      { uuid: "ep-1", played_at: "2024-09-15T18:00:00.000Z" },
    ]);
    expect(second).toEqual({ updated: 1, skipped: 0 });

    eps = await getEpisodes(env.DB);
    expect(eps[0].played_at).toBe("2024-09-15T18:00:00.000Z");

    // Old history data arrives: must NOT move played_at backward
    const third = await updateEpisodePlayedAt(env.DB, [
      { uuid: "ep-1", played_at: "2024-03-01T10:00:00.000Z" },
    ]);
    expect(third).toEqual({ updated: 0, skipped: 1 });

    eps = await getEpisodes(env.DB);
    expect(eps[0].played_at).toBe("2024-09-15T18:00:00.000Z");
  });
});

describe("getBookmarksWithEpisodes", () => {
  it("returns null episode fields when no episode exists", async () => {
    await saveBookmarks(env.DB, {
      bookmarks: [makeBookmark()],
    });

    const bookmarks = await getBookmarksWithEpisodes(env.DB);
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].title).toBe("Test Bookmark");
    expect(bookmarks[0].episode_title).toBeNull();
    expect(bookmarks[0].podcast_title).toBeNull();
    expect(bookmarks[0].episode_duration).toBeNull();
  });

  it("returns joined data when episode exists", async () => {
    await insertNewEpisodes(env.DB, [
      makeNewEpisode({ uuid: "ep-1", title: "My Episode", podcast_title: "My Podcast", duration: 3600 }),
    ]);

    await saveBookmarks(env.DB, {
      bookmarks: [makeBookmark({ episodeUuid: "ep-1" })],
    });

    const bookmarks = await getBookmarksWithEpisodes(env.DB);
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].episode_title).toBe("My Episode");
    expect(bookmarks[0].podcast_title).toBe("My Podcast");
    expect(bookmarks[0].episode_duration).toBe(3600);
  });
});
