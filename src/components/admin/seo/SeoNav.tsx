import type { ServerProps } from 'payload'

import React from 'react'

import { SeoNavGroup } from './SeoNavGroup'

/** Sidebar "SEO" group (after the other groups), for every logged-in admin user. */
export function SeoNav({ user }: ServerProps) {
  return user ? <SeoNavGroup /> : null
}
