import type { Access } from 'payload'

import type { Tenant, User } from '../../../payload-types'

import { isSuperAdmin } from '../../../access/isSuperAdmin'
import { branchesWhere } from '../../../access/permissions'

/** People who may add accounts, and only at branches where they may */
export const createAccess: Access<User> = ({ req }) => {
  if (!req.user) {
    return false
  }

  if (isSuperAdmin(req.user)) {
    return true
  }

  if (req.data?.roles?.includes('super-admin')) {
    return false
  }

  const branches = branchesWhere(req.user, 'users', 'create')
  if (!branches.length) {
    return false
  }
  if (!req.data) {
    return true // the admin panel asking whether to show "Create new"
  }

  const requested: Tenant['id'][] =
    req.data?.tenants?.map((t: { tenant: Tenant['id'] | Tenant }) =>
      typeof t.tenant === 'object' ? t.tenant.id : t.tenant,
    ) ?? []

  return requested.length > 0 && requested.every((id) => branches.includes(id))
}
