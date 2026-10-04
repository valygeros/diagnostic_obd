import { describe, expect, it, vi } from 'vitest'
import { DtcDatabase } from './lookup'
import type { DtcEntry } from './types'

const P0301: Partial<DtcEntry> = {
  code: 'P0301',
  title: "Raté d'allumage — cylindre 1",
  urgency: 'stop',
}
const files: Record<string, unknown> = {
  'dtc/index.json': { prefixes: ['P03', 'U01'] },
  'dtc/P03.json': { P0301 },
  'dtc/U01.json': {},
}

function db() {
  const fetcher = vi.fn(async (path: string) => {
    if (!(path in files)) throw new Error('404')
    return files[path]
  })
  return { db: new DtcDatabase(fetcher), fetcher }
}

describe('DtcDatabase', () => {
  it('finds a documented code', async () => {
    const r = await db().db.lookup('p0301')
    expect(r).toEqual({ found: true, entry: P0301 })
  })

  it('fetches each prefix file once', async () => {
    const { db: d, fetcher } = db()
    await d.lookupMany(['P0301', 'P0302', 'P0301'])
    expect(fetcher.mock.calls.filter(([p]) => p === 'dtc/P03.json')).toHaveLength(1)
  })

  it('answers honestly for an undocumented manufacturer code', async () => {
    const r = await db().db.lookup('P1234')
    expect(r).toEqual({
      found: false,
      code: 'P1234',
      system: 'Moteur et transmission',
      generic: false,
    })
  })

  it('answers for a missing generic code in an existing file', async () => {
    const r = await db().db.lookup('U0199')
    expect(r.found).toBe(false)
  })

  it('does not throw when offline, and retries later', async () => {
    let online = false
    const fetcher = vi.fn(async (path: string) => {
      if (!online) throw new Error('offline')
      return files[path]
    })
    const d = new DtcDatabase(fetcher)
    expect((await d.lookup('P0301')).found).toBe(false)
    online = true
    expect((await d.lookup('P0301')).found).toBe(true)
  })

  it('rejects malformed codes without fetching', async () => {
    const { db: d, fetcher } = db()
    expect((await d.lookup('XYZ')).found).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
