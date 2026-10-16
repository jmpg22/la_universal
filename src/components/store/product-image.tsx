// Foto del producto o, si no tiene, el emoji de su categoría sobre un fondo suave.
const TINTS = ["bg-amber-50", "bg-emerald-50", "bg-sky-50", "bg-rose-50", "bg-lime-50", "bg-orange-50", "bg-teal-50"];

export function ProductImage({
  name,
  imageUrl,
  emoji,
  seed,
  className = "",
  emojiClassName = "text-5xl",
}: {
  name: string;
  imageUrl: string | null;
  emoji?: string | null;
  seed: number;
  className?: string;
  emojiClassName?: string;
}) {
  if (imageUrl) {
    return (
      // Las fotos pueden venir de /uploads o de una URL externa; se muestran tal cual.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt={name} loading="lazy" className={`object-cover ${className}`} />
    );
  }
  return (
    <div
      role="img"
      aria-label={name}
      className={`flex items-center justify-center ${TINTS[seed % TINTS.length]} ${className}`}
    >
      <span className={emojiClassName} aria-hidden>
        {emoji ?? "🛒"}
      </span>
    </div>
  );
}
