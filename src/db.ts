import { drizzle } from "drizzle-orm/d1";
import type { BatchItem } from "drizzle-orm/batch";
import { eq, and, count, desc, asc, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { episodes, podcasts, bookmarks, backupProgress } from "./schema";
import type { StoredEpisode, StoredPodcast, StoredBookmark } from "./schema";
import type { PodcastListResponse, BookmarkListResponse } from "./types";
import type { HistoryEntry } from "./history";

export interface PodcastWithStats {
  uuid: string;
  title: string;
  author: string;
  description: string;
  url: string;
  slug: string;
  date_added: string;
  folder_uuid: string;
  sort_position: number;
  is_private: number;
  auto_start_from: number;
  auto_skip_last: number;
  episodes_sort_order: number;
  last_episode_uuid: string;
  last_episode_published: string;
  episode_count: number;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  raw_data: string;
  total_episodes: number;
  played_count: number;
  starred_count: number;
  total_played_time: number;
}

export interface BookmarkWithEpisode {
  bookmark_uuid: string;
  podcast_uuid: string;
  episode_uuid: string;
  time: number;
  title: string;
  created_at: string;
  deleted_at: string | null;
  raw_data: string;
  episode_title: string | null;
  podcast_title: string | null;
  episode_duration: number | null;
}

function getDb(d1: D1Database) {
  return drizzle(d1);
}

const BATCH_SIZE = 50;

async function batchExecute(db: ReturnType<typeof getDb>, stmts: BatchItem<"sqlite">[]): Promise<void> {
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    await db.batch(chunk as [typeof chunk[0], ...typeof chunk]);
  }
}

export async function getExistingEpisodeUuids(d1: D1Database, uuids: string[]): Promise<Set<string>> {
  if (uuids.length === 0) return new Set();

  const db = getDb(d1);
  const result = new Set<string>();

  for (let i = 0; i < uuids.length; i += BATCH_SIZE) {
    const chunk = uuids.slice(i, i + BATCH_SIZE);
    const rows = await db.select({ uuid: episodes.uuid }).from(episodes).where(inArray(episodes.uuid, chunk));
    for (const r of rows) result.add(r.uuid);
  }

  return result;
}

export interface EpisodeUpdate {
  uuid: string;
  playing_status: number;
  played_up_to: number;
  starred: number;
  is_deleted: number;
}

export async function updateEpisodeSyncData(d1: D1Database, updates: EpisodeUpdate[]): Promise<void> {
  if (updates.length === 0) return;

  const db = getDb(d1);

  const stmts = updates.map((ep) => {
    return db.update(episodes)
      .set({
        playing_status: ep.playing_status,
        played_up_to: ep.played_up_to,
        starred: ep.starred,
        is_deleted: ep.is_deleted,
      })
      .where(eq(episodes.uuid, ep.uuid));
  });

  await batchExecute(db, stmts);
}

export interface NewEpisode {
  uuid: string;
  url: string;
  title: string;
  podcast_title: string;
  podcast_uuid: string;
  published: string;
  duration: number;
  file_type: string;
  size: string;
  playing_status: number;
  played_up_to: number;
  is_deleted: number;
  starred: number;
  episode_type: string;
  episode_season: number;
  episode_number: number;
  author: string;
  slug: string;
  podcast_slug: string;
}

export async function insertNewEpisodes(d1: D1Database, newEpisodes: NewEpisode[]): Promise<void> {
  if (newEpisodes.length === 0) return;

  const db = getDb(d1);

  const stmts = newEpisodes.map((ep) => {
    return db.insert(episodes).values({
      uuid: ep.uuid,
      url: ep.url,
      title: ep.title,
      podcast_title: ep.podcast_title,
      podcast_uuid: ep.podcast_uuid,
      published: ep.published,
      duration: ep.duration,
      file_type: ep.file_type,
      size: ep.size,
      playing_status: ep.playing_status,
      played_up_to: ep.played_up_to,
      is_deleted: ep.is_deleted,
      starred: ep.starred,
      episode_type: ep.episode_type,
      episode_season: ep.episode_season,
      episode_number: ep.episode_number,
      author: ep.author,
      slug: ep.slug,
      podcast_slug: ep.podcast_slug,
      raw_data: JSON.stringify(ep),
    }).onConflictDoUpdate({
      target: episodes.uuid,
      set: {
        url: ep.url,
        title: ep.title,
        podcast_title: ep.podcast_title,
        podcast_uuid: ep.podcast_uuid,
        published: ep.published,
        duration: ep.duration,
        file_type: ep.file_type,
        size: ep.size,
        playing_status: ep.playing_status,
        played_up_to: ep.played_up_to,
        is_deleted: ep.is_deleted,
        starred: ep.starred,
        episode_type: ep.episode_type,
        episode_season: ep.episode_season,
        episode_number: ep.episode_number,
        author: ep.author,
        slug: ep.slug,
        podcast_slug: ep.podcast_slug,
        raw_data: JSON.stringify(ep),
      },
    });
  });

  await batchExecute(db, stmts);
}

