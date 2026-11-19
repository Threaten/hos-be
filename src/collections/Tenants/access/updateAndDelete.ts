import { isSuperAdmin } from '@/access/isSuperAdmin'
import { branchesWhere } from '@/access/permissions'
import type { User } from '@/payload-types'
import type { Access } from 'payload'

/** Branches whose settings and website the person may edit */
export const updateAndDeleteAccess: Access = ({ req }) => {
  if (!req.user) {
    return false
  }

  if (isSuperAdmin(req.user)) {
    return true
  }

  const branches = branchesWhere(req.user as User, 'branch', 'update')
  return branches.length ? { id: { in: branches } } : false
}
