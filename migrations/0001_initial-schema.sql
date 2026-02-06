-- Migration number: 0001 	 2026-02-06T00:00:00.000Z
CREATE TABLE IF NOT EXISTS episodes (
    uuid TEXT PRIMARY KEY,
    url TEXT,
    title TEXT NOT NULL,
    podcast_title TEXT,
    podcast_uuid TEXT,
    published TEXT,
    duration INTEGER,
    file_type TEXT,
    size TEXT,
    playing_status INTEGER,
    played_up_to INTEGER,
    is_deleted INTEGER DEFAULT 0,
    starred INTEGER DEFAULT 0,
    episode_type TEXT,
    episode_season INTEGER,
    episode_number INTEGER,
    author TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_episodes_podcast_uuid ON episodes(podcast_uuid);
CREATE INDEX IF NOT EXISTS idx_episodes_published ON episodes(published);
CREATE INDEX IF NOT EXISTS idx_episodes_playing_status ON episodes(playing_status);
