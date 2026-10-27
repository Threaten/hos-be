import type { CollectionConfig } from 'payload'
import { anyone, byTenantRole } from '@/access/roles'
import { sendContactTelegramNotification } from '@/hooks/sendTelegramNotification'

export const ContactMessages: CollectionConfig = {
  slug: 'contact-messages',
  hooks: {
    afterChange: [sendContactTelegramNotification],
  },
  access: {
    // Public website submits contact messages
    create: anyone,
    read: byTenantRole('branch'),
    update: byTenantRole('branch', 'tenant-admin'),
    delete: byTenantRole('branch', 'tenant-admin'),
  },
  admin: {
    useAsTitle: 'customer',
  },
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
    },

    {
      name: 'message',
      type: 'textarea',
      required: false,
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: ['Pending', 'Confirmed', 'Cancelled'],
      defaultValue: 'Pending',
      required: true,
    },
  ],
}
