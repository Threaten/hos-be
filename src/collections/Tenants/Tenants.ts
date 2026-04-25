import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  LinkFeature,
  lexicalEditor,
  EXPERIMENTAL_TableFeature,
} from '@payloadcms/richtext-lexical'
// import { YoutubeFeature } from "payloadcms-lexical-ext";

import { isSuperAdminAccess } from '@/access/isSuperAdmin'
import { updateAndDeleteAccess } from './access/updateAndDelete'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  access: {
    create: isSuperAdminAccess,
    delete: updateAndDeleteAccess,
    read: () => true,
    update: updateAndDeleteAccess,
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'domain',
      type: 'text',
      admin: {
        description: 'Used for domain-based tenant handling',
      },
    },
    {
      name: 'heroImagesList',
      type: 'array',
      required: true,
      minRows: 5,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    { name: 'heroTitle', type: 'text', required: true },
    { name: 'heroSubtitle', type: 'text', required: true },
    { name: 'heroDescription', type: 'textarea', required: true },
    {
      name: 'shortAboutCollages',
      type: 'array',
      maxRows: 4,
      minRows: 4,
      required: true,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    { name: 'shortAboutTitle', type: 'text', required: true },
    { name: 'shortAboutText', type: 'text', required: true },
    {
      name: 'galleryText',
      label: 'Home Gallery Text',
      type: 'text',
      required: false,
      admin: {
        description: 'Subtitle shown beneath the Featured Gallery heading on the home page.',
        placeholder: 'A glimpse into our culinary world',
      },
    },
    {
      name: 'ctaTitle',
      label: 'CTA Title',
      type: 'text',
      required: false,
      admin: {
        description: 'Heading in the Call-to-Action section on the home page.',
        placeholder: 'Experience [Tenant Name] Today',
      },
    },
    {
      name: 'ctaText',
      label: 'CTA Text',
      type: 'text',
      required: false,
      admin: {
        description: 'Subtext in the Call-to-Action section on the home page.',
        placeholder: 'Join us for an unforgettable culinary journey',
      },
    },
    {
      name: 'aboutTitle',
      label: 'About Us Title',
      type: 'text',
      required: false,
      admin: {
        description: 'Large heading shown on the About Us hero image.',
        placeholder: 'about [tenant name]',
      },
    },
    {
      name: 'aboutSubtitle',
      label: 'About Us Subtitle',
      type: 'text',
      required: false,
      admin: {
        description: 'Subtitle shown beneath the About Us hero heading.',
        placeholder: 'A Journey of Culinary Excellence',
      },
    },
    {
      name: 'aboutusHero',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'aboutus',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => {
          return [
            ...defaultFeatures,

            HeadingFeature({
              enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
            }),
            FixedToolbarFeature({}),
            InlineToolbarFeature(),
            HorizontalRuleFeature(),
            LinkFeature(),
            EXPERIMENTAL_TableFeature(),
          ]
        },
      }),
    },
    { name: 'menu', type: 'upload', relationTo: 'media', required: false },
    {
      name: 'newMenu',
      label: 'New Events/Menu',
      type: 'array',

      fields: [{ name: 'src', type: 'upload', relationTo: 'media', required: true }],
    },
    { name: 'logo', type: 'upload', relationTo: 'media', required: false },
    { name: 'address', type: 'text', required: false },
    {
      name: 'location',
      type: 'group',
      label: 'Location Coordinates',
      admin: {
        description: 'Used for geo SEO meta tags and structured data.',
      },
      fields: [
        {
          name: 'latitude',
          type: 'number',
          required: false,
          admin: {
            description: 'e.g. 10.7769',
            step: 0.000001,
          },
        },
        {
          name: 'longitude',
          type: 'number',
          required: false,
          admin: {
            description: 'e.g. 106.7009',
            step: 0.000001,
          },
        },
      ],
    },
    { name: 'phone', type: 'text', required: false },
    { name: 'email', type: 'text', required: false },
    { name: 'facebook', type: 'text', required: false },
    { name: 'instagram', type: 'text', required: false },
    { name: 'tiktok', type: 'text', required: false },
    { name: 'youtube', type: 'text', required: false },
    {
      name: 'allowPublicRead',
      type: 'checkbox',
      admin: {
        description:
          'If checked, logging in is not required to read. Useful for building public pages.',
        position: 'sidebar',
      },
      defaultValue: false,
      index: true,
    },
  ],
}
