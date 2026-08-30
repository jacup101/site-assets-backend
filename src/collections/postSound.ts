import type { CollectionConfig } from './types.ts';

// Ported from brandon-site/admin/server/collections.ts (POST_SOUND).
export const POST_SOUND: CollectionConfig = {
  id: 'post-sound',
  label: 'Post-Sound',
  titleField: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'role', label: 'Role', type: 'text', required: true },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      required: true,
      options: [
        { value: 'Feature', label: 'Feature' },
        { value: 'Short', label: 'Short' },
        { value: 'Vertical', label: 'Vertical' },
      ],
    },
    { key: 'year', label: 'Year', type: 'text' },
    { key: 'link', label: 'Link', type: 'url' },
    { key: 'imgPath', label: 'Image', type: 'image', required: true },
    { key: 'featured', label: 'Featured', type: 'checkbox' },
  ],
};
