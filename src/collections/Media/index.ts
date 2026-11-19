import type { CollectionConfig } from 'payload'
import { anyone } from '@/access/roles'
import { allowAnywhere, hideUnless } from '@/access/permissions'

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
  access: {
    create: allowAnywhere('media', 'create'),
    read: anyone,
    update: allowAnywhere('media', 'update'),
    delete: allowAnywhere('media', 'delete'),
  },
  admin: { useAsTitle: 'filename', hidden: hideUnless('media') },
  fields: [
    { name: 'alt', type: 'text' },
    { name: 'caption', type: 'text' },
  ],
}
export default Media
