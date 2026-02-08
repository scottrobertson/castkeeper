import { describe, it, expect } from "vitest";
import { EpisodesPage } from "../../src/components/EpisodesPage";
import type { StoredEpisode } from "../../src/schema";

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

function render(episodes: StoredEpisode[], totalEpisodes: number, page: number, perPage: number, filters: any[] = []): string {
  return (<EpisodesPage episodes={episodes} totalEpisodes={totalEpisodes} page={page} perPage={perPage} filters={filters} />).toString();
}

describe("EpisodesPage", () => {
  it("includes the total episode count", () => {
    const html = render([], 42, 1, 50);
    expect(html).toContain("42 episodes");
  });

  it("includes episode titles", () => {
    const html = render([makeEpisode({ title: "My Great Episode" })], 1, 1, 50);
    expect(html).toContain("My Great Episode");
  });

  it("includes podcast titles", () => {
    const html = render([makeEpisode({ podcast_title: "My Podcast" })], 1, 1, 50);
    expect(html).toContain("My Podcast");
  });

  it("includes the CSV export link", () => {
    const html = render([], 0, 1, 50);
    expect(html).toContain("/export");
  });

  it("includes progress percentage", () => {
    const html = render(
      [makeEpisode({ duration: 3661, played_up_to: 1830 })],
      1, 1, 50,
    );
    expect(html).toContain("50%");
  });

  it("shows Played badge for finished episodes", () => {
    const html = render([makeEpisode({ playing_status: 3 })], 1, 1, 50);
    expect((html.match(/Played/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("shows In Progress badge for partially played episodes", () => {
    const html = render([makeEpisode({ playing_status: 2, played_up_to: 300 })], 1, 1, 50);
    expect((html.match(/In Progress/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("shows Archived badge for deleted episodes", () => {
    const html = render([makeEpisode({ is_deleted: 1 })], 1, 1, 50);
    expect(html).toContain('>Archived<');
  });

  it("includes backup button in nav", () => {
    const html = render([], 0, 1, 50);
    expect(html).toContain("Backup Now");
  });

  it("includes nav links", () => {
    const html = render([], 0, 1, 50);
    expect(html).toContain('href="/episodes"');
    expect(html).toContain('href="/podcasts"');
    expect(html).toContain('href="/bookmarks"');
  });

  it("shows pagination when there are multiple pages", () => {
    const html = render([], 120, 1, 50);
    expect(html).toContain("Page 1 of 3");
    expect(html).toContain("Next");
  });

  it("shows previous link on page 2", () => {
    const html = render([], 120, 2, 50);
    expect(html).toContain("Previous");
    expect(html).toContain("Next");
    expect(html).toContain("Page 2 of 3");
  });

  it("hides pagination for single page", () => {
    const html = render([], 30, 1, 50);
    expect(html).not.toContain("Previous");
    expect(html).not.toContain("Next");
  });

  it("shows Starred badge for starred episodes", () => {
    const html = render([makeEpisode({ starred: 1 })], 1, 1, 50);
    expect(html).toContain('title="Starred"');
    expect(html).toContain("\u2605");
  });

  it("shows filter buttons", () => {
    const html = render([], 0, 1, 50);
    expect(html).toContain("In Progress");
    expect(html).toContain("Archived");
    expect(html).toContain("Starred");
    expect(html).toContain("Not Started");
  });

  it("highlights active filters", () => {
    const html = render([], 0, 1, 50, ["starred"]);
    expect(html).toContain("(1)");
    expect(html).toMatch(/href="\/episodes".*Starred/s);
  });

  it("shows empty state when filters match nothing", () => {
    const html = render([], 0, 1, 50, ["starred"]);
    expect(html).toContain("No episodes match these filters");
    expect(html).toContain("Clear filters");
  });

  it("does not show empty state without filters", () => {
    const html = render([], 0, 1, 50);
    expect(html).not.toContain("No episodes match these filters");
  });

  it("preserves filters in pagination links", () => {
    const html = render([], 120, 1, 50, ["starred", "archived"]);
    expect(html).toContain("filter=starred");
    expect(html).toContain("filter=archived");
  });

  it("includes logout button", () => {
    const html = render([], 0, 1, 50);
    expect(html).toContain("Logout");
    expect(html).toContain("/logout");
  });
});
