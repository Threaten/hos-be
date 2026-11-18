import type { Access, CollectionConfig, Where } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import { byTenantRole, createForTenantRole } from '@/access/roles'
import { getUserTenantIDs } from '@/utilities/getUserTenantIDs'

/** Reasons that apply everywhere, plus those of the user's own branches */
const readOwnOrShared: Access = ({ req }) => {
  if (!req.user) return false
  if (isSuperAdmin(req.user)) return true
  return {
    or: [
      { branch: { in: getUserTenantIDs(req.user) } },
      { branch: { exists: false } },
      { branch: { equals: null } },
    ],
  } as Where
}

/**
 * Why a voucher was given ("Birthday", "Apology for a long wait"…). Staff pick
 * one when issuing a voucher. Reasons without a branch are shared by every
 * branch and managed by super admins; a branch's admins manage its own.
 */
export const VoucherReasons: CollectionConfig = {
  slug: 'voucher-reasons',
  labels: { singular: 'Voucher reason', plural: 'Voucher reasons' },
  access: {
    read: readOwnOrShared,
    create: createForTenantRole('branch', 'tenant-admin'),
    update: byTenantRole('branch', 'tenant-admin'),
    delete: byTenantRole('branch', 'tenant-admin'),
  },
  admin: {
    group: 'Vouchers',
    useAsTitle: 'label',
    defaultColumns: ['label', 'branch', 'updatedAt'],
    description:
      'The reasons staff can choose from when issuing a voucher. Removing one does not change vouchers already issued with it.',
  },
  defaultSort: 'label',
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      maxLength: 60,
      admin: { placeholder: 'Birthday' },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      admin: {
        description: 'Leave empty to offer this reason at every branch (super admins only).',
      },
    },
  ],
}
