import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";

beforeEach(async () => {
  await env.DB.exec("DROP TABLE IF EXISTS episodes");
  await env.DB.exec("DROP TABLE IF EXISTS podcasts");
  await env.DB.exec("DROP TABLE IF EXISTS bookmarks");
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("worker routes", () => {
  it("returns 200 with text body on default route", async () => {
    const response = await SELF.fetch("https://example.com/");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Pocketcasts Backup Worker");
  });

  it("returns 401 on /episodes without password", async () => {
    const response = await SELF.fetch("https://example.com/episodes");
    expect(response.status).toBe(401);
  });

  it("returns HTML on /episodes with correct password", async () => {
    const response = await SELF.fetch(
      `https://example.com/episodes?password=${env.PASS}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
  });

  it("redirects /history to /episodes", async () => {
    const response = await SELF.fetch("https://example.com/history?password=test", { redirect: "manual" });
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toContain("/episodes");
  });

  it("returns 401 on /podcasts without password", async () => {
    const response = await SELF.fetch("https://example.com/podcasts");
    expect(response.status).toBe(401);
  });

  it("returns HTML on /podcasts with correct password", async () => {
    const response = await SELF.fetch(
      `https://example.com/podcasts?password=${env.PASS}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    const html = await response.text();
    expect(html).toContain("Pocketcasts Podcasts");
  });

  it("returns 401 on /bookmarks without password", async () => {
    const response = await SELF.fetch("https://example.com/bookmarks");
    expect(response.status).toBe(401);
  });

  it("returns HTML on /bookmarks with correct password", async () => {
    const response = await SELF.fetch(
      `https://example.com/bookmarks?password=${env.PASS}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    const html = await response.text();
    expect(html).toContain("Pocketcasts Bookmarks");
  });

  it("returns 401 on /export without password", async () => {
    const response = await SELF.fetch("https://example.com/export");
    expect(response.status).toBe(401);
  });

  it("returns CSV on /export with correct password", async () => {
    const response = await SELF.fetch(
      `https://example.com/export?password=${env.PASS}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv");

    const csv = await response.text();
    expect(csv).toContain("Episode Title");
    expect(csv).toContain("Podcast Title");
  });
});
