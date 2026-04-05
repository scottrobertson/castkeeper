import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { resetDatabase } from "./reset-db";
import { savePodcasts, insertNewEpisodes } from "../src/db";
import type { NewEpisode } from "../src/db";
import type { PodcastListResponse } from "../src/types";

beforeEach(async () => {
  await resetDatabase();
});

async function login(): Promise<string> {
  const response = await SELF.fetch("https://example.com/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `password=${encodeURIComponent(env.PASS)}`,
    redirect: "manual",
  });
  const setCookie = response.headers.get("Set-Cookie") ?? "";
  const match = setCookie.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : "";
}

function makePodcast(overrides: Partial<PodcastListResponse["podcasts"][number]> = {}) {
  return {
    uuid: "pod-1",
    title: "My Test Podcast",
    author: "Test Author",
    description: "A description",
    url: "https://example.com/feed",
    slug: "my-test-podcast",
    dateAdded: "2024-01-01T00:00:00Z",
    folderUuid: "",
    sortPosition: 1,
    isPrivate: false,
    autoStartFrom: 0,
    autoSkipLast: 0,
    episodesSortOrder: 3,
    lastEpisodeUuid: "",
    lastEpisodePublished: "",
    unplayed: false,
    lastEpisodePlayingStatus: 0,
    lastEpisodeArchived: false,
    descriptionHtml: "",
    settings: {},
    ...overrides,
  };
}

function makeEpisode(overrides: Partial<NewEpisode> = {}): NewEpisode {
  return {
    uuid: "ep-1",
    url: "https://example.com/ep1.mp3",
    title: "Test Episode",
    podcast_title: "My Test Podcast",
    podcast_uuid: "pod-1",
    published: "2024-01-15T00:00:00Z",
    duration: 600,
    file_type: "audio/mp3",
    size: "1000000",
    playing_status: 3,
    played_up_to: 600,
    is_deleted: 0,
    starred: 0,
    episode_type: "full",
    episode_season: 1,
    episode_number: 1,
    author: "Test Author",
    slug: "test-episode",
    podcast_slug: "my-test-podcast",
    ...overrides,
  };
}

describe("worker routes", () => {
  it("shows login page on / when not authenticated", async () => {
    const response = await SELF.fetch("https://example.com/");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Log in");
  });

  it("redirects to /episodes on / when authenticated", async () => {
    const cookie = await login();
    const response = await SELF.fetch("https://example.com/", {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/episodes");
  });

  it("redirects to / on /backup without auth", async () => {
    const response = await SELF.fetch("https://example.com/backup", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
  });

  it("redirects to / on /episodes without auth", async () => {
    const response = await SELF.fetch("https://example.com/episodes", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
  });

  it("returns HTML on /episodes with cookie auth", async () => {
    const cookie = await login();
    const response = await SELF.fetch("https://example.com/episodes", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
  });

  it("redirects to / on /podcasts without auth", async () => {
    const response = await SELF.fetch("https://example.com/podcasts", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
  });

  it("returns HTML on /podcasts with cookie auth", async () => {
    const cookie = await login();
    const response = await SELF.fetch("https://example.com/podcasts", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Castkeeper");
  });

  it("redirects to / on /bookmarks without auth", async () => {
    const response = await SELF.fetch("https://example.com/bookmarks", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
  });

  it("returns HTML on /bookmarks with cookie auth", async () => {
    const cookie = await login();
    const response = await SELF.fetch("https://example.com/bookmarks", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Castkeeper");
  });

  it("redirects to / on /export without auth", async () => {
    const response = await SELF.fetch("https://example.com/export", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
  });

  it("returns CSV on /export with cookie auth", async () => {
    const cookie = await login();
    const response = await SELF.fetch("https://example.com/export", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv");

    const csv = await response.text();
    expect(csv).toContain("Episode Title");
    expect(csv).toContain("Podcast Title");
  });
});

describe("login / logout", () => {
  it("sets session cookie on successful login", async () => {
    const response = await SELF.fetch("https://example.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `password=${encodeURIComponent(env.PASS)}`,
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/episodes");
    expect(response.headers.get("Set-Cookie")).toContain("session=");
  });

  it("returns 401 with error on wrong password", async () => {
    const response = await SELF.fetch("https://example.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "password=wrong",
    });
    expect(response.status).toBe(401);
    const html = await response.text();
    expect(html).toContain("Invalid password");
  });

  it("clears session cookie on logout", async () => {
    const cookie = await login();
    const response = await SELF.fetch("https://example.com/logout", {
      method: "POST",
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("session=");
    expect(setCookie).toMatch(/Max-Age=0|Expires=/i);
  });
});

describe("/podcast/:uuid route", () => {
  it("redirects to / without auth", async () => {
    const response = await SELF.fetch("https://example.com/podcast/pod-1", { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
  });

  it("returns 404 when podcast does not exist", async () => {
    const cookie = await login();
    const response = await SELF.fetch("https://example.com/podcast/nonexistent-uuid", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(404);
  });

  it("returns HTML with podcast details when podcast exists", async () => {
    const cookie = await login();
    await savePodcasts(env.DB, { podcasts: [makePodcast()], folders: [] });

    const response = await SELF.fetch("https://example.com/podcast/pod-1", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("My Test Podcast");
  });

  it("supports filter query params", async () => {
    const cookie = await login();
    await savePodcasts(env.DB, { podcasts: [makePodcast()], folders: [] });

    const response = await SELF.fetch("https://example.com/podcast/pod-1?filter=starred", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("My Test Podcast");
  });
});

describe("/export with filters", () => {
  it("returns CSV filtered by played episodes", async () => {
    const cookie = await login();
    await insertNewEpisodes(env.DB, [
      makeEpisode({ uuid: "ep-played", title: "Played Episode", playing_status: 3 }),
      makeEpisode({ uuid: "ep-unplayed", title: "Unplayed Episode", playing_status: 1, played_up_to: 0 }),
    ]);

    const response = await SELF.fetch("https://example.com/export?filter=played", {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain("Played Episode");
    expect(csv).not.toContain("Unplayed Episode");
  });

  it("includes content-disposition header with filename", async () => {
    const cookie = await login();
    const response = await SELF.fetch("https://example.com/export", {
      headers: { Cookie: cookie },
    });
    const disposition = response.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("castkeeper-");
    expect(disposition).toContain(".csv");
  });
});
