import type { CollectionConfig } from 'payload'

export const Customers: CollectionConfig = {
  slug: 'customers',
  access: {
    create: () => true,
    delete: () => true,
    read: () => true,
    update: () => true,
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
