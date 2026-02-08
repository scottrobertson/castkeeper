import type { StoredEpisode } from "../schema";
import type { EpisodeFilter } from "../db";
import { Layout } from "./Layout";
import { GroupedEpisodes, FilterDropdown, Pagination, buildFilterParams } from "./EpisodeList";

export function EpisodesPage({ episodes, totalEpisodes, page, perPage, filters = [] }: {
  episodes: StoredEpisode[];
  totalEpisodes: number;
  page: number;
  perPage: number;
  filters?: EpisodeFilter[];
}) {
  const totalPages = Math.ceil(totalEpisodes / perPage);

  return (
    <Layout title="Castkeeper — Episodes">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h1 class="text-base font-semibold text-[#fafafa] tracking-tight">Episodes</h1>
          <FilterDropdown basePath="/episodes" filters={filters} />
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-[#71717a]">{totalEpisodes} episodes</span>
          <a href={buildFilterParams("/export", filters)} class="h-8 inline-flex items-center px-3 text-xs font-medium rounded-md border border-[#27272a] text-[#fafafa] hover:bg-white/[0.04] transition-all duration-150">Download CSV</a>
        </div>
      </div>

      {episodes.length === 0 && filters.length > 0 ? (
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <p class="text-[#71717a] text-sm">No episodes match these filters</p>
          <a href="/episodes" class="text-[#3ecf8e] text-sm mt-2 hover:underline">Clear filters</a>
        </div>
      ) : (
        <div>
          <GroupedEpisodes episodes={episodes} />
        </div>
      )}

      <Pagination basePath="/episodes" filters={filters} page={page} totalPages={totalPages} />
    </Layout>
  );
}
