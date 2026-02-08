import { describe, it, expect } from "vitest";
import { PodcastsPage } from "../../src/components/PodcastsPage";
import type { PodcastWithStats } from "../../src/db";

function makePodcast(overrides: Partial<PodcastWithStats> = {}): PodcastWithStats {
  return {
    uuid: "pod-123",
    title: "Test Podcast",
    author: "Test Author",
    description: "A test podcast",
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

function render(podcasts: PodcastWithStats[]): string {
  return (<PodcastsPage podcasts={podcasts} />).toString();
}

describe("PodcastsPage", () => {
  it("includes podcast title and author", () => {
    const html = render([makePodcast({ title: "My Podcast", author: "Jane Doe" })]);
    expect(html).toContain("My Podcast");
    expect(html).toContain("Jane Doe");
  });

  it("shows tracked count", () => {
    const html = render([makePodcast({ total_episodes: 42 })]);
    expect(html).toContain(">42<");
  });

  it("shows listening time", () => {
    const html = render([makePodcast({ total_played_time: 7200 })]);
    expect(html).toContain("2h 0m 0s");
  });

  it("shows subscribed count", () => {
    const html = render([makePodcast(), makePodcast({ uuid: "pod-2" })]);
    expect(html).toContain("2 subscribed");
  });

  it("shows removed section for deleted podcasts", () => {
    const html = render([
      makePodcast(),
      makePodcast({ uuid: "pod-2", deleted_at: "2024-06-01T00:00:00Z" }),
    ]);
    expect(html).toContain("Removed");
    expect(html).toContain("1 removed");
  });

  it("shows dashes for podcast with no tracked episodes", () => {
    const html = render([makePodcast({ total_episodes: 0, played_count: 0, total_played_time: 0 })]);
    expect(html).toContain(">\u2014<");
  });

  it("shows column headers", () => {
    const html = render([makePodcast()]);
    expect(html).toContain("Episodes");
    expect(html).toContain("Tracked");
    expect(html).toContain("Listened");
    expect(html).toContain("Added");
    expect(html).not.toContain("Started");
  });

  it("shows episode count", () => {
    const html = render([makePodcast({ episode_count: 250 })]);
    expect(html).toContain(">250<");
  });
});
