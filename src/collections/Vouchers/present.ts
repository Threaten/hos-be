import type { Tenant, User, Voucher } from '@/payload-types'

/** How staff are named in the voucher log */
export const staffName = (user: Pick<User, 'username' | 'email'>) => user.username?.trim() || user.email

export type VoucherState = 'active' | 'used' | 'void' | 'expired'

/** What a signed-in staff member sees when they scan a voucher */
export function presentVoucher(v: Voucher, { withDetails }: { withDetails: boolean }) {
  const branch = typeof v.branch === 'object' ? (v.branch as Tenant) : null
  const expired = v.status === 'active' && v.expiresAt != null && new Date(v.expiresAt) < new Date()
  const state: VoucherState = expired ? 'expired' : (v.status as VoucherState)
  return {
    code: v.code,
    title: v.title,
    state,
    branch: branch ? { name: branch.name, domain: branch.domain } : null,
    reason: v.reasonLabel ?? null,
    note: v.note ?? null,
    issuedBy: v.issuedByName ?? null,
    issuedAt: v.issuedAt ?? null,
    expiresAt: v.expiresAt ?? null,
    usedBy: v.usedByName ?? null,
    usedAt: v.usedAt ?? null,
    // The details stay hidden until the voucher is used
    details: withDetails ? (v.details ?? null) : null,
  }
}
