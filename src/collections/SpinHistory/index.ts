import type { CollectionConfig } from 'payload'
import { anyone } from '@/access/roles'
import { allowAt, hideUnless } from '@/access/permissions'

export const SpinHistory: CollectionConfig = {
  slug: 'spin-history',
  access: {
    // Public lucky wheel records spins
    create: anyone,
    read: allowAt('spinHistory', 'read'),
    update: () => false,
    delete: allowAt('spinHistory', 'delete'),
  },
  admin: {
    useAsTitle: 'reward',
    hidden: hideUnless('spinHistory'),
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
