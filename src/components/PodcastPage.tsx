import type { StoredEpisode } from "../schema";
import type { PodcastWithStats, BookmarkWithEpisode, EpisodeFilter } from "../db";
import { Layout } from "./Layout";
import { EpisodeRow, FilterDropdown, Pagination, Tooltip } from "./EpisodeList";
import { BookmarkRow } from "./BookmarkList";
import { formatDuration, formatRelativeDate } from "../utils";

export function PodcastPage({ podcast, episodes, totalEpisodes, page, perPage, filters = [], bookmarks = [] }: {
  podcast: PodcastWithStats;
  episodes: StoredEpisode[];
  totalEpisodes: number;
  page: number;
  perPage: number;
  filters?: EpisodeFilter[];
  bookmarks?: BookmarkWithEpisode[];
}) {
  const totalPages = Math.ceil(totalEpisodes / perPage);
  const basePath = `/podcast/${podcast.uuid}`;
  const activeBookmarks = bookmarks.filter(b => b.deleted_at === null);
  const deletedBookmarks = bookmarks.filter(b => b.deleted_at !== null);
  const hasBookmarks = bookmarks.length > 0;
  const hasFilters = filters.length > 0;

  return (
    <Layout title={`Castkeeper — ${podcast.title}`}>
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-base font-semibold text-[#fafafa] tracking-tight">{podcast.title}</h1>
          {podcast.deleted_at && (
            <span class="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Removed</span>
          )}
        </div>
        {podcast.author && <p class="text-[#71717a] text-sm">{podcast.author}</p>}
        {podcast.url && (
          <a href={podcast.url} target="_blank" rel="noopener noreferrer" class="inline-block mt-1 text-xs text-[#555] hover:text-[#999] transition-colors duration-150 no-underline truncate max-w-md">{podcast.url}</a>
        )}
        {podcast.description && <p class="text-[#999] text-sm mt-2 leading-relaxed">{podcast.description}</p>}
        <div class="mt-4 pt-4 border-t border-white/[0.06] text-xs text-[#555] space-y-1">
          {podcast.total_episodes > 0 && (
            <p>{podcast.total_episodes} {podcast.total_episodes === 1 ? 'episode' : 'episodes'}{podcast.total_played_time > 0 && ` \u00b7 ${formatDuration(podcast.total_played_time)} listened`}</p>
          )}
          <p>Subscribed {formatRelativeDate(podcast.date_added)}{podcast.last_episode_published && ` \u00b7 Last published ${formatRelativeDate(podcast.last_episode_published)}`}</p>
        </div>
      </div>

      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-sm font-medium text-[#fafafa]">Episodes</h2>
          <FilterDropdown basePath={basePath} filters={filters} />
        </div>
        {hasFilters
          ? <span class="text-xs text-[#71717a]">{totalEpisodes} matching</span>
          : <Tooltip label={`${totalEpisodes} episodes you've interacted with out of ${podcast.episode_count} published`}>
              <span class="text-xs text-[#71717a] cursor-default border-b border-dotted border-[#555]">{totalEpisodes} of {podcast.episode_count} tracked</span>
            </Tooltip>
        }
      </div>

      {episodes.length === 0 && hasFilters ? (
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <p class="text-[#71717a] text-sm">No episodes match these filters</p>
          <a href={basePath} class="text-[#3ecf8e] text-sm mt-2 hover:underline">Clear filters</a>
        </div>
      ) : (
        <div>
          {episodes.map(ep => <EpisodeRow episode={ep} showPodcast={false} />)}
        </div>
      )}

      <Pagination basePath={basePath} filters={filters} page={page} totalPages={totalPages} />

      {hasBookmarks && (
        <div class="mt-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-[#fafafa]">Bookmarks</h2>
            <span class="text-xs text-[#71717a]">
              {activeBookmarks.length} bookmarks{deletedBookmarks.length > 0 && ` \u00b7 ${deletedBookmarks.length} removed`}
            </span>
          </div>
          <div>
            {activeBookmarks.map(b => <BookmarkRow bookmark={b} showPodcast={false} />)}
          </div>
          {deletedBookmarks.length > 0 && (
            <>
              <div class="flex items-center gap-3 mt-5 mb-2"><span class="text-[11px] uppercase tracking-wider text-[#71717a] font-medium whitespace-nowrap">Removed</span><div class="h-px bg-white/[0.06] flex-1"></div></div>
              <div>
                {deletedBookmarks.map(b => <div class="opacity-60"><BookmarkRow bookmark={b} showPodcast={false} /></div>)}
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
