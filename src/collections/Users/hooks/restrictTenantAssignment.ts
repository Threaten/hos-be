import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import {
  branchesWhere,
  loadRoles,
  missingPermissions,
  permissionsAt,
  refreshPermissionsCache,
  rowPermissions,
} from '@/access/permissions'
import type { Role, Tenant, User } from '@/payload-types'
import { extractID } from '@/utilities/extractID'

type TenantRow = NonNullable<User['tenants']>[number]

/** A comparable fingerprint of each branch row: its roles and extra permissions */
const rowsByBranch = (rows?: TenantRow[] | null): Map<string, { row: TenantRow; key: string }> =>
  new Map(
    (rows ?? [])
      .filter((row) => row?.tenant)
      .map((row) => [
        extractID<Tenant>(row.tenant),
        {
          row,
          key: JSON.stringify([
            (row.roles ?? []).map((r) => extractID<Role>(r as Role | string)).sort(),
            Object.entries(row.permissions ?? {})
              .filter(([, v]) => Array.isArray(v) && v.length)
              .map(([k, v]) => [k, [...(v as string[])].sort()])
              .sort(),
          ]),
        },
      ]),
  )

/**
 * Changing someone's branches, roles or extra permissions:
 * - needs permission to manage people at that branch, and
 * - can't give them anything the person making the change can't do there.
 * So nobody can promote themselves or anyone else beyond their own reach.
 * Roles must be shared ones or the branch's own.
 */
export const restrictTenantAssignment: CollectionBeforeChangeHook<User> = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!data?.tenants) return data

  const before = rowsByBranch(operation === 'update' ? originalDoc?.tenants : [])
  const after = rowsByBranch(data.tenants)
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
    (branch) => before.get(branch)?.key !== after.get(branch)?.key,
  )
  if (!changed.length) return data

  const roles = await loadRoles(req.payload, data.tenants, req)

  for (const branch of changed) {
    const row = after.get(branch)?.row
    for (const ref of row?.roles ?? []) {
      const role = roles.get(extractID<Role>(ref as Role | string))
      if (!role) throw new APIError('One of the chosen roles no longer exists.', 400, null, true)
      if (role.branch && extractID<Tenant>(role.branch) !== branch) {
        throw new APIError(`The role “${role.name}” belongs to another branch.`, 400, null, true)
      }
    }

    const user = req.user as User | null
    if (!user || isSuperAdmin(user)) continue

    const action = before.has(branch) ? 'update' : 'create'
    if (!branchesWhere(user, 'users', action).includes(branch) && !branchesWhere(user, 'users', 'update').includes(branch)) {
      throw new APIError('You are not allowed to change who works at this branch or what they can do.', 403, null, true)
    }
    if (row) {
      const missing = missingPermissions(rowPermissions(row, roles), permissionsAt(user, branch))
      if (missing.length) {
        throw new APIError(
          `You can only give permissions you have yourself. Not allowed: ${missing.join(', ')}.`,
          403,
          null,
          true,
        )
      }
    }
  }

  return data
}

/** Store what this person may now do (after any change to their branches or roles) */
export const updatePermissions: CollectionAfterChangeHook<User> = async ({ doc, req }) => {
  await refreshPermissionsCache(req.payload, [doc.id], req)
  return doc
}
