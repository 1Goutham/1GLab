import { Bracket } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">404</div>
        <h1 className="mt-4 font-display text-3xl font-light text-white">That page isn&apos;t on the roadmap.</h1>
        <div className="mt-8">
          <Bracket href="/">Back to today&apos;s mission</Bracket>
        </div>
      </div>
    </div>
  );
}
