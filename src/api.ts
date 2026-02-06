import type { PodcastEpisodesResponse, CachePodcastResponse, PodcastListResponse, BookmarkListResponse } from "./types";

export async function getEpisodeSyncData(token: string, podcastUuid: string): Promise<PodcastEpisodesResponse> {
  const res = await fetch(
    "https://api.pocketcasts.com/user/podcast/episodes",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uuid: podcastUuid }),
    }
  );

  if (!res.ok) {
    console.log(await res.text());
    throw new Error(`Failed to fetch episode sync data for ${podcastUuid}`);
  }
  return await res.json() as PodcastEpisodesResponse;
}

export async function getPodcastEpisodeMetadata(podcastUuid: string): Promise<CachePodcastResponse> {
  const res = await fetch(
    `https://cache.pocketcasts.com/mobile/podcast/full/${podcastUuid}`,
    {
      method: "GET",
      redirect: "follow",
    }
  );

  if (!res.ok) {
    console.log(await res.text());
    throw new Error(`Failed to fetch podcast metadata for ${podcastUuid}`);
  }
  return await res.json() as CachePodcastResponse;
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
