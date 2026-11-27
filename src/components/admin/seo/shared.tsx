import { readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import React from 'react'

/**
 * The nightly SEO agent (hos-fe-v2/seo-agent) keeps its notes as files on the server, in
 * ~/.seo-agent-hos/state. The CMS runs on the same server, so the SEO pages read them straight
 * from disk. Set SEO_AGENT_STATE_DIR when the CMS runs as another user (e.g. root).
 */
export const stateDir = () =>
  process.env.SEO_AGENT_STATE_DIR || path.join(os.homedir(), '.seo-agent-hos', 'state')

export async function readText(file: string) {
  try {
    const [text, info] = await Promise.all([readFile(file, 'utf8'), stat(file)])
    return { text, updatedAt: info.mtime }
  } catch {
    return null
  }
}

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

/** List items ("- x", "* x", "1. x"), with indented continuation lines joined on. */
export function bullets(markdown: string): string[] {
  const items: string[] = []
  for (const line of markdown.split(/\r?\n/)) {
    const item = line.match(/^(?:[-*]|\d+[.)])\s+(.*)$/)
    if (item) items.push(item[1].trim())
    else if (items.length && /^\s+\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`
  }
  return items.filter(Boolean)
}

export const formatDate = (date: Date) =>
  date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short' })

export const formatDay = (date: Date) =>
  date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium' })

/** `code` spans and **bold** from the agent's Markdown; everything else stays plain text. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
          <code key={index}>{part.slice(1, -1)}</code>
        ) : part.startsWith('**') && part.endsWith('**') && part.length > 3 ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}
