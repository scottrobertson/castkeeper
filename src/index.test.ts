import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";

beforeEach(async () => {
  await env.DB.exec("DROP TABLE IF EXISTS episodes");
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("worker routes", () => {
  it("returns 200 with text body on default route", async () => {
    const response = await SELF.fetch("https://example.com/");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Pocketcasts Backup Worker");
  });

  it("returns 401 on /history without password", async () => {
    const response = await SELF.fetch("https://example.com/history");
    expect(response.status).toBe(401);
  });

  it("returns HTML on /history with correct password", async () => {
    const response = await SELF.fetch(
      `https://example.com/history?password=${env.PASS}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
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
