import { login } from "./login";
import { getEpisodeSyncData, getPodcastEpisodeMetadata, getPodcastList, getBookmarks } from "./api";
import { getExistingEpisodeUuids, updateEpisodeSyncData, insertNewEpisodes, savePodcasts, saveBookmarks, updatePodcastEpisodeCount, resetBackupProgress, incrementBackupProgress, updateEpisodePlayedAt } from "./db";
import type { EpisodeUpdate, NewEpisode } from "./db";
import { getListenHistory } from "./history";
import type { Env, BackupQueueMessage, EpisodeSyncItem, CacheEpisode } from "./types";

export async function handleQueueMessage(message: BackupQueueMessage, env: Env): Promise<void> {
  switch (message.type) {
    case "sync-podcasts":
      return syncPodcasts(env);
    case "sync-podcast":
      return syncPodcast(message, env);
    case "sync-history":
      return syncHistory(message.token, env.DB);
  }
}

async function syncPodcasts(env: Env): Promise<void> {
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

  for (let i = 0; i < messages.length; i += 100) {
    await env.BACKUP_QUEUE.sendBatch(messages.slice(i, i + 100));
  }

  console.log(`[Backup] Enqueued ${total} podcast sync messages`);
}

async function syncPodcast(
  message: Extract<BackupQueueMessage, { type: "sync-podcast" }>,
  env: Env,
): Promise<void> {
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
}

async function syncHistory(token: string, d1: D1Database): Promise<void> {
  console.log("[History] Fetching listen history");
  const history = await getListenHistory(token);
  console.log(`[History] Got ${history.length} played episodes`);
  await updateEpisodePlayedAt(d1, history);
  console.log("[Backup] Complete");
}

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

  const interacted = syncData.episodes.filter(
    (ep) => ep.playingStatus > 0 || ep.playedUpTo > 0
  );

  if (interacted.length === 0) {
    console.log(`[${podcastTitle}] No interacted episodes, skipping`);
    return 0;
  }

  const interactedUuids = interacted.map((ep) => ep.uuid);
  const existingUuids = await getExistingEpisodeUuids(d1, interactedUuids);

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

  if (toUpdate.length > 0) {
    console.log(`[${podcastTitle}] Updating ${toUpdate.length} existing episodes`);
    await updateEpisodeSyncData(d1, toUpdate);
  }

  if (newSyncItems.length > 0) {
    console.log(`[${podcastTitle}] Inserting ${newSyncItems.length} new episodes`);

    const cacheMap = new Map<string, CacheEpisode>();
    for (const ep of cacheData.podcast.episodes) {
      cacheMap.set(ep.uuid, ep);
    }

    const toInsert: NewEpisode[] = [];
    for (const syncItem of newSyncItems) {
      const cached = cacheMap.get(syncItem.uuid);
      if (!cached) continue;

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
