import type { CollectionConfig } from 'payload'

export const SpinHistory: CollectionConfig = {
  slug: 'spin-history',
  access: {
    create: () => true,
    delete: () => true,
    read: () => true,
    update: () => false,
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
