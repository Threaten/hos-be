import { randomBytes } from 'node:crypto'
import type { Access, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { isSuperAdmin, isSuperAdminAccess } from '@/access/isSuperAdmin'
import { byTenantRole } from '@/access/roles'
import { extractID } from '@/utilities/extractID'
import { getUserTenantIDs } from '@/utilities/getUserTenantIDs'
import type { User, VoucherReason } from '@/payload-types'

import { qrEndpoint, redeemEndpoint, scanEndpoint } from './endpoints'
import { staffName } from './present'

/** The branch a voucher goes to when none is given: the user's only branch */
const onlyBranch = (user: User | null | undefined) => {
  const ids = user ? getUserTenantIDs(user) : []
  return ids.length === 1 ? ids[0] : undefined
}

/** Any staff role may issue, for their own branch; one-branch staff needn't name it */
const canIssue: Access = ({ req, data }) => {
  const user = req.user as User | null
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const ids = getUserTenantIDs(user)
  if (!data) return ids.length > 0 // whether to show "Create new"
  const branch = data.branch ? extractID(data.branch) : onlyBranch(user)
  return Boolean(branch) && ids.includes(branch as string)
}

/** Unguessable, URL-safe; it is the voucher's only key */
const newCode = () => randomBytes(15).toString('base64url')

/**
 * Vouchers staff issue to guests.
 *
 * Staff create one in the admin (any role at the branch), then share its QR
 * code or link. The QR opens /voucher/<code> on the branch's own site, where
 * a signed-in staff member sees what it is for and presses "Use voucher".
 * Only then are the details shown and the voucher marked used; it can never
 * be used again. Who issued it, why and when, and who used it and when, are
 * kept on the voucher.
 *
 * The bookkeeping fields are read-only in the admin and always overwritten by
 * the hook below, so they can't be forged through the API either.
 */
export const Vouchers: CollectionConfig = {
  slug: 'vouchers',
  labels: { singular: 'Voucher', plural: 'Vouchers' },
  access: {
    create: canIssue,
    read: byTenantRole('branch'),
    update: byTenantRole('branch', 'tenant-admin'),
    delete: isSuperAdminAccess,
  },
  admin: {
    group: 'Vouchers',
    useAsTitle: 'title',
    defaultColumns: ['title', 'reasonLabel', 'status', 'branch', 'issuedByName', 'issuedAt', 'usedByName', 'usedAt'],
    description:
      'Create new → pick a reason → Save, then share the QR code with the guest. Staff scan it on the branch website to use it, once.',
  },
  defaultSort: '-issuedAt',
  endpoints: [scanEndpoint, redeemEndpoint, qrEndpoint],
  hooks: {
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation === 'create' && data && !data.branch) data.branch = onlyBranch(req.user as User | null)
        return data
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, operation, req, context }) => {
        // The redeem endpoint is the only way to mark a voucher used
        if (context.redeeming) return data

        if (operation === 'create') {
          const user = req.user as User | null
          data.code = newCode()
          data.status = 'active'
          data.issuedBy = user?.id ?? null
          data.issuedByName = user ? staffName(user) : 'System'
          data.issuedAt = new Date().toISOString()
          data.usedBy = null
          data.usedByName = null
          data.usedAt = null
        } else {
          if (originalDoc?.status === 'used') {
            throw new APIError('This voucher has been used and can no longer be changed.', 400, null, true)
          }
          if (data.status === 'used') {
            throw new APIError('A voucher is marked used by scanning it and pressing “Use voucher”.', 400, null, true)
          }
          for (const key of ['code', 'issuedBy', 'issuedByName', 'issuedAt', 'usedBy', 'usedByName', 'usedAt', 'branch'] as const) {
            data[key] = originalDoc?.[key]
          }
        }

        // Copy the reason's wording onto the voucher, so editing or removing
        // the reason later never changes a voucher already issued
        const reasonID = data.reason ? extractID<VoucherReason>(data.reason) : null
        if (reasonID && (operation === 'create' || reasonID !== extractID<VoucherReason>(originalDoc?.reason))) {
          const reason = await req.payload
            .findByID({ collection: 'voucher-reasons', id: reasonID, depth: 0, req })
            .catch(() => null)
          if (!reason) throw new APIError('Choose a reason from the list.', 400, null, true)
          data.reasonLabel = reason.label
          data.title = reason.offer
          data.details = reason.details ?? null
        } else if (operation === 'update') {
          data.reasonLabel = originalDoc?.reasonLabel
          data.title = originalDoc?.title
          data.details = originalDoc?.details
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'share',
      type: 'ui',
      admin: {
        position: 'sidebar',
        condition: (data) => Boolean(data?.code),
        components: { Field: '@/collections/Vouchers/VoucherShare#VoucherShare' },
      },
    },
    {
      name: 'reason',
      type: 'relationship',
      relationTo: 'voucher-reasons',
      required: true,
      admin: {
        description: 'Pick a reason and save: the code and QR appear straight away.',
      },
      filterOptions: ({ data }) => {
        const branch = data?.branch ? extractID(data.branch) : null
        return {
          or: [
            ...(branch ? [{ branch: { equals: branch } }] : []),
            { branch: { exists: false } },
            { branch: { equals: null } },
          ],
        }
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      defaultValue: ({ user }: { user?: User | null }) => onlyBranch(user),
      admin: {
        // Filled in automatically for staff of a single branch
        condition: (_data, _sibling, { user }) => !user || getUserTenantIDs(user as User).length !== 1,
        description: 'The voucher opens on this branch’s website and only its staff can use it.',
      },
    },

    // ─── Bookkeeping (set by the system) ─────────────────────────────────
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Ready to use', value: 'active' },
        { label: 'Used', value: 'used' },
        { label: 'Cancelled', value: 'void' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Branch admins can cancel a voucher that has not been used.',
      },
    },
    {
      name: 'title',
      label: 'Gives',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true, description: 'Copied from the reason when issued.' },
    },
    {
      name: 'details',
      type: 'textarea',
      admin: { position: 'sidebar', readOnly: true, condition: (data) => Boolean(data?.details) },
    },
    {
      name: 'code',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Generated when the voucher is issued.' },
    },
    {
      name: 'reasonLabel',
      label: 'Reason (as issued)',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      type: 'collapsible',
      label: 'Log',
      admin: { position: 'sidebar' },
      fields: [
        { name: 'issuedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        { name: 'issuedByName', label: 'Issued by', type: 'text', admin: { readOnly: true } },
        {
          name: 'issuedAt',
          label: 'Issued at',
          type: 'date',
          index: true,
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } },
        },
        { name: 'usedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        { name: 'usedByName', label: 'Used by', type: 'text', admin: { readOnly: true } },
        {
          name: 'usedAt',
          label: 'Used at',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } },
        },
      ],
    },
  ],
}
