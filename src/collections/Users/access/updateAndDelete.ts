import type { Access } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import { branchesWhere } from '@/access/permissions'
import { isAccessingSelf } from './isAccessingSelf'

/** Your own account (field rules limit what you may change), or people at branches where you manage accounts */
export const updateAndDeleteAccess: Access = ({ req, id }) => {
  const { user } = req

  if (!user) {
    return false
  }

  if (isSuperAdmin(user) || isAccessingSelf({ user, id })) {
    return true
  }

  const branches = branchesWhere(user, 'users', 'update')
  return branches.length ? { 'tenants.tenant': { in: branches } } : false
}

/** Nobody deletes their own account; account managers delete people at their branches */
export const deleteAccess: Access = ({ req, id }) => {
  const { user } = req
  if (!user || isAccessingSelf({ user, id })) {
    return false
  }
  if (isSuperAdmin(user)) {
    return true
  }
  const branches = branchesWhere(user, 'users', 'delete')
  return branches.length ? { 'tenants.tenant': { in: branches } } : false
}
