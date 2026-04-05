import { describe, it, expect } from "vitest";
import { buildFilterParams, EpisodeRow, GroupedEpisodes } from "../../src/components/EpisodeList";
import type { StoredEpisode } from "../../src/schema";

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
    played_at: null,
    ...overrides,
  };
}

describe("buildFilterParams", () => {
  it("returns base path with no filters or page", () => {
    expect(buildFilterParams("/episodes", [])).toBe("/episodes");
  });

  it("appends a single filter as a query param", () => {
    expect(buildFilterParams("/episodes", ["starred"])).toBe("/episodes?filter=starred");
  });

  it("appends multiple filters", () => {
    const result = buildFilterParams("/episodes", ["starred", "played"]);
    expect(result).toContain("filter=starred");
    expect(result).toContain("filter=played");
    expect(result).toContain("&");
  });

  it("appends page number when page > 1", () => {
    expect(buildFilterParams("/episodes", [], 2)).toBe("/episodes?page=2");
  });

  it("does not append page when page is 1", () => {
    expect(buildFilterParams("/episodes", [], 1)).toBe("/episodes");
  });

  it("includes both filters and page", () => {
    const result = buildFilterParams("/episodes", ["starred"], 3);
    expect(result).toContain("filter=starred");
    expect(result).toContain("page=3");
  });

  it("URL-encodes filter values with special characters", () => {
    const result = buildFilterParams("/episodes", ["not_archived"]);
    expect(result).toBe("/episodes?filter=not_archived");
  });

  it("works with a podcast-specific base path", () => {
    const result = buildFilterParams("/podcast/abc-123", ["in_progress"]);
    expect(result).toBe("/podcast/abc-123?filter=in_progress");
  });
});

describe("EpisodeRow", () => {
  it("renders episode title", () => {
    const html = (<EpisodeRow episode={makeEpisode({ title: "My Great Episode" })} />).toString();
    expect(html).toContain("My Great Episode");
  });

  it("shows podcast title link by default (showPodcast=true)", () => {
    const html = (<EpisodeRow episode={makeEpisode({ podcast_title: "My Podcast", podcast_uuid: "pod-1" })} />).toString();
    expect(html).toContain("My Podcast");
    expect(html).toContain("/podcast/pod-1");
  });

  it("hides podcast title when showPodcast=false", () => {
    const html = (<EpisodeRow episode={makeEpisode({ podcast_title: "My Podcast" })} showPodcast={false} />).toString();
    expect(html).not.toContain("My Podcast");
  });

  it("shows progress percentage", () => {
    const html = (<EpisodeRow episode={makeEpisode({ duration: 1000, played_up_to: 500 })} />).toString();
    expect(html).toContain("50%");
  });

  it("shows starred icon for starred episodes", () => {
    const html = (<EpisodeRow episode={makeEpisode({ starred: 1 })} />).toString();
    expect(html).toContain("\u2605");
    expect(html).toContain("Starred");
  });

  it("shows archive icon for deleted unstarred episodes", () => {
    const html = (<EpisodeRow episode={makeEpisode({ is_deleted: 1, starred: 0 })} />).toString();
    expect(html).toContain("Archived");
  });

  it("shows played status dot for played episodes", () => {
    const html = (<EpisodeRow episode={makeEpisode({ playing_status: 3 })} />).toString();
    expect(html).toContain("Played");
  });

  it("shows in-progress status dot for in-progress episodes", () => {
    const html = (<EpisodeRow episode={makeEpisode({ playing_status: 2 })} />).toString();
    expect(html).toContain("In Progress");
  });

  it("shows not-started dot for unplayed episodes", () => {
    const html = (<EpisodeRow episode={makeEpisode({ playing_status: 1 })} />).toString();
    expect(html).toContain("Not Started");
  });
});

describe("GroupedEpisodes", () => {
  it("renders nothing for an empty list", () => {
    const html = (<GroupedEpisodes episodes={[]} />).toString();
    expect(html.trim()).toBe("");
  });

  it("renders episodes without group headings when played_at is null", () => {
    const html = (<GroupedEpisodes episodes={[makeEpisode({ uuid: "ep-1", played_at: null })]} />).toString();
    expect(html).toContain("Test Episode");
    // No day heading rendered for episodes with null played_at (appears under Older or alone)
  });

  it("groups episodes played today under 'Today' heading", () => {
    const today = new Date().toISOString();
    const html = (<GroupedEpisodes episodes={[makeEpisode({ played_at: today })]} />).toString();
    expect(html).toContain("Today");
  });

  it("groups episodes played yesterday under 'Yesterday' heading", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const html = (<GroupedEpisodes episodes={[makeEpisode({ played_at: yesterday })]} />).toString();
    expect(html).toContain("Yesterday");
  });

  it("shows 'Older' heading when episodes without played_at follow dated ones", () => {
    const today = new Date().toISOString();
    const episodes = [
      makeEpisode({ uuid: "ep-1", played_at: today }),
      makeEpisode({ uuid: "ep-2", played_at: null }),
    ];
    const html = (<GroupedEpisodes episodes={episodes} />).toString();
    expect(html).toContain("Older");
  });

  it("renders multiple day groups in order", () => {
    const day1 = "2024-03-10T12:00:00.000Z";
    const day2 = "2024-03-09T12:00:00.000Z";
    const episodes = [
      makeEpisode({ uuid: "ep-1", played_at: day1 }),
      makeEpisode({ uuid: "ep-2", played_at: day2 }),
    ];
    const html = (<GroupedEpisodes episodes={episodes} />).toString();
    // Both dates should appear as formatted day headings
    expect(html).toContain("March 10");
    expect(html).toContain("March 9");
  });

  it("groups multiple episodes on the same day under one heading", () => {
    const day = "2024-03-10T12:00:00.000Z";
    const episodes = [
      makeEpisode({ uuid: "ep-1", played_at: day, title: "Episode A" }),
      makeEpisode({ uuid: "ep-2", played_at: "2024-03-10T15:00:00.000Z", title: "Episode B" }),
    ];
    const html = (<GroupedEpisodes episodes={episodes} />).toString();
    expect(html).toContain("Episode A");
    expect(html).toContain("Episode B");
    // Only one "March 10" heading
    const matches = (html.match(/March 10/g) || []).length;
    expect(matches).toBe(1);
  });
});
