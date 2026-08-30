import type { CollectionConfig } from './types.ts';

// Ported from brandon-site/admin/server/collections.ts (MUSIC). `slug` is
// dropped for the same reason as film.ts — it's a dedicated column here.
export const MUSIC: CollectionConfig = {
  id: 'music',
  label: 'Music',
  titleField: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    {
      key: 'groupId',
      label: 'Section',
      type: 'select',
      required: true,
      options: [
        { value: 'featured-projects', label: 'Featured Projects' },
        { value: 'collaborations', label: 'Collaborations' },
      ],
    },
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'year', label: 'Year', type: 'text' },
    { key: 'albumName', label: 'Album name', type: 'text' },
    { key: 'imgPath', label: 'Image', type: 'image' },
    { key: 'description', label: 'Description (list view)', type: 'textarea', required: true },
    { key: 'detailDescription', label: 'Description (detail page)', type: 'textarea' },
    { key: 'videoUrl', label: 'Video embed URL', type: 'url' },
    { key: 'pdfUrl', label: 'PDF path', type: 'text' },
    { key: 'spotifyEmbedUrl', label: 'Spotify embed URL', type: 'url' },
    { key: 'appleMusicEmbedUrl', label: 'Apple Music embed URL', type: 'url' },
    { key: 'bandcampEmbedUrl', label: 'Bandcamp embed URL', type: 'url' },
    { key: 'bandcampEmbedHeight', label: 'Bandcamp embed height', type: 'number' },
    { key: 'tidalEmbedUrl', label: 'Tidal embed URL', type: 'url' },
    { key: 'soundcloudEmbedUrl', label: 'SoundCloud embed URL', type: 'url' },
    {
      key: 'embedLayout',
      label: 'Embed layout',
      type: 'select',
      options: [
        { value: '', label: 'Default (stacked)' },
        { value: 'side-by-side', label: 'Side by side' },
      ],
    },
    {
      key: 'bannerLayout',
      label: 'Banner layout',
      type: 'select',
      options: [
        { value: '', label: 'Default' },
        { value: 'vertical', label: 'Vertical' },
      ],
    },
    {
      key: 'extraVideoUrls',
      label: 'Extra video embed URLs',
      type: 'array',
      itemLabel: 'Video URL',
      fields: [{ key: 'value', label: 'URL', type: 'url', required: true }],
    },
    {
      key: 'bannerImages',
      label: 'Banner images',
      type: 'array',
      itemLabel: 'Banner image',
      fields: [{ key: 'value', label: 'Image', type: 'image', required: true }],
    },
    {
      key: 'carouselImages',
      label: 'Carousel images',
      type: 'array',
      itemLabel: 'Carousel image',
      fields: [{ key: 'value', label: 'Image', type: 'image', required: true }],
    },
    {
      key: 'links',
      label: 'Links',
      type: 'array',
      itemLabel: 'Link',
      fields: [
        { key: 'label', label: 'Label', type: 'text', required: true },
        { key: 'href', label: 'URL', type: 'url', required: true },
      ],
    },
  ],
};
