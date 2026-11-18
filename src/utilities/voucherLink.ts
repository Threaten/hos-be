import qrcode from 'qrcode-generator'

/**
 * Where a branch site lives. Production is https://<domain>.houseofsenses.vn;
 * set SITE_DOMAIN (and SITE_PROTOCOL) to point at a local front end instead.
 */
const SITE_DOMAIN = process.env.SITE_DOMAIN || 'houseofsenses.vn'
const SITE_PROTOCOL = process.env.SITE_PROTOCOL || 'https'

/** The page on the branch's own site that a voucher's QR code opens */
export function voucherUrl(branchDomain: string, code: string): string {
  return `${SITE_PROTOCOL}://${branchDomain}.${SITE_DOMAIN}/voucher/${encodeURIComponent(code)}`
}

/** A QR code for `text` as a standalone SVG, dark modules on white */
export function qrSvg(text: string, { cell = 10, margin = 4 } = {}): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  const size = (count + margin * 2) * cell
  let path = ''
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${(col + margin) * cell},${(row + margin) * cell}h${cell}v${cell}h-${cell}z`
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#ffffff"/><path d="${path}" fill="#1c1a19"/></svg>`
  )
}
