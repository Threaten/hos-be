import type { Access, CollectionConfig, Where } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import { allowAt, allowCreateAt, branchesWhere, hideUnless } from '@/access/permissions'
import type { User } from '@/payload-types'

/** Shared reasons, plus those of branches where the user may see reasons or issue vouchers */
const readOwnOrShared: Access = ({ req }) => {
  const user = req.user as User | null
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const branches = [
    ...new Set([...branchesWhere(user, 'voucherReasons', 'read'), ...branchesWhere(user, 'vouchers', 'create')]),
  ]
  if (!branches.length) return false
  return {
    or: [
      { branch: { in: branches } },
      { branch: { exists: false } },
      { branch: { equals: null } },
    ],
  } as Where
}

/** People allowed to manage their branch's reasons; spin prizes are managed on the wheel */
const manageOwn =
  (action: 'update' | 'delete'): Access =>
  (args) => {
  if (!args.req.user) return false
  const notSpin: Where = { source: { not_equals: 'spin' } }
  if (isSuperAdmin(args.req.user)) return notSpin
  const own = allowAt('voucherReasons', action)(args)
  if (!own) return false
  return own === true ? notSpin : ({ and: [own, notSpin] } as Where)
  }

/**
 * The list staff pick from when issuing a voucher. Each reason says why the
 * voucher is given ("Birthday") and what the guest gets ("Free dessert"), so
 * issuing one is a single choice. Reasons without a branch are shared by
 * every branch and managed by super admins; a branch's admins manage its own.
 *
 * Each branch's lucky wheel prizes appear here too ("30% off - from Spin"),
 * kept in step with the wheel by ./syncSpinPrizes.ts and only editable there.
 */
export const VoucherReasons: CollectionConfig = {
  slug: 'voucher-reasons',
  labels: { singular: 'Voucher reason', plural: 'Voucher reasons' },
  access: {
    read: readOwnOrShared,
    create: allowCreateAt('voucherReasons'),
    update: manageOwn('update'),
    delete: manageOwn('delete'),
  },
  admin: {
    group: 'Vouchers',
    useAsTitle: 'label',
    hidden: hideUnless('voucherReasons'),
    defaultColumns: ['label', 'offer', 'branch', 'source'],
    description:
      'What staff can choose from when issuing a voucher. Lucky wheel prizes are added automatically (“… - from Spin”); change those on the branch’s Lucky wheel tab. Editing or removing a reason does not change vouchers already issued.',
  },
  defaultSort: 'label',
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      maxLength: 60,
      admin: { placeholder: 'Birthday', description: 'Why the voucher is given.' },
    },
    {
      name: 'offer',
      type: 'text',
      required: true,
      maxLength: 60,
      admin: {
        placeholder: 'Free dessert',
        description: 'What the guest gets. Staff see this as soon as they scan the voucher.',
      },
    },
    {
      name: 'details',
      type: 'textarea',
      admin: {
        placeholder: 'Any dessert from the menu, one per table.',
        description: 'Optional. Shown to staff only after they press “Use voucher”.',
      },
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
    {
      name: 'source',
      type: 'select',
      defaultValue: 'manual',
      index: true,
      options: [
        { label: 'Added here', value: 'manual' },
        { label: 'Lucky wheel', value: 'spin' },
      ],
      access: { create: () => false, update: () => false },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'spinPrizeId',
      type: 'text',
      index: true,
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
  ],
}
