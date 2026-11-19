import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionBeforeLoginHook, CollectionRefreshHook } from 'payload'
import { APIError, getFieldsToSign, jwtSign } from 'payload'

import { can } from '@/access/permissions'
import type { User } from '@/payload-types'

/**
 * How long a sign-in lasts, for the admin and the branch websites alike.
 *
 * - A token is good for SESSION_IDLE; using the site renews it (the admin and
 *   the websites ask at most once a day), so a week without use signs you out.
 * - Renewals stop SESSION_MAX after the original sign-in: a month at most.
 * - Disabling an account or changing its password ends every session at once.
 *   Payload checks the session list on each request, so emptying it is enough.
 */
export const SESSION_IDLE_SECONDS = 7 * 24 * 60 * 60
export const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000

type Session = { id: string; createdAt: string | Date; expiresAt: string | Date }

/** Renew a token, but never past a month from the original sign-in */
export const capSessionLength: CollectionRefreshHook = async ({ args, user }) => {
  const { req, collection } = args
  const sid = (req.user as (User & { _sid?: string }) | null)?._sid
  if (!sid || !user) return undefined

  // Raw record: the session list is hidden from normal reads
  const raw = (await req.payload.db.findOne({
    collection: 'users',
    where: { id: { equals: user.id } },
    req,
  })) as unknown as { sessions?: Session[] } | null
  const sessions = raw?.sessions ?? []
  const session = sessions.find((s) => s.id === sid)
  if (!session) throw new APIError('Your session has ended. Please sign in again.', 401, null, true)

  const now = Date.now()
  const endsAt = new Date(session.createdAt).getTime() + SESSION_MAX_MS
  if (now >= endsAt) {
    await req.payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { sessions: sessions.filter((s) => s.id !== sid) },
      req,
      returning: false,
    })
    throw new APIError('You have been signed in for a month. Please sign in again.', 401, null, true)
  }

  // Renew for a week, or until the month is up, whichever comes first
  const expiresAt = Math.min(now + SESSION_IDLE_SECONDS * 1000, endsAt)
  session.expiresAt = new Date(expiresAt)
  await req.payload.db.updateOne({
    collection: 'users',
    id: user.id,
    data: { sessions },
    req,
    returning: false,
  })

  const { exp, token } = await jwtSign({
    fieldsToSign: getFieldsToSign({ collectionConfig: collection.config, email: user.email, sid, user: req.user as User }),
    secret: req.payload.secret,
    tokenExpiration: Math.max(60, Math.floor((expiresAt - now) / 1000)),
  })
  return {
    exp,
    refreshedToken: token,
    setCookie: true,
    strategy: (req.user as User & { _strategy?: string })._strategy,
    user,
  }
}

export const ACCOUNT_DISABLED_MESSAGE = 'This account has been disabled. Ask an admin to turn it back on.'

/**
 * Disabled accounts cannot sign in, in the admin or on the websites. Payload
 * runs this only after the password checks out, so the message reveals nothing
 * to someone guessing.
 */
export const blockDisabledLogin: CollectionBeforeLoginHook = ({ user }) => {
  if ((user as User).disabled) {
    throw new APIError(ACCOUNT_DISABLED_MESSAGE, 401, null, true)
  }
  return user
}

/**
 * Disabling an account or changing its password signs it out everywhere.
 * Someone changing their own password stays signed in where they did it.
 */
export const endSessionsOnSecurityChange: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req, context }) => {
  if (operation !== 'update' || context.keepSessions) return data
  const passwordChanged = typeof data.password === 'string' && data.password.length > 0
  const disabledNow = data.disabled === true && !originalDoc?.disabled
  if (passwordChanged || disabledNow) {
    const me = req.user as (User & { _sid?: string }) | null
    const ownChange = !disabledNow && me?.id === originalDoc?.id && me?._sid
    // The after-change hook empties the session list once the record is saved
    req.context.sessionsEnded = { keep: ownChange ? me._sid : null }
  }
  return data
}

/** End the sessions (all, or all but the one kept) */
export const persistEndedSessions: CollectionAfterChangeHook = async ({ doc, req }) => {
  const ended = req.context.sessionsEnded as { keep: string | null } | undefined
  if (!ended) return doc
  req.context.sessionsEnded = undefined
  let sessions: Session[] = []
  if (ended.keep) {
    const raw = (await req.payload.db.findOne({
      collection: 'users',
      where: { id: { equals: doc.id } },
      req,
    })) as unknown as { sessions?: Session[] } | null
    sessions = (raw?.sessions ?? []).filter((s) => s.id === ended.keep)
  }
  await req.payload.db.updateOne({
    collection: 'users',
    id: doc.id,
    data: { sessions },
    req,
    returning: false,
  })
  return doc
}

/** Only people who manage accounts may switch one off or on, never their own */
export const canToggleDisabled = ({ req, id }: { req: { user: unknown }; id?: string | number }) => {
  const user = req.user as User | null
  if (!user || id === user.id) return false
  return can(user, 'users', 'update')
}
