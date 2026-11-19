import type { Access, Field, Payload, PayloadRequest, Where } from 'payload'

import type { Role, Tenant, User } from '../payload-types'
import { extractID } from '../utilities/extractID'
import { isSuperAdmin } from './isSuperAdmin'

/**
 * Permissions
 *
 * Admins build roles (Branch admin, Staff, Cashier…) out of the permissions
 * below and give people one or more roles per branch, plus any extra
 * permissions that one person needs. A person can do something at a branch
 * if any of their roles there, or their own extras, allow it.
 *
 * Everyone can always change their own password. Super admins can do
 * everything everywhere.
 *
 * What a person may do is worked out whenever their account or one of their
 * roles changes, and kept on the account (permissionsCache), so every check
 * below is a quick look-up.
 */
export const RESOURCES = {
  reservations: { label: 'Reservations', actions: ['read', 'create', 'update', 'delete'] },
  vouchers: { label: 'Vouchers', actions: ['read', 'create', 'update', 'use', 'delete'] },
  voucherReasons: { label: 'Voucher reasons', actions: ['read', 'create', 'update', 'delete'] },
  contactMessages: { label: 'Contact messages', actions: ['read', 'update', 'delete'] },
  spinHistory: { label: 'Spin history', actions: ['read', 'delete'] },
  customers: { label: 'Customers', actions: ['update', 'delete'] },
  media: { label: 'Media library', actions: ['create', 'update', 'delete'] },
  branch: { label: 'Branch settings & website', actions: ['update'] },
  users: { label: 'People (staff accounts)', actions: ['read', 'create', 'update', 'delete'] },
  roles: { label: 'Roles', actions: ['read', 'create', 'update', 'delete'] },
  auditLogs: { label: 'Audit log', actions: ['read'] },
} as const

export type Resource = keyof typeof RESOURCES
export type Action = 'read' | 'create' | 'update' | 'delete' | 'use'
/** resource → allowed actions */
export type PermissionSet = Partial<Record<Resource, Action[]>>
/** branch id → what the person may do there */
export type PermissionsCache = Record<string, PermissionSet>

const ACTION_LABEL: Record<Action, string> = {
  read: 'See',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
  use: 'Use (scan)',
}

const RESOURCE_KEYS = Object.keys(RESOURCES) as Resource[]

/** Every permission there is: what the Branch admin role starts with */
export const ALL_PERMISSIONS: PermissionSet = Object.fromEntries(
  RESOURCE_KEYS.map((r) => [r, [...RESOURCES[r].actions]]),
)

/** The permission grid, as admin fields: one row of checkboxes per area */
export const permissionsField = (overrides: { name?: string; label?: string; description?: string } = {}): Field => ({
  name: overrides.name ?? 'permissions',
  label: overrides.label ?? 'Permissions',
  type: 'group',
  admin: { description: overrides.description },
  fields: RESOURCE_KEYS.map((resource) => ({
    name: resource,
    label: RESOURCES[resource].label,
    type: 'select',
    hasMany: true,
    options: RESOURCES[resource].actions.map((action) => ({ label: ACTION_LABEL[action], value: action })),
  })),
})

// ─── Working out a person's permissions ────────────────────────────────

type PermissionsLike = { [K in Resource]?: (string | null)[] | null } | null | undefined

const addAll = (into: PermissionSet, from: PermissionsLike) => {
  if (!from) return
  for (const resource of RESOURCE_KEYS) {
    const actions = from[resource]
    if (!actions?.length) continue
    const set = new Set([...(into[resource] ?? []), ...(actions.filter(Boolean) as Action[])])
    into[resource] = RESOURCES[resource].actions.filter((a) => set.has(a))
  }
}

type TenantRow = NonNullable<User['tenants']>[number]

/** What one branch row of an account allows, given the roles it names */
export const rowPermissions = (row: Pick<TenantRow, 'roles' | 'permissions'>, roles: Map<string, Role>): PermissionSet => {
  const result: PermissionSet = {}
  for (const ref of row.roles ?? []) {
    const role = roles.get(extractID<Role>(ref as Role | string))
    if (role) addAll(result, role.permissions as PermissionsLike)
  }
  addAll(result, row.permissions as PermissionsLike)
  return result
}

