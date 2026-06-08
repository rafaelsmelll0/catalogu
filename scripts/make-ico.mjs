import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(__dirname, '../src/assets/cat-head-512.png')
const out = path.join(__dirname, '../src/assets/catalogu.ico')

const SIZES = [16, 32, 48, 64, 128, 256]

async function buildIco() {
  const pngs = await Promise.all(
    SIZES.map(s => sharp(src).resize(s, s).png().toBuffer())
  )

  // ICO file format: header + directory + image data
  const numImages = pngs.length
  const headerSize = 6
  const dirEntrySize = 16
  const dirSize = numImages * dirEntrySize
  const dataOffset = headerSize + dirSize

  const offsets = []
  let pos = dataOffset
  for (const buf of pngs) {
    offsets.push(pos)
    pos += buf.length
  }

  const totalSize = pos
  const ico = Buffer.alloc(totalSize)

  // Header
  ico.writeUInt16LE(0, 0)      // reserved
  ico.writeUInt16LE(1, 2)      // type: ICO
  ico.writeUInt16LE(numImages, 4)

  // Directory entries
  for (let i = 0; i < numImages; i++) {
    const s = SIZES[i]
    const base = headerSize + i * dirEntrySize
    ico.writeUInt8(s === 256 ? 0 : s, base + 0)  // width (0 = 256)
    ico.writeUInt8(s === 256 ? 0 : s, base + 1)  // height
    ico.writeUInt8(0, base + 2)   // color count
    ico.writeUInt8(0, base + 3)   // reserved
    ico.writeUInt16LE(1, base + 4) // color planes
    ico.writeUInt16LE(32, base + 6) // bits per pixel
    ico.writeUInt32LE(pngs[i].length, base + 8)
    ico.writeUInt32LE(offsets[i], base + 12)
  }

  // Image data
  for (let i = 0; i < numImages; i++) {
    pngs[i].copy(ico, offsets[i])
  }

  fs.writeFileSync(out, ico)
  console.log(`ICO generated: ${out} (${ico.length} bytes, ${numImages} sizes: ${SIZES.join(',')})`)
}

buildIco().catch(e => { console.error(e); process.exit(1) })
