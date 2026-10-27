import type { Access, Where } from 'payload'

import type { Tenant, User } from '../payload-types'
import { extractID } from '../utilities/extractID'
import { getUserTenantIDs } from '../utilities/getUserTenantIDs'
import { isSuperAdmin } from './isSuperAdmin'

/**
 * Role model
 *
 * - super-admin   (global)     full access to everything
 * - tenant-admin  (per tenant) manage records belonging to their tenant(s)
 * - tenant-viewer (per tenant) read-only access to records of their tenant(s)
 * - anonymous                  public website: read public content and submit forms
 */
export type TenantRole = NonNullable<User['tenants']>[number]['roles'][number]

export const anyone: Access = () => true

export const isLoggedIn: Access = ({ req }) => Boolean(req.user)

/**
 * Only super admins and users holding a tenant role may use the admin panel
 */
export const canAccessAdmin = ({ req }: { req: { user: User | null } }): boolean => {
  if (!req.user) {
    return false
  }

  return isSuperAdmin(req.user) || getUserTenantIDs(req.user).length > 0
}

/**
 * Any super admin or tenant admin (of at least one tenant)
 */
export const isAnyTenantAdmin: Access = ({ req }) => {
  if (!req.user) {
    return false
  }

  return isSuperAdmin(req.user) || getUserTenantIDs(req.user, 'tenant-admin').length > 0
}

/**
 * Read / update / delete scoped to documents whose `field` points at one of the user's tenants.
 * Without a role, any tenant role (admin or viewer) qualifies.
 * On update, also refuses moving the document to a tenant the user does not hold the role in.
 */
export const byTenantRole =
  (field: string, role?: TenantRole): Access =>
  ({ req, data }) => {
    if (!req.user) {
      return false
    }

    if (isSuperAdmin(req.user)) {
      return true
    }

    const tenantIDs = getUserTenantIDs(req.user, role)

    const requestedTenant = data?.[field]
    if (requestedTenant && !tenantIDs.includes(extractID<Tenant>(requestedTenant))) {
      return false
    }

    return {
      [field]: {
        in: tenantIDs,
      },
    } as Where
  }

/**
 * Create scoped to the tenant set on the incoming document's `field`
 */
export const createForTenantRole =
  (field: string, role: TenantRole): Access =>
  ({ req, data }) => {
    if (!req.user) {
      return false
    }

    if (isSuperAdmin(req.user)) {
      return true
    }

    const tenantIDs = getUserTenantIDs(req.user, role)

    // No data yet: admin panel asking whether to show the "Create" button
    if (!data) {
      return tenantIDs.length > 0
    }

    const requestedTenant = data[field]

    return Boolean(requestedTenant) && tenantIDs.includes(extractID<Tenant>(requestedTenant))
  }
