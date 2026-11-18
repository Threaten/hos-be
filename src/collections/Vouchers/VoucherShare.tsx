'use client'

import { useEffect, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'

const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN || 'houseofsenses.vn'
const SITE_PROTOCOL = process.env.NEXT_PUBLIC_SITE_PROTOCOL || 'https'

/** Turn the QR SVG into a PNG file, which chat apps accept more readily */
async function qrPng(src: string, name: string): Promise<File> {
  const svg = await (await fetch(src)).text()
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d')!.drawImage(img, 0, 0, size, size)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the QR code'))), 'image/png'),
  )
  return new File([blob], name, { type: 'image/png' })
}

/** Sidebar panel on a saved voucher: its QR code and link, ready to share */
export function VoucherShare() {
  const code = useFormFields(([fields]) => fields.code?.value as string | undefined)
  const branch = useFormFields(([fields]) => fields.branch?.value as string | { id: string } | undefined)
  const status = useFormFields(([fields]) => fields.status?.value as string | undefined)
  const [domain, setDomain] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const branchID = typeof branch === 'object' ? branch?.id : branch
  useEffect(() => {
    if (!branchID) return
    fetch(`/api/tenants/${branchID}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => setDomain(t?.domain ?? null))
      .catch(() => setDomain(null))
  }, [branchID])

  if (!code) return null
  const link = domain ? `${SITE_PROTOCOL}://${domain}.${SITE_DOMAIN}/voucher/${code}` : null
  const qr = `/api/vouchers/qr/${encodeURIComponent(code)}`
  const fileName = `voucher-${code}.png`

  const flash = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 2500)
  }

  const copy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    flash('Link copied')
  }

  const download = async () => {
    const file = await qrPng(qr, fileName)
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const share = async () => {
    if (!link) return
    try {
      const file = await qrPng(qr, fileName)
      const withFile = { files: [file], title: 'Your voucher', text: link }
      if (navigator.canShare?.(withFile)) await navigator.share(withFile)
      else if (navigator.share) await navigator.share({ title: 'Your voucher', url: link })
      else await copy()
    } catch {
      // Closing the share sheet is not an error
    }
  }

  const inactive = status && status !== 'active'

  return (
    <div style={{ marginBottom: 'calc(var(--base) * 1.5)' }}>
      <div className="field-label" style={{ marginBottom: 8 }}>
        Share with the guest
      </div>
      <img
        src={qr}
        alt="Voucher QR code"
        width={220}
        height={220}
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 220,
          height: 'auto',
          borderRadius: 4,
          opacity: inactive ? 0.35 : 1,
        }}
      />
      {inactive && (
        <p style={{ margin: '8px 0 0', color: 'var(--theme-error-500)' }}>
          {status === 'used' ? 'Already used.' : 'Cancelled.'} This QR code no longer works.
        </p>
      )}
      <p style={{ margin: '10px 0', wordBreak: 'break-all', fontSize: 12, color: 'var(--theme-elevation-600)' }}>
        {link ?? 'Loading link…'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn btn--style-primary btn--size-small" onClick={share} disabled={!link}>
          Share
        </button>
        <button type="button" className="btn btn--style-secondary btn--size-small" onClick={copy} disabled={!link}>
          Copy link
        </button>
        <button type="button" className="btn btn--style-secondary btn--size-small" onClick={download}>
          Download QR
        </button>
      </div>
      {notice && <p style={{ margin: '8px 0 0', fontSize: 12 }}>{notice}</p>}
    </div>
  )
}
