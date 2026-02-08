import type { PodcastWithStats } from "../db";
import { Layout } from "./Layout";
import { formatDuration, formatRelativeDate } from "../utils";

const PODCAST_GRID = '1fr 64px 56px 100px 80px';

function PodcastHeaderRow() {
  return (
    <div class="grid items-center px-3 h-8 border-b border-white/[0.06]" style={`grid-template-columns: ${PODCAST_GRID}; gap: 8px`}>
      <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Podcast</div>
      <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Episodes</div>
      <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Tracked</div>
      <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Listened</div>
      <div class="text-[11px] uppercase tracking-wider text-[#555] font-medium">Added</div>
    </div>
  );
}

function PodcastRow({ podcast }: { podcast: PodcastWithStats }) {
  const href = `/podcast/${podcast.uuid}`;

  return (
    <div class="grid items-center px-3 h-[52px] border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150" style={`grid-template-columns: ${PODCAST_GRID}; gap: 8px`}>
      <div class="min-w-0">
        <div class="truncate"><a href={href} class="text-[#ededef] hover:text-[#fafafa] text-[13px] font-medium underline decoration-[#333] hover:decoration-[#555] transition-colors duration-150">{podcast.title}</a></div>
        <div class="text-[#71717a] text-xs truncate">{podcast.author}</div>
      </div>
      <div class="text-[#71717a] text-xs">{podcast.episode_count || '\u2014'}</div>
      <div class="text-[#71717a] text-xs">{podcast.total_episodes || '\u2014'}</div>
      <div class="text-[#71717a] text-xs">{podcast.total_played_time > 0 ? formatDuration(podcast.total_played_time) : '\u2014'}</div>
      <div class="text-[#555] text-xs">{formatRelativeDate(podcast.date_added)}</div>
    </div>
  );
}

export function PodcastsPage({ podcasts }: { podcasts: PodcastWithStats[] }) {
  const active = podcasts.filter(p => p.deleted_at === null);
  const deleted = podcasts.filter(p => p.deleted_at !== null);

  return (
    <Layout title="Castkeeper — Podcasts">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-base font-semibold text-[#fafafa] tracking-tight">Podcasts</h1>
        <span class="text-xs text-[#71717a]">
          {active.length} subscribed{deleted.length > 0 && ` \u00b7 ${deleted.length} removed`}
        </span>
      </div>
      <div class="overflow-x-auto"><div class="min-w-[540px]">
        <PodcastHeaderRow />
        {active.map(p => <PodcastRow podcast={p} />)}
      </div></div>
      {deleted.length > 0 && (
        <>
          <div class="flex items-center gap-3 mt-5 mb-2"><span class="text-[11px] uppercase tracking-wider text-[#71717a] font-medium whitespace-nowrap">Removed</span><div class="h-px bg-white/[0.06] flex-1"></div></div>
          <div class="overflow-x-auto"><div class="min-w-[540px]">
            {deleted.map(p => <div class="opacity-60"><PodcastRow podcast={p} /></div>)}
          </div></div>
        </>
      )}
    </Layout>
  );
}
