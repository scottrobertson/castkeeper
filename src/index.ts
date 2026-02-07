/// <reference types="@cloudflare/workers-types" />

import { login } from "./login";
import { getEpisodeSyncData, getPodcastEpisodeMetadata, getPodcastList, getBookmarks } from "./api";
import { getExistingEpisodeUuids, updateEpisodeSyncData, insertNewEpisodes, savePodcasts, saveBookmarks, getEpisodes, getEpisodeCount, getPodcastsWithStats, getBookmarksWithEpisodes, updatePodcastEpisodeCount, parseFilters, updateEpisodePlayedAt, resetBackupProgress, incrementBackupProgress } from "./db";
import type { EpisodeUpdate, NewEpisode } from "./db";
import { getListenHistory } from "./history";
import { generateEpisodesHtml, generatePodcastsHtml, generateBookmarksHtml } from "./templates";
import { generateCsv } from "./csv";
import type { Env, BackupResult, BackupQueueMessage, EpisodeSyncItem, CacheEpisode } from "./types";

export default {
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
    await handleBackup(env);
  },

  async queue(batch: MessageBatch<BackupQueueMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      await handleQueueMessage(msg.body, env);
      msg.ack();
    }
  },
};

async function processPodcastEpisodes(
  token: string,
  d1: D1Database,
  podcastUuid: string,
  podcastTitle: string,
  podcastAuthor: string,
  podcastSlug: string,
): Promise<number> {
  const [syncData, cacheData] = await Promise.all([
    getEpisodeSyncData(token, podcastUuid),
    getPodcastEpisodeMetadata(podcastUuid),
  ]);

  await updatePodcastEpisodeCount(d1, podcastUuid, cacheData.episode_count);

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

  // Insert new episodes using already-fetched cache data
  if (newSyncItems.length > 0) {
    console.log(`[${podcastTitle}] Inserting ${newSyncItems.length} new episodes`);

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
      await insertNewEpisodes(d1, toInsert);
    }
  }

  console.log(`[${podcastTitle}] Done: ${toUpdate.length} updated, ${newSyncItems.length} new`);
  return interacted.length;
}

async function handleBackup(env: Env): Promise<Response> {
  try {
    validateEnvironment(env);
    await env.BACKUP_QUEUE.send({ type: "sync-podcasts" });
    return createJsonResponse({ success: true, message: "Backup queued" });
  } catch (error) {
    console.error("Backup failed:", error);
    return createErrorResponse(error);
  }
}

async function handleQueueMessage(message: BackupQueueMessage, env: Env): Promise<void> {
  switch (message.type) {
    case "sync-podcasts": {
      const token = await login(env.EMAIL, env.PASS);
      const [podcastList, bookmarkList] = await Promise.all([
        getPodcastList(token),
        getBookmarks(token),
      ]);
      await Promise.all([
        savePodcasts(env.DB, podcastList),
        saveBookmarks(env.DB, bookmarkList),
      ]);

      const total = podcastList.podcasts.length;
      await resetBackupProgress(env.DB, total);

      const messages: MessageSendRequest<BackupQueueMessage>[] = podcastList.podcasts.map((podcast) => ({
        body: {
          type: "sync-podcast" as const,
          token,
          podcastUuid: podcast.uuid,
          podcastTitle: podcast.title,
          podcastAuthor: podcast.author,
          podcastSlug: podcast.slug,
        },
      }));

      // sendBatch accepts up to 100 messages per call
      for (let i = 0; i < messages.length; i += 100) {
        await env.BACKUP_QUEUE.sendBatch(messages.slice(i, i + 100));
      }

      console.log(`[Backup] Enqueued ${total} podcast sync messages`);
      break;
    }

    case "sync-podcast": {
      await processPodcastEpisodes(
        message.token,
        env.DB,
        message.podcastUuid,
        message.podcastTitle,
        message.podcastAuthor,
        message.podcastSlug,
      );

      const progress = await incrementBackupProgress(env.DB);
      console.log(`[Backup] Progress: ${progress.completed}/${progress.total}`);

      if (progress.completed >= progress.total) {
        await env.BACKUP_QUEUE.send({ type: "sync-history", token: message.token });
        console.log("[Backup] All podcasts synced, enqueued history sync");
      }
      break;
    }

    case "sync-history": {
      console.log("[History] Fetching listen history");
      const history = await getListenHistory(message.token);
      console.log(`[History] Got ${history.length} played episodes`);
      await updateEpisodePlayedAt(env.DB, history);
      console.log("[Backup] Complete");
      break;
    }
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
    const podcasts = await getPodcastsWithStats(env.DB);
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
    const bookmarks = await getBookmarksWithEpisodes(env.DB);
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
