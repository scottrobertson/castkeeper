import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleQueueMessage } from "../src/backup";
import type { BackupQueueMessage } from "../src/types";

vi.mock("../src/login", () => ({
  login: vi.fn(),
}));

vi.mock("../src/api", () => ({
  getEpisodeSyncData: vi.fn(),
  getPodcastEpisodeMetadata: vi.fn(),
  getPodcastList: vi.fn(),
  getBookmarks: vi.fn(),
}));

vi.mock("../src/db", () => ({
  getExistingEpisodeUuids: vi.fn(),
  updateEpisodeSyncData: vi.fn(),
  insertNewEpisodes: vi.fn(),
  savePodcasts: vi.fn(),
  saveBookmarks: vi.fn(),
  updatePodcastEpisodeCount: vi.fn(),
  resetBackupProgress: vi.fn(),
  incrementBackupProgress: vi.fn(),
  updateEpisodePlayedAt: vi.fn(),
}));

vi.mock("../src/history", () => ({
  getListenHistory: vi.fn(),
}));

import { login } from "../src/login";
import { getEpisodeSyncData, getPodcastEpisodeMetadata, getPodcastList, getBookmarks as getBookmarksApi } from "../src/api";
import {
  getExistingEpisodeUuids,
  updateEpisodeSyncData,
  insertNewEpisodes,
  savePodcasts,
  saveBookmarks,
  updatePodcastEpisodeCount,
  resetBackupProgress,
  incrementBackupProgress,
  updateEpisodePlayedAt,
} from "../src/db";
import { getListenHistory } from "../src/history";

