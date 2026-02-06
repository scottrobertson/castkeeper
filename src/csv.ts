import type { StoredEpisode } from "./types";
import { calculateProgress } from "./templates";

function escapeCsvField(field: string | number | null): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsv(episodes: StoredEpisode[]): string {
  const headers = [
    'Episode Title',
    'Podcast Title',
    'Duration (seconds)',
    'Played Up To (seconds)',
    'Progress (%)',
    'Published Date',
    'Episode Type',
    'Season',
    'Episode Number',
    'Author',
    'Starred',
    'Deleted'
  ];

  const csvRows = [headers.join(',')];

  episodes.forEach(episode => {
    const progress = calculateProgress(episode.played_up_to, episode.duration);
    const row = [
      escapeCsvField(episode.title),
      escapeCsvField(episode.podcast_title),
      episode.duration,
      episode.played_up_to,
      progress,
      escapeCsvField(episode.published),
      escapeCsvField(episode.episode_type),
      episode.episode_season || '',
      episode.episode_number || '',
      escapeCsvField(episode.author),
      episode.starred ? 'Yes' : 'No',
      episode.is_deleted ? 'Yes' : 'No'
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}
