import type { CollectionConfig } from 'payload'

export const Reservations: CollectionConfig = {
  slug: 'reservations',
  access: {
    create: () => true,
    delete: () => true,
    read: () => true,
    update: () => true,
  },
  admin: {
    useAsTitle: 'customer',
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
