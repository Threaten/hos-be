import type { CollectionConfig } from 'payload'
import { anyone } from '@/access/roles'
import { allowAt, hideUnless } from '@/access/permissions'
import { sendContactTelegramNotification } from '@/hooks/sendTelegramNotification'

export const ContactMessages: CollectionConfig = {
  slug: 'contact-messages',
  hooks: {
    afterChange: [sendContactTelegramNotification],
  },
  access: {
    // Public website submits contact messages
    create: anyone,
    read: allowAt('contactMessages', 'read'),
    update: allowAt('contactMessages', 'update'),
    delete: allowAt('contactMessages', 'delete'),
  },
  admin: {
    useAsTitle: 'customer',
    hidden: hideUnless('contactMessages'),
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
