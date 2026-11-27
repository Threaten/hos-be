'use client'

import { Link, NavGroup, useConfig } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import React from 'react'

const LINKS = [
  { path: '/seo', label: 'Agent to-dos' },
  { path: '/seo/competitors', label: 'Competitors' },
]

/** "SEO" group in the admin sidebar, drawn with Payload's own nav classes so it matches the other groups. */
export function SeoNavGroup() {
  const pathname = usePathname()
  const {
    config: {
      routes: { admin },
    },
  } = useConfig()

  return (
    <NavGroup label="SEO">
      {LINKS.map(({ path, label }) => {
        const href = `${admin}${path}`
        const isActive = pathname === href
        const content = (
          <>
            {isActive ? <div className="nav__link-indicator" /> : null}
            <span className="nav__link-label">{label}</span>
          </>
        )
        return isActive ? (
          <div className="nav__link" key={path}>
            {content}
          </div>
        ) : (
          <Link className="nav__link" href={href} key={path} prefetch={false}>
            {content}
          </Link>
        )
      })}
    </NavGroup>
  )
}
