import type { StoredEpisode } from "../schema";
import type { EpisodeFilter } from "../db";
import { layout } from "./layout";
import { calculateProgress, formatDuration, formatRelativeDate, tooltip } from "./utils";

function statusDot(episode: StoredEpisode): string {
  const wrapper = (dot: string, label: string) =>
    `<div class="group relative flex">${dot}<div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-[#fafafa] text-[#0a0a0a] text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-lg">${label}</div></div>`;

  if (episode.playing_status === 3) {
    return wrapper(`<div class="w-2 h-2 rounded-full bg-[#22c55e] mt-1.5 shrink-0"></div>`, 'Played');
  }
  if (episode.playing_status === 2) {
    return wrapper(`<div class="w-2 h-2 rounded-full bg-[#3b82f6] mt-1.5 shrink-0"></div>`, 'In Progress');
  }
  return wrapper(`<div class="w-2 h-2 rounded-full border border-[#27272a] mt-1.5 shrink-0"></div>`, 'Not Started');
}

function getDayKey(playedAt: string | null): string {
  if (!playedAt) return "";
  return playedAt.slice(0, 10);
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
  const progressLabel = `${formatDuration(episode.played_up_to)} / ${formatDuration(episode.duration)}`;

  const icons: string[] = [];
  if (episode.starred) icons.push(`<span class="text-amber-400 text-[11px]" title="Starred">★</span>`);
  if (episode.is_deleted) icons.push(tooltip(`<span class="text-zinc-500"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg></span>`, 'Archived'));

  return `
    <div class="grid items-center pr-1 sm:pr-3 h-[52px] border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150" style="grid-template-columns: 12px 1fr 24px 120px 52px; gap: 8px">
        ${statusDot(episode)}
        <div class="min-w-0">
            <div class="text-[#ededef] text-[13px] font-medium truncate">${episode.title}</div>
            <div class="text-[#71717a] text-xs truncate">${episode.podcast_title}</div>
        </div>
        <div class="flex justify-center">${icons.length ? icons.join('') : ''}</div>
        ${tooltip(`<div class="flex items-center gap-2 cursor-default">
            <div class="w-16 h-[3px] bg-[#1c1c1f] rounded-full overflow-hidden shrink-0">
                <div class="bg-[#3ecf8e] h-full rounded-full" style="width: ${progress}%"></div>
            </div>
            <span class="text-[#71717a] text-xs">${progress}%</span>
        </div>`, progressLabel)}
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

  return layout("Castkeeper — Episodes", password, content);
}
