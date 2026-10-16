export function normalizeText(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** true si todas las palabras de la búsqueda aparecen en el texto, sin importar acentos ni mayúsculas. */
export function matchesQuery(text: string, query: string) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeText(text);
  return words.every((w) => haystack.includes(w));
}