function makeMockEnv() {
  return {
    // All db functions are mocked via vi.mock("../src/db"), so this empty object
    // is never actually accessed — it's only passed through to the mocked functions.
    DB: {} as D1Database,
    EMAIL: "test@example.com",
    PASS: "test-password",
    BACKUP_QUEUE: {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as Env;
}

const mockPodcastList = {
  podcasts: [
    {
      uuid: "pod-1",
      title: "Test Podcast",
      author: "Test Author",
      slug: "test-podcast",
      description: "",
      url: "",
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
      descriptionHtml: "",
      settings: {},
    },
  ],
  folders: [],
};

const mockBookmarkList = { bookmarks: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(login).mockResolvedValue("mock-token");
  vi.mocked(getPodcastList).mockResolvedValue(mockPodcastList);
  vi.mocked(getBookmarksApi).mockResolvedValue(mockBookmarkList);
  vi.mocked(savePodcasts).mockResolvedValue({ total: 1 });
  vi.mocked(saveBookmarks).mockResolvedValue({ total: 0 });
  vi.mocked(resetBackupProgress).mockResolvedValue(undefined);
  vi.mocked(incrementBackupProgress).mockResolvedValue({ completed: 1, total: 1 });
  vi.mocked(updatePodcastEpisodeCount).mockResolvedValue(undefined);
  vi.mocked(getExistingEpisodeUuids).mockResolvedValue(new Set());
  vi.mocked(updateEpisodeSyncData).mockResolvedValue(undefined);
  vi.mocked(insertNewEpisodes).mockResolvedValue(undefined);
  vi.mocked(updateEpisodePlayedAt).mockResolvedValue({ updated: 0, skipped: 0 });
  vi.mocked(getListenHistory).mockResolvedValue([]);
  vi.mocked(getEpisodeSyncData).mockResolvedValue({ episodes: [] });
  vi.mocked(getPodcastEpisodeMetadata).mockResolvedValue({
    episode_count: 0,
    has_more_episodes: false,
    podcast: { uuid: "pod-1", title: "Test Podcast", author: "Test Author", slug: "test-podcast", episodes: [] },
  });
});

describe("handleQueueMessage — sync-podcasts", () => {
  it("logs in and fetches podcast list and bookmarks", async () => {
    const env = makeMockEnv();
    await handleQueueMessage({ type: "sync-podcasts" }, env);

    expect(login).toHaveBeenCalledWith("test@example.com", "test-password");
    expect(getPodcastList).toHaveBeenCalledWith("mock-token");
    expect(getBookmarksApi).toHaveBeenCalledWith("mock-token");
  });

  it("saves podcasts and bookmarks to DB", async () => {
    const env = makeMockEnv();
    await handleQueueMessage({ type: "sync-podcasts" }, env);

    expect(savePodcasts).toHaveBeenCalledWith(env.DB, mockPodcastList);
    expect(saveBookmarks).toHaveBeenCalledWith(env.DB, mockBookmarkList);
  });

  it("resets backup progress with total podcast count", async () => {
    const env = makeMockEnv();
    await handleQueueMessage({ type: "sync-podcasts" }, env);

    expect(resetBackupProgress).toHaveBeenCalledWith(env.DB, 1);
  });

  it("enqueues one sync-podcast message per podcast", async () => {
    const env = makeMockEnv();
    await handleQueueMessage({ type: "sync-podcasts" }, env);

    expect(env.BACKUP_QUEUE.sendBatch).toHaveBeenCalledTimes(1);
    const [messages] = vi.mocked(env.BACKUP_QUEUE.sendBatch).mock.calls[0] as [Array<{ body: BackupQueueMessage }>];
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toMatchObject({
      type: "sync-podcast",
      token: "mock-token",
      podcastUuid: "pod-1",
      podcastTitle: "Test Podcast",
      podcastAuthor: "Test Author",
      podcastSlug: "test-podcast",
    });
  });

  it("enqueues in batches of 100 when there are more than 100 podcasts", async () => {
    const manyPodcasts = Array.from({ length: 150 }, (_, i) => ({
      ...mockPodcastList.podcasts[0],
      uuid: `pod-${i}`,
      title: `Podcast ${i}`,
    }));
    vi.mocked(getPodcastList).mockResolvedValue({ podcasts: manyPodcasts, folders: [] });

    const env = makeMockEnv();
    await handleQueueMessage({ type: "sync-podcasts" }, env);

    expect(env.BACKUP_QUEUE.sendBatch).toHaveBeenCalledTimes(2);
    const firstBatch = vi.mocked(env.BACKUP_QUEUE.sendBatch).mock.calls[0][0];
    const secondBatch = vi.mocked(env.BACKUP_QUEUE.sendBatch).mock.calls[1][0];
    expect(firstBatch).toHaveLength(100);
    expect(secondBatch).toHaveLength(50);
  });
});

describe("handleQueueMessage — sync-podcast", () => {
  const syncPodcastMessage: Extract<BackupQueueMessage, { type: "sync-podcast" }> = {
    type: "sync-podcast",
    token: "mock-token",
    podcastUuid: "pod-1",
    podcastTitle: "Test Podcast",
    podcastAuthor: "Test Author",
    podcastSlug: "test-podcast",
  };

  it("updates podcast episode count from cache metadata", async () => {
    vi.mocked(getPodcastEpisodeMetadata).mockResolvedValue({
      episode_count: 42,
      has_more_episodes: false,
      podcast: { uuid: "pod-1", title: "Test Podcast", author: "Test Author", slug: "test-podcast", episodes: [] },
    });

    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(updatePodcastEpisodeCount).toHaveBeenCalledWith(env.DB, "pod-1", 42);
  });

  it("increments backup progress after processing podcast", async () => {
    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(incrementBackupProgress).toHaveBeenCalledWith(env.DB);
  });

  it("enqueues sync-history when all podcasts are done", async () => {
    vi.mocked(incrementBackupProgress).mockResolvedValue({ completed: 5, total: 5 });

    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(env.BACKUP_QUEUE.send).toHaveBeenCalledWith({
      type: "sync-history",
      token: "mock-token",
    });
  });

  it("does not enqueue sync-history when podcasts are still being processed", async () => {
    vi.mocked(incrementBackupProgress).mockResolvedValue({ completed: 3, total: 5 });

    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(env.BACKUP_QUEUE.send).not.toHaveBeenCalled();
  });

  it("skips processing when no episodes have been interacted with", async () => {
    vi.mocked(getEpisodeSyncData).mockResolvedValue({
      episodes: [
        { uuid: "ep-1", playingStatus: 0, playedUpTo: 0, isDeleted: false, starred: false, duration: 3600, bookmarks: [], deselectedChapters: "" },
      ],
    });

    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(getExistingEpisodeUuids).not.toHaveBeenCalled();
    expect(insertNewEpisodes).not.toHaveBeenCalled();
    expect(updateEpisodeSyncData).not.toHaveBeenCalled();
  });

  it("updates existing episodes with new sync data", async () => {
    vi.mocked(getEpisodeSyncData).mockResolvedValue({
      episodes: [
        { uuid: "ep-1", playingStatus: 3, playedUpTo: 3600, isDeleted: false, starred: true, duration: 3600, bookmarks: [], deselectedChapters: "" },
      ],
    });
    vi.mocked(getExistingEpisodeUuids).mockResolvedValue(new Set(["ep-1"]));

    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(updateEpisodeSyncData).toHaveBeenCalledWith(env.DB, [
      { uuid: "ep-1", playing_status: 3, played_up_to: 3600, starred: 1, is_deleted: 0 },
    ]);
    expect(insertNewEpisodes).not.toHaveBeenCalled();
  });

  it("inserts new episodes merged with cache metadata", async () => {
    vi.mocked(getEpisodeSyncData).mockResolvedValue({
      episodes: [
        { uuid: "ep-1", playingStatus: 2, playedUpTo: 900, isDeleted: false, starred: false, duration: 3600, bookmarks: [], deselectedChapters: "" },
      ],
    });
    vi.mocked(getExistingEpisodeUuids).mockResolvedValue(new Set());
    vi.mocked(getPodcastEpisodeMetadata).mockResolvedValue({
      episode_count: 1,
      has_more_episodes: false,
      podcast: {
        uuid: "pod-1",
        title: "Test Podcast",
        author: "Test Author",
        slug: "test-podcast",
        episodes: [
          {
            uuid: "ep-1",
            title: "Episode One",
            slug: "episode-one",
            url: "https://example.com/ep1.mp3",
            file_type: "audio/mpeg",
            file_size: 50000000,
            duration: 3600,
            published: "2024-01-15T10:00:00Z",
            type: "full",
            season: 1,
            number: 5,
          },
        ],
      },
    });

    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(insertNewEpisodes).toHaveBeenCalledWith(
      env.DB,
      [
        expect.objectContaining({
          uuid: "ep-1",
          title: "Episode One",
          url: "https://example.com/ep1.mp3",
          podcast_uuid: "pod-1",
          podcast_title: "Test Podcast",
          playing_status: 2,
          played_up_to: 900,
          duration: 3600,
          episode_type: "full",
          episode_season: 1,
          episode_number: 5,
          author: "Test Author",
          slug: "episode-one",
          podcast_slug: "test-podcast",
        }),
      ]
    );
  });

  it("skips new episodes that are missing from cache metadata", async () => {
    vi.mocked(getEpisodeSyncData).mockResolvedValue({
      episodes: [
        { uuid: "ep-missing", playingStatus: 3, playedUpTo: 1200, isDeleted: false, starred: false, duration: 1200, bookmarks: [], deselectedChapters: "" },
      ],
    });
    vi.mocked(getExistingEpisodeUuids).mockResolvedValue(new Set());
    vi.mocked(getPodcastEpisodeMetadata).mockResolvedValue({
      episode_count: 0,
      has_more_episodes: false,
      podcast: { uuid: "pod-1", title: "Test Podcast", author: "Test Author", slug: "test-podcast", episodes: [] },
    });

    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(insertNewEpisodes).not.toHaveBeenCalled();
  });

  it("includes episodes with playedUpTo > 0 even if playingStatus is 0", async () => {
    vi.mocked(getEpisodeSyncData).mockResolvedValue({
      episodes: [
        { uuid: "ep-1", playingStatus: 0, playedUpTo: 60, isDeleted: false, starred: false, duration: 3600, bookmarks: [], deselectedChapters: "" },
      ],
    });
    vi.mocked(getExistingEpisodeUuids).mockResolvedValue(new Set());

    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(getExistingEpisodeUuids).toHaveBeenCalledWith(env.DB, ["ep-1"]);
  });

  it("uses sync duration when cache duration is missing", async () => {
    vi.mocked(getEpisodeSyncData).mockResolvedValue({
      episodes: [
        { uuid: "ep-1", playingStatus: 3, playedUpTo: 1500, isDeleted: false, starred: false, duration: 1500, bookmarks: [], deselectedChapters: "" },
      ],
    });
    vi.mocked(getExistingEpisodeUuids).mockResolvedValue(new Set());
    vi.mocked(getPodcastEpisodeMetadata).mockResolvedValue({
      episode_count: 1,
      has_more_episodes: false,
      podcast: {
        uuid: "pod-1",
        title: "Test Podcast",
        author: "Test Author",
        slug: "test-podcast",
        episodes: [
          {
            uuid: "ep-1",
            title: "Episode",
            slug: "episode",
            url: "https://example.com/ep1.mp3",
            file_type: "",
            file_size: 0,
            duration: 0,
            published: "2024-01-15T10:00:00Z",
            type: "full",
            season: 0,
            number: 0,
          },
        ],
      },
    });

    const env = makeMockEnv();
    await handleQueueMessage(syncPodcastMessage, env);

    expect(insertNewEpisodes).toHaveBeenCalledWith(
      env.DB,
      [expect.objectContaining({ uuid: "ep-1", duration: 1500 })]
    );
  });
});

describe("handleQueueMessage — sync-history", () => {
  it("fetches listen history and updates played_at timestamps", async () => {
    const historyEntries = [
      { uuid: "ep-1", played_at: "2024-06-15T12:00:00.000Z" },
      { uuid: "ep-2", played_at: "2024-06-14T08:00:00.000Z" },
    ];
    vi.mocked(getListenHistory).mockResolvedValue(historyEntries);
    vi.mocked(updateEpisodePlayedAt).mockResolvedValue({ updated: 2, skipped: 0 });

    const env = makeMockEnv();
    await handleQueueMessage({ type: "sync-history", token: "mock-token" }, env);

    expect(getListenHistory).toHaveBeenCalledWith("mock-token");
    expect(updateEpisodePlayedAt).toHaveBeenCalledWith(env.DB, historyEntries);
  });

  it("handles empty history gracefully", async () => {
    vi.mocked(getListenHistory).mockResolvedValue([]);
    vi.mocked(updateEpisodePlayedAt).mockResolvedValue({ updated: 0, skipped: 0 });

    const env = makeMockEnv();
    await handleQueueMessage({ type: "sync-history", token: "mock-token" }, env);

    expect(getListenHistory).toHaveBeenCalledWith("mock-token");
    expect(updateEpisodePlayedAt).toHaveBeenCalledWith(env.DB, []);
  });
});
