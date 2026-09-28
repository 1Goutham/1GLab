export default function Loading() {
  return (
    <div aria-busy className="space-y-10">
      <div className="space-y-3">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-10 w-2/3 max-w-lg" />
        <div className="skeleton h-4 w-1/2 max-w-md" />
      </div>
      <div className="space-y-px">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-6 border-t border-line py-6">
            <div className="skeleton h-8 w-8" />
            <div className="flex-1 space-y-2.5">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-5 w-1/2" />
              <div className="skeleton h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
