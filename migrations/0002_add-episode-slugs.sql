-- Migration number: 0002 	 2026-02-06T00:00:00.000Z
ALTER TABLE episodes ADD COLUMN slug TEXT;
ALTER TABLE episodes ADD COLUMN podcast_slug TEXT;
