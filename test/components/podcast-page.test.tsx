import { describe, it, expect } from "vitest";
import { PodcastPage } from "../../src/components/PodcastPage";
import type { PodcastWithStats, BookmarkWithEpisode } from "../../src/db";
import type { StoredEpisode } from "../../src/schema";

function makePodcast(overrides: Partial<PodcastWithStats> = {}): PodcastWithStats {
  return {
    uuid: "pod-123",
    title: "Test Podcast",
    author: "Test Author",
    description: "A test description",
    url: "https://example.com/feed",
    slug: "test-podcast",
    date_added: "2024-01-01T00:00:00Z",
    folder_uuid: "",
    sort_position: 1,
    is_private: 0,
    auto_start_from: 0,
    auto_skip_last: 0,
    episodes_sort_order: 3,
    last_episode_uuid: "ep-1",
    last_episode_published: "2024-01-15T10:00:00Z",
    episode_count: 100,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    deleted_at: null,
    raw_data: "{}",
    total_episodes: 42,
    played_count: 38,
    starred_count: 5,
    total_played_time: 72000,
    ...overrides,
  };
}

function makeEpisode(overrides: Partial<StoredEpisode> = {}): StoredEpisode {
  return {
    uuid: "ep-123",
    url: "https://example.com/ep.mp3",
    title: "Test Episode",
    podcast_title: "Test Podcast",
    podcast_uuid: "pod-123",
    published: "2024-01-15",
    duration: 600,
    file_type: "audio/mp3",
    size: "1000000",
    playing_status: 3,
    played_up_to: 600,
    is_deleted: 0,
    starred: 0,
    episode_type: "full",
    episode_season: 1,
    episode_number: 5,
    author: "Test Author",
    slug: "test-episode",
    podcast_slug: "test-podcast",
    created_at: "2024-01-15T00:00:00Z",
    raw_data: "{}",
    ...overrides,
  };
}

function makeBookmark(overrides: Partial<BookmarkWithEpisode> = {}): BookmarkWithEpisode {
  return {
    bookmark_uuid: "bm-123",
    podcast_uuid: "pod-123",
    episode_uuid: "ep-123",
    time: 120,
    title: "Test Bookmark",
    created_at: "2024-01-15T10:00:00Z",
    deleted_at: null,
    raw_data: "{}",
    episode_title: "Test Episode",
    podcast_title: "Test Podcast",
    episode_duration: 600,
    ...overrides,
  };
}

function render(
  podcast: PodcastWithStats,
  episodes: StoredEpisode[],
  totalEpisodes: number,
  page: number,
  perPage: number,
  filters: any[] = [],
  bookmarks: BookmarkWithEpisode[] = []
): string {
  return (<PodcastPage podcast={podcast} episodes={episodes} totalEpisodes={totalEpisodes} page={page} perPage={perPage} filters={filters} bookmarks={bookmarks} />).toString();
}

