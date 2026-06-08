import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Load .env manually (avoid depending on dotenv at build time)
const envPath = resolve(root, '.env')
let apiKey = ''
try {
  const envContent = readFileSync(envPath, 'utf8')
  const match = envContent.match(/^TMDB_API_KEY=(.+)$/m)
  if (match) apiKey = match[1].trim()
} catch {
  console.error('✗ .env not found at', envPath)
  process.exit(1)
}

if (!apiKey) {
  console.error('✗ TMDB_API_KEY not found in .env')
  process.exit(1)
}

// Inject into compiled dist-electron/tmdb.js
const tmdbPath = resolve(root, 'dist-electron/tmdb.js')
let content = readFileSync(tmdbPath, 'utf8')

// Replace process.env.TMDB_API_KEY ?? '' with the hardcoded value
const before = content
content = content.replace(
  /process\.env\.TMDB_API_KEY\s*\?\?\s*['"]{2}/g,
  `"${apiKey}" ?? ""`
)

if (content === before) {
  console.warn('⚠ Pattern not found — tmdb.js may already be injected or format changed')
} else {
  writeFileSync(tmdbPath, content)
  console.log('✓ TMDB_API_KEY injected into dist-electron/tmdb.js')
}
