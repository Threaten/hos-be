import type { Payload } from 'payload'

import { ALL_PERMISSIONS, refreshPermissionsCache, type PermissionSet } from '@/access/permissions'
import type { Role } from '@/payload-types'

type SystemKey = NonNullable<Role['system']>

const BUILT_IN: Record<SystemKey, { name: string; description: string; permissions: PermissionSet }> = {
  'branch-admin': {
    name: 'Branch admin',
    description: 'Everything for the branch: people, roles, website, reservations, vouchers.',
    permissions: ALL_PERMISSIONS,
  },
  staff: {
    name: 'Staff',
    description: 'Day-to-day work: reservations and vouchers.',
    permissions: {
      reservations: ['read', 'create', 'update'],
      vouchers: ['read', 'create', 'update', 'use'],
      voucherReasons: ['read'],
    },
  },
  viewer: {
    name: 'Viewer',
    description: 'Can look at the branch’s records, not change them.',
    permissions: {
      reservations: ['read'],
      vouchers: ['read'],
      voucherReasons: ['read'],
      contactMessages: ['read'],
      spinHistory: ['read'],
    },
  },
}

/** What the old fixed roles become */
const LEGACY: Record<string, SystemKey> = {
  'tenant-admin': 'branch-admin',
  'tenant-viewer': 'viewer',
}

/**
 * On start-up: make sure the built-in roles exist (Branch admin always has
 * every permission), move accounts still on the old fixed roles onto them,
 * and bring everyone's stored permissions up to date. Safe to run every time.
 */
export async function seedRoles(payload: Payload) {
  const ids = {} as Record<SystemKey, string>
  for (const [key, def] of Object.entries(BUILT_IN) as [SystemKey, (typeof BUILT_IN)[SystemKey]][]) {
    const { docs } = await payload.find({
      collection: 'roles',
      where: { system: { equals: key } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (docs[0]) {
      ids[key] = docs[0].id
      if (key === 'branch-admin') {
        // New permissions added to the system go to Branch admin automatically
        await payload.update({
          collection: 'roles',
          id: docs[0].id,
          data: { permissions: def.permissions as Role['permissions'] },
          overrideAccess: true,
          context: { seeding: true },
        })
      }
      continue
    }
    const created = await payload.create({
      collection: 'roles',
      data: { name: def.name, description: def.description, permissions: def.permissions as Role['permissions'] },
      overrideAccess: true,
      context: { seeding: true },
    })
    // `system` can't be set through the API; set it directly
    await payload.db.updateOne({ collection: 'roles', id: created.id, data: { system: key }, returning: false })
    ids[key] = created.id
  }

  // Accounts saved before roles were editable hold role names, not role ids
  // (raw driver: the schema would refuse the old values)
  const Users = payload.db.collections['users']
  const raw = Users.collection
  const legacy = await raw.find({ 'tenants.roles': { $in: Object.keys(LEGACY) } }).toArray()
  for (const user of legacy as unknown as { _id: unknown; tenants: { roles: unknown[] }[] }[]) {
    const tenants = user.tenants.map((row) => ({
      ...row,
      roles: [
        ...new Set(
          (row.roles ?? []).map((r) => (typeof r === 'string' && LEGACY[r] ? ids[LEGACY[r]] : String(r))),
        ),
      ].map((id) => new (Users.base.Types.ObjectId)(id)),
    }))
    await raw.updateOne({ _id: user._id as never }, { $set: { tenants } })
  }
  if (legacy.length) payload.logger.info(`Moved ${legacy.length} account(s) onto the built-in roles`)

  await refreshPermissionsCache(payload, 'all')
}