describe("PodcastPage", () => {
  it("shows podcast title and author", () => {
    const html = render(makePodcast({ title: "My Show", author: "Jane Doe" }), [], 0, 1, 50);
    expect(html).toContain("My Show");
    expect(html).toContain("Jane Doe");
  });

  it("shows podcast description", () => {
    const html = render(makePodcast({ description: "An amazing show about things" }), [], 0, 1, 50);
    expect(html).toContain("An amazing show about things");
  });

  it("shows podcast URL as a link", () => {
    const html = render(makePodcast({ url: "https://example.com/feed" }), [], 0, 1, 50);
    expect(html).toContain("https://example.com/feed");
    expect(html).toContain("<a");
  });

  it("shows Removed badge for deleted podcasts", () => {
    const html = render(makePodcast({ deleted_at: "2024-06-01T00:00:00Z" }), [], 0, 1, 50);
    expect(html).toContain("Removed");
  });

  it("does not show Removed badge for active podcasts", () => {
    const html = render(makePodcast({ deleted_at: null }), [], 0, 1, 50);
    expect(html).not.toContain("Removed");
  });

  it("shows tracked episodes count and episode_count", () => {
    const html = render(makePodcast({ total_episodes: 42, episode_count: 100 }), [], 42, 1, 50);
    expect(html).toContain("42 of 100 tracked");
  });

  it("shows listening time when total_played_time is non-zero", () => {
    const html = render(makePodcast({ total_played_time: 3600 }), [], 0, 1, 50);
    expect(html).toContain("1h 0m 0s");
    expect(html).toContain("listened");
  });

  it("hides listening time when total_played_time is zero", () => {
    const html = render(makePodcast({ total_played_time: 0 }), [], 0, 1, 50);
    expect(html).not.toContain("listened");
  });

  it("renders episode rows", () => {
    const html = render(makePodcast(), [makeEpisode({ title: "My Episode" })], 1, 1, 50);
    expect(html).toContain("My Episode");
  });

  it("does not show podcast title in episode rows (showPodcast=false)", () => {
    const podcast = makePodcast({ title: "My Show", uuid: "pod-123" });
    // Use a distinct episode title so the podcast title is the only unique identifier
    const episode = makeEpisode({ podcast_title: "My Show", podcast_uuid: "pod-123" });
    const html = render(podcast, [episode], 1, 1, 50);
    // Episode rows should NOT contain a hyperlink to the podcast with the podcast title
    expect(html).not.toMatch(/<a[^>]*href="\/podcast\/pod-123"[^>]*>My Show<\/a>/);
  });

  it("shows empty state message when filters match nothing", () => {
    const html = render(makePodcast(), [], 0, 1, 50, ["starred"]);
    expect(html).toContain("No episodes match these filters");
    expect(html).toContain("Clear filters");
  });

  it("clears filters link points to podcast base path", () => {
    const podcast = makePodcast({ uuid: "pod-abc" });
    const html = render(podcast, [], 0, 1, 50, ["starred"]);
    expect(html).toContain(`/podcast/pod-abc`);
  });

  it("shows pagination when there are multiple pages", () => {
    const html = render(makePodcast(), [], 120, 1, 50);
    expect(html).toContain("Page 1 of 3");
    expect(html).toContain("Next");
  });

  it("shows bookmarks section when bookmarks exist", () => {
    const bookmarks = [makeBookmark({ title: "Great Moment" })];
    const html = render(makePodcast(), [], 0, 1, 50, [], bookmarks);
    expect(html).toContain("Bookmarks");
    expect(html).toContain("Great Moment");
  });

  it("shows active bookmark count", () => {
    const bookmarks = [
      makeBookmark({ bookmark_uuid: "bm-1", deleted_at: null }),
      makeBookmark({ bookmark_uuid: "bm-2", deleted_at: null }),
    ];
    const html = render(makePodcast(), [], 0, 1, 50, [], bookmarks);
    expect(html).toContain("2 bookmarks");
  });

  it("shows removed bookmark count when deleted bookmarks exist", () => {
    const bookmarks = [
      makeBookmark({ bookmark_uuid: "bm-1", deleted_at: null }),
      makeBookmark({ bookmark_uuid: "bm-2", deleted_at: "2024-06-01T00:00:00Z" }),
    ];
    const html = render(makePodcast(), [], 0, 1, 50, [], bookmarks);
    expect(html).toContain("1 removed");
  });

  it("hides bookmarks section when there are no bookmarks", () => {
    const html = render(makePodcast(), [], 0, 1, 50, [], []);
    // The bookmarks section uses an <h2> heading; nav links use <a> so checking <h2> is unambiguous
    expect(html).not.toMatch(/<h2[^>]*>\s*Bookmarks\s*<\/h2>/);
  });

  it("shows matching count when filters are active", () => {
    const html = render(makePodcast(), [], 7, 1, 50, ["starred"]);
    expect(html).toContain("7 matching");
  });

  it("includes the page title with podcast name", () => {
    const html = render(makePodcast({ title: "My Podcast" }), [], 0, 1, 50);
    expect(html).toContain("Castkeeper — My Podcast");
  });
});
