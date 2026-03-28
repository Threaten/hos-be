import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from "sharp";


import { Users } from './collections/Users'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { isSuperAdmin } from './access/isSuperAdmin'
import type { Config } from './payload-types'
import { getUserTenantIDs } from './utilities/getUserTenantIDs'

import { Settings } from './globals/Settings'
import HomeInformation from './globals/HomeInformation'

import Media from './collections/Media'
import { Tenants } from './collections/Tenants/Tenants'
import { Customers } from './collections/Customers'
import { Gallery } from './collections/Gallery'
import { Reservations } from './collections/Reservations'
import { ContactMessages } from './collections/ContactMessages'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// eslint-disable-next-line no-restricted-exports
export default buildConfig({
  sharp,
  admin: {
    user: 'users',
    components: {
      beforeDashboard: ['@/components/Dashboard/TodaysReservationsWidget'],
      graphics: {
        Logo: '@/graphics/Logo/index.tsx#Logos',
        Icon: '@/graphics/Logo/index.tsx#Logos',
      },
    },
    meta: {
      title: 'Admin Panel',
      icons: [
        {
          rel: 'icon',
          type: 'image/png',
          url: '/favicon.png',
        },
      ],
    },
  },
  collections: [Users, Media, Tenants, Customers, Gallery, Reservations, ContactMessages],
  globals: [Settings, HomeInformation],
  db: mongooseAdapter({
    url: process.env.DATABASE_URL as string,
  }),
  // db: postgresAdapter({
  //   pool: {
  //     connectionString: process.env.POSTGRES_URL,
  //   },
  // }),
  onInit: async (args) => {},
  editor: lexicalEditor({}),

  graphQL: {
    schemaOutputFile: path.resolve(dirname, 'generated-schema.graphql'),
  },

  secret: process.env.PAYLOAD_SECRET as string,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  plugins: [
    
    multiTenantPlugin<Config>({
      collections: {},
      tenantField: {
        access: {
          read: () => true,
          update: ({ req }) => {
            if (isSuperAdmin(req.user)) {
              return true
            }
            return getUserTenantIDs(req.user).length > 0
          },
        },
      },
      tenantsArrayField: {
        includeDefaultField: false,
      },
      userHasAccessToAllTenants: (user) => isSuperAdmin(user),
    }),
  ],
})
