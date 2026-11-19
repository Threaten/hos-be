import type { Endpoint, PayloadRequest } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import type { Tenant, User, Voucher } from '@/payload-types'
import { extractID } from '@/utilities/extractID'
import { can } from '@/access/permissions'
import { qrSvg, voucherUrl } from '@/utilities/voucherLink'

import { presentVoucher, staffName } from './present'

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function findByCode(req: PayloadRequest): Promise<Voucher | null> {
  const code = String(req.routeParams?.code ?? '')
  if (!code) return null
  const { docs } = await req.payload.find({
    collection: 'vouchers',
    where: { code: { equals: code } },
    depth: 1,
    limit: 1,
    overrideAccess: true, // access is checked below, per branch
    req,
  })
  return docs[0] ?? null
}

/** The voucher, if the signed-in user may see or use vouchers at its branch; otherwise an error response */
async function voucherForStaff(req: PayloadRequest, action: 'read' | 'use' = 'read'): Promise<Voucher | Response> {
  const user = req.user as User | null
  if (!user) return json({ error: 'Sign in as staff to see this voucher.' }, 401)
  const voucher = await findByCode(req)
  if (!voucher) return json({ error: 'There is no voucher with this code.' }, 404)
  const branchID = voucher.branch ? extractID<Tenant>(voucher.branch) : null
  if (!isSuperAdmin(user) && !can(user, 'vouchers', 'read', branchID) && !can(user, 'vouchers', 'use', branchID)) {
    return json({ error: 'This voucher belongs to another branch.' }, 403)
  }
  if (action === 'use' && !can(user, 'vouchers', 'use', branchID)) {
    return json({ error: 'Your account isn’t allowed to use vouchers. Ask a branch admin.' }, 403)
  }
  return voucher
}

/** GET /api/vouchers/scan/:code — what the voucher is, before using it */
export const scanEndpoint: Endpoint = {
  path: '/scan/:code',
  method: 'get',
  handler: async (req) => {
    const voucher = await voucherForStaff(req)
    if (voucher instanceof Response) return voucher
    return json(presentVoucher(voucher, { withDetails: voucher.status === 'used' }))
  },
}

/** POST /api/vouchers/redeem/:code — use it: reveals the details and marks it used, once */
export const redeemEndpoint: Endpoint = {
  path: '/redeem/:code',
  method: 'post',
  handler: async (req) => {
    const voucher = await voucherForStaff(req, 'use')
    if (voucher instanceof Response) return voucher
    const user = req.user as User

    const current = presentVoucher(voucher, { withDetails: false })
    if (current.state !== 'active') {
      const message = {
        used: 'This voucher has already been used.',
        void: 'This voucher has been cancelled.',
      }[current.state]
      return json({ error: message, voucher: presentVoucher(voucher, { withDetails: voucher.status === 'used' }) }, 409)
    }

    // Flip active → used in one database operation, so two staff scanning
    // the same voucher at once can't both use it
    const Model = req.payload.db.collections['vouchers']
    const usedAt = new Date()
    const { modifiedCount } = await Model.updateOne(
      { _id: voucher.id, status: 'active' },
      { $set: { status: 'used', usedAt } },
    )
    if (modifiedCount !== 1) {
      const latest = await findByCode(req)
      return json(
        {
          error: 'This voucher has just been used.',
          voucher: latest ? presentVoucher(latest, { withDetails: true }) : null,
        },
        409,
      )
    }

    const used = await req.payload.update({
      collection: 'vouchers',
      id: voucher.id,
      data: { usedBy: user.id, usedByName: staffName(user), usedAt: usedAt.toISOString() },
      depth: 1,
      overrideAccess: true,
      context: { redeeming: true },
      req,
    })
    return json(presentVoucher(used, { withDetails: true }))
  },
}

/** GET /api/vouchers/qr/:code — the QR code image; opens the voucher on its branch site */
export const qrEndpoint: Endpoint = {
  path: '/qr/:code',
  method: 'get',
  handler: async (req) => {
    const voucher = await findByCode(req)
    const branch = voucher && typeof voucher.branch === 'object' ? (voucher.branch as Tenant) : null
    if (!voucher || !branch?.domain) return new Response('Not found', { status: 404 })
    const svg = qrSvg(voucherUrl(branch.domain, voucher.code as string))
    const headers: Record<string, string> = {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    }
    if (req.searchParams?.get('download')) {
      headers['Content-Disposition'] = `attachment; filename="voucher-${voucher.code}.svg"`
    }
    return new Response(svg, { headers })
  },
}

/**
 * POST /api/vouchers/from-spin  { branch, prize }
 *
 * The lucky wheel calls this when a spin lands on a prize: it issues a
 * voucher for that prize's "… - from Spin" reason, in the name of the staff
 * member running the wheel, with the same permissions as issuing one in the
 * admin. Returns the code and the link the guest's QR code opens.
 */
export const fromSpinEndpoint: Endpoint = {
  path: '/from-spin',
  method: 'post',
  handler: async (req) => {
    if (!req.user) return json({ error: 'Sign in as staff to issue vouchers.' }, 401)
    const body = (await req.json?.().catch(() => null)) as { branch?: string; prize?: string } | null
    const branch = body?.branch
    const prize = body?.prize?.trim()
    if (!branch || !prize) return json({ error: 'Missing branch or prize.' }, 400)

    const { docs } = await req.payload.find({
      collection: 'voucher-reasons',
      where: { and: [{ branch: { equals: branch } }, { source: { equals: 'spin' } }, { offer: { equals: prize } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (!docs[0]) return json({ error: `“${prize}” is not on this branch’s wheel any more.` }, 404)

    try {
      // overrideAccess: false → the usual issuing rules apply to this staff member
      const voucher = await req.payload.create({
        collection: 'vouchers',
        data: { reason: docs[0].id, branch, status: 'active' }, // status and the log are set by the hook
        depth: 1,
        overrideAccess: false,
        req,
      })
      const tenant = typeof voucher.branch === 'object' ? (voucher.branch as Tenant) : null
      return json(
        {
          code: voucher.code,
          title: voucher.title,
          url: tenant?.domain ? voucherUrl(tenant.domain, voucher.code as string) : null,
        },
        201,
      )
    } catch {
      return json({ error: 'Your account isn’t allowed to issue vouchers at this branch.' }, 403)
    }
  },
}
