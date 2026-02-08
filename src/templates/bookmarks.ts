import type { BookmarkWithEpisode } from "../db";
import { layout } from "./layout";
import { formatDuration, formatRelativeDate } from "./utils";

function generateBookmarkRow(bookmark: BookmarkWithEpisode): string {
  const subtitle = bookmark.episode_title
    ? `${bookmark.episode_title}${bookmark.podcast_title ? ` \u00b7 ${bookmark.podcast_title}` : ''}`
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
            ${active.length} bookmarks${deleted.length > 0 ? ` \u00b7 ${deleted.length} removed` : ''}
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

  return layout("Castkeeper \u2014 Bookmarks", password, content);
}
