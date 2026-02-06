/// <reference types="@cloudflare/workers-types" />

import { login } from "./login";
import { getEpisodeSyncData, getPodcastEpisodeMetadata, getPodcastList, getBookmarks } from "./api";
import { getExistingEpisodeUuids, updateEpisodeSyncData, insertNewEpisodes, savePodcasts, saveBookmarks, getEpisodes, getEpisodeCount, getPodcasts, getBookmarks as getStoredBookmarks, parseFilters } from "./db";
import type { EpisodeUpdate, NewEpisode } from "./db";
import { generateEpisodesHtml, generatePodcastsHtml, generateBookmarksHtml } from "./templates";
import { generateCsv } from "./csv";
import type { Env, BackupResult, ExportedHandler, EpisodeSyncItem, CacheEpisode } from "./types";

const worker: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case "/backup":
        return handleBackup(env);
      case "/episodes":
        return handleEpisodes(request, env);
      case "/podcasts":
        return handlePodcasts(request, env);
      case "/bookmarks":
        return handleBookmarks(request, env);
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

const CONCURRENCY_LIMIT = 3;

async function processPodcastEpisodes(
  token: string,
  d1: D1Database,
  podcastUuid: string,
  podcastTitle: string,
  podcastAuthor: string,
  podcastSlug: string,
): Promise<number> {
  const syncData = await getEpisodeSyncData(token, podcastUuid);

  // Filter to episodes the user has interacted with
  const interacted = syncData.episodes.filter(
    (ep) => ep.playingStatus > 0 || ep.playedUpTo > 0
  );

  if (interacted.length === 0) {
    console.log(`[${podcastTitle}] No interacted episodes, skipping`);
    return 0;
  }

  const interactedUuids = interacted.map((ep) => ep.uuid);
  const existingUuids = await getExistingEpisodeUuids(d1, interactedUuids);

  // Split into existing (update sync fields) and new (need metadata)
  const toUpdate: EpisodeUpdate[] = [];
  const newSyncItems: EpisodeSyncItem[] = [];

  for (const ep of interacted) {
    if (existingUuids.has(ep.uuid)) {
      toUpdate.push({
        uuid: ep.uuid,
        playing_status: ep.playingStatus,
        played_up_to: ep.playedUpTo,
        starred: ep.starred ? 1 : 0,
        is_deleted: ep.isDeleted ? 1 : 0,
      });
    } else {
      newSyncItems.push(ep);
    }
  }

  // Update existing episodes
  if (toUpdate.length > 0) {
    console.log(`[${podcastTitle}] Updating ${toUpdate.length} existing episodes`);
    await updateEpisodeSyncData(d1, toUpdate);
  }

  // Fetch metadata and insert new episodes
  if (newSyncItems.length > 0) {
    console.log(`[${podcastTitle}] Fetching metadata for ${newSyncItems.length} new episodes`);
    const cacheData = await getPodcastEpisodeMetadata(podcastUuid);

    const cacheMap = new Map<string, CacheEpisode>();
    for (const ep of cacheData.podcast.episodes) {
      cacheMap.set(ep.uuid, ep);
    }

    const toInsert: NewEpisode[] = [];
    for (const syncItem of newSyncItems) {
      const cached = cacheMap.get(syncItem.uuid);
      if (!cached) continue; // Episode removed from podcast, skip

      toInsert.push({
        uuid: syncItem.uuid,
        url: cached.url,
        title: cached.title,
        podcast_title: podcastTitle,
        podcast_uuid: podcastUuid,
        published: cached.published,
        duration: cached.duration || syncItem.duration,
        file_type: cached.file_type || "",
        size: String(cached.file_size || "0"),
        playing_status: syncItem.playingStatus,
        played_up_to: syncItem.playedUpTo,
        is_deleted: syncItem.isDeleted ? 1 : 0,
        starred: syncItem.starred ? 1 : 0,
        episode_type: cached.type || "full",
        episode_season: cached.season || 0,
        episode_number: cached.number || 0,
        author: podcastAuthor,
        slug: cached.slug || "",
        podcast_slug: podcastSlug,
      });
    }

    if (toInsert.length > 0) {
      console.log(`[${podcastTitle}] Inserting ${toInsert.length} new episodes`);
      await insertNewEpisodes(d1, toInsert);
    }
  }

  console.log(`[${podcastTitle}] Done: ${toUpdate.length} updated, ${newSyncItems.length} new`);
  return interacted.length;
}

async function handleBackup(env: Env): Promise<Response> {
  try {
    validateEnvironment(env);

    const token = await login(env.EMAIL, env.PASS);
    const [podcastList, bookmarkList] = await Promise.all([
      getPodcastList(token),
      getBookmarks(token),
    ]);
    const [savedPodcasts, savedBookmarks] = await Promise.all([
      savePodcasts(env.DB, podcastList),
      saveBookmarks(env.DB, bookmarkList),
    ]);

    // Process podcasts with concurrency limit
    let totalSynced = 0;
    const podcastQueue = [...podcastList.podcasts];

    while (podcastQueue.length > 0) {
      const batch = podcastQueue.splice(0, CONCURRENCY_LIMIT);
      const results = await Promise.all(
        batch.map((podcast) =>
          processPodcastEpisodes(
            token,
            env.DB,
            podcast.uuid,
            podcast.title,
            podcast.author,
            podcast.slug,
          )
        )
      );
      totalSynced += results.reduce((sum, n) => sum + n, 0);
    }

    const totalEpisodes = await getEpisodeCount(env.DB);

    const response: BackupResult = {
      success: true,
      message: "Backup completed successfully",
      synced: totalSynced,
      total: totalEpisodes,
      podcasts: savedPodcasts.total,
      bookmarks: savedBookmarks.total,
    };

    return createJsonResponse(response);
  } catch (error) {
    console.error("Backup failed:", error);
    return createErrorResponse(error);
  }
}

const EPISODES_PER_PAGE = 50;

async function handleEpisodes(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!isAuthorized(password, env.PASS)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const filters = parseFilters(url.searchParams.getAll("filter"));
    const offset = (page - 1) * EPISODES_PER_PAGE;

    const [episodes, totalEpisodes] = await Promise.all([
      getEpisodes(env.DB, EPISODES_PER_PAGE, offset, filters),
      getEpisodeCount(env.DB, filters),
    ]);
    const html = generateEpisodesHtml(episodes, totalEpisodes, page, EPISODES_PER_PAGE, password, filters);
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Episodes failed:", error);
    return new Response("Error loading episodes", { status: 500 });
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

async function handleBookmarks(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!isAuthorized(password, env.PASS)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const bookmarks = await getStoredBookmarks(env.DB);
    const html = generateBookmarksHtml(bookmarks, password);
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Bookmarks failed:", error);
    return new Response("Error loading bookmarks", { status: 500 });
  }
}

async function handleExport(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!isAuthorized(password, env.PASS)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const filters = parseFilters(url.searchParams.getAll("filter"));
    const episodes = await getEpisodes(env.DB, undefined, undefined, filters);
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
