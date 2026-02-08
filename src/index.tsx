/// <reference types="@cloudflare/workers-types" />

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { getEpisodes, getEpisodeCount, getPodcastsWithStats, getBookmarksWithEpisodes, parseFilters } from "./db";
import { handleQueueMessage } from "./backup";
import { EpisodesPage } from "./components/EpisodesPage";
import { PodcastsPage } from "./components/PodcastsPage";
import { BookmarksPage } from "./components/BookmarksPage";
import { generateCsv } from "./csv";
import type { Env, BackupResult, BackupQueueMessage } from "./types";

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

const EPISODES_PER_PAGE = 50;

const requireAuth = (c: AppContext, next: Next) => {
  const password = c.req.query("password");
  if (password !== c.env.PASS) {
    return c.text("Unauthorized", 401);
  }
  return next();
};

app.get("/", (c) => c.text("castkeeper"));

app.get("/backup", async (c) => {
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
  const password = c.req.query("password") ?? null;
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const filters = parseFilters(c.req.queries("filter") ?? []);
  const offset = (page - 1) * EPISODES_PER_PAGE;

  const [episodes, totalEpisodes] = await Promise.all([
    getEpisodes(c.env.DB, EPISODES_PER_PAGE, offset, filters),
    getEpisodeCount(c.env.DB, filters),
  ]);

  return c.html(
    <EpisodesPage episodes={episodes} totalEpisodes={totalEpisodes} page={page} perPage={EPISODES_PER_PAGE} password={password} filters={filters} />
  );
});

app.get("/podcasts", requireAuth, async (c) => {
  const password = c.req.query("password") ?? null;
  const podcasts = await getPodcastsWithStats(c.env.DB);
  return c.html(<PodcastsPage podcasts={podcasts} password={password} />);
});

app.get("/bookmarks", requireAuth, async (c) => {
  const password = c.req.query("password") ?? null;
  const bookmarks = await getBookmarksWithEpisodes(c.env.DB);
  return c.html(<BookmarksPage bookmarks={bookmarks} password={password} />);
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
