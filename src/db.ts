import type { HistoryResponse, SaveHistoryResult, StoredEpisode } from "./types";

export async function saveHistory(db: D1Database, history: HistoryResponse): Promise<SaveHistoryResult> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO episodes (
      uuid, url, title, podcast_title, podcast_uuid, published, 
      duration, file_type, size, playing_status, played_up_to, 
      is_deleted, starred, episode_type, episode_season, episode_number, 
      author, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
