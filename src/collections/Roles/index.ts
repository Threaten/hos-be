import type { Access, CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import {
  branchesWhere,
  hideUnless,
  missingPermissions,
  permissionsAt,
  permissionsField,
  refreshPermissionsCache,
  type PermissionSet,
} from '@/access/permissions'
import type { Role, Tenant, User } from '@/payload-types'
import { extractID } from '@/utilities/extractID'

/** Shared roles (no branch) plus the roles of branches where the person may see roles or manage people */
const readRoles: Access = ({ req }) => {
  const user = req.user as User | null
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const branches = [
    ...new Set([
      ...branchesWhere(user, 'roles', 'read'),
      ...branchesWhere(user, 'users', 'create'),
      ...branchesWhere(user, 'users', 'update'),
    ]),
  ]
  if (!branches.length) return false
  return { or: [{ branch: { in: branches } }, { branch: { exists: false } }, { branch: { equals: null } }] } as Where
}

/** A branch's own roles, for people allowed to manage roles there; shared roles are for super admins */
const manageRoles =
  (action: 'create' | 'update' | 'delete'): Access =>
  ({ req, data }) => {
    const user = req.user as User | null
    if (!user) return false
    if (isSuperAdmin(user)) return true
    const branches = branchesWhere(user, 'roles', action)
    if (!branches.length) return false
    if (action === 'create') {
      if (!data) return true
      return Boolean(data.branch) && branches.includes(extractID<Tenant>(data.branch))
    }
    if (data?.branch && !branches.includes(extractID<Tenant>(data.branch))) return false
    return { branch: { in: branches } } as Where
  }

/**
 * Roles: named sets of permissions, given to people per branch.
 *
 * Three come with the system (Branch admin, Staff, Viewer) and are shared by
 * every branch; super admins can adjust Staff and Viewer. Branches can add
 * their own. Nobody can put a permission in a role that they don't have
 * themselves, so no one can promote themselves through a role.
 */
export const Roles: CollectionConfig = {
  slug: 'roles',
  labels: { singular: 'Role', plural: 'Roles' },
  access: {
    read: readRoles,
    create: manageRoles('create'),
    update: manageRoles('update'),
    delete: manageRoles('delete'),
  },
  admin: {
    group: 'People',
    useAsTitle: 'name',
    defaultColumns: ['name', 'branch', 'description'],
    hidden: hideUnless('roles'),
    description:
      'A role is a set of permissions. Give people roles on their account, under their branch. Changes apply to everyone with the role straight away.',
  },
  defaultSort: 'name',
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        const user = req.user as User | null
        if (originalDoc?.system === 'branch-admin' && operation === 'update' && !req.context.seeding) {
          throw new APIError('Branch admin always has every permission and cannot be changed.', 400, null, true)
        }
        if (!user || isSuperAdmin(user)) return data
        if (originalDoc?.system) {
          throw new APIError('Only super admins can change the built-in roles.', 403, null, true)
        }
        const branch = extractID<Tenant>(data.branch ?? originalDoc?.branch)
        const missing = missingPermissions(
          (data.permissions ?? originalDoc?.permissions ?? {}) as PermissionSet,
          permissionsAt(user, branch),
        )
        if (missing.length) {
          throw new APIError(
            `You can only give permissions you have yourself. Not allowed: ${missing.join(', ')}.`,
            403,
            null,
            true,
          )
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'update') return doc
        // Everyone with this role gets its new permissions now
        const { docs } = await req.payload.find({
          collection: 'users',
          where: { 'tenants.roles': { equals: doc.id } },
          pagination: false,
          depth: 0,
          select: {},
          overrideAccess: true,
          req,
        })
        if (docs.length) await refreshPermissionsCache(req.payload, docs.map((u) => u.id), req)
        return doc
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const role = (await req.payload.findByID({ collection: 'roles', id, depth: 0, overrideAccess: true, req })) as Role
        if (role.system) throw new APIError('Built-in roles cannot be deleted.', 400, null, true)
        const { totalDocs } = await req.payload.count({
          collection: 'users',
          where: { 'tenants.roles': { equals: id } },
          overrideAccess: true,
          req,
        })
        if (totalDocs) {
          throw new APIError(
            `${totalDocs} ${totalDocs === 1 ? 'person has' : 'people have'} this role. Take it off them first.`,
            400,
            null,
            true,
          )
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 40,
      admin: { placeholder: 'Cashier' },
    },
    {
      name: 'description',
      type: 'text',
      maxLength: 160,
      admin: { placeholder: 'Takes payments and uses vouchers at the counter.' },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Leave empty to offer this role at every branch (super admins only).',
      },
    },
    permissionsField({
      description: 'Tick what people with this role may do at their branch. Everyone can always change their own password.',
    }),
    {
      name: 'system',
      type: 'select',
      options: [
        { label: 'Branch admin', value: 'branch-admin' },
        { label: 'Staff', value: 'staff' },
        { label: 'Viewer', value: 'viewer' },
      ],
      index: true,
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
  ],
}
