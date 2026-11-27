import type { AdminViewServerProps } from 'payload'

import path from 'node:path'
import React from 'react'

import { isSuperAdmin } from '@/access/isSuperAdmin'

import { SeoPage, NoAgentData } from './SeoPage'
import { bullets, formatDate, Inline, readText, stateDir } from './shared'

/** Lines the owner still has to answer in facts.md: "- TODO Cuisine per branch:" → "Cuisine per branch". */
const openFacts = (markdown: string) =>
  bullets(markdown)
    .filter((item) => /^TODO\b/.test(item))
    .map((item) => item.replace(/^TODO\s*/, '').replace(/:\s*$/, ''))

/** The newest journal entry: everything after the last heading, else the last lines. */
function latestEntry(markdown: string) {
  const lines = markdown.trimEnd().split(/\r?\n/)
  let start = -1
  lines.forEach((line, index) => {
    if (/^#{1,3}\s/.test(line)) start = index
  })
  const entry = start === -1 ? lines.slice(-12) : lines.slice(start)
  const title = start === -1 ? null : entry[0].replace(/^#+\s*/, '')
  const body = (start === -1 ? entry : entry.slice(1)).join('\n').trim()
  return { title, body }
}

/** SEO → Agent to-dos (/admin/seo): what the nightly SEO agent needs from the owner. */
export async function SeoTodosView(props: AdminViewServerProps) {
  const dir = stateDir()
  // The to-do list and the run journal mention server problems, keys and logs: super admins only.
  // Everyone else sees the facts the agent needs.
  const superAdmin = isSuperAdmin(props.initPageResult.req.user as Parameters<typeof isSuperAdmin>[0])
  const [todo, facts, journal, alert] = await Promise.all(
    ['owner-todo.md', 'facts.md', 'journal.md', 'ALERT.md'].map((name) =>
      readText(path.join(dir, name)),
    ),
  )

  const todos = todo ? bullets(todo.text) : []
  const missingFacts = facts ? openFacts(facts.text) : []
  const entry = journal?.text.trim() ? latestEntry(journal.text) : null
  const alertText = alert?.text.trim()

  return (
    <SeoPage
      props={props}
      title="Agent to-dos"
      intro={
        superAdmin
          ? 'What the nightly SEO agent needs from you, and what it did last.'
          : 'Facts the nightly SEO agent needs to write about the restaurants.'
      }
    >
      {!todo && !facts && !journal && !alert ? (
        <NoAgentData />
      ) : (
        <div className="seo-page__body">
          {superAdmin && alertText ? (
            <div className="seo-page__alert" role="alert">
              <h3>Failed deploy</h3>
              <pre>{alertText}</pre>
            </div>
          ) : null}

          <div className="seo-page__grid">
            {superAdmin ? (
              <div className="seo-page__card">
                <h3>
                  To do <span className="seo-page__count">{todos.length}</span>
                </h3>
                {todo ? (
                  <p className="seo-page__meta">Updated {formatDate(todo.updatedAt)}</p>
                ) : null}
                {todos.length ? (
                  <ol className="seo-page__list">
                    {todos.map((item, index) => (
                      <li key={index}>
                        <Inline text={item} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="seo-page__empty">Nothing to do right now.</p>
                )}
              </div>
            ) : null}

            <div className="seo-page__card">
              <h3>
                Facts to fill in <span className="seo-page__count">{missingFacts.length}</span>
              </h3>
              <p className="seo-page__meta">
                The agent only writes facts it can confirm. Answer these in{' '}
                <code>{path.join(dir, 'facts.md')}</code> and remove the word TODO from each line
                you fill in.
              </p>
              {missingFacts.length ? (
                <ul className="seo-page__list">
                  {missingFacts.map((item, index) => (
                    <li key={index}>
                      <Inline text={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="seo-page__empty">All facts are filled in.</p>
              )}
            </div>
          </div>

          {superAdmin && entry ? (
            <div className="seo-page__card">
              <h3>Last run{entry.title ? `: ${entry.title}` : ''}</h3>
              {journal ? (
                <p className="seo-page__meta">Journal updated {formatDate(journal.updatedAt)}</p>
              ) : null}
              <pre>{entry.body}</pre>
            </div>
          ) : null}
        </div>
      )}
    </SeoPage>
  )
}
