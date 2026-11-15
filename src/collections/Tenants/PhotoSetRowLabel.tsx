'use client'

import { useRowLabel } from '@payloadcms/ui'

/** "The room · 10 photos" instead of "Set 01" on collapsed photo sets */
export function PhotoSetRowLabel() {
  const { data, rowNumber } = useRowLabel<{ title?: string; photos?: unknown[] }>()
  const count = data?.photos?.length ?? 0
  const title = data?.title?.trim() || `Set ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`
  return (
    <span>
      {title}
      <span style={{ opacity: 0.55 }}> · {count} {count === 1 ? 'photo' : 'photos'}</span>
    </span>
  )
}
