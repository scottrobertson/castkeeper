import { raw } from "hono/html";
import type { StoredEpisode } from "../schema";
import type { EpisodeFilter } from "../db";
import { calculateProgress, formatDuration, formatRelativeDate } from "../utils";

export function Tooltip({ children, label }: { children: any; label: string }) {
  return (
    <div class="group/tip relative">
      {children}
      <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-[#fafafa] text-[#0a0a0a] text-[11px] font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-150 shadow-lg">{label}</div>
    </div>
  );
}

export function StatusDot({ episode }: { episode: StoredEpisode }) {
  const dot = (color: string, label: string) => (
    <div class="group relative flex">
      <div class={`w-2 h-2 rounded-full ${color} mt-1.5 shrink-0`}></div>
      <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-[#fafafa] text-[#0a0a0a] text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 shadow-lg">{label}</div>
    </div>
  );

  if (episode.playing_status === 3) return dot('bg-[#22c55e]', 'Played');
  if (episode.playing_status === 2) return dot('bg-[#3b82f6]', 'In Progress');
  return dot('border border-[#27272a]', 'Not Started');
}

export function EpisodeRow({ episode, showPodcast = true, hideBorder }: { episode: StoredEpisode; showPodcast?: boolean; hideBorder?: boolean }) {
  const progress = calculateProgress(episode.played_up_to, episode.duration);
  const progressLabel = `${formatDuration(episode.played_up_to)} / ${formatDuration(episode.duration)}`;
  const podcastHref = `/podcast/${episode.podcast_uuid}`;

  return (
    <div class={`grid items-center pr-1 sm:pr-3 h-[52px] ${hideBorder ? '' : 'border-b border-white/[0.04]'} hover:bg-white/[0.02] transition-colors duration-150`} style="grid-template-columns: 12px 1fr 24px 120px 52px; gap: 8px">
      <StatusDot episode={episode} />
      <div class="min-w-0">
        <div class="text-[#ededef] text-[13px] font-medium truncate">{episode.title}</div>
        {showPodcast && <div class="truncate"><a href={podcastHref} class="text-[#71717a] text-xs hover:text-[#fafafa] underline decoration-[#333] hover:decoration-[#555] transition-colors duration-150">{episode.podcast_title}</a></div>}
      </div>
      <div class="flex justify-center">
        {episode.starred === 1 && <span class="text-amber-400 text-[11px]" title="Starred">{'\u2605'}</span>}
        {episode.is_deleted === 1 && !episode.starred && (
          <Tooltip label="Archived">
            <span class="text-zinc-500"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V21H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg></span>
          </Tooltip>
        )}
      </div>
      <Tooltip label={progressLabel}>
        <div class="flex items-center gap-2 cursor-default">
          <div class="w-16 h-[3px] bg-[#1c1c1f] rounded-full overflow-hidden shrink-0">
            <div class="bg-[#3ecf8e] h-full rounded-full" style={`width: ${progress}%`}></div>
          </div>
          <span class="text-[#71717a] text-xs">{progress}%</span>
        </div>
      </Tooltip>
      <div class="text-[#555] text-xs text-right">{formatRelativeDate(episode.played_at)}</div>
    </div>
  );
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

export function DayHeading({ label }: { label: string }) {
  return (
    <div class="flex items-center gap-3 mt-3 mb-2 first:mt-3">
      <span class="text-[11px] uppercase tracking-wider text-[#71717a] font-medium whitespace-nowrap">{label}</span>
      <div class="h-px bg-white/[0.06] flex-1"></div>
    </div>
  );
}

export function GroupedEpisodes({ episodes, showPodcast = true }: { episodes: StoredEpisode[]; showPodcast?: boolean }) {
  const elements: any[] = [];
  let currentDay = '';

  for (let i = 0; i < episodes.length; i++) {
    const episode = episodes[i];
    const dayKey = getDayKey(episode.played_at);

    if (dayKey && dayKey !== currentDay) {
      currentDay = dayKey;
      elements.push(<DayHeading label={formatDayHeading(dayKey)} />);
    } else if (!dayKey && currentDay !== '') {
      currentDay = '';
      elements.push(<DayHeading label="Older" />);
    }

    const nextEpisode = episodes[i + 1];
    const nextDayKey = nextEpisode ? getDayKey(nextEpisode.played_at) : null;
    const isLastInGroup = !nextEpisode || nextDayKey !== dayKey;

    elements.push(<EpisodeRow episode={episode} showPodcast={showPodcast} hideBorder={isLastInGroup} />);
  }

  return <>{elements}</>;
}

export const FILTER_OPTIONS: { value: EpisodeFilter; label: string }[] = [
  { value: "in_progress", label: "In Progress" },
  { value: "played", label: "Played" },
  { value: "not_started", label: "Not Started" },
  { value: "not_archived", label: "Not Archived" },
  { value: "archived", label: "Archived" },
  { value: "starred", label: "Starred" },
];

export function buildFilterParams(basePath: string, filters: EpisodeFilter[], page?: number): string {
  const parts: string[] = [];
  filters.forEach(f => parts.push(`filter=${encodeURIComponent(f)}`));
  if (page && page > 1) parts.push(`page=${page}`);
  return `${basePath}${parts.length > 0 ? `?${parts.join('&')}` : ''}`;
}

export function FilterDropdown({ basePath, filters }: { basePath: string; filters: EpisodeFilter[] }) {
  const activeFilters = new Set(filters);
  const filterCount = filters.length;
  const funnelColor = filterCount > 0 ? 'text-[#fafafa]' : 'text-[#555]';

  return (
    <>
      <div class="relative" id="filter-dropdown">
        <button onclick="document.getElementById('filter-dropdown').classList.toggle('open')" class={`flex items-center gap-1 px-2 h-7 rounded-md border ${filterCount > 0 ? 'border-[#3ecf8e]/40' : 'border-[#27272a]'} ${funnelColor} hover:text-[#fafafa] hover:bg-white/[0.04] transition-all duration-150`}>
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          {filterCount > 0 && <span class="text-[#3ecf8e] text-xs font-medium ml-0.5">({filterCount})</span>}
        </button>
        <div class="hidden absolute left-0 top-full mt-1 py-1 bg-[#1a1a1e] border border-[#27272a] rounded-lg shadow-xl z-20 min-w-[160px]" id="filter-panel">
          {FILTER_OPTIONS.map(opt => {
            const isActive = activeFilters.has(opt.value);
            const nextFilters = isActive
              ? filters.filter(f => f !== opt.value)
              : [...filters, opt.value];
            const href = buildFilterParams(basePath, nextFilters);
            return (
              <a href={href} class={`flex items-center gap-2.5 px-3 py-1.5 text-[13px] ${isActive ? 'text-[#fafafa]' : 'text-[#999]'} hover:bg-white/[0.04] transition-colors duration-150`}>
                {isActive
                  ? <svg class="w-3.5 h-3.5 text-[#3ecf8e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  : <div class="w-3.5 h-3.5 rounded border border-[#555]"></div>
                }
                {' '}{opt.label}
              </a>
            );
          })}
        </div>
      </div>
      <style>{raw("#filter-dropdown.open #filter-panel { display: block; }")}</style>
      <script>{raw(`
        document.addEventListener('click', function(e) {
          var dd = document.getElementById('filter-dropdown');
          if (dd && !dd.contains(e.target)) dd.classList.remove('open');
        });
      `)}</script>
    </>
  );
}

export function Pagination({ basePath, filters, page, totalPages }: {
  basePath: string;
  filters: EpisodeFilter[];
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return <></>;

  return (
    <div class="flex items-center justify-center gap-2 mt-6">
      {page > 1 && <a href={buildFilterParams(basePath, filters, page - 1)} class="h-8 inline-flex items-center px-3 text-xs font-medium rounded-md border border-[#27272a] text-[#71717a] hover:text-[#fafafa] hover:bg-white/[0.04] transition-all duration-150">Previous</a>}
      <span class="text-xs text-[#555]">Page {page} of {totalPages}</span>
      {page < totalPages && <a href={buildFilterParams(basePath, filters, page + 1)} class="h-8 inline-flex items-center px-3 text-xs font-medium rounded-md border border-[#27272a] text-[#71717a] hover:text-[#fafafa] hover:bg-white/[0.04] transition-all duration-150">Next</a>}
    </div>
  );
}
