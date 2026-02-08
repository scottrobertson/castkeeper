import type { BookmarkWithEpisode } from "../db";
import { Tooltip } from "./EpisodeList";
import { formatDuration, formatRelativeDate } from "../utils";

export function BookmarkRow({ bookmark, showPodcast = true }: { bookmark: BookmarkWithEpisode; showPodcast?: boolean }) {
  const podcastHref = `/podcast/${bookmark.podcast_uuid}`;
  const columns = showPodcast
    ? '12px 1fr 200px 200px 80px 80px'
    : '12px 1fr 1fr 80px 80px';

  return (
    <div class="grid items-center pr-1 sm:pr-3 h-[52px] border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150" style={`grid-template-columns: ${columns}; gap: 8px`}>
      <div class="flex justify-center"><svg class="w-3 h-3 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z" /></svg></div>
      <Tooltip label={bookmark.title}>
        <div class="text-[#ededef] text-[13px] font-medium truncate min-w-0 cursor-default">{bookmark.title}</div>
      </Tooltip>
      <Tooltip label={bookmark.episode_title || 'Unknown episode'}>
        <div class="text-[#71717a] text-xs truncate min-w-0 cursor-default">{bookmark.episode_title || <span class="text-[#555]">Unknown episode</span>}</div>
      </Tooltip>
      {showPodcast && (
        <Tooltip label={bookmark.podcast_title || 'Unknown podcast'}>
          <div class="text-[#71717a] text-xs truncate min-w-0">
            {bookmark.podcast_title
              ? <a href={podcastHref} class="hover:text-[#fafafa] underline decoration-[#333] hover:decoration-[#555] transition-colors duration-150">{bookmark.podcast_title}</a>
              : <span class="text-[#555]">Unknown podcast</span>}
          </div>
        </Tooltip>
      )}
      <div class="text-[#71717a] text-xs">{formatDuration(bookmark.time)}</div>
      <div class="text-[#555] text-xs text-right whitespace-nowrap">{formatRelativeDate(bookmark.created_at)}</div>
    </div>
  );
}
