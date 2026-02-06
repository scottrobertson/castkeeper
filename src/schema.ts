import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { InferSelectModel } from "drizzle-orm";

export const episodes = sqliteTable("episodes", {
  uuid: text("uuid").primaryKey(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  podcast_title: text("podcast_title").notNull(),
  podcast_uuid: text("podcast_uuid").notNull(),
  published: text("published").notNull(),
  duration: integer("duration").notNull(),
  file_type: text("file_type").notNull(),
  size: text("size").notNull(),
  playing_status: integer("playing_status").notNull(),
  played_up_to: integer("played_up_to").notNull(),
  is_deleted: integer("is_deleted").notNull().default(0),
  starred: integer("starred").notNull().default(0),
  episode_type: text("episode_type").notNull(),
  episode_season: integer("episode_season").notNull(),
  episode_number: integer("episode_number").notNull(),
  author: text("author").notNull(),
  slug: text("slug").notNull(),
  podcast_slug: text("podcast_slug").notNull(),
  played_at: text("played_at"),
  updated_at: text("updated_at"),
  created_at: text("created_at").default("CURRENT_TIMESTAMP"),
  raw_data: text("raw_data").notNull(),
});

export const podcasts = sqliteTable("podcasts", {
  uuid: text("uuid").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  description: text("description").notNull(),
  url: text("url").notNull(),
  slug: text("slug").notNull(),
  date_added: text("date_added").notNull(),
  folder_uuid: text("folder_uuid").notNull(),
  sort_position: integer("sort_position").notNull(),
  is_private: integer("is_private").notNull().default(0),
  auto_start_from: integer("auto_start_from").notNull().default(0),
  auto_skip_last: integer("auto_skip_last").notNull().default(0),
  episodes_sort_order: integer("episodes_sort_order").notNull(),
  last_episode_uuid: text("last_episode_uuid").notNull(),
  last_episode_published: text("last_episode_published").notNull(),
  created_at: text("created_at").default("CURRENT_TIMESTAMP"),
  updated_at: text("updated_at").default("CURRENT_TIMESTAMP"),
  deleted_at: text("deleted_at"),
  raw_data: text("raw_data").notNull(),
});

export const bookmarks = sqliteTable("bookmarks", {
  bookmark_uuid: text("bookmark_uuid").primaryKey(),
  podcast_uuid: text("podcast_uuid").notNull(),
  episode_uuid: text("episode_uuid").notNull(),
  time: integer("time").notNull(),
  title: text("title").notNull(),
  created_at: text("created_at").notNull(),
  deleted_at: text("deleted_at"),
  raw_data: text("raw_data").notNull(),
});

export type StoredEpisode = InferSelectModel<typeof episodes>;
export type StoredPodcast = InferSelectModel<typeof podcasts>;
export type StoredBookmark = InferSelectModel<typeof bookmarks>;
