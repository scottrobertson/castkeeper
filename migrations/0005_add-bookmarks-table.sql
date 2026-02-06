-- Migration number: 0005 	 2026-02-06T00:00:00.000Z
CREATE TABLE IF NOT EXISTS bookmarks (
    bookmark_uuid TEXT PRIMARY KEY,
    podcast_uuid TEXT,
    episode_uuid TEXT,
    time INTEGER NOT NULL,
    title TEXT,
    created_at TEXT,
    deleted_at TEXT,
    raw_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_episode_uuid ON bookmarks(episode_uuid);
CREATE INDEX IF NOT EXISTS idx_bookmarks_podcast_uuid ON bookmarks(podcast_uuid);
