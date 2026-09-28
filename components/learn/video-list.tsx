"use client";

import { useState, useTransition } from "react";
import { Check, Play, Search, ThumbsDown, Star } from "lucide-react";
import { videoFeedback } from "@/lib/actions/daily";
import { cn } from "@/lib/cn";

type V = {
  id: number;
  title: string;
  channel: string;
  url: string;
  kind: "video" | "search";
  minutes: number | null;
  reason: string;
  watched: boolean;
  rating: "useful" | "not_useful" | null;
  embedId: string | null;
};

/**
 * Videos come with a reason to watch — never a wall of embeds. Feedback
 * (watched / useful / not useful) re-ranks future recommendations.
 */
export function VideoList({ videos }: { videos: V[] }) {
  return (
    <ul className="mt-5 border-b border-line">
      {videos.map((v) => (
        <VideoRow key={v.id} v={v} />
      ))}
    </ul>
  );
}

function VideoRow({ v }: { v: V }) {
  const [state, setState] = useState({ watched: v.watched, rating: v.rating });
  const [playing, setPlaying] = useState(false);
  const [, start] = useTransition();
  const send = (patch: { watched?: boolean; rating?: "useful" | "not_useful" | null }) => {
    setState((s) => ({ watched: patch.watched ?? s.watched, rating: patch.rating === undefined ? s.rating : patch.rating }));
    start(async () => void (await videoFeedback({ videoId: v.id, ...patch })));
  };

  return (
    <li className={cn("row-line border-t border-line py-5", state.rating === "not_useful" && "opacity-50")}>
      <div className="flex gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-line-strong text-muted">
          {v.kind === "video" ? <Play className="size-4" /> : <Search className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-[15px] text-fg">{v.title}</span>
            <span className="font-mono text-[11px] text-faint">
              {v.channel}
              {v.minutes ? ` · ${v.minutes} min` : ""}
            </span>
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
            <span className="text-faint">Why watch — </span>
            {v.reason}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {v.embedId ? (
              <button onClick={() => { setPlaying((p) => !p); if (!state.watched) send({ watched: true }); }} className="bracket text-[12.5px]">
                <span className="bracket-l">[</span>
                <span className="bracket-t">{playing ? "Close player" : `Watch${v.minutes ? ` ${v.minutes} min` : ""}`}</span>
                <span className="bracket-r">]</span>
              </button>
            ) : (
              <a href={v.url} target="_blank" rel="noopener noreferrer" className="bracket text-[12.5px]" onClick={() => !state.watched && v.kind === "video" && send({ watched: true })}>
                <span className="bracket-l">[</span>
                <span className="bracket-t">{v.kind === "search" ? `Find on YouTube` : "Watch"}</span>
                <span className="bracket-r">]</span>
              </a>
            )}
            <span className="mx-1 h-3 w-px bg-line-strong" />
            <Toggle on={state.watched} onClick={() => send({ watched: !state.watched })} icon={<Check className="size-3" />} label="Watched" />
            <Toggle on={state.rating === "useful"} onClick={() => send({ rating: state.rating === "useful" ? null : "useful" })} icon={<Star className="size-3" />} label="Useful" />
            <Toggle on={state.rating === "not_useful"} onClick={() => send({ rating: state.rating === "not_useful" ? null : "not_useful" })} icon={<ThumbsDown className="size-3" />} label="Not useful" bad />
          </div>
          {playing && v.embedId && (
            <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl border border-line">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${v.embedId}?autoplay=1&rel=0`}
                title={v.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Toggle({ on, onClick, icon, label, bad }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; bad?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "tactile flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px]",
        on ? (bad ? "border-bad/40 text-bad" : "border-accent/40 bg-accent/10 text-accent") : "border-line text-faint hover:text-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
