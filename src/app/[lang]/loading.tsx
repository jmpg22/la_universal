export default function Loading() {
  return (
    <div aria-busy>
      <div className="h-72 animate-pulse bg-gradient-to-br from-brand-700 to-brand-500 opacity-90 sm:h-96" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 h-10 w-full animate-pulse rounded-full bg-white shadow-sm" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-black/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
