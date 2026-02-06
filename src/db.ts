import type { HistoryResponse, SaveHistoryResult, StoredEpisode, PodcastListResponse, StoredPodcast } from "./types";

export async function saveHistory(db: D1Database, history: HistoryResponse): Promise<SaveHistoryResult> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO episodes (
      uuid, url, title, podcast_title, podcast_uuid, published,
      duration, file_type, size, playing_status, played_up_to,
      is_deleted, starred, episode_type, episode_season, episode_number,
      author, slug, podcast_slug, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const batch: D1PreparedStatement[] = [];
  history.episodes.forEach((episode) => {
    batch.push(stmt.bind(
      episode.uuid,
      episode.url,
      episode.title,
      episode.podcastTitle,
      episode.podcastUuid,
      episode.published,
      episode.duration,
      episode.fileType,
      episode.size,
      episode.playingStatus,
      episode.playedUpTo,
      episode.isDeleted ? 1 : 0,
      episode.starred ? 1 : 0,
      episode.episodeType,
      episode.episodeSeason,
      episode.episodeNumber,
      episode.author,
      episode.slug,
      episode.podcastSlug,
      JSON.stringify(episode)
    ));
  });

  await db.batch(batch);

  const result = await db.prepare("SELECT COUNT(*) as total FROM episodes").first() as { total: number };
  return { total: result.total };
}

export async function getEpisodeCount(db: D1Database): Promise<number> {
  const result = await db.prepare("SELECT COUNT(*) as total FROM episodes").first() as { total: number };
  return result.total;
}

export async function getEpisodes(db: D1Database, limit?: number): Promise<StoredEpisode[]> {
  const query = limit
    ? "SELECT * FROM episodes ORDER BY published DESC LIMIT ?"
    : "SELECT * FROM episodes ORDER BY published DESC";

  const stmt = limit
    ? db.prepare(query).bind(limit)
    : db.prepare(query);

  const result = await stmt.all<StoredEpisode>();
  return result.results;
}

export async function savePodcasts(db: D1Database, podcastList: PodcastListResponse): Promise<{ total: number }> {
  const upsertStmt = db.prepare(`
    INSERT OR REPLACE INTO podcasts (
      uuid, title, author, description, url, slug, date_added,
      folder_uuid, sort_position, is_private, auto_start_from,
      auto_skip_last, episodes_sort_order, last_episode_uuid,
      last_episode_published, updated_at, deleted_at, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, ?)
  `);

  const batch: D1PreparedStatement[] = [];
  const activeUuids = new Set<string>();

  podcastList.podcasts.forEach((podcast) => {
    activeUuids.add(podcast.uuid);
    batch.push(upsertStmt.bind(
      podcast.uuid,
      podcast.title,
      podcast.author,
      podcast.description,
      podcast.url,
      podcast.slug,
      podcast.dateAdded,
      podcast.folderUuid,
      podcast.sortPosition,
      podcast.isPrivate ? 1 : 0,
      podcast.autoStartFrom,
      podcast.autoSkipLast,
      podcast.episodesSortOrder,
      podcast.lastEpisodeUuid,
      podcast.lastEpisodePublished,
      JSON.stringify(podcast)
    ));
  });

  if (batch.length > 0) {
    await db.batch(batch);
  }

  // Mark podcasts not in the API response as deleted
  if (activeUuids.size > 0) {
    const placeholders = [...activeUuids].map(() => "?").join(",");
    await db.prepare(
      `UPDATE podcasts SET deleted_at = CURRENT_TIMESTAMP WHERE uuid NOT IN (${placeholders}) AND deleted_at IS NULL`
    ).bind(...activeUuids).run();
  } else {
    await db.prepare(
      "UPDATE podcasts SET deleted_at = CURRENT_TIMESTAMP WHERE deleted_at IS NULL"
    ).run();
  }

  const result = await db.prepare("SELECT COUNT(*) as total FROM podcasts").first() as { total: number };
  return { total: result.total };
}

export async function getPodcasts(db: D1Database): Promise<StoredPodcast[]> {
  const result = await db.prepare(
    "SELECT * FROM podcasts ORDER BY deleted_at IS NOT NULL, sort_position ASC"
  ).all<StoredPodcast>();
  return result.results;
}

export async function getPodcastCount(db: D1Database): Promise<number> {
  const result = await db.prepare("SELECT COUNT(*) as total FROM podcasts").first() as { total: number };
  return result.total;
}
