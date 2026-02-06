import { describe, it, expect } from "vitest";
import { formatDuration, calculateProgress, generateHistoryHtml, generateBookmarksHtml } from "../src/templates";
import type { StoredEpisode, StoredBookmark } from "../src/types";

function makeEpisode(overrides: Partial<StoredEpisode> = {}): StoredEpisode {
  return {
    uuid: "abc-123",
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

function makeBookmark(overrides: Partial<StoredBookmark> = {}): StoredBookmark {
  return {
    bookmark_uuid: "bm-123",
    podcast_uuid: "pod-123",
    episode_uuid: "ep-123",
    time: 120,
    title: "Test Bookmark",
    created_at: "2024-01-15T10:00:00Z",
    deleted_at: null,
    raw_data: "{}",
    ...overrides,
  };
}

describe("formatDuration", () => {
  it("returns 0s for zero seconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("returns seconds only for values under a minute", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("returns minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2m 5s");
  });

  it("returns hours, minutes, and seconds", () => {
    expect(formatDuration(3661)).toBe("1h 1m 1s");
  });

  it("returns exact minute with 0 seconds", () => {
    expect(formatDuration(60)).toBe("1m 0s");
  });

  it("returns exact hour with 0 minutes and 0 seconds", () => {
    expect(formatDuration(3600)).toBe("1h 0m 0s");
  });
});

describe("calculateProgress", () => {
  it("returns 100 for a fully listened episode", () => {
    expect(calculateProgress(600, 600)).toBe(100);
  });

  it("returns 50 for a half listened episode", () => {
    expect(calculateProgress(300, 600)).toBe(50);
  });

  it("rounds to the nearest integer", () => {
    expect(calculateProgress(1, 3)).toBe(33);
  });

  it("returns 0 when nothing has been played", () => {
    expect(calculateProgress(0, 600)).toBe(0);
  });
});

describe("generateHistoryHtml", () => {
  it("includes the total episode count", () => {
    const html = generateHistoryHtml([], 42, "pass");
    expect(html).toContain("42");
  });

  it("includes episode titles", () => {
    const html = generateHistoryHtml([makeEpisode({ title: "My Great Episode" })], 1, "pass");
    expect(html).toContain("My Great Episode");
  });

  it("includes podcast titles", () => {
    const html = generateHistoryHtml([makeEpisode({ podcast_title: "My Podcast" })], 1, "pass");
    expect(html).toContain("My Podcast");
  });

  it("includes the CSV export link with password", () => {
    const html = generateHistoryHtml([], 0, "secret");
    expect(html).toContain("/export?password=secret");
  });

  it("includes formatted duration and progress", () => {
    const html = generateHistoryHtml(
      [makeEpisode({ duration: 3661, played_up_to: 1830 })],
      1,
      "pass"
    );
    expect(html).toContain("1h 1m 1s");
    expect(html).toContain("50%");
  });

  it("includes backup button in nav", () => {
    const html = generateHistoryHtml([], 0, "pass");
    expect(html).toContain("Backup Now");
  });

  it("includes nav links with password", () => {
    const html = generateHistoryHtml([], 0, "secret");
    expect(html).toContain("/history?password=secret");
    expect(html).toContain("/podcasts?password=secret");
    expect(html).toContain("/bookmarks?password=secret");
  });
});

describe("generateBookmarksHtml", () => {
  it("includes bookmark titles", () => {
    const html = generateBookmarksHtml([makeBookmark({ title: "Great Moment" })], "pass");
    expect(html).toContain("Great Moment");
  });

  it("includes formatted bookmark time", () => {
    const html = generateBookmarksHtml([makeBookmark({ time: 3661 })], "pass");
    expect(html).toContain("1h 1m 1s");
  });

  it("shows removed badge for deleted bookmarks", () => {
    const html = generateBookmarksHtml([makeBookmark({ deleted_at: "2024-06-01T00:00:00Z" })], "pass");
    expect(html).toContain("Removed");
  });

  it("shows active count", () => {
    const html = generateBookmarksHtml([makeBookmark(), makeBookmark({ bookmark_uuid: "bm-2" })], "pass");
    expect(html).toContain("2 bookmarks");
  });
});
