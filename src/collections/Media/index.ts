import type { CollectionConfig } from 'payload'
import { anyone, isAnyTenantAdmin } from '@/access/roles'

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
    create: isAnyTenantAdmin,
    read: anyone,
    update: isAnyTenantAdmin,
    delete: isAnyTenantAdmin,
  },
  admin: { useAsTitle: 'filename' },
  fields: [
    { name: 'alt', type: 'text' },
    { name: 'caption', type: 'text' },
  ],
}
export default Media
