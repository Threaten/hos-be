import type { CollectionConfig } from 'payload'
import { anyone } from '@/access/roles'
import { allowAnywhere } from '@/access/permissions'

export const Customers: CollectionConfig = {
  slug: 'customers',
  access: {
    // Public website looks up / creates customers when submitting forms
    create: anyone,
    read: anyone,
    update: allowAnywhere('customers', 'update'),
    delete: allowAnywhere('customers', 'delete'),
  },
  admin: {
    useAsTitle: 'customerName',
  },
  fields: [
    {
      name: 'customerName',
      type: 'text',
    },
    {
      name: 'customerPhone',
      type: 'text',
      unique: true,
    },
    {
      name: 'reservationHistory',
      type: 'join',
      collection: 'reservations',
      on: 'customer',
    },
    {
      name: 'contactHistory',
      type: 'join',
      collection: 'contact-messages',
      on: 'customer',
    },
  ],
}
