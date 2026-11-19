import type { CollectionConfig } from 'payload'
import { allowAt, allowCreateAt, hideUnless } from '@/access/permissions'
import { sendReservationTelegramNotification } from '@/hooks/sendTelegramNotification'

export const Reservations: CollectionConfig = {
  slug: 'reservations',
  hooks: {
    afterChange: [sendReservationTelegramNotification],
  },
  access: {
    // Public website submits reservations
    // (signed-in people need the permission at that branch)
    create: (args) => !args.req.user || allowCreateAt('reservations')(args),
    read: allowAt('reservations', 'read'),
    update: allowAt('reservations', 'update'),
    delete: allowAt('reservations', 'delete'),
  },
  admin: {
    useAsTitle: 'customer',
    hidden: hideUnless('reservations'),
    defaultColumns: [
      'customer',
      'reservationDateTime',
      'branch',
      'numberOfGuests',
      'specialRequests',
      'status',
    ],
    components: {
      beforeList: ['@/collections/Reservations/components/CalendarView'],
    },
  },
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
    },

    {
      name: 'reservationDateTime',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'dd MM yyyy hh:mm a',
        },
      },
    },

    {
      name: 'numberOfGuests',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'specialRequests',
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
