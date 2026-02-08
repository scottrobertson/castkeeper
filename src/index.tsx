/// <reference types="@cloudflare/workers-types" />

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { getEpisodes, getEpisodeCount, getPodcastsWithStats, getPodcastWithStats, getBookmarksWithEpisodes, parseFilters } from "./db";
import { handleQueueMessage } from "./backup";
import { EpisodesPage } from "./components/EpisodesPage";
import { PodcastsPage } from "./components/PodcastsPage";
import { BookmarksPage } from "./components/BookmarksPage";
import { PodcastPage } from "./components/PodcastPage";
import { LoginPage } from "./components/LoginPage";
import { generateCsv } from "./csv";
import type { Env, BackupResult, BackupQueueMessage } from "./types";

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

const EPISODES_PER_PAGE = 50;

async function generateToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const requireAuth = async (c: AppContext, next: Next) => {
  const token = getCookie(c, "session");
  const expected = await generateToken(c.env.PASS);
  if (token !== expected) {
    return c.redirect("/");
  }
  return next();
};

app.get("/", async (c) => {
  const token = getCookie(c, "session");
  const expected = await generateToken(c.env.PASS);
  if (token === expected) {
    return c.redirect("/episodes");
  }
  return c.html(<LoginPage />);
});

app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const password = body["password"];
  if (typeof password !== "string" || password !== c.env.PASS) {
    return c.html(<LoginPage error="Invalid password" />, 401);
  }
  const token = await generateToken(password);
  setCookie(c, "session", token, {
    path: "/",
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
  });
  return c.redirect("/episodes");
});

app.post("/logout", async (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/");
});

app.get("/backup", requireAuth, async (c) => {
  try {
    if (!c.env.EMAIL || !c.env.PASS) {
      throw new Error("EMAIL and PASS environment variables are required");
    }
    await c.env.BACKUP_QUEUE.send({ type: "sync-podcasts" });
    return c.json({ success: true, message: "Backup queued" } satisfies BackupResult);
  } catch (error) {
    console.error("Backup failed:", error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" } satisfies BackupResult,
      500,
    );
  }
});

app.get("/episodes", requireAuth, async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const filters = parseFilters(c.req.queries("filter") ?? []);
  const offset = (page - 1) * EPISODES_PER_PAGE;

  const [episodes, totalEpisodes] = await Promise.all([
    getEpisodes(c.env.DB, EPISODES_PER_PAGE, offset, filters),
    getEpisodeCount(c.env.DB, filters),
  ]);

  return c.html(
    <EpisodesPage episodes={episodes} totalEpisodes={totalEpisodes} page={page} perPage={EPISODES_PER_PAGE} filters={filters} />
  );
});

app.get("/podcasts", requireAuth, async (c) => {
  const podcasts = await getPodcastsWithStats(c.env.DB);
  return c.html(<PodcastsPage podcasts={podcasts} />);
});

app.get("/podcast/:uuid", requireAuth, async (c) => {
  const uuid = c.req.param("uuid");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const filters = parseFilters(c.req.queries("filter") ?? []);
  const offset = (page - 1) * EPISODES_PER_PAGE;

  const podcast = await getPodcastWithStats(c.env.DB, uuid);
  if (!podcast) {
    return c.text("Not Found", 404);
  }

  const [episodes, totalEpisodes, bookmarks] = await Promise.all([
    getEpisodes(c.env.DB, EPISODES_PER_PAGE, offset, filters, uuid),
    getEpisodeCount(c.env.DB, filters, uuid),
    getBookmarksWithEpisodes(c.env.DB, uuid),
  ]);

  return c.html(
    <PodcastPage podcast={podcast} episodes={episodes} totalEpisodes={totalEpisodes} page={page} perPage={EPISODES_PER_PAGE} filters={filters} bookmarks={bookmarks} />
  );
});

app.get("/bookmarks", requireAuth, async (c) => {
  const bookmarks = await getBookmarksWithEpisodes(c.env.DB);
  return c.html(<BookmarksPage bookmarks={bookmarks} />);
});

app.get("/export", requireAuth, async (c) => {
  const filters = parseFilters(c.req.queries("filter") ?? []);
  const episodes = await getEpisodes(c.env.DB, undefined, undefined, filters);
  const csv = generateCsv(episodes);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="castkeeper-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
});

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.EMAIL || !env.PASS) {
      console.error("Scheduled backup failed: EMAIL and PASS environment variables are required");
      return;
    }
    await env.BACKUP_QUEUE.send({ type: "sync-podcasts" });
  },

  async queue(batch: MessageBatch<BackupQueueMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      await handleQueueMessage(msg.body, env);
      msg.ack();
    }
  },
};
