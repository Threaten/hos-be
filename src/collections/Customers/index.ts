import type { CollectionConfig } from 'payload'
import { anyone, isAnyTenantAdmin } from '@/access/roles'
import { isSuperAdminAccess } from '@/access/isSuperAdmin'

export const Customers: CollectionConfig = {
  slug: 'customers',
  access: {
    // Public website looks up / creates customers when submitting forms
    create: anyone,
    read: anyone,
    update: isAnyTenantAdmin,
    delete: isSuperAdminAccess,
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
