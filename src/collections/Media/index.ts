import type { CollectionConfig } from 'payload'

const Media: CollectionConfig = {
  slug: 'media',
  folders: true,
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'video/*', 'application/pdf'],
    focalPoint: true,
    formatOptions: {
      format: 'webp',
    },
  },
  access: { read: () => true },
  admin: { useAsTitle: 'filename' },
  fields: [
    { name: 'alt', type: 'text' },
    { name: 'caption', type: 'text' },
  ],
}
export default Media
