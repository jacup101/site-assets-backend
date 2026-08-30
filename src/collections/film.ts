import type { CollectionConfig } from './types.ts';

// Ported from brandon-site/admin/server/collections.ts (FILM). `slug` is
// dropped from the field list here — it's a dedicated column on the
// `entries` table in this backend, not a data field, since D1 storage
// doesn't need it folded into the JSON blob the way brandon-site's
// file-based storage did.
export const FILM: CollectionConfig = {
  id: 'film',
  label: 'Film',
  titleField: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'year', label: 'Year', type: 'text' },
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'blurb', label: 'Blurb (list view)', type: 'textarea' },
    { key: 'description', label: 'Description (detail page)', type: 'textarea' },
    { key: 'imgPath', label: 'Image', type: 'image' },
    { key: 'imgContain', label: 'Fit image (don’t crop to fill)', type: 'checkbox' },
    { key: 'subtitleLayout', label: 'Subtitle layout', type: 'checkbox' },
    { key: 'videoUrl', label: 'Video embed URL', type: 'url' },
    { key: 'imdbUrl', label: 'IMDb URL', type: 'url' },
    { key: 'heroImg', label: 'Hero image', type: 'image' },
    { key: 'galleryColumns', label: 'Gallery columns', type: 'number' },
    { key: 'credit', label: 'Credit footer line', type: 'textarea' },
    {
      key: 'credits',
      label: 'Credits',
      type: 'array',
      itemLabel: 'Credit',
      fields: [
        { key: 'role', label: 'Role', type: 'text', required: true },
        { key: 'names', label: 'Names', type: 'text', required: true },
      ],
    },
    {
      key: 'laurels',
      label: 'Laurel images',
      type: 'array',
      itemLabel: 'Laurel image',
      fields: [{ key: 'value', label: 'Image', type: 'image', required: true }],
    },
    {
      key: 'gallery',
      label: 'Gallery',
      type: 'array',
      itemLabel: 'Gallery item',
      fields: [
        {
          key: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          options: [
            { value: 'video', label: 'Video (YouTube embed URL)' },
            { value: 'link', label: 'Link' },
            { value: 'image', label: 'Image' },
            { value: 'instagram', label: 'Instagram embed' },
          ],
        },
        { key: 'url', label: 'URL', type: 'url', required: true },
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'role', label: 'Role', type: 'text' },
        { key: 'imgPath', label: 'Image', type: 'image' },
      ],
    },
  ],
};
