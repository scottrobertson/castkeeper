import type { BookmarkWithEpisode } from "../db";
import { Layout } from "./Layout";
import { BookmarkRow } from "./BookmarkList";

export function BookmarksPage({ bookmarks, password }: { bookmarks: BookmarkWithEpisode[]; password: string | null }) {
  const active = bookmarks.filter(b => b.deleted_at === null);
  const deleted = bookmarks.filter(b => b.deleted_at !== null);

  return (
    <Layout title="Castkeeper — Bookmarks" password={password}>
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-base font-semibold text-[#fafafa] tracking-tight">Bookmarks</h1>
        <span class="text-xs text-[#71717a]">
          {active.length} bookmarks{deleted.length > 0 && ` \u00b7 ${deleted.length} removed`}
        </span>
      </div>
      <div>
        {active.map(b => <BookmarkRow bookmark={b} password={password} />)}
      </div>
      {deleted.length > 0 && (
        <>
          <div class="flex items-center gap-3 mt-5 mb-2"><span class="text-[11px] uppercase tracking-wider text-[#71717a] font-medium whitespace-nowrap">Removed</span><div class="h-px bg-white/[0.06] flex-1"></div></div>
          <div>
            {deleted.map(b => <div class="opacity-60"><BookmarkRow bookmark={b} password={password} /></div>)}
          </div>
        </>
      )}
    </Layout>
  );
}
