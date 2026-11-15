/**
 * Moves branch photos into photo sets.
 *
 *   before                                   after (per branch)
 *   tenants.heroImagesList[].image      →    photoSets: "The room"
 *   tenants.shortAboutCollages[].image  →    photoSets: "The table" + aboutPhotos (first two)
 *   gallery docs (branch = tenant)      →    photoSets: "Moments" (newest first)
 *   gallery.caption                     →    media.caption, when the photo has none
 *   media.caption "hos-seed:…"          →    removed (old seed bookkeeping, not a caption)
 *
 * Dry run by default; set APPLY=1 to write (`payload run` does not pass
 * command-line flags through to scripts). Branches that already have photo
 * sets are skipped, so it is safe to run twice. Old fields and the gallery
 * collection are left untouched in the database (backed up to a JSON file
 * first) and can be dropped by hand once the new site is live.
 *
 *   pnpm migrate:photo-sets             # show what would change
 *   APPLY=1 pnpm migrate:photo-sets     # do it
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

type Raw = Record<string, any>

const apply = process.env.APPLY === '1'
const id = (v: unknown): string | null => (v == null ? null : String((v as Raw)?._id ?? v))
const unique = (ids: (string | null)[]) => [...new Set(ids.filter(Boolean) as string[])]
/** Earlier seeds stored a lookup key in the caption; the site now shows captions */
const isSeedMarker = (caption: unknown) => typeof caption === 'string' && caption.startsWith('hos-seed:')

const payload = await getPayload({ config })
try {
  const db = payload.db.connection.db!
  const names = (await db.listCollections().toArray()).map((c) => c.name)
  const galleryName = ['galleries', 'gallery'].find((n) => names.includes(n))

  const tenants = await db.collection('tenants').find({}).toArray()
  const gallery = galleryName
    ? await db.collection(galleryName).find({}).sort({ createdAt: -1 }).toArray()
    : []

  const backup = path.join(os.tmpdir(), `hos-photos-${Date.now()}.json`)
  await writeFile(
    backup,
    JSON.stringify(
      {
        tenants: tenants.map((t) => ({
          id: String(t._id),
          name: t.name,
          heroImagesList: t.heroImagesList,
          shortAboutCollages: t.shortAboutCollages,
          photoSets: t.photoSets,
          aboutPhotos: t.aboutPhotos,
        })),
        gallery,
      },
      null,
      2,
    ),
    { flag: 'wx', mode: 0o600 },
  )
  payload.logger.info(`Backed up current photo data to ${backup}`)
  payload.logger.info(apply ? 'Applying changes' : 'Dry run (set APPLY=1 to write)')

  /** Media given a real caption below; never clear these */
  const captioned = new Set<string>()

  for (const t of tenants) {
    const tenantID = String(t._id)
    if (Array.isArray(t.photoSets) && t.photoSets.length > 0) {
      payload.logger.info(`${t.name}: already has photo sets, skipped`)
      continue
    }

    const room = unique((t.heroImagesList ?? []).map((r: Raw) => id(r.image)))
    const table = unique((t.shortAboutCollages ?? []).map((r: Raw) => id(r.image)))
    const own = gallery.filter((g) => id(g.branch) === tenantID && g.image)
    const moments = unique(own.map((g) => id(g.image)))

    const photoSets = [
      { title: 'The room', photos: room },
      { title: 'The table', photos: table },
      { title: 'Moments', photos: moments },
    ].filter((s) => s.photos.length > 0)
    const aboutPhotos =
      Array.isArray(t.aboutPhotos) && t.aboutPhotos.length ? undefined : table.slice(0, 2)

    payload.logger.info(
      `${t.name}: ${photoSets.map((s) => `${s.title} (${s.photos.length})`).join(', ') || 'no photos'}` +
        (aboutPhotos ? `; story photos ${aboutPhotos.length}` : ''),
    )

    if (apply) {
      await payload.update({
        collection: 'tenants',
        id: tenantID,
        data: { photoSets, ...(aboutPhotos ? { aboutPhotos } : {}) },
        depth: 0,
      })
    }

    // Gallery captions now live on the photo itself
    for (const g of own) {
      const caption = typeof g.caption === 'string' ? g.caption.trim() : ''
      const mediaID = id(g.image)
      if (!caption || !mediaID) continue
      const media = await payload.findByID({ collection: 'media', id: mediaID, depth: 0 }).catch(() => null)
      if (!media || (media.caption && !isSeedMarker(media.caption))) continue
      if (captioned.has(mediaID)) continue
      captioned.add(mediaID)
      payload.logger.info(`  caption → ${media.filename}: "${caption}"`)
      if (apply) {
        await payload.update({
          collection: 'media',
          id: mediaID,
          data: { caption, ...(media.alt && !/\.(webp|png|jpe?g)$/i.test(media.alt) ? {} : { alt: caption }) },
          depth: 0,
        })
      }
    }
  }

  // Any seed markers left (photos with no gallery caption): clear them
  const marked = await payload.find({
    collection: 'media',
    where: { caption: { like: 'hos-seed:' } },
    pagination: false,
    depth: 0,
  })
  for (const m of marked.docs.filter((d) => isSeedMarker(d.caption) && !captioned.has(String(d.id)))) {
    payload.logger.info(`caption cleared → ${m.filename}`)
    if (apply) {
      await payload.update({ collection: 'media', id: m.id, data: { caption: null }, depth: 0 })
    }
  }
} finally {
  await payload.destroy()
}
