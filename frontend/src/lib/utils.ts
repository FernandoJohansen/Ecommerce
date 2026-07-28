import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Busca acento- e caixa-insensível
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// "Difusor de Vidro" → "difusor-de-vidro" (usado nas URLs /produto/$slug)
export function slugify(texto: string): string {
  return normalizarBusca(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SUPABASE_STORAGE_MARKER = "/storage/v1/object/public/";

/**
 * For Supabase Storage URLs, returns a srcset using the built-in image
 * transform API (?width=N&format=webp). Returns undefined for bundled static
 * assets (data URIs, blob: or relative paths) which have no transform endpoint.
 */
export function supabaseSrcSet(
  url: string,
  widths: number[] = [400, 800, 1200],
): string | undefined {
  if (!url.includes(SUPABASE_STORAGE_MARKER)) return undefined;
  const base = url.split("?")[0];
  return widths.map((w) => `${base}?width=${w}&format=webp ${w}w`).join(", ");
}
