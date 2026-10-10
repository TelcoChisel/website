#!/usr/bin/env node
/**
 * Refresh data/tools.js from catalog/tools.json.
 * With --pull, download the SoT from TelcoChiselOS main first.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const catalogPath = path.join(root, 'catalog', 'tools.json')
const outPath = path.join(root, 'data', 'tools.js')
const SOT_URL =
  'https://raw.githubusercontent.com/TelcoChisel/TelcoChiselOS/main/data/tools.json'

async function pull() {
  const res = await fetch(SOT_URL)
  if (!res.ok) throw new Error(`fetch ${SOT_URL}: ${res.status}`)
  const text = await res.text()
  JSON.parse(text) // validate
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true })
  fs.writeFileSync(catalogPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
  console.log(`Pulled SoT → ${path.relative(root, catalogPath)}`)
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function generate(catalog) {
  const items = catalog.map((tool) => {
    const obj = {
      name: tool.name,
      slug: tool.slug || slugify(tool.name),
      category: tool.category,
      status: tool.status,
      desc: tool.desc,
      path: tool.path,
      cmd: tool.cmd
    }
    const lines = Object.entries(obj).map(([k, v]) => `        ${k}: ${JSON.stringify(v)}`)
    return `    {\n${lines.join(',\n')}\n    }`
  })
  return `export const toolsCatalog = [\n${items.join(',\n')}\n];\n`
}

async function main() {
  if (process.argv.includes('--pull')) await pull()
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Missing ${catalogPath}. Run with --pull or copy tools.json there.`)
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, generate(catalog), 'utf8')
  console.log(`Wrote ${path.relative(root, outPath)} (${catalog.length} tools)`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