/** Load the roles named by these rows */
export const loadRoles = async (
  payload: Payload,
  rows: Pick<TenantRow, 'roles'>[],
  req?: PayloadRequest,
): Promise<Map<string, Role>> => {
  const ids = [...new Set(rows.flatMap((r) => (r.roles ?? []).map((ref) => extractID<Role>(ref as Role | string))))]
  if (!ids.length) return new Map()
  const { docs } = await payload.find({
    collection: 'roles',
    where: { id: { in: ids } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return new Map(docs.map((r) => [r.id, r]))
}

/** Branch id → permissions, for a whole account */
export const computePermissionsCache = (rows: TenantRow[] | null | undefined, roles: Map<string, Role>): PermissionsCache => {
  const cache: PermissionsCache = {}
  for (const row of rows ?? []) {
    if (!row?.tenant) continue
    const branch = extractID<Tenant>(row.tenant)
    cache[branch] = cache[branch] ?? {}
    addAll(cache[branch], rowPermissions(row, roles) as PermissionsLike)
  }
  return cache
}

/** Recompute and store the permissions of these accounts (no hooks, no audit noise) */
export const refreshPermissionsCache = async (payload: Payload, userIDs: string[] | 'all', req?: PayloadRequest) => {
  const { docs } = await payload.find({
    collection: 'users',
    where: userIDs === 'all' ? {} : { id: { in: userIDs } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const roles = await loadRoles(payload, docs.flatMap((u) => u.tenants ?? []), req)
  for (const user of docs) {
    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { permissionsCache: computePermissionsCache(user.tenants, roles) },
      req,
      returning: false,
    })
  }
}

/** Is everything in `wanted` also in `held`? (Nobody hands out more than they have) */
export const missingPermissions = (wanted: PermissionSet, held: PermissionSet): string[] => {
  const missing: string[] = []
  for (const resource of RESOURCE_KEYS) {
    for (const action of wanted[resource] ?? []) {
      if (!held[resource]?.includes(action)) missing.push(`${RESOURCES[resource].label}: ${ACTION_LABEL[action]}`)
    }
  }
  return missing
}

// ─── Checks ─────────────────────────────────────────────────────────────

const cacheOf = (user: User | null | undefined): PermissionsCache =>
  ((user as (User & { permissionsCache?: PermissionsCache }) | null)?.permissionsCache ?? {}) as PermissionsCache

/** What the person may do at one branch (super admins: everything) */
export const permissionsAt = (user: User | null | undefined, branch: string): PermissionSet =>
  !user ? {} : isSuperAdmin(user) ? ALL_PERMISSIONS : (cacheOf(user)[branch] ?? {})

/** The branches where the person may do this */
export const branchesWhere = (user: User | null | undefined, resource: Resource, action: Action): string[] => {
  if (!user) return []
  return Object.entries(cacheOf(user))
    .filter(([, perms]) => perms[resource]?.includes(action))
    .map(([branch]) => branch)
}

/** May the person do this at this branch, or (no branch given) anywhere? */
export const can = (user: User | null | undefined, resource: Resource, action: Action, branch?: string | null): boolean => {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  return branch ? branchesWhere(user, resource, action).includes(branch) : branchesWhere(user, resource, action).length > 0
}

/** Access: records of the branches where the person may do this */
export const allowAt =
  (resource: Resource, action: Action, field = 'branch'): Access =>
  ({ req, data }) => {
    const user = req.user as User | null
    if (!user) return false
    if (isSuperAdmin(user)) return true
    const branches = branchesWhere(user, resource, action)
    if (!branches.length) return false
    // Moving a record to another branch needs the permission there too
    if (data?.[field] && !branches.includes(extractID<Tenant>(data[field]))) return false
    return { [field]: { in: branches } } as Where
  }

/** Access for create: the new record's branch must be one where the person may */
export const allowCreateAt =
  (resource: Resource, field = 'branch'): Access =>
  ({ req, data }) => {
    const user = req.user as User | null
    if (!user) return false
    if (isSuperAdmin(user)) return true
    const branches = branchesWhere(user, resource, 'create')
    if (!data) return branches.length > 0 // whether to show "Create new"
    return Boolean(data[field]) && branches.includes(extractID<Tenant>(data[field]))
  }

/** Access for things that don't belong to a branch: allowed at any branch */
export const allowAnywhere =
  (resource: Resource, action: Action): Access =>
  ({ req }) =>
    can(req.user as User | null, resource, action)

/** Hide a collection from the admin menu unless the person may see or do anything with it */
export const hideUnless =
  (resource: Resource) =>
  ({ user }: { user: unknown }): boolean =>
    !RESOURCES[resource].actions.some((action) => can(user as User | null, resource, action))
