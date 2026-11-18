'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@payloadcms/ui'

/** Must match SESSION_IDLE_SECONDS in collections/Users/sessions.ts */
const IDLE_MS = 7 * 24 * 60 * 60 * 1000
/** Renew at most once a day */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * The admin only renews its token minutes before it expires. This renews it
 * once a day while someone is actually using the admin, so "a week without
 * use signs you out" counts from the last use. The server caps the total at
 * a month.
 */
export function SessionKeeper({ children }: { children?: ReactNode }) {
  const { user, tokenExpirationMs, refreshCookie } = useAuth()
  const last = useRef(0)

  useEffect(() => {
    if (!user) return
    const maybeRenew = () => {
      const now = Date.now()
      if (now - last.current < 60_000 || !tokenExpirationMs) return
      last.current = now
      // Issued more than a day ago → renew
      if (tokenExpirationMs - now < IDLE_MS - RENEW_AFTER_MS) refreshCookie(true)
    }
    const onVisible = () => document.visibilityState === 'visible' && maybeRenew()
    window.addEventListener('pointerdown', maybeRenew)
    window.addEventListener('keydown', maybeRenew)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pointerdown', maybeRenew)
      window.removeEventListener('keydown', maybeRenew)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, tokenExpirationMs, refreshCookie])

  return <>{children}</>
}