export type EpisodeFilter = "archived" | "in_progress" | "played" | "not_started" | "starred";

const VALID_FILTERS = new Set<string>(["archived", "in_progress", "played", "not_started", "starred"]);

export function parseFilters(values: string[]): EpisodeFilter[] {
  return values.filter(v => VALID_FILTERS.has(v)) as EpisodeFilter[];
}

function buildFilterConditions(filters: EpisodeFilter[]) {
  return filters.map(f => {
    switch (f) {
      case "archived": return eq(episodes.is_deleted, 1);
      case "in_progress": return eq(episodes.playing_status, 2);
      case "played": return eq(episodes.playing_status, 3);
      case "not_started": return eq(episodes.playing_status, 1);
      case "starred": return eq(episodes.starred, 1);
    }
  });
}

export async function getEpisodeCount(d1: D1Database, filters: EpisodeFilter[] = []): Promise<number> {
  const db = getDb(d1);
  const conditions = buildFilterConditions(filters);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db.select({ total: count() }).from(episodes).where(where);
  return result[0].total;
}

export async function getEpisodes(d1: D1Database, limit?: number, offset?: number, filters: EpisodeFilter[] = []): Promise<StoredEpisode[]> {
  const db = getDb(d1);
  const conditions = buildFilterConditions(filters);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Order by played_at descending, episodes without played_at go last, then by published date
  const query = db.select().from(episodes).where(where).orderBy(
    sql`${episodes.played_at} IS NULL`,
    desc(episodes.played_at),
    desc(episodes.published)
  );

  if (limit !== undefined && offset !== undefined) {
    return query.limit(limit).offset(offset);
  }

  if (limit !== undefined) {
    return query.limit(limit);
  }

  return query;
}

export async function savePodcasts(d1: D1Database, podcastList: PodcastListResponse): Promise<{ total: number }> {
  const db = getDb(d1);

  const activeUuids = new Set<string>();

  const upsertStmts = podcastList.podcasts.map((podcast) => {
    activeUuids.add(podcast.uuid);
    return db.insert(podcasts).values({
      uuid: podcast.uuid,
      title: podcast.title,
      author: podcast.author,
      description: podcast.description,
      url: podcast.url,
      slug: podcast.slug,
      date_added: podcast.dateAdded,
      folder_uuid: podcast.folderUuid,
      sort_position: podcast.sortPosition,
      is_private: podcast.isPrivate ? 1 : 0,
      auto_start_from: podcast.autoStartFrom,
      auto_skip_last: podcast.autoSkipLast,
      episodes_sort_order: podcast.episodesSortOrder,
      last_episode_uuid: podcast.lastEpisodeUuid,
      last_episode_published: podcast.lastEpisodePublished,
      updated_at: sql`CURRENT_TIMESTAMP`,
      deleted_at: null,
      raw_data: JSON.stringify(podcast),
    }).onConflictDoUpdate({
      target: podcasts.uuid,
      set: {
        title: podcast.title,
        author: podcast.author,
        description: podcast.description,
        url: podcast.url,
        slug: podcast.slug,
        date_added: podcast.dateAdded,
        folder_uuid: podcast.folderUuid,
        sort_position: podcast.sortPosition,
        is_private: podcast.isPrivate ? 1 : 0,
        auto_start_from: podcast.autoStartFrom,
        auto_skip_last: podcast.autoSkipLast,
        episodes_sort_order: podcast.episodesSortOrder,
        last_episode_uuid: podcast.lastEpisodeUuid,
        last_episode_published: podcast.lastEpisodePublished,
        updated_at: sql`CURRENT_TIMESTAMP`,
        deleted_at: null,
        raw_data: JSON.stringify(podcast),
      },
    });
  });

  if (upsertStmts.length > 0) {
    await batchExecute(db, upsertStmts);
  }

  // Mark podcasts not in the API response as deleted
  if (activeUuids.size > 0) {
    const uuidList = [...activeUuids];
    const placeholders = uuidList.map(() => "?").join(",");
    await d1.prepare(
      `UPDATE podcasts SET deleted_at = CURRENT_TIMESTAMP WHERE uuid NOT IN (${placeholders}) AND deleted_at IS NULL`
    ).bind(...uuidList).run();
  } else {
    await db.update(podcasts)
      .set({ deleted_at: sql`CURRENT_TIMESTAMP` })
      .where(isNull(podcasts.deleted_at));
  }

  const result = await db.select({ total: count() }).from(podcasts);
  return { total: result[0].total };
}

export async function getPodcasts(d1: D1Database): Promise<StoredPodcast[]> {
  const db = getDb(d1);
  return db.select().from(podcasts)
    .orderBy(sql`deleted_at IS NOT NULL`, asc(podcasts.sort_position));
}

export async function updatePodcastEpisodeCount(d1: D1Database, podcastUuid: string, episodeCount: number): Promise<void> {
  const db = getDb(d1);
  await db.update(podcasts)
    .set({ episode_count: episodeCount })
    .where(eq(podcasts.uuid, podcastUuid));
}

