import { ABOUT } from './about.ts';
import { FILM } from './film.ts';
import { MUSIC } from './music.ts';
import { POST_SOUND } from './postSound.ts';
import type { CollectionConfig, DocumentConfig } from './types.ts';

export const COLLECTIONS: Record<string, CollectionConfig> = {
  [POST_SOUND.id]: POST_SOUND,
  [FILM.id]: FILM,
  [MUSIC.id]: MUSIC,
};

export const DOCUMENTS: Record<string, DocumentConfig> = {
  [ABOUT.id]: ABOUT,
};

export function getCollection(id: string): CollectionConfig | undefined {
  return COLLECTIONS[id];
}

export function getDocument(id: string): DocumentConfig | undefined {
  return DOCUMENTS[id];
}
