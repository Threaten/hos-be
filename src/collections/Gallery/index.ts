import type { CollectionConfig } from 'payload'
import { anyone, byTenantRole, createForTenantRole } from '@/access/roles'

export const Gallery: CollectionConfig = {
  slug: 'gallery',
  access: {
    create: createForTenantRole('branch', 'tenant-admin'),
    read: anyone,
    update: byTenantRole('branch', 'tenant-admin'),
    delete: byTenantRole('branch', 'tenant-admin'),
  },
  admin: {
    useAsTitle: 'image',
  },
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'caption',
      type: 'text',
      required: false,
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'tenants',
    },
  ],
}
