import { randomBytes } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { isSuperAdminAccess } from '@/access/isSuperAdmin'
import { byTenantRole, createForTenantRole } from '@/access/roles'
import { extractID } from '@/utilities/extractID'
import { getUserTenantIDs } from '@/utilities/getUserTenantIDs'
import type { User, VoucherReason } from '@/payload-types'

import { qrEndpoint, redeemEndpoint, scanEndpoint } from './endpoints'
import { staffName } from './present'

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
    create: createForTenantRole('branch'),
    read: byTenantRole('branch'),
    update: byTenantRole('branch', 'tenant-admin'),
    delete: isSuperAdminAccess,
  },
  admin: {
    group: 'Vouchers',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'branch', 'reasonLabel', 'issuedByName', 'issuedAt', 'usedByName', 'usedAt'],
    description:
      'Issue a voucher, then share its QR code or link with the guest. Staff scan it on the branch website to use it; it then cannot be used again.',
  },
  defaultSort: '-issuedAt',
  endpoints: [scanEndpoint, redeemEndpoint, qrEndpoint],
  hooks: {
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

        // Keep the reason's wording with the voucher, even if it is later removed
        const reasonID = data.reason ? extractID<VoucherReason>(data.reason) : null
        if (reasonID && (operation === 'create' || reasonID !== extractID<VoucherReason>(originalDoc?.reason))) {
          const reason = await req.payload
            .findByID({ collection: 'voucher-reasons', id: reasonID, depth: 0, req })
            .catch(() => null)
          data.reasonLabel = reason?.label ?? data.reasonLabel ?? null
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
      name: 'branch',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      defaultValue: ({ user }: { user?: User | null }) => (user ? getUserTenantIDs(user)[0] : undefined),
      admin: {
        description: 'The voucher opens on this branch’s website and only its staff can use it.',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 60,
      admin: {
        placeholder: '10% off the bill',
        description: 'What staff see as soon as they scan it, before using it.',
      },
    },
    {
      name: 'details',
      type: 'textarea',
      admin: {
        placeholder: 'Take 10% off food and drinks, one table, not with other offers.',
        description: 'Shown only after staff press “Use voucher”: what exactly to give or apply.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'reason',
          type: 'relationship',
          relationTo: 'voucher-reasons',
          required: true,
          admin: {
            width: '50%',
            description: 'Admins manage this list under Vouchers → Voucher reasons.',
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
          name: 'expiresAt',
          label: 'Valid until',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' },
            description: 'Optional. Leave empty for no end date.',
          },
        },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      admin: { description: 'Optional context, e.g. which table or what happened.' },
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
