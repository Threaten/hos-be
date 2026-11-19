import type { CollectionConfig, Endpoint } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import { allowAt, hideUnless } from '@/access/permissions'
import { staffName } from '@/collections/Vouchers/present'
import type { User } from '@/payload-types'
import { getUserTenantIDs } from '@/utilities/getUserTenantIDs'

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST /api/spin-history/record  { branch, reward }
 *
 * The only way a spin is recorded: the lucky wheel page calls it after each
 * spin, signed in as the staff member running the wheel. The reward must be
 * one of the branch's prizes, so made-up results can't be recorded.
 */
const recordSpin: Endpoint = {
  path: '/record',
  method: 'post',
  handler: async (req) => {
    const user = req.user as User | null
    if (!user) return json({ error: 'Sign in as staff to run the lucky wheel.' }, 401)
    const body = (await req.json?.().catch(() => null)) as { branch?: string; reward?: string } | null
    const branch = body?.branch
    const reward = body?.reward?.trim()
    if (!branch || !reward) return json({ error: 'Missing branch or reward.' }, 400)
    if (!isSuperAdmin(user) && !getUserTenantIDs(user).includes(branch)) {
      return json({ error: 'You can only run the wheel of your own branch.' }, 403)
    }

    const tenant = await req.payload
      .findByID({ collection: 'tenants', id: branch, depth: 0, overrideAccess: true, req })
      .catch(() => null)
    if (!tenant) return json({ error: 'Unknown branch.' }, 404)
    const onWheel = (tenant.spinWheelPrizes ?? []).some((p) => p.label?.trim() === reward)
    if (!onWheel) return json({ error: `“${reward}” is not on this branch’s wheel.` }, 400)

    const doc = await req.payload.create({
      collection: 'spin-history',
      data: {
        occurredAt: new Date().toISOString(),
        reward,
        branch,
        spunBy: user.id,
        spunByName: staffName(user),
      },
      overrideAccess: true, // nobody may create these through the admin or the API
      depth: 0,
      req,
    })
    return json({ id: doc.id }, 201)
  },
}

/**
 * Every spin of a branch's lucky wheel. Written only by the lucky wheel page
 * (see recordSpin); no one can add or edit entries in the admin or through
 * the API. Who may see or delete them is set by their roles.
 */
export const SpinHistory: CollectionConfig = {
  slug: 'spin-history',
  labels: { singular: 'Spin', plural: 'Spin history' },
  access: {
    create: () => false,
    read: allowAt('spinHistory', 'read'),
    update: () => false,
    delete: allowAt('spinHistory', 'delete'),
  },
  admin: {
    useAsTitle: 'reward',
    hidden: hideUnless('spinHistory'),
    defaultColumns: ['occurredAt', 'reward', 'branch', 'spunByName'],
    description: 'Recorded by the lucky wheel page on each spin. Entries cannot be added or changed here.',
  },
  defaultSort: '-occurredAt',
  endpoints: [recordSpin],
  fields: [
    {
      name: 'occurredAt',
      label: 'Time Occurred',
      type: 'date',
      required: true,
      index: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'dd/MM/yyyy HH:mm:ss',
        },
      },
    },
    {
      name: 'reward',
      label: 'Reward Content',
      type: 'text',
      required: true,
    },
    {
      name: 'branch',
      label: 'Branch',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        { name: 'spunByName', label: 'Run by', type: 'text', admin: { width: '50%' } },
        { name: 'spunBy', type: 'relationship', relationTo: 'users', admin: { width: '50%' } },
      ],
    },
  ],
}
