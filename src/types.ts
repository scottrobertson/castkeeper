/// <reference types="@cloudflare/workers-types" />

export interface LoginResponse {
  token: string;
}

export interface EpisodeSyncItem {
  uuid: string;
  playingStatus: number;
  playedUpTo: number;
  isDeleted: boolean;
  starred: boolean;
  duration: number;
  bookmarks: unknown[];
  deselectedChapters: string;
}

export interface PodcastEpisodesResponse {
  episodes: EpisodeSyncItem[];
}

export interface CacheEpisode {
  uuid: string;
  title: string;
  slug: string;
  url: string;
  file_type: string;
  file_size: number;
  duration: number;
  published: string;
  type: string;
  season: number;
  number: number;
}

export interface CachePodcastResponse {
  episode_count: number;
  has_more_episodes: boolean;
  podcast: {
    uuid: string;
    title: string;
    author: string;
    slug: string;
    episodes: CacheEpisode[];
  };
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

export interface Bookmark {
  bookmarkUuid: string;
  podcastUuid: string;
  episodeUuid: string;
  time: number;
  title: string;
  createdAt: string;
}

export interface BookmarkListResponse {
  bookmarks: Bookmark[];
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
  bookmarks?: number;
}


export type ExportedHandler<Env = unknown> = {
  fetch?: (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;
  scheduled?: (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => void | Promise<void>;
};

