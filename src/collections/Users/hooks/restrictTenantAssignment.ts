import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

import type { Tenant, User } from '@/payload-types'
import { isSuperAdmin } from '@/access/isSuperAdmin'
import { extractID } from '@/utilities/extractID'
import { getUserTenantIDs } from '@/utilities/getUserTenantIDs'

type TenantRow = NonNullable<User['tenants']>[number]

const rolesByTenant = (rows?: TenantRow[] | null): Map<Tenant['id'], string> =>
  new Map(
    (rows ?? [])
      .filter((row) => row?.tenant)
      .map((row) => [extractID<Tenant>(row.tenant), [...(row.roles ?? [])].sort().join(',')]),
  )

/**
 * Non super admins may only add, remove or change tenant roles
 * for tenants they are a tenant-admin of. Prevents self-promotion.
 */
export const restrictTenantAssignment: CollectionBeforeChangeHook<User> = ({
  data,
  originalDoc,
  req,
}) => {
  if (!req.user || isSuperAdmin(req.user) || !data?.tenants) {
    return data
  }

  const adminTenantIDs = getUserTenantIDs(req.user, 'tenant-admin')
  const before = rolesByTenant(originalDoc?.tenants)
  const after = rolesByTenant(data.tenants)

  for (const tenantID of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(tenantID) !== after.get(tenantID) && !adminTenantIDs.includes(tenantID)) {
      throw new APIError('You are not allowed to change roles for this tenant.', 403, null, true)
    }
  }

  return data
}
