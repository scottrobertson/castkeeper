/// <reference types="@cloudflare/workers-types" />

export interface LoginResponse {
  token: string;
}

export interface Episode {
  uuid: string;
  url: string;
  published: string;
  duration: number;
  fileType: string;
  title: string;
  size: string;
  playingStatus: number;
  playedUpTo: number;
  starred: boolean;
  podcastUuid: string;
  podcastTitle: string;
  episodeType: string;
  episodeSeason: number;
  episodeNumber: number;
  isDeleted: boolean;
  author: string;
  bookmarks: unknown[];
  slug: string;
  podcastSlug: string;
}

export interface HistoryResponse {
  episodes: Episode[];
}

export interface Podcast {
  uuid: string;
  title: string;
  author: string;
  description: string;
  url: string;
  slug: string;
  dateAdded: string;
  folderUuid: string;
  sortPosition: number;
  isPrivate: boolean;
  autoStartFrom: number;
  autoSkipLast: number;
  episodesSortOrder: number;
  lastEpisodeUuid: string;
  lastEpisodePublished: string;
  unplayed: boolean;
  lastEpisodePlayingStatus: number;
  lastEpisodeArchived: boolean;
  descriptionHtml: string;
  settings: unknown;
}

export interface PodcastListResponse {
  podcasts: Podcast[];
  folders: unknown[];
}

export interface Env {
  DB: D1Database;
  EMAIL: string;
  PASS: string;
  ENVIRONMENT?: string;
}

export interface BackupResult {
  success: boolean;
  message?: string;
  error?: string;
  synced?: number;
  total?: number;
  podcasts?: number;
}

export interface SaveHistoryResult {
  total: number;
}

export type ExportedHandler<Env = unknown> = {
  fetch?: (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;
  scheduled?: (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => void | Promise<void>;
};

export interface StoredEpisode {
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
  created_at: string;
  raw_data: string;
}

export interface StoredPodcast {
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
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  raw_data: string;
}