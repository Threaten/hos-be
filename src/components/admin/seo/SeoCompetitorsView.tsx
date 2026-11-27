import type { AdminViewServerProps } from 'payload'

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'

import { NoAgentData, SeoPage } from './SeoPage'
import { bullets, formatDay, Inline, readJson, readText, stateDir } from './shared'

/**
 * SEO → Competitors (/admin/seo/competitors): competitor research from the SEO agent
 * (hos-fe-v2/seo-agent/tools/competitors.mjs). Reads the per-page snapshots in state/competitors/*.json and our own
 * pages from ours.json (both written by the tool), plus the agent's own conclusions from
 * state/competitor-notes.md. The raw report.md stays available at the bottom.
 */

type Page = {
  url: string
  status: number | string
  fetchedAt?: string
  title?: string
  words?: number
  faq?: string[]
  schema?: string[]
  rating?: { value?: number | string; count?: number | string } | null
  signals?: {
    prices?: string[]
    schedule?: string[]
    certificate?: boolean
    jobs?: boolean
    testimonials?: boolean
  }
  media?: { videos?: number }
  change?: { wordsBefore?: number }
}

const ok = (page: Page) => page.status === 200

/** The comparisons in the report, as checks that work on any page. */
const CHECKS: { label: string; has: (page: Page) => boolean }[] = [
  { label: 'Shows prices', has: (p) => Boolean(p.signals?.prices?.length) },
  { label: 'FAQ', has: (p) => Boolean(p.faq?.length) },
  { label: 'FAQ schema', has: (p) => Boolean(p.schema?.includes('FAQPage')) },
  { label: 'Restaurant schema', has: (p) => Boolean(p.schema?.some((t) => /Restaurant|FoodEstablishment|LocalBusiness/.test(t))) },
  { label: 'Menu schema', has: (p) => Boolean(p.schema?.includes('Menu')) },
  { label: 'Star rating', has: (p) => Boolean(p.rating) },
  { label: 'Testimonials', has: (p) => Boolean(p.signals?.testimonials) },
  { label: 'Video', has: (p) => Boolean(p.media?.videos) },
]

/**
 * Our pages from the "## Our pages" section of report.md, for reports written before the tool
 * also saved ours.json. Reads the fixed line format of competitors.mjs `line()`.
 */
function oursFromReport(markdown: string): Page[] {
  const start = markdown.indexOf('## Our pages')
  if (start === -1) return []
  const end = markdown.indexOf('\n## ', start + 1)
  const section = markdown.slice(start, end === -1 ? undefined : end)
  const pages: Page[] = []
  for (const block of section.split(/^### /m).slice(1)) {
    const [url, ...rest] = block.split(/\r?\n/).map((line) => line.trim())
    const body = rest.join('\n')
    const field = (pattern: RegExp) => body.match(pattern)?.[1]?.trim()
    const words = field(/^(\d+) words/m)
    if (!words) {
      pages.push({ url, status: field(/^\[(.+)\]$/m) ?? 'no data' })
      continue
    }
    const list = (value?: string) => (value && value !== '-' ? value.split(/,\s*/).filter(Boolean) : [])
    const rating = body.match(/rating ([\d.]+) \(([^)]*)\)/)
    pages.push({
      url,
      status: 200,
      title: field(/^T: (.*)$/m),
      words: Number(words),
      faq: Array.from({ length: Number(field(/FAQ (\d+)/) ?? 0) }, () => ''),
      schema: list(field(/schema: ([^|\n]*)/)),
      rating: rating ? { value: rating[1], count: rating[2] } : null,
      signals: {
        prices: list(field(/price: ([^|\n]*)/)),
        schedule: field(/schedule: (\S+)/) === 'yes' ? ['yes'] : [],
        certificate: field(/certificate: (\S+)/) === 'yes',
        jobs: field(/jobs: (\S+)/) === 'yes',
        testimonials: field(/testimonials: (\S+)/) === 'yes',
      },
      media: { videos: Number(field(/videos (\d+)/) ?? 0) },
    })
  }
  return pages
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
}

const shortUrl = (url: string) => {
  try {
    const { hostname, pathname } = new URL(url)
    return `${hostname.replace(/^www\./, '')}${pathname === '/' ? '' : decodeURIComponent(pathname)}`
  } catch {
    return url
  }
}

const Mark = ({ value }: { value: boolean }) => (
  <span className={value ? 'seo-page__yes' : 'seo-page__no'}>{value ? 'Yes' : 'No'}</span>
)

function PageRow({ page, ours }: { page: Page; ours?: boolean }) {
  const price = page.signals?.prices?.slice(0, 2).join(', ')
  return (
    <tr className={ours ? 'seo-page__ours' : undefined}>
      <td>
        <a href={page.url} target="_blank" rel="noreferrer" title={page.title || page.url}>
          {shortUrl(page.url)}
        </a>
        {page.title ? <span className="seo-page__page-title">{page.title}</span> : null}
      </td>
      {ok(page) ? (
        <>
          <td className="seo-page__num">
            {page.words ?? '–'}
            {page.change?.wordsBefore && page.change.wordsBefore !== page.words ? (
              <span className="seo-page__page-title">was {page.change.wordsBefore}</span>
            ) : null}
          </td>
          <td>{price || <Mark value={false} />}</td>
          <td>
            <Mark value={Boolean(page.signals?.testimonials)} />
          </td>
          <td>
            <Mark value={Boolean(page.schema?.some((t) => /Restaurant|FoodEstablishment|LocalBusiness/.test(t)))} />
          </td>
          <td className="seo-page__num">{page.faq?.length || '–'}</td>
          <td>{page.rating ? `${page.rating.value ?? '?'} (${page.rating.count ?? '?'})` : '–'}</td>
          <td className="seo-page__num">{page.media?.videos || '–'}</td>
        </>
      ) : (
        <td colSpan={7} className="seo-page__page-title">
          Could not load ({String(page.status)})
        </td>
      )}
    </tr>
  )
}

export async function SeoCompetitorsView(props: AdminViewServerProps) {
  const dir = path.join(stateDir(), 'competitors')
  const files = await readdir(dir).catch(() => [] as string[])
  const [snapshots, oursFile, report, notes] = await Promise.all([
    Promise.all(
      files
        .filter((file) => file.endsWith('.json') && file !== 'ours.json')
        .map((file) => readJson<Page>(path.join(dir, file))),
    ),
    readJson<{ generatedAt?: string; pages?: Page[] }>(path.join(dir, 'ours.json')),
    readText(path.join(dir, 'report.md')),
    readText(path.join(stateDir(), 'competitor-notes.md')),
  ])

  const competitors = snapshots
    .filter((page): page is Page => Boolean(page?.url))
    .sort((a, b) => (b.words || 0) - (a.words || 0))
  const intro = 'How the pages that rank for our keywords compare with ours. The agent studies them weekly and never copies their text.'
  if (!competitors.length && !report) {
    return (
      <SeoPage props={props} title="Competitors" intro={intro}>
        <NoAgentData />
      </SeoPage>
    )
  }

  const loaded = competitors.filter(ok)
  // ours.json from the tool; older reports only have our pages as text in report.md.
  const ours = (oursFile?.pages?.length ? oursFile.pages : report ? oursFromReport(report.text) : []).filter(
    (page) => page?.url,
  )
  const oursLoaded = ours.filter(ok)
  const share = (has: (page: Page) => boolean) =>
    loaded.length ? Math.round((100 * loaded.filter(has).length) / loaded.length) : 0
  const actions = notes ? bullets(notes.text) : []

  return (
    <SeoPage props={props} title="Competitors" intro={intro}>
      <div className="seo-page__body">
      <p className="seo-page__meta">
        {loaded.length} competitor pages compared{report ? ` · report ${formatDay(report.updatedAt)}` : ''}
      </p>

      {actions.length ? (
        <div className="seo-page__card">
          <h3>What the agent will do about it</h3>
          {notes ? <p className="seo-page__meta">From competitor-notes.md, updated {formatDay(notes.updatedAt)}</p> : null}
          <ol className="seo-page__list">
            {actions.map((item, index) => (
              <li key={index}>
                <Inline text={item} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {loaded.length ? (
        <div className="seo-page__card">
          <h3>How competitors compare</h3>
          <p className="seo-page__meta">
            Share of the {loaded.length} competitor pages that have each thing
            {oursLoaded.length ? `, and whether any of our ${oursLoaded.length} checked pages has it` : ''}.
          </p>
          <div className="seo-page__stats">
            <div>
              <strong>{median(loaded.map((page) => page.words || 0))}</strong>
              <span>Median words</span>
              {oursLoaded.length ? (
                <span className="seo-page__page-title">
                  Ours: {median(oursLoaded.map((page) => page.words || 0))}
                </span>
              ) : null}
            </div>
            {CHECKS.map((check) => (
              <div key={check.label}>
                <strong>{share(check.has)}%</strong>
                <span>{check.label}</span>
                {oursLoaded.length ? (
                  <span className="seo-page__page-title">
                    Ours: <Mark value={oursLoaded.some(check.has)} />
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {competitors.length ? (
        <div className="seo-page__table-wrap">
          <table className="seo-page__table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Words</th>
                <th>Price</th>
                <th>Reviews</th>
                <th>Restaurant data</th>
                <th>FAQ</th>
                <th>Rating</th>
                <th>Videos</th>
              </tr>
            </thead>
            {ours.length ? (
              <tbody>
                <tr>
                  <th colSpan={8} className="seo-page__group">
                    Our pages
                  </th>
                </tr>
                {ours.map((page) => (
                  <PageRow key={page.url} page={page} ours />
                ))}
              </tbody>
            ) : null}
            <tbody>
              <tr>
                <th colSpan={8} className="seo-page__group">
                  Competitor pages, longest first
                </th>
              </tr>
              {competitors.map((page) => (
                <PageRow key={page.url} page={page} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {report ? (
        <details className="seo-page__raw">
          <summary>
            Full report as written: page outlines and questions
          </summary>
          <pre>{report.text.trim()}</pre>
        </details>
      ) : null}
      </div>
    </SeoPage>
  )
}
