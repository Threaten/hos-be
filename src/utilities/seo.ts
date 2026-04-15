import type { CollectionSlug, Payload } from 'payload'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// Cache for tenant configs to avoid repeated database queries per request
const tenantConfigCache = new Map<string, TenantConfig | null>()

export interface TenantConfig {
  name: string
  slug: string
  domain?: string
  description?: string
}

/**
 * Fetch a tenant by ID from the database
 */
async function getTenantById(id: string | number): Promise<Record<string, unknown> | null> {
  try {
    const payload: Payload = await getPayload({ config: configPromise })
    const tenant = await payload.findByID({
      collection: 'tenants' as CollectionSlug,
      id: String(id),
    })
    return tenant as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Get tenant configuration with caching.
 * Accepts a tenant object, string ID, or numeric ID.
 */
export async function getTenantConfig(
  tenant: Record<string, unknown> | string | number | undefined | null,
): Promise<TenantConfig | null> {
  if (!tenant) return null

  let tenantId: string | number
  if (typeof tenant === 'string' || typeof tenant === 'number') {
    tenantId = tenant
  } else if (typeof tenant === 'object' && 'id' in tenant) {
    tenantId = (tenant as { id: string | number }).id
  } else {
    return null
  }

  const cacheKey = String(tenantId)
  if (tenantConfigCache.has(cacheKey)) {
    return tenantConfigCache.get(cacheKey) ?? null
  }

  try {
    const tenantData = await getTenantById(tenantId)
    if (tenantData) {
      const config: TenantConfig = {
        name: (tenantData.name as string) || 'House of Senses',
        slug: (tenantData.domain as string) || '',
        domain: tenantData.domain as string | undefined,
        description: tenantData.heroDescription as string | undefined,
      }
      tenantConfigCache.set(cacheKey, config)
      return config
    }
  } catch (error) {
    console.warn(`[getTenantConfig] Error fetching tenant ${tenantId}:`, error)
  }

  tenantConfigCache.set(cacheKey, null)
  return null
}

/**
 * Auto-generate SEO title for Payload collections.
 * Format: "{name} | House of Senses" (max 60 chars)
 * Skips generation if meta.title is already manually set.
 */
export async function generateSeoTitle({ doc }: { doc: Record<string, unknown> }): Promise<string> {
  try {
    const meta = doc.meta as Record<string, unknown> | undefined
    if (meta?.title) {
      return meta.title as string
    }

    const title = (doc.name as string) || (doc.title as string) || ''
    if (!title) return ''

    let tenantSuffix = 'House of Senses'
    if (doc.tenant) {
      const config = await getTenantConfig(
        doc.tenant as Record<string, unknown> | string | number,
      )
      if (config?.name) {
        tenantSuffix = config.name
      }
    }

    const combined = `${title} | ${tenantSuffix}`
    return combined.length > 60 ? combined.substring(0, 57) + '...' : combined
  } catch (error) {
    console.warn('[generateSeoTitle] Error:', error)
    return ''
  }
}

/**
 * Auto-generate SEO description from content fields.
 * Tries: heroDescription → description (max 160 chars)
 * Skips generation if meta.description is already manually set.
 */
export async function generateSeoDescription({
  doc,
}: {
  doc: Record<string, unknown>
}): Promise<string> {
  try {
    const meta = doc.meta as Record<string, unknown> | undefined
    if (meta?.description) {
      return meta.description as string
    }

    const candidates = [
      doc.heroDescription,
      doc.description,
    ] as (string | undefined)[]

    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'string') {
        return candidate.length > 160 ? candidate.substring(0, 157) + '...' : candidate
      }
    }

    return ''
  } catch (error) {
    console.warn('[generateSeoDescription] Error:', error)
    return ''
  }
}
