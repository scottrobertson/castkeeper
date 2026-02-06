import type { StoredEpisode, StoredPodcast, StoredBookmark } from "./types";

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export function calculateProgress(playedTime: number, duration: number): number {
  return Math.round((playedTime / duration) * 100);
}

function layout(title: string, password: string | null, content: string): string {
  const params = password ? `?password=${encodeURIComponent(password)}` : '';
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen">
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-6">
                <span class="font-semibold text-gray-900">Pocketcasts Backup</span>
                <div class="flex gap-4">
                    <a href="/history${params}" class="text-sm font-medium text-gray-600 hover:text-gray-900">History</a>
                    <a href="/podcasts${params}" class="text-sm font-medium text-gray-600 hover:text-gray-900">Podcasts</a>
                    <a href="/bookmarks${params}" class="text-sm font-medium text-gray-600 hover:text-gray-900">Bookmarks</a>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span id="backup-status" class="text-sm"></span>
                <button onclick="runBackup()" class="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium px-3 py-1.5 rounded">Backup Now</button>
            </div>
        </div>
    </nav>

    <main class="max-w-4xl mx-auto px-4 py-6">
        ${content}
    </main>

    <script>
        async function runBackup() {
            const button = document.querySelector('nav button');
            const status = document.getElementById('backup-status');

            button.disabled = true;
            button.textContent = 'Running...';
            status.textContent = '';
            status.className = 'text-sm';

            try {
                const response = await fetch('/backup');
                const result = await response.json();

                if (result.success) {
                    status.textContent = 'Done';
                    status.className = 'text-sm text-green-600';
                    setTimeout(() => { window.location.reload(); }, 1000);
                } else {
                    status.textContent = 'Error: ' + result.error;
                    status.className = 'text-sm text-red-600';
                }
            } catch (error) {
                status.textContent = 'Backup failed';
                status.className = 'text-sm text-red-600';
            }

            button.disabled = false;
            button.textContent = 'Backup Now';
        }
    </script>
</body>
</html>`;
}

function generateEpisodeHtml(episode: StoredEpisode): string {
  const progress = calculateProgress(episode.played_up_to, episode.duration);
  const publishedDate = new Date(episode.published).toLocaleDateString();

  return `
    <div class="border border-gray-200 rounded-lg p-4 bg-white">
        <div class="font-semibold text-gray-900">${episode.title}</div>
        <div class="text-gray-500 text-sm mt-1">${episode.podcast_title}</div>
        <div class="text-gray-400 text-sm mt-1">
            Duration: ${formatDuration(episode.duration)} |
            Played: ${formatDuration(episode.played_up_to)} |
            Progress: ${progress}%
        </div>
        <div class="bg-gray-100 h-1.5 rounded-full mt-2">
            <div class="bg-green-500 h-full rounded-full" style="width: ${progress}%"></div>
        </div>
        <div class="text-gray-400 text-sm mt-1">Published: ${publishedDate}</div>
    </div>`;
}

export function generateHistoryHtml(episodes: StoredEpisode[], totalEpisodes: number, password: string | null): string {
  const content = `
    <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Listen History</h1>
        <div class="flex items-center gap-3">
            <span class="text-sm text-gray-500">${totalEpisodes} episodes</span>
            <a href="/export?password=${encodeURIComponent(password || '')}" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded">Download CSV</a>
        </div>
    </div>
    <div class="flex flex-col gap-3">
        ${episodes.map(episode => generateEpisodeHtml(episode)).join('')}
    </div>`;

  return layout("Pocketcasts Listen History", password, content);
}

function generatePodcastHtml(podcast: StoredPodcast): string {
  const addedDate = new Date(podcast.date_added).toLocaleDateString();
  const isDeleted = podcast.deleted_at !== null;
  const deletedDate = isDeleted ? new Date(podcast.deleted_at!).toLocaleDateString() : null;

  return `
    <div class="border border-gray-200 rounded-lg p-4 bg-white${isDeleted ? ' opacity-60' : ''}">
        <div class="font-semibold text-gray-900">
            ${podcast.title}
            ${isDeleted ? `<span class="ml-2 bg-red-500 text-white text-xs font-normal px-2 py-0.5 rounded">Removed ${deletedDate}</span>` : ''}
        </div>
        <div class="text-gray-500 text-sm mt-1">${podcast.author}</div>
        <div class="text-gray-600 text-sm mt-2">${podcast.description}</div>
        <div class="text-gray-400 text-sm mt-1">Added: ${addedDate}</div>
    </div>`;
}

export function generatePodcastsHtml(podcasts: StoredPodcast[], password: string | null): string {
  const active = podcasts.filter(p => p.deleted_at === null);
  const deleted = podcasts.filter(p => p.deleted_at !== null);

  const content = `
    <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Podcasts</h1>
        <span class="text-sm text-gray-500">
            ${active.length} subscribed${deleted.length > 0 ? ` · ${deleted.length} removed` : ''}
        </span>
    </div>
    <div class="flex flex-col gap-3">
        ${active.map(p => generatePodcastHtml(p)).join('')}
    </div>
    ${deleted.length > 0 ? `
    <h2 class="text-lg font-semibold text-gray-500 mt-8 mb-4 border-b border-gray-200 pb-2">Removed Podcasts</h2>
    <div class="flex flex-col gap-3">
        ${deleted.map(p => generatePodcastHtml(p)).join('')}
    </div>` : ''}`;

  return layout("Pocketcasts Podcasts", password, content);
}

function generateBookmarkHtml(bookmark: StoredBookmark): string {
  const createdDate = new Date(bookmark.created_at).toLocaleDateString();
  const isDeleted = bookmark.deleted_at !== null;
  const deletedDate = isDeleted ? new Date(bookmark.deleted_at!).toLocaleDateString() : null;

  return `
    <div class="border border-gray-200 rounded-lg p-4 bg-white${isDeleted ? ' opacity-60' : ''}">
        <div class="font-semibold text-gray-900">
            ${bookmark.title}
            ${isDeleted ? `<span class="ml-2 bg-red-500 text-white text-xs font-normal px-2 py-0.5 rounded">Removed ${deletedDate}</span>` : ''}
        </div>
        <div class="text-gray-400 text-sm mt-1">
            at ${formatDuration(bookmark.time)} · ${createdDate}
        </div>
    </div>`;
}

export function generateBookmarksHtml(bookmarks: StoredBookmark[], password: string | null): string {
  const active = bookmarks.filter(b => b.deleted_at === null);
  const deleted = bookmarks.filter(b => b.deleted_at !== null);

  const content = `
    <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Bookmarks</h1>
        <span class="text-sm text-gray-500">
            ${active.length} bookmarks${deleted.length > 0 ? ` · ${deleted.length} removed` : ''}
        </span>
    </div>
    <div class="flex flex-col gap-3">
        ${active.map(b => generateBookmarkHtml(b)).join('')}
    </div>
    ${deleted.length > 0 ? `
    <h2 class="text-lg font-semibold text-gray-500 mt-8 mb-4 border-b border-gray-200 pb-2">Removed Bookmarks</h2>
    <div class="flex flex-col gap-3">
        ${deleted.map(b => generateBookmarkHtml(b)).join('')}
    </div>` : ''}`;

  return layout("Pocketcasts Bookmarks", password, content);
}
