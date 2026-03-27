import { GlobalConfig } from 'payload'

const HomeInformation: GlobalConfig = {
  slug: 'home-information',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    // {
    //   name: "address(es)",

    //   type: "array",
    //   minRows: 1,
    //   fields: [
    //     {
    //       name: "address",
    //       label: "Address",
    //       type: "text",
    //       required: true,
    //     },
    //   ],
    // },
    {
      name: 'quote(s)',
      type: 'array',
      minRows: 2,
      maxRows: 10,
      fields: [
        {
          name: 'quote',
          label: 'Quote',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'Catch Phrase 1',
      type: 'text',
      required: true,
    },
    {
      name: 'Catch Phrase Image 1',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'Catch Phrase 2',
      type: 'text',
      required: true,
    },
    {
      name: 'Catch Phrase Image 2',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
  ],
}

export default HomeInformation
