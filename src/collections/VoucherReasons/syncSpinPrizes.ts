import type { CollectionAfterChangeHook, Payload, PayloadRequest } from 'payload'

import type { Tenant } from '@/payload-types'

/** "30% off" on the wheel → "30% off - from Spin" in the reasons list */
export const spinReasonLabel = (prize: string) => `${prize} - from Spin`

/** A wheel slice that wins nothing is not a voucher */
const isPrize = (label?: string | null) => Boolean(label?.trim()) && !/^try again$/i.test(label!.trim())

/**
 * Keep a branch's voucher reasons in step with its lucky wheel prizes: one
 * reason per prize, renamed when the prize is renamed and removed when the
 * prize is removed. Each reason remembers which wheel slice it came from, so
 * renaming a prize changes its reason instead of making a new one.
 */
export async function syncSpinReasons(payload: Payload, tenant: Pick<Tenant, 'id' | 'spinWheelPrizes'>, req?: PayloadRequest) {
  const prizes = (tenant.spinWheelPrizes ?? []).filter((p) => p.id && isPrize(p.label))
  const { docs: existing } = await payload.find({
    collection: 'voucher-reasons',
    where: { and: [{ branch: { equals: tenant.id } }, { source: { equals: 'spin' } }] },
    pagination: false,
    depth: 0,
    req,
  })
  const bySlice = new Map(existing.map((r) => [r.spinPrizeId, r]))

  for (const prize of prizes) {
    const offer = prize.label.trim()
    const label = spinReasonLabel(offer)
    const current = bySlice.get(prize.id!)
    bySlice.delete(prize.id!)
    if (!current) {
      await payload.create({
        collection: 'voucher-reasons',
        data: { label, offer, branch: tenant.id, source: 'spin', spinPrizeId: prize.id! },
        req,
      })
    } else if (current.label !== label || current.offer !== offer) {
      await payload.update({ collection: 'voucher-reasons', id: current.id, data: { label, offer }, req })
    }
  }

  // Prizes taken off the wheel (issued vouchers keep their own copy of the wording)
  for (const gone of bySlice.values()) {
    await payload.delete({ collection: 'voucher-reasons', id: gone.id, req })
  }
}

/** Tenants afterChange: re-sync whenever a branch is saved */
export const syncSpinReasonsAfterChange: CollectionAfterChangeHook<Tenant> = async ({ doc, req }) => {
  await syncSpinReasons(req.payload, doc, req)
  return doc
}
