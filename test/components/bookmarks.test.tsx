import { describe, it, expect } from "vitest";
import { BookmarksPage } from "../../src/components/BookmarksPage";
import type { BookmarkWithEpisode } from "../../src/db";

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
    episode_duration: 3600,
    ...overrides,
  };
}

function render(bookmarks: BookmarkWithEpisode[]): string {
  return (<BookmarksPage bookmarks={bookmarks} />).toString();
}

describe("BookmarksPage", () => {
  it("includes bookmark titles", () => {
    const html = render([makeBookmark({ title: "Great Moment" })]);
    expect(html).toContain("Great Moment");
  });

  it("includes formatted bookmark time", () => {
    const html = render([makeBookmark({ time: 3661 })]);
    expect(html).toContain("1h 1m 1s");
  });

  it("shows removed section for deleted bookmarks", () => {
    const html = render([makeBookmark({ deleted_at: "2024-06-01T00:00:00Z" })]);
    expect(html).toContain("Removed");
  });

  it("shows active count", () => {
    const html = render([makeBookmark(), makeBookmark({ bookmark_uuid: "bm-2" })]);
    expect(html).toContain("2 bookmarks");
  });

  it("shows episode title and podcast title", () => {
    const html = render([makeBookmark({ episode_title: "Great Episode", podcast_title: "Cool Podcast" })]);
    expect(html).toContain("Great Episode");
    expect(html).toContain("Cool Podcast");
  });

  it("handles null episode data gracefully", () => {
    const html = render([makeBookmark({ episode_title: null, podcast_title: null, episode_duration: null })]);
    expect(html).toContain("Test Bookmark");
  });
});
