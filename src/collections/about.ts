import type { DocumentConfig } from './types.ts';

// Ported from brandon-site/admin/server/about.ts. Unlike that version,
// `portraitImage` and `stripImages` don't need special-cased multi-file
// upload handling here — since image upload is a decoupled endpoint in
// this backend, they're just ordinary `image` fields like everything else.
export const ABOUT: DocumentConfig = {
  id: 'about',
  label: 'About',
  fields: [
    {
      key: 'bioParagraphs',
      label: 'Bio paragraphs',
      type: 'array',
      itemLabel: 'Paragraph',
      fields: [{ key: 'value', label: 'Text', type: 'textarea', required: true }],
    },
    { key: 'portraitImage', label: 'Portrait', type: 'image', required: true },
    {
      key: 'stripImages',
      label: 'Strip photos',
      type: 'array',
      itemLabel: 'Strip photo',
      fields: [
        { key: 'path', label: 'Image', type: 'image', required: true },
        {
          key: 'cropTop',
          label: 'Crop from top (for photos with little headroom)',
          type: 'checkbox',
        },
      ],
    },
    {
      key: 'socialLinks',
      label: 'Social links',
      type: 'array',
      itemLabel: 'Social link',
      fields: [
        {
          key: 'iconClass',
          label: 'Icon',
          type: 'select',
          required: true,
          options: [
            { value: 'social-link-icon-instagram', label: 'Instagram' },
            { value: 'social-link-icon-imdb', label: 'IMDb' },
            { value: 'social-link-icon-youtube', label: 'YouTube' },
            { value: 'social-link-icon-bandcamp', label: 'Bandcamp' },
          ],
        },
        { key: 'ariaLabel', label: 'Label', type: 'text', required: true },
        { key: 'href', label: 'URL', type: 'url', required: true },
      ],
    },
  ],
};
