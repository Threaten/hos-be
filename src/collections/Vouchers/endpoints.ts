import type { Endpoint, PayloadRequest } from 'payload'

import { isSuperAdmin } from '@/access/isSuperAdmin'
import type { Tenant, User, Voucher } from '@/payload-types'
import { extractID } from '@/utilities/extractID'
import { getUserTenantIDs } from '@/utilities/getUserTenantIDs'
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

/** The voucher, if the signed-in user is staff at its branch; otherwise an error response */
async function voucherForStaff(req: PayloadRequest): Promise<Voucher | Response> {
  const user = req.user as User | null
  if (!user) return json({ error: 'Sign in as staff to see this voucher.' }, 401)
  const voucher = await findByCode(req)
  if (!voucher) return json({ error: 'There is no voucher with this code.' }, 404)
  const branchID = extractID<Tenant>(voucher.branch)
  if (!isSuperAdmin(user) && !getUserTenantIDs(user).includes(branchID)) {
    return json({ error: 'This voucher belongs to another branch.' }, 403)
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
    const voucher = await voucherForStaff(req)
    if (voucher instanceof Response) return voucher
    const user = req.user as User

    const current = presentVoucher(voucher, { withDetails: false })
    if (current.state !== 'active') {
      const message = {
        used: 'This voucher has already been used.',
        void: 'This voucher has been cancelled.',
        expired: 'This voucher has expired.',
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
