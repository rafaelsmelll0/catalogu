import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const exe    = resolve(root, 'release/win-unpacked/Catalogu.exe')
const ico    = resolve(root, 'src/assets/catalogu.ico')
const rcedit = resolve(root, 'node_modules/rcedit/bin/rcedit.exe')

if (!existsSync(exe))    { console.error('Catalogu.exe não encontrado'); process.exit(1) }
if (!existsSync(ico))    { console.error('catalogu.ico não encontrado'); process.exit(1) }
if (!existsSync(rcedit)) { console.error('rcedit não encontrado'); process.exit(1) }

execSync(`"${rcedit}" "${exe}" --set-icon "${ico}"`)
console.log('✅ Ícone aplicado no Catalogu.exe')
