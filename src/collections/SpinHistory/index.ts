import type { CollectionConfig } from 'payload'
import { anyone, byTenantRole } from '@/access/roles'

export const SpinHistory: CollectionConfig = {
  slug: 'spin-history',
  access: {
    // Public lucky wheel records spins
    create: anyone,
    read: byTenantRole('branch'),
    update: () => false,
    delete: byTenantRole('branch', 'tenant-admin'),
  },
  admin: {
    useAsTitle: 'reward',
    defaultColumns: ['occurredAt', 'reward', 'branch'],
  },
  fields: [
    {
      name: 'occurredAt',
      label: 'Time Occurred',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'dd/MM/yyyy HH:mm:ss',
        },
      },
    },
    {
      name: 'reward',
      label: 'Reward Content',
      type: 'text',
      required: true,
    },
    {
      name: 'branch',
      label: 'Branch',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
  ],
}
