import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";

beforeEach(async () => {
  await env.DB.exec("DROP TABLE IF EXISTS episodes");
  await env.DB.exec("DROP TABLE IF EXISTS podcasts");
  await env.DB.exec("DROP TABLE IF EXISTS bookmarks");
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
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
