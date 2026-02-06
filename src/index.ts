/// <reference types="@cloudflare/workers-types" />

import { login } from "./login";
import { getListenHistory, getPodcastList, getBookmarks } from "./api";
import { saveHistory, savePodcasts, saveBookmarks, getEpisodes, getEpisodeCount, getPodcasts } from "./db";
import { generateHistoryHtml, generatePodcastsHtml } from "./templates";
import { generateCsv } from "./csv";
import type { Env, BackupResult, ExportedHandler } from "./types";

const worker: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case "/backup":
        return handleBackup(env);
      case "/history":
        return handleHistory(request, env);
      case "/podcasts":
        return handlePodcasts(request, env);
      case "/export":
        return handleExport(request, env);
      default:
        return new Response("Pocketcasts Backup Worker", { status: 200 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleBackup(env));
  },
};

export default worker;

async function handleBackup(env: Env): Promise<Response> {
  try {
    validateEnvironment(env);

    const token = await login(env.EMAIL, env.PASS);
    const [history, podcastList, bookmarkList] = await Promise.all([
      getListenHistory(token),
      getPodcastList(token),
      getBookmarks(token),
    ]);
    const [savedHistory, savedPodcasts, savedBookmarks] = await Promise.all([
      saveHistory(env.DB, history),
      savePodcasts(env.DB, podcastList),
      saveBookmarks(env.DB, bookmarkList),
    ]);

    const response: BackupResult = {
      success: true,
      message: "Backup completed successfully",
      synced: history.episodes.length,
      total: savedHistory.total,
      podcasts: savedPodcasts.total,
      bookmarks: savedBookmarks.total,
    };

    return createJsonResponse(response);
  } catch (error) {
    console.error("Backup failed:", error);
    return createErrorResponse(error);
  }
}

async function handleHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!isAuthorized(password, env.PASS)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [episodes, totalEpisodes] = await Promise.all([
      getEpisodes(env.DB, 100),
      getEpisodeCount(env.DB),
    ]);
    const html = generateHistoryHtml(episodes, totalEpisodes, password);
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("History failed:", error);
    return new Response("Error loading history", { status: 500 });
  }
}

async function handlePodcasts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!isAuthorized(password, env.PASS)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const podcasts = await getPodcasts(env.DB);
    const html = generatePodcastsHtml(podcasts, password);
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Podcasts failed:", error);
    return new Response("Error loading podcasts", { status: 500 });
  }
}

async function handleExport(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!isAuthorized(password, env.PASS)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const episodes = await getEpisodes(env.DB);
    const csv = generateCsv(episodes);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="pocketcasts-history-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export failed:", error);
    return new Response("Error exporting data", { status: 500 });
  }
}

// Utility functions
function validateEnvironment(env: Env): void {
  if (!env.EMAIL || !env.PASS) {
    throw new Error("EMAIL and PASS environment variables are required");
  }
}

function isAuthorized(password: string | null, expectedPassword: string): boolean {
  return password === expectedPassword;
}

function createJsonResponse(data: BackupResult): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

function createErrorResponse(error: unknown): Response {
  const errorResponse: BackupResult = {
    success: false,
    error: error instanceof Error ? error.message : "Unknown error",
  };

  return new Response(JSON.stringify(errorResponse), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
