import { getPayload } from 'payload'
import config from '../payload.config'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const payload = await getPayload({ config })
try {
  // Read raw records because the new text schema cannot represent old arrays.
  const collection = payload.db.connection.collection('tenants')
  const tenants = await collection.find({ openingHours: { $type: 'array' } }).toArray()
  if (tenants.length) {
    const backup = path.join(os.tmpdir(), `hos-opening-hours-${Date.now()}.json`)
    await writeFile(backup, JSON.stringify(tenants.map(({ _id, openingHours }) => ({
      id: String(_id), openingHours,
    })), null, 2), { flag: 'wx', mode: 0o600 })
    payload.logger.info(`Previous weekly schedules backed up to ${backup}`)
  }
  for (const tenant of tenants) {
    const counts = new Map<string, number>()
    for (const row of tenant.openingHours) {
      if (!row.closed && row.opens && row.closes) {
        const hours = `${row.opens}–${row.closes}`
        counts.set(hours, (counts.get(hours) || 0) + 1)
      }
    }
    const openingHours = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    await collection.updateOne(
      { _id: tenant._id, openingHours: tenant.openingHours },
      { $set: { openingHours } },
    )
    payload.logger.info(`Converted ${tenant.name} opening hours to "${openingHours}"`)
  }
} finally {
  await payload.destroy()
}
