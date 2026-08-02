import type { ImageMetadata } from 'astro';
import raw from './content.json';
import type { CategoryKey } from './site';

export type Photo = { file: string; alt: string; new: string };

export type Entry = {
  old: string;
  slug: string;
  title: string;
  h1: string;
  description: string;
  category: string;
  cat: CategoryKey;
  bodyHtml: string;
  text: string;
  clean: string;
  images: Photo[];
};

const photoModules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/photos/*.{jpg,jpeg,png}',
  { eager: true }
);

/** Resolve a photo filename to its processed ImageMetadata. */
export function photo(name: string): ImageMetadata | undefined {
  return photoModules[`../assets/photos/${name}`]?.default;
}

export const realisations = raw.realisations as unknown as Entry[];
export const details = raw.details as unknown as Entry[];
export const conseils = raw.conseils as unknown as Entry[];
export const droppedUrls = raw.drop as string[];

export const byCategory = (cat: CategoryKey) =>
  realisations.filter((r) => r.cat === cat);

/** First photo of an entry, used for cards and social previews. */
export const cover = (e: Entry) => (e.images.length ? photo(e.images[0].new) : undefined);

/** Short teaser derived from the body copy. */
export function excerpt(e: Entry, max = 165): string {
  const t = (e.clean || e.text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}
