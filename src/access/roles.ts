import type { Access } from 'payload'

import type { User } from '../payload-types'
import { getUserTenantIDs } from '../utilities/getUserTenantIDs'
import { isSuperAdmin } from './isSuperAdmin'

/**
 * Who is who
 *
 * - super-admin (global)      full access to everything
 * - branch people             what their roles (and extra permissions) at each
 *                             branch allow; see ./permissions.ts
 * - anonymous                 public website: read public content and submit forms
 */

export const anyone: Access = () => true

export const isLoggedIn: Access = ({ req }) => Boolean(req.user)

/**
 * Only super admins and people working at a branch may use the admin panel
 */
export const canAccessAdmin = ({ req }: { req: { user: User | null } }): boolean => {
  if (!req.user) {
    return false
  }

  return isSuperAdmin(req.user) || getUserTenantIDs(req.user).length > 0
}
