import type { HistoryResponse, PodcastListResponse, BookmarkListResponse } from "./types";

export async function getListenHistory(token: string): Promise<HistoryResponse> {
  const res = await fetch(
    "https://api.pocketcasts.com/user/history?limit=200",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    console.log(await res.text());
    throw new Error("Failed to fetch listen history");
  }
  return await res.json() as HistoryResponse;
}

export async function getPodcastList(token: string): Promise<PodcastListResponse> {
  const res = await fetch(
    "https://api.pocketcasts.com/user/podcast/list",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) {
    console.log(await res.text());
    throw new Error("Failed to fetch podcast list");
  }
  return await res.json() as PodcastListResponse;
}

export async function getBookmarks(token: string): Promise<BookmarkListResponse> {
  const res = await fetch(
    "https://api.pocketcasts.com/user/bookmark/list",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) {
    console.log(await res.text());
    throw new Error("Failed to fetch bookmarks");
  }
  return await res.json() as BookmarkListResponse;
}
