import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { stateDir } from './shared'

/** Admin page frame for the SEO section: the normal sidebar and header, for every logged-in admin user. */
export function SeoPage({
  props: { initPageResult, params, searchParams },
  title,
  intro,
  children,
}: {
  props: AdminViewServerProps
  title: string
  intro: React.ReactNode
  children: React.ReactNode
}) {
  const { req, permissions, locale, visibleEntities } = initPageResult
  const user = req.user
  if (!user) redirect(`${req.payload.config.routes.admin}/login`)

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Gutter className="seo-page">
        <header className="seo-page__head">
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        {children}
      </Gutter>
    </DefaultTemplate>
  )
}

export const NoAgentData = () => (
  <p className="seo-page__empty">
    No SEO agent data on this server yet (looked in <code>{stateDir()}</code>).
  </p>
)
