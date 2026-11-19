import type { CollectionConfig, Field } from 'payload'
import { canAccessAdmin } from '@/access/roles'
import { can, hideUnless, permissionsField } from '@/access/permissions'

import { createAccess } from './access/create'
import { readAccess } from './access/read'
import { deleteAccess, updateAndDeleteAccess } from './access/updateAndDelete'
import { externalUsersLogin } from './endpoints/externalUsersLogin'
import { ensureUniqueUsername } from './hooks/ensureUniqueUsername'
import { isSuperAdmin } from '@/access/isSuperAdmin'
import { setCookieBasedOnDomain } from './hooks/setCookieBasedOnDomain'
import { restrictTenantAssignment, updatePermissions } from './hooks/restrictTenantAssignment'
import {
  SESSION_IDLE_SECONDS,
  blockDisabledLogin,
  canToggleDisabled,
  capSessionLength,
  endSessionsOnSecurityChange,
  persistEndedSessions,
} from './sessions'
import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields'
import type { User } from '@/payload-types'

/** Only people who may manage accounts can change roles and permissions */
const canManagePeople = ({ req }: { req: { user: unknown } }) => {
  const user = req.user as User | null
  return can(user, 'users', 'update') || can(user, 'users', 'create')
}

const defaultTenantArrayField = tenantsArrayField({
  tenantsArrayFieldName: 'tenants',
  tenantsArrayTenantFieldName: 'tenant',
  tenantsCollectionSlug: 'tenants',
  // Staff can't add (or remove) branches on any account, their own included;
  // what account managers may change is checked in restrictTenantAssignment
  arrayFieldAccess: { create: canManagePeople, update: canManagePeople },
  tenantFieldAccess: { create: canManagePeople, update: canManagePeople },
  rowFields: [
    {
      name: 'roles',
      type: 'relationship',
      relationTo: 'roles',
      hasMany: true,
      required: true,
      access: { update: canManagePeople },
      admin: {
        description: 'What this person does at this branch. Manage roles under People → Roles.',
      },
      // Shared roles, plus this branch's own
      filterOptions: ({ siblingData }) => {
        const branch = (siblingData as { tenant?: string | { id: string } } | undefined)?.tenant
        const id = typeof branch === 'object' ? branch?.id : branch
        return {
          or: [
            { branch: { exists: false } },
            { branch: { equals: null } },
            ...(id ? [{ branch: { equals: id } }] : []),
          ],
        }
      },
    },
    {
      type: 'collapsible',
      label: 'Extra permissions for this person',
      admin: { initCollapsed: true },
      fields: [
        {
          ...permissionsField({
            label: ' ',
            description: 'Anything ticked here is added to what their roles allow, at this branch only.',
          }),
          access: { update: canManagePeople },
        } as Field,
      ],
    },
  ],
})

/** Staff may change their own password and nothing else about their account */
const accountManagersOnly = ({ req }: { req: { user: unknown } }) => can(req.user as User | null, 'users', 'update')

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    create: createAccess,
    delete: deleteAccess,
    read: readAccess,
    update: updateAndDeleteAccess,
    admin: canAccessAdmin,
  },
  admin: {
    useAsTitle: 'email',
    group: 'People',
    // Everyone reaches their own account (and password) from the account menu
    hidden: hideUnless('users'),
  },
  // Sign-ins last a week from last use, a month at most; see ./sessions.ts
  auth: { tokenExpiration: SESSION_IDLE_SECONDS, useSessions: true },
  endpoints: [externalUsersLogin],
  fields: [
    {
      // Payload's own email field (merged with it), locked for staff
      name: 'email',
      type: 'email',
      access: { update: accountManagersOnly },
    },
    {
      type: 'text',
      name: 'password',
      hidden: true,
      access: {
        read: () => false, // Hide password field from read access
        update: ({ req, id }) => {
          const { user } = req
          if (!user) {
            return false
          }

          // Everyone may change their own password; account managers may
          // reset the passwords of people at their branches
          return id === user.id || can(user as User, 'users', 'update')
        },
      },
    },
    {
      admin: {
        position: 'sidebar',
      },
      name: 'roles',
      type: 'select',
      defaultValue: ['user'],
      hasMany: true,
      options: ['super-admin', 'user'],
      access: {
        update: ({ req }) => {
          return isSuperAdmin(req.user)
        },
      },
    },
    {
      name: 'disabled',
      label: 'Account disabled',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      access: { update: canToggleDisabled, create: canToggleDisabled },
      admin: {
        position: 'sidebar',
        description: 'Signs this person out everywhere straight away and stops them signing in.',
      },
    },
    {
      name: 'username',
      type: 'text',
      access: { update: accountManagersOnly },
      hooks: {
        beforeValidate: [ensureUniqueUsername],
      },
      index: true,
    },
    {
      ...defaultTenantArrayField,
      label: 'Branches & roles',
    } as Field,
    {
      // What the roles and extras above add up to, per branch; kept up to
      // date by the system so access checks are a quick look-up
      name: 'permissionsCache',
      type: 'json',
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
  ],
  // The following hook sets a cookie based on the domain a user logs in from.
  // It checks the domain and matches it to a tenant in the system, then sets
  // a 'payload-tenant' cookie for that tenant.

  hooks: {
    afterLogin: [setCookieBasedOnDomain],
    beforeLogin: [blockDisabledLogin],
    refresh: [capSessionLength],
    beforeChange: [restrictTenantAssignment, endSessionsOnSecurityChange],
    afterChange: [persistEndedSessions, updatePermissions],
  },
}
