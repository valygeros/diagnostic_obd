/**
 * Builds the fault-code base served with the site (CLAUDE.md §7).
 *
 * Inputs
 *   data/dtc/source/*_enriched.yaml   OBDex (CC0), fetched with `npm run db:fetch`
 *   data/dtc/fr/curated.json          hand-written French sheets (override everything)
 *   data/dtc/fr/symptoms.json         EN → FR symptoms
 *   data/dtc/fr/causes.json           EN → FR causes
 *   scripts/lib/title-fr.mjs          structured title translator
 *   scripts/lib/urgency.mjs           severity rules
 *
 * Output
 *   public/dtc/<prefix>.json   one file per 3-char prefix (P03, U01…), fetched on demand
 *   public/dtc/index.json      version, counts, translation coverage
 *
 * Every text field carries its language, so the UI can flag what is still in English.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import * as yaml from 'js-yaml'
import { translateTitle } from './lib/title-fr.mjs'
import { deriveUrgency } from './lib/urgency.mjs'

const SRC = 'data/dtc/source/'
const OUT = 'public/dtc/'

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const curated = readJson('data/dtc/fr/curated.json').codes
const symptomsFr = readJson('data/dtc/fr/symptoms.json')
const causesFr = readJson('data/dtc/fr/causes.json')

const sourceFiles = existsSync(SRC)
  ? readdirSync(SRC).filter((f) => f.endsWith('_enriched.yaml'))
  : []
if (sourceFiles.length === 0) {
  console.error("Sources OBDex absentes : lance `npm run db:fetch` d'abord.")
  process.exit(1)
}

const stats = {
  codes: 0,
  curated: 0,
  titleFr: 0,
  causes: 0,
  causesFr: 0,
  symptoms: 0,
  symptomsFr: 0,
}
const chunks = new Map()

for (const file of sourceFiles) {
  for (const c of yaml.load(readFileSync(SRC + file, 'utf8'))) {
    stats.codes++
    const cur = curated[c.code]
    if (cur) stats.curated++
    const titleEn = c.title.en

    let title
    let titleLang = 'fr'
    let titleSource
    if (cur?.title) {
      title = cur.title
      titleSource = 'curated'
    } else {
      const auto = translateTitle(titleEn)
      title = auto ?? titleEn
      titleLang = auto ? 'fr' : 'en'
      titleSource = auto ? 'auto' : 'source'
    }
    if (titleLang === 'fr') stats.titleFr++

    const causes = cur?.causes
      ? cur.causes.map((x) => ({ text: x.text, likelihood: x.likelihood, lang: 'fr' }))
      : (c.common_causes ?? []).map((x) => {
          const fr = causesFr[x.label.en]
          return { text: fr ?? x.label.en, likelihood: x.likelihood, lang: fr ? 'fr' : 'en' }
        })
    stats.causes += causes.length
    stats.causesFr += causes.filter((x) => x.lang === 'fr').length

    const symptoms = (c.symptoms ?? []).map((s) => {
      const fr = symptomsFr[s.en]
      return { text: fr ?? s.en, lang: fr ? 'fr' : 'en' }
    })
    stats.symptoms += symptoms.length
    stats.symptomsFr += symptoms.filter((x) => x.lang === 'fr').length

    const entry = {
      code: c.code,
      title,
      titleLang,
      titleSource,
      titleEn,
      description: cur?.description ?? c.description?.en ?? '',
      descriptionLang: cur?.description ? 'fr' : 'en',
      symptoms,
      causes,
      checks: cur?.checks ?? [],
      urgency: cur?.urgency ?? deriveUrgency(c.code, titleEn, c.flags),
      urgencySource: cur?.urgency ? 'curated' : 'rule',
      flags: {
        mil: c.flags?.mil ?? null,
        emissions: c.flags?.emissions_relevant ?? null,
        limpMode: c.flags?.limp_mode_possible ?? null,
        driveCycle: c.flags?.drive_cycle_required ?? null,
      },
      repair: c.repair
        ? {
            difficulty: c.repair.difficulty ?? null,
            diy: c.repair.diy_possible ?? null,
            costEur: c.repair.estimated_cost_eur ?? null,
            hours: c.repair.estimated_hours ?? null,
          }
        : null,
      related: c.related_codes ?? [],
      sources: [
        ...(cur ? ['Fiche rédigée pour ce projet'] : []),
        'OBDex (CC0)',
        ...(c.sources ?? []),
      ],
    }

    const prefix = c.code.slice(0, 3)
    if (!chunks.has(prefix)) chunks.set(prefix, {})
    chunks.get(prefix)[c.code] = entry
  }
}

// Curated codes missing from OBDex would be silently lost: refuse.
for (const code of Object.keys(curated)) {
  const chunk = chunks.get(code.slice(0, 3))
  if (!chunk?.[code]) throw new Error(`Fiche ${code} : code absent d'OBDex`)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const [prefix, codes] of chunks) {
  writeFileSync(`${OUT}${prefix}.json`, JSON.stringify(codes))
}

const sha = readFileSync(SRC + 'SOURCE_VERSION', 'utf8').split(' ')[0]
const pct = (a, b) => Math.round((a / b) * 1000) / 10
const index = {
  version: 1,
  source: { name: 'OBDex', license: 'CC0-1.0', commit: sha },
  prefixes: [...chunks.keys()].sort(),
  counts: { codes: stats.codes, curated: stats.curated },
  translation: {
    titlesFr: pct(stats.titleFr, stats.codes),
    causesFr: pct(stats.causesFr, stats.causes),
    symptomsFr: pct(stats.symptomsFr, stats.symptoms),
    descriptionsFr: pct(stats.curated, stats.codes),
  },
}
writeFileSync(`${OUT}index.json`, JSON.stringify(index, null, 2))

console.log(`${stats.codes} codes → ${chunks.size} fichiers dans ${OUT}`)
console.log('Traduction FR :', index.translation)
