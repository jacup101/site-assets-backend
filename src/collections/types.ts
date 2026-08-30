// Ported from brandon-site's admin/server/collections.ts. The shape is the
// same (a field schema drives both server-side validation and a future
// UI's form rendering), but there's no more `dataFile`/`imageDir` per
// collection — storage is generic (the `entries`/`documents` tables), and
// there's no more special-cased "primaryImage" upload handling either: now
// that image upload is its own decoupled endpoint (POST /sites/:id/assets,
// fed an already browser-compressed file), any field can just be typed
// `image` — it holds a URL/key string like any other field, the same way
// `laurels`/`bannerImages`/etc. arrays-of-images work.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'image'
  | 'array';

export interface FieldSchema {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[]; // 'select' only
  fields?: FieldSchema[]; // 'array' only — sub-schema for each row
  itemLabel?: string; // 'array' only — e.g. "Credit", "Gallery item"
}

export interface CollectionConfig {
  id: string;
  label: string;
  titleField: string;
  fields: FieldSchema[];
}

export interface DocumentConfig {
  id: string;
  label: string;
  fields: FieldSchema[];
}
