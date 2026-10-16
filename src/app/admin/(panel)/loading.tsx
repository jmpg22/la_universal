export default function Loading() {
  return (
    <div aria-busy className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-stone-200" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card h-24 animate-pulse bg-white" />
        ))}
      </div>
      <div className="card h-80 animate-pulse bg-white" />
    </div>
  );
}
