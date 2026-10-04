/**
 * Downloads the OBDex source data (CC0) at the pinned commit into data/dtc/source/.
 * Usage: npm run db:fetch
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const dir = 'data/dtc/source/'
const sha = readFileSync(dir + 'SOURCE_VERSION', 'utf8')
  .split(' ')[0]
  ?.trim()
if (!sha) throw new Error('data/dtc/source/SOURCE_VERSION is missing the commit SHA')

const FILES = [
  'data/generic/P0xxx_enriched.yaml',
  'data/generic/P2xxx_enriched.yaml',
  'data/generic/P3xxx_enriched.yaml',
  'data/generic/U0xxx_enriched.yaml',
  'data/generic/U3xxx_enriched.yaml',
  'data/generic/B0xxx_enriched.yaml',
  'data/generic/C0xxx_enriched.yaml',
  'data/pids/mode01.yaml',
]

mkdirSync(dir, { recursive: true })
for (const path of FILES) {
  const url = `https://raw.githubusercontent.com/foerbsnavi/OBDex/${sha}/${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  const name = path.split('/').at(-1)
  writeFileSync(dir + name, await res.text())
  console.log(`✓ ${name}`)
}
console.log(`OBDex @ ${sha.slice(0, 7)}`)
