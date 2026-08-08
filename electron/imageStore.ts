import { app, protocol } from 'electron'
import log from 'electron-log'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

const SCHEME = 'catimg'

/** Pasta local onde as imagens em webp ficam guardadas (dentro do userData). */
export function getImagesDir(): string {
  const dir = path.join(app.getPath('userData'), 'images')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Um caminho é uma imagem local nossa? (catimg://arquivo.webp) */
export function isLocalImage(p?: string | null): boolean {
  return !!p && p.startsWith(`${SCHEME}://`)
}

/**
 * Deve ser chamado ANTES de app.whenReady(): registra o scheme catimg:// como
 * privilegiado, para que o renderer possa carregar as imagens tanto em dev
 * (origem http://localhost) quanto em produção (origem file://).
 */
export function registerImageScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true },
    },
  ])
}

/** Deve ser chamado depois de app.whenReady(): serve os arquivos de catimg://. */
export function serveImageProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const raw = request.url.slice(`${SCHEME}://`.length)
    // basename evita path traversal (ex.: catimg://../../algo)
    const filename = path.basename(decodeURIComponent(raw))
    const filePath = path.join(getImagesDir(), filename)
    try {
      const data = await fs.promises.readFile(filePath)
      return new Response(new Uint8Array(data), { headers: { 'content-type': 'image/webp' } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

/**
 * Baixa uma imagem remota (URL do TMDB), converte para webp redimensionado e
 * salva localmente. Retorna o caminho catimg:// ou null se falhar / não for URL.
 */
export async function localizeRemoteImage(
  url: string | null | undefined,
  kind: 'poster' | 'backdrop',
): Promise<string | null> {
  if (!url || !url.startsWith('http')) return null // vazio ou já local

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const input = Buffer.from(await res.arrayBuffer())

    const width = kind === 'poster' ? 500 : 1280
    const output = await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    const name = `${kind}_${randomUUID()}.webp`
    fs.writeFileSync(path.join(getImagesDir(), name), output)
    return `${SCHEME}://${name}`
  } catch (err) {
    log.error(`Falha ao localizar imagem (${kind}):`, url, err)
    return null
  }
}

/**
 * Localiza cover_path e backdrop_path de um objeto de mídia antes de persistir.
 * Se a conversão falhar, mantém a URL original como fallback (degradação suave).
 */
export async function localizeMediaImages<
  T extends { cover_path?: string | null; backdrop_path?: string | null },
>(input: T): Promise<T> {
  const [cover, backdrop] = await Promise.all([
    localizeRemoteImage(input.cover_path, 'poster'),
    localizeRemoteImage(input.backdrop_path, 'backdrop'),
  ])

  return {
    ...input,
    cover_path: cover ?? input.cover_path,
    backdrop_path: backdrop ?? input.backdrop_path,
  }
}

/** Remove o arquivo local de uma imagem catimg://, se existir. */
export function deleteLocalImage(p?: string | null) {
  if (!isLocalImage(p)) return
  try {
    const filename = path.basename(p!.slice(`${SCHEME}://`.length))
    const filePath = path.join(getImagesDir(), filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (err) {
    log.error('Falha ao remover imagem local:', p, err)
  }
}
