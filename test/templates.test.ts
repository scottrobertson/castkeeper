import { describe, it, expect } from "vitest";
import { formatDuration, calculateProgress, generateEpisodesHtml, generateBookmarksHtml, formatRelativeDate } from "../src/templates";
import type { StoredEpisode, StoredBookmark } from "../src/schema";

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

describe("formatRelativeDate", () => {
  it("returns dash for null", () => {
    expect(formatRelativeDate(null)).toBe("\u2014");
  });

  it("returns minutes ago for recent dates", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeDate(fiveMinutesAgo)).toBe("5m ago");
  });

  it("returns hours ago for dates within a day", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(formatRelativeDate(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago for dates within a week", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(formatRelativeDate(twoDaysAgo)).toBe("2d ago");
  });

  it("returns month and day for dates within a year", () => {
    const result = formatRelativeDate("2024-06-15T00:00:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
  });
});

describe("generateEpisodesHtml", () => {
  it("includes the total episode count", () => {
    const html = generateEpisodesHtml([], 42, 1, 50, "pass");
    expect(html).toContain("42 episodes");
  });

  it("includes episode titles", () => {
    const html = generateEpisodesHtml([makeEpisode({ title: "My Great Episode" })], 1, 1, 50, "pass");
    expect(html).toContain("My Great Episode");
  });

  it("includes podcast titles", () => {
    const html = generateEpisodesHtml([makeEpisode({ podcast_title: "My Podcast" })], 1, 1, 50, "pass");
    expect(html).toContain("My Podcast");
  });

  it("includes the CSV export link with password", () => {
    const html = generateEpisodesHtml([], 0, 1, 50, "secret");
    expect(html).toContain("/export?password=secret");
  });

  it("includes progress percentage", () => {
    const html = generateEpisodesHtml(
      [makeEpisode({ duration: 3661, played_up_to: 1830 })],
      1, 1, 50,
      "pass"
    );
    expect(html).toContain("50%");
  });

  it("shows Played badge for finished episodes", () => {
    const html = generateEpisodesHtml([makeEpisode({ playing_status: 3 })], 1, 1, 50, "pass");
    // "Played" appears once as a filter label on every page; the episode status adds a second occurrence
    expect((html.match(/Played/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("shows In Progress badge for partially played episodes", () => {
    const html = generateEpisodesHtml([makeEpisode({ playing_status: 2, played_up_to: 300 })], 1, 1, 50, "pass");
    // "In Progress" appears once as a filter label on every page; the episode status adds a second occurrence
    expect((html.match(/In Progress/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("shows Archived badge for deleted episodes", () => {
    const html = generateEpisodesHtml([makeEpisode({ is_deleted: 1 })], 1, 1, 50, "pass");
    // Filter label uses plain text; the episode icon uses title="Archived"
    expect(html).toContain('title="Archived"');
  });


  it("includes backup button in nav", () => {
    const html = generateEpisodesHtml([], 0, 1, 50, "pass");
    expect(html).toContain("Backup Now");
  });

  it("includes nav links with password", () => {
    const html = generateEpisodesHtml([], 0, 1, 50, "secret");
    expect(html).toContain("/episodes?password=secret");
    expect(html).toContain("/podcasts?password=secret");
    expect(html).toContain("/bookmarks?password=secret");
  });

  it("shows pagination when there are multiple pages", () => {
    const html = generateEpisodesHtml([], 120, 1, 50, "pass");
    expect(html).toContain("Page 1 of 3");
    expect(html).toContain("Next");
  });

  it("shows previous link on page 2", () => {
    const html = generateEpisodesHtml([], 120, 2, 50, "pass");
    expect(html).toContain("Previous");
    expect(html).toContain("Next");
    expect(html).toContain("Page 2 of 3");
  });

  it("hides pagination for single page", () => {
    const html = generateEpisodesHtml([], 30, 1, 50, "pass");
    expect(html).not.toContain("Previous");
    expect(html).not.toContain("Next");
  });

  it("shows Starred badge for starred episodes", () => {
    const html = generateEpisodesHtml([makeEpisode({ starred: 1 })], 1, 1, 50, "pass");
    // Filter label uses plain text; the episode star icon uses title="Starred"
    expect(html).toContain('title="Starred"');
    expect(html).toContain("★");
  });

  it("shows filter buttons", () => {
    const html = generateEpisodesHtml([], 0, 1, 50, "pass");
    expect(html).toContain("In Progress");
    expect(html).toContain("Archived");
    expect(html).toContain("Starred");
    expect(html).toContain("Not Started");
  });

  it("highlights active filters", () => {
    const html = generateEpisodesHtml([], 0, 1, 50, "pass", ["starred"]);
    expect(html).toContain("(1)");
    // Active filter toggle URL should remove the filter (not include it)
    expect(html).toMatch(/href="\/episodes\?password=pass".*Starred/s);
  });

  it("shows empty state when filters match nothing", () => {
    const html = generateEpisodesHtml([], 0, 1, 50, "pass", ["starred"]);
    expect(html).toContain("No episodes match these filters");
    expect(html).toContain("Clear filters");
  });

  it("does not show empty state without filters", () => {
    const html = generateEpisodesHtml([], 0, 1, 50, "pass");
    expect(html).not.toContain("No episodes match these filters");
  });

  it("preserves filters in pagination links", () => {
    const html = generateEpisodesHtml([], 120, 1, 50, "pass", ["starred", "archived"]);
    expect(html).toContain("filter=starred");
    expect(html).toContain("filter=archived");
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
