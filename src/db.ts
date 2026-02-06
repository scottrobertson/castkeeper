import { drizzle } from "drizzle-orm/d1";
import { eq, and, count, desc, asc, isNull, isNotNull, sql } from "drizzle-orm";
import { episodes, podcasts, bookmarks } from "./schema";
import type { StoredEpisode, StoredPodcast, StoredBookmark } from "./schema";
import type { HistoryResponse, SaveHistoryResult, PodcastListResponse, BookmarkListResponse } from "./types";

function getDb(d1: D1Database) {
  return drizzle(d1);
}

export async function saveHistory(d1: D1Database, history: HistoryResponse): Promise<SaveHistoryResult> {
  const db = getDb(d1);

  const stmts = history.episodes.map((episode) =>
    db.insert(episodes).values({
      uuid: episode.uuid,
      url: episode.url,
      title: episode.title,
      podcast_title: episode.podcastTitle,
      podcast_uuid: episode.podcastUuid,
      published: episode.published,
      duration: episode.duration,
      file_type: episode.fileType,
      size: episode.size,
      playing_status: episode.playingStatus,
      played_up_to: episode.playedUpTo,
      is_deleted: episode.isDeleted ? 1 : 0,
      starred: episode.starred ? 1 : 0,
      episode_type: episode.episodeType,
      episode_season: episode.episodeSeason,
      episode_number: episode.episodeNumber,
      author: episode.author,
      slug: episode.slug,
      podcast_slug: episode.podcastSlug,
      raw_data: JSON.stringify(episode),
    }).onConflictDoUpdate({
      target: episodes.uuid,
      set: {
        url: episode.url,
        title: episode.title,
        podcast_title: episode.podcastTitle,
        podcast_uuid: episode.podcastUuid,
        published: episode.published,
        duration: episode.duration,
        file_type: episode.fileType,
        size: episode.size,
        playing_status: episode.playingStatus,
        played_up_to: episode.playedUpTo,
        is_deleted: episode.isDeleted ? 1 : 0,
        starred: episode.starred ? 1 : 0,
        episode_type: episode.episodeType,
        episode_season: episode.episodeSeason,
        episode_number: episode.episodeNumber,
        author: episode.author,
        slug: episode.slug,
        podcast_slug: episode.podcastSlug,
        raw_data: JSON.stringify(episode),
        played_at: episode.playingStatus === 3
          ? sql`CASE WHEN ${episodes.playing_status} != 3 THEN CURRENT_TIMESTAMP ELSE ${episodes.played_at} END`
          : sql`${episodes.played_at}`,
      },
    })
  );

  if (stmts.length > 0) {
    await db.batch(stmts as [typeof stmts[0], ...typeof stmts]);
  }

  const result = await db.select({ total: count() }).from(episodes);
  return { total: result[0].total };
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

  const query = db.select().from(episodes).where(where).orderBy(desc(episodes.published));

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
    await db.batch(upsertStmts as [typeof upsertStmts[0], ...typeof upsertStmts]);
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
    await db.batch(upsertStmts as [typeof upsertStmts[0], ...typeof upsertStmts]);
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
