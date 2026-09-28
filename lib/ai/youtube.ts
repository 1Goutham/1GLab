import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";

/**
 * Video recommendations for a topic.
 *
 * Curated resources (seeded, each with a "why watch this") are always the
 * baseline. With YOUTUBE_API_KEY set, the "search" entries are resolved into
 * concrete videos from the named channel via the YouTube Data API, and cached
 * as `youtube_api` rows. Learner feedback re-ranks everything: not-useful
 * videos sink, channels that were useful before float up.
 *
 * Nothing in the app depends on the API being available.
 */
export type VideoView = typeof s.videoResources.$inferSelect & {
  watched: boolean;
  rating: "useful" | "not_useful" | null;
  embedId: string | null;
};

export function youtubeId(url: string): string | null {
  const m = url.match(/[?&]v=([\w-]{11})/) ?? url.match(/youtu\.be\/([\w-]{11})/);
  return m ? m[1] : null;
}

async function resolveSearch(video: typeof s.videoResources.$inferSelect, key: string) {
  const q = new URL(video.url).searchParams.get("search_query");
  if (!q) return null;
  const api = new URL("https://www.googleapis.com/youtube/v3/search");
  api.search = new URLSearchParams({ part: "snippet", type: "video", maxResults: "3", q, relevanceLanguage: "en", videoEmbeddable: "true", key }).toString();
  const res = await fetch(api, { next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }[] };
  const channelWord = video.channel.toLowerCase().split(" ")[0];
  const pick = data.items?.find((i) => i.snippet.channelTitle.toLowerCase().includes(channelWord)) ?? data.items?.[0];
  if (!pick) return null;
  const decoded = pick.snippet.title.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const [row] = await db
    .insert(s.videoResources)
    .values({
      topicId: video.topicId,
      title: decoded,
      channel: pick.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${pick.id.videoId}`,
      kind: "video",
      reason: video.reason,
      source: "youtube_api",
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function videosForTopic(topicId: string, userId: string): Promise<VideoView[]> {
  let videos = await db.select().from(s.videoResources).where(eq(s.videoResources.topicId, topicId));
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    const resolved = new Set(videos.filter((v) => v.source === "youtube_api").map((v) => v.reason));
    for (const v of videos.filter((v) => v.kind === "search" && !resolved.has(v.reason))) {
      try {
        const row = await resolveSearch(v, key);
        if (row) videos.push(row);
      } catch {
        /* keep the curated search link */
      }
    }
    // A resolved video replaces its search placeholder.
    const replaced = new Set(videos.filter((v) => v.source === "youtube_api").map((v) => v.reason));
    videos = videos.filter((v) => !(v.kind === "search" && replaced.has(v.reason)));
  }

  const fb = await db.select().from(s.videoFeedback).where(eq(s.videoFeedback.userId, userId));
  const byVideo = new Map(fb.map((f) => [f.videoId, f]));
  // Channel affinity from past feedback across all topics.
  const allVideos = fb.length ? await db.select({ id: s.videoResources.id, channel: s.videoResources.channel }).from(s.videoResources) : [];
  const affinity = new Map<string, number>();
  for (const f of fb) {
    const ch = allVideos.find((v) => v.id === f.videoId)?.channel;
    if (!ch || !f.rating) continue;
    affinity.set(ch, (affinity.get(ch) ?? 0) + (f.rating === "useful" ? 1 : -1));
  }
  const score = (v: typeof s.videoResources.$inferSelect) => {
    const f = byVideo.get(v.id);
    return (f?.rating === "not_useful" ? -10 : 0) + (f?.rating === "useful" ? 3 : 0) + (affinity.get(v.channel) ?? 0) + (v.kind === "video" ? 1 : 0);
  };
  return videos
    .sort((a, b) => score(b) - score(a))
    .map((v) => ({
      ...v,
      watched: byVideo.get(v.id)?.watched ?? false,
      rating: byVideo.get(v.id)?.rating ?? null,
      embedId: v.kind === "video" ? youtubeId(v.url) : null,
    }));
}
