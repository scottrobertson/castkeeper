import type { StoredEpisode } from "./schema";
import type { EpisodeFilter, PodcastWithStats, BookmarkWithEpisode } from "./db";

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
  return Math.min(100, Math.round((playedTime / duration) * 100));
}

function layout(title: string, password: string | null, content: string): string {
  const params = password ? `?password=${encodeURIComponent(password)}` : '';
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { font-family: 'Inter', system-ui, sans-serif; }</style>
</head>
<body class="bg-[#0a0a0a] min-h-screen overflow-y-scroll">
    <nav class="bg-[#111113] border-b border-[#1f1f23] sticky top-0 z-10">
        <div class="max-w-4xl mx-auto px-3 sm:px-6 h-12 flex items-center justify-between">
            <div class="flex items-center gap-6">
                <span class="text-[#fafafa] font-semibold text-sm hidden sm:inline">Pocketcasts Backup</span>
                <svg class="w-5 h-5 text-[#fafafa] sm:hidden shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <div class="flex gap-4">
                    <a href="/episodes${params}" class="text-[13px] font-medium text-[#71717a] hover:text-[#fafafa] transition-colors duration-150">Episodes</a>
                    <a href="/podcasts${params}" class="text-[13px] font-medium text-[#71717a] hover:text-[#fafafa] transition-colors duration-150">Podcasts</a>
                    <a href="/bookmarks${params}" class="text-[13px] font-medium text-[#71717a] hover:text-[#fafafa] transition-colors duration-150">Bookmarks</a>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span id="backup-status" class="text-xs"></span>
                <button onclick="runBackup()" class="bg-[#3ecf8e] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#0a0a0a] text-[11px] sm:text-xs font-medium px-2 sm:px-3 h-7 sm:h-8 rounded-md transition-all duration-150">Backup Now</button>
            </div>
        </div>
    </nav>

    <main class="max-w-4xl mx-auto px-3 sm:px-6 py-6">
        ${content}
    </main>

    <script>
        async function runBackup() {
            const button = document.querySelector('nav button');
            const status = document.getElementById('backup-status');

            button.disabled = true;
            button.textContent = 'Running...';
            status.textContent = '';
            status.className = 'text-xs';

            try {
                const response = await fetch('/backup');
                const result = await response.json();

                if (result.success) {
                    status.textContent = 'Backup enqueued';
                    status.className = 'text-xs text-[#3ecf8e]';
                } else {
                    status.textContent = 'Error: ' + result.error;
                    status.className = 'text-xs text-[#ef4444]';
                }
            } catch (error) {
                status.textContent = 'Backup failed';
                status.className = 'text-xs text-[#ef4444]';
            }

            button.disabled = false;
            button.textContent = 'Backup Now';
        }
    </script>
</body>
</html>`;
}

export function formatRelativeDate(isoString: string | null): string {
  if (!isoString) return "\u2014";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 365) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusDot(episode: StoredEpisode): string {
  const wrapper = (dot: string, label: string) =>
    `<div class="group relative flex justify-center">${dot}<div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-[#fafafa] text-[#0a0a0a] text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-lg">${label}</div></div>`;

  if (episode.playing_status === 3) {
    return wrapper(`<div class="w-2 h-2 rounded-full bg-[#22c55e] mt-1.5 shrink-0"></div>`, 'Played');
  }
  if (episode.playing_status === 2) {
    return wrapper(`<div class="w-2 h-2 rounded-full bg-[#3b82f6] mt-1.5 shrink-0"></div>`, 'In Progress');
  }
  return wrapper(`<div class="w-2 h-2 rounded-full border border-[#27272a] mt-1.5 shrink-0"></div>`, 'Not Started');
}

function formatPlayedAt(playedAt: string): string {
  const date = new Date(playedAt);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getDayKey(playedAt: string | null): string {
  if (!playedAt) return "";
  return playedAt.slice(0, 10); // YYYY-MM-DD
}

function formatDayHeading(dayKey: string): string {
  const date = new Date(dayKey + "T00:00:00Z");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const todayKey = today.toISOString().slice(0, 10);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (dayKey === todayKey) return "Today";
  if (dayKey === yesterdayKey) return "Yesterday";

  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function generateEpisodeHtml(episode: StoredEpisode): string {
  const progress = calculateProgress(episode.played_up_to, episode.duration);

  const icons: string[] = [];
  if (episode.starred) icons.push(`<span class="text-amber-400 text-[11px]" title="Starred">★</span>`);
  if (episode.is_deleted) icons.push(`<span class="text-zinc-500" title="Archived"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg></span>`);

  return `
    <div class="grid items-center px-1 sm:px-3 h-[52px] border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150" style="grid-template-columns: 16px 1fr 24px 120px 52px; gap: 8px">
        ${statusDot(episode)}
        <div class="min-w-0">
            <div class="text-[#ededef] text-[13px] font-medium truncate">${episode.title}</div>
            <div class="text-[#71717a] text-xs truncate">${episode.podcast_title}</div>
        </div>
        <div class="flex justify-center">${icons.length ? icons.join('') : ''}</div>
        <div class="flex items-center gap-2">
            <div class="w-16 h-[3px] bg-[#1c1c1f] rounded-full overflow-hidden shrink-0">
                <div class="bg-[#3ecf8e] h-full rounded-full" style="width: ${progress}%"></div>
            </div>
            <span class="text-[#71717a] text-xs">${progress}%</span>
        </div>
        <div class="text-[#555] text-xs text-right">${formatRelativeDate(episode.played_at)}</div>
    </div>`;
}

function generateGroupedEpisodesHtml(episodes: StoredEpisode[]): string {
  let html = '';
  let currentDay = '';

  for (const episode of episodes) {
    const dayKey = getDayKey(episode.played_at);

    if (dayKey && dayKey !== currentDay) {
      currentDay = dayKey;
      html += `<div class="flex items-center gap-3 mt-5 mb-2 first:mt-3"><span class="text-[11px] uppercase tracking-wider text-[#71717a] font-medium whitespace-nowrap">${formatDayHeading(dayKey)}</span><div class="h-px bg-white/[0.06] flex-1"></div></div>`;
    } else if (!dayKey && currentDay !== '') {
      currentDay = '';
      html += `<div class="flex items-center gap-3 mt-5 mb-2"><span class="text-[11px] uppercase tracking-wider text-[#71717a] font-medium whitespace-nowrap">Older</span><div class="h-px bg-white/[0.06] flex-1"></div></div>`;
    }

    html += generateEpisodeHtml(episode);
  }

  return html;
}

const FILTER_OPTIONS: { value: EpisodeFilter; label: string }[] = [
  { value: "in_progress", label: "In Progress" },
  { value: "played", label: "Played" },
  { value: "not_started", label: "Not Started" },
  { value: "archived", label: "Archived" },
  { value: "starred", label: "Starred" },
];

function buildEpisodeParams(password: string | null, filters: EpisodeFilter[], page?: number): string {
  const parts: string[] = [];
  if (password) parts.push(`password=${encodeURIComponent(password)}`);
  filters.forEach(f => parts.push(`filter=${encodeURIComponent(f)}`));
  if (page && page > 1) parts.push(`page=${page}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function generateEpisodesHtml(episodes: StoredEpisode[], totalEpisodes: number, page: number, perPage: number, password: string | null, filters: EpisodeFilter[] = []): string {
  const totalPages = Math.ceil(totalEpisodes / perPage);
  const activeFilters = new Set(filters);

  const filterOptions = FILTER_OPTIONS.map(opt => {
    const isActive = activeFilters.has(opt.value);
    const nextFilters = isActive
      ? filters.filter(f => f !== opt.value)
      : [...filters, opt.value];
    const href = `/episodes${buildEpisodeParams(password, nextFilters)}`;
    const icon = isActive
      ? `<svg class="w-3.5 h-3.5 text-[#3ecf8e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
      : `<div class="w-3.5 h-3.5 rounded border border-[#555]"></div>`;
    return `<a href="${href}" class="flex items-center gap-2.5 px-3 py-1.5 text-[13px] ${isActive ? 'text-[#fafafa]' : 'text-[#999]'} hover:bg-white/[0.04] transition-colors duration-150">${icon} ${opt.label}</a>`;
  }).join('\n            ');

  const filterCount = filters.length;
  const funnelColor = filterCount > 0 ? 'text-[#fafafa]' : 'text-[#555]';
  const countBadge = filterCount > 0 ? `<span class="text-[#3ecf8e] text-xs font-medium ml-0.5">(${filterCount})</span>` : '';

  const content = `
    <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
            <h1 class="text-base font-semibold text-[#fafafa] tracking-tight">Episodes</h1>
            <div class="relative" id="filter-dropdown">
                <button onclick="document.getElementById('filter-dropdown').classList.toggle('open')" class="flex items-center gap-1 px-2 h-7 rounded-md border ${filterCount > 0 ? 'border-[#3ecf8e]/40' : 'border-[#27272a]'} ${funnelColor} hover:text-[#fafafa] hover:bg-white/[0.04] transition-all duration-150">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                    ${countBadge}
                </button>
                <div class="hidden absolute left-0 top-full mt-1 py-1 bg-[#1a1a1e] border border-[#27272a] rounded-lg shadow-xl z-20 min-w-[160px]" id="filter-panel">
                    ${filterOptions}
                </div>
            </div>
        </div>
        <div class="flex items-center gap-3">
            <span class="text-xs text-[#71717a]">${totalEpisodes} episodes</span>
            <a href="/export${buildEpisodeParams(password, filters)}" class="h-8 inline-flex items-center px-3 text-xs font-medium rounded-md border border-[#27272a] text-[#fafafa] hover:bg-white/[0.04] transition-all duration-150">Download CSV</a>
        </div>
    </div>
    ${episodes.length === 0 && filters.length > 0 ? `
    <div class="flex flex-col items-center justify-center py-16 text-center">
        <p class="text-[#71717a] text-sm">No episodes match these filters</p>
        <a href="/episodes${password ? `?password=${encodeURIComponent(password)}` : ''}" class="text-[#3ecf8e] text-sm mt-2 hover:underline">Clear filters</a>
    </div>` : `
    <div>
        ${generateGroupedEpisodesHtml(episodes)}
    </div>`}
    ${totalPages > 1 ? `
    <div class="flex items-center justify-center gap-2 mt-6">
        ${page > 1 ? `<a href="/episodes${buildEpisodeParams(password, filters, page - 1)}" class="h-8 inline-flex items-center px-3 text-xs font-medium rounded-md border border-[#27272a] text-[#71717a] hover:text-[#fafafa] hover:bg-white/[0.04] transition-all duration-150">Previous</a>` : ''}
        <span class="text-xs text-[#555]">Page ${page} of ${totalPages}</span>
        ${page < totalPages ? `<a href="/episodes${buildEpisodeParams(password, filters, page + 1)}" class="h-8 inline-flex items-center px-3 text-xs font-medium rounded-md border border-[#27272a] text-[#71717a] hover:text-[#fafafa] hover:bg-white/[0.04] transition-all duration-150">Next</a>` : ''}
    </div>` : ''}
    <style>#filter-dropdown.open #filter-panel { display: block; }</style>
    <script>
        document.addEventListener('click', function(e) {
            var dd = document.getElementById('filter-dropdown');
            if (dd && !dd.contains(e.target)) dd.classList.remove('open');
        });
    </script>`;

  return layout("Pocketcasts Episodes", password, content);
}

const PODCAST_GRID = '1fr 64px 56px 100px 80px';

function podcastHeaderRow(): string {
  return `
    <div class="grid items-center px-3 h-8 border-b border-white/[0.06]" style="grid-template-columns: ${PODCAST_GRID}; gap: 8px">
        <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Podcast</div>
        <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Episodes</div>
        <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Played</div>
        <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Listened</div>
        <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Added</div>
    </div>`;
}

function generatePodcastRow(podcast: PodcastWithStats): string {
  return `
    <div class="grid items-center px-3 h-[52px] border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150" style="grid-template-columns: ${PODCAST_GRID}; gap: 8px">
        <div class="min-w-0">
            <div class="text-[#ededef] text-[13px] font-medium truncate">${podcast.title}</div>
            <div class="text-[#71717a] text-xs truncate">${podcast.author}</div>
        </div>
        <div class="text-[#71717a] text-xs">${podcast.episode_count || '—'}</div>
        <div class="text-[#71717a] text-xs">${podcast.played_count || '—'}</div>
        <div class="text-[#71717a] text-xs">${podcast.total_played_time > 0 ? formatDuration(podcast.total_played_time) : '—'}</div>
        <div class="text-[#555] text-xs">${formatRelativeDate(podcast.date_added)}</div>
    </div>`;
}

export function generatePodcastsHtml(podcasts: PodcastWithStats[], password: string | null): string {
  const active = podcasts.filter(p => p.deleted_at === null);
  const deleted = podcasts.filter(p => p.deleted_at !== null);

  const content = `
    <div class="flex items-center justify-between mb-4">
        <h1 class="text-base font-semibold text-[#fafafa] tracking-tight">Podcasts</h1>
        <span class="text-xs text-[#71717a]">
            ${active.length} subscribed${deleted.length > 0 ? ` · ${deleted.length} removed` : ''}
        </span>
    </div>
    <div class="overflow-x-auto"><div class="min-w-[540px]">
        ${podcastHeaderRow()}
        ${active.map(p => generatePodcastRow(p)).join('')}
    </div></div>
    ${deleted.length > 0 ? `
    <div class="flex items-center gap-3 mt-5 mb-2"><span class="text-[11px] uppercase tracking-wider text-[#71717a] font-medium whitespace-nowrap">Removed</span><div class="h-px bg-white/[0.06] flex-1"></div></div>
    <div class="overflow-x-auto"><div class="min-w-[540px]">
        ${deleted.map(p => `<div class="opacity-60">${generatePodcastRow(p)}</div>`).join('')}
    </div></div>` : ''}`;

  return layout("Pocketcasts Podcasts", password, content);
}

function generateBookmarkRow(bookmark: BookmarkWithEpisode): string {
  const subtitle = bookmark.episode_title
    ? `${bookmark.episode_title}${bookmark.podcast_title ? ` · ${bookmark.podcast_title}` : ''}`
    : '';

  return `
    <div class="grid items-center px-3 h-[52px] border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150" style="grid-template-columns: 16px 1fr 80px 64px; gap: 8px">
        <div class="flex justify-center"><svg class="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"/></svg></div>
        <div class="min-w-0">
            <div class="text-[#ededef] text-[13px] font-medium truncate">${bookmark.title}</div>
            ${subtitle ? `<div class="text-[#71717a] text-xs truncate">${subtitle}</div>` : ''}
        </div>
        <div class="text-[#71717a] text-xs text-right">${formatDuration(bookmark.time)}</div>
        <div class="text-[#555] text-xs text-right">${formatRelativeDate(bookmark.created_at)}</div>
    </div>`;
}

export function generateBookmarksHtml(bookmarks: BookmarkWithEpisode[], password: string | null): string {
  const active = bookmarks.filter(b => b.deleted_at === null);
  const deleted = bookmarks.filter(b => b.deleted_at !== null);

  const content = `
    <div class="flex items-center justify-between mb-4">
        <h1 class="text-base font-semibold text-[#fafafa] tracking-tight">Bookmarks</h1>
        <span class="text-xs text-[#71717a]">
            ${active.length} bookmarks${deleted.length > 0 ? ` · ${deleted.length} removed` : ''}
        </span>
    </div>
    <div>
        ${active.map(b => generateBookmarkRow(b)).join('')}
    </div>
    ${deleted.length > 0 ? `
    <div class="flex items-center gap-3 mt-5 mb-2"><span class="text-[11px] uppercase tracking-wider text-[#71717a] font-medium whitespace-nowrap">Removed</span><div class="h-px bg-white/[0.06] flex-1"></div></div>
    <div>
        ${deleted.map(b => `<div class="opacity-60">${generateBookmarkRow(b)}</div>`).join('')}
    </div>` : ''}`;

  return layout("Pocketcasts Bookmarks", password, content);
}
