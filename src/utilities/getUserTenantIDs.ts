import type { Tenant, User } from '../payload-types'
import { extractID } from './extractID'

/**
 * The branches a person works at (whatever their roles there).
 * For what they may do at each, see access/permissions.ts.
 */
export const getUserTenantIDs = (user: null | User): Tenant['id'][] => {
  if (!user) {
    return []
  }

  return (user.tenants ?? []).filter((row) => row?.tenant).map((row) => extractID<Tenant>(row.tenant))
}