export async function getPodcastCount(d1: D1Database): Promise<number> {
  const db = getDb(d1);
  const result = await db.select({ total: count() }).from(podcasts);
  return result[0].total;
}

export async function saveBookmarks(d1: D1Database, bookmarkList: BookmarkListResponse): Promise<{ total: number }> {
  const db = getDb(d1);

  const activeUuids = new Set<string>();

  const upsertStmts = bookmarkList.bookmarks.map((bookmark) => {
    activeUuids.add(bookmark.bookmarkUuid);
    return db.insert(bookmarks).values({
      bookmark_uuid: bookmark.bookmarkUuid,
      podcast_uuid: bookmark.podcastUuid,
      episode_uuid: bookmark.episodeUuid,
      time: bookmark.time,
      title: bookmark.title,
      created_at: bookmark.createdAt,
      deleted_at: null,
      raw_data: JSON.stringify(bookmark),
    }).onConflictDoUpdate({
      target: bookmarks.bookmark_uuid,
      set: {
        podcast_uuid: bookmark.podcastUuid,
        episode_uuid: bookmark.episodeUuid,
        time: bookmark.time,
        title: bookmark.title,
        created_at: bookmark.createdAt,
        deleted_at: null,
        raw_data: JSON.stringify(bookmark),
      },
    });
  });

  if (upsertStmts.length > 0) {
    await batchExecute(db, upsertStmts);
  }

  // Mark bookmarks not in the API response as deleted
  if (activeUuids.size > 0) {
    const uuidList = [...activeUuids];
    const placeholders = uuidList.map(() => "?").join(",");
    await d1.prepare(
      `UPDATE bookmarks SET deleted_at = CURRENT_TIMESTAMP WHERE bookmark_uuid NOT IN (${placeholders}) AND deleted_at IS NULL`
    ).bind(...uuidList).run();
  } else {
    await db.update(bookmarks)
      .set({ deleted_at: sql`CURRENT_TIMESTAMP` })
      .where(isNull(bookmarks.deleted_at));
  }

  const result = await db.select({ total: count() }).from(bookmarks);
  return { total: result[0].total };
}

export async function getBookmarks(d1: D1Database): Promise<StoredBookmark[]> {
  const db = getDb(d1);
  return db.select().from(bookmarks)
    .orderBy(sql`deleted_at IS NOT NULL`, desc(bookmarks.created_at));
}

export async function resetBackupProgress(d1: D1Database, total: number): Promise<void> {
  const db = getDb(d1);
  await db.insert(backupProgress).values({ id: 1, total, completed: 0 })
    .onConflictDoUpdate({
      target: backupProgress.id,
      set: { total, completed: 0 },
    });
}

export async function incrementBackupProgress(d1: D1Database): Promise<{ completed: number; total: number }> {
  const db = getDb(d1);
  await db.update(backupProgress)
    .set({ completed: sql`completed + 1` })
    .where(eq(backupProgress.id, 1));

  const row = await db.select().from(backupProgress).where(eq(backupProgress.id, 1));
  return { completed: row[0].completed, total: row[0].total };
}

export async function updateEpisodePlayedAt(d1: D1Database, entries: HistoryEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const db = getDb(d1);

  const stmts = entries.map((entry) => {
    return db.update(episodes)
      .set({ played_at: entry.played_at })
      .where(and(
        eq(episodes.uuid, entry.uuid),
        isNull(episodes.played_at),
      ));
  });

  await batchExecute(db, stmts);
}

export async function getPodcastsWithStats(d1: D1Database): Promise<PodcastWithStats[]> {
  const result = await d1.prepare(`
    SELECT
      p.*,
      COALESCE(e.total_episodes, 0) AS total_episodes,
      COALESCE(e.played_count, 0) AS played_count,
      COALESCE(e.starred_count, 0) AS starred_count,
      COALESCE(e.total_played_time, 0) AS total_played_time
    FROM podcasts p
    LEFT JOIN (
      SELECT
        podcast_uuid,
        COUNT(*) AS total_episodes,
        SUM(CASE WHEN playing_status = 3 THEN 1 ELSE 0 END) AS played_count,
        SUM(CASE WHEN starred = 1 THEN 1 ELSE 0 END) AS starred_count,
        SUM(played_up_to) AS total_played_time
      FROM episodes
      GROUP BY podcast_uuid
    ) e ON p.uuid = e.podcast_uuid
    ORDER BY p.deleted_at IS NOT NULL, p.date_added DESC
  `).all<PodcastWithStats>();

  return result.results;
}

export async function getBookmarksWithEpisodes(d1: D1Database): Promise<BookmarkWithEpisode[]> {
  const result = await d1.prepare(`
    SELECT
      b.*,
      e.title AS episode_title,
      e.podcast_title AS podcast_title,
      e.duration AS episode_duration
    FROM bookmarks b
    LEFT JOIN episodes e ON b.episode_uuid = e.uuid
    ORDER BY b.deleted_at IS NOT NULL, b.created_at DESC
  `).all<BookmarkWithEpisode>();

  return result.results;
}
