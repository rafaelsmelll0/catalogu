// Hook do electron-builder: roda depois de empacotar o app (win-unpacked)
// e ANTES de montar o instalador NSIS. É o momento certo para gravar o ícone
// no Catalogu.exe, já que signAndEditExecutable:false (desligado para evitar o
// winCodeSign, que exige symlinks/Modo Desenvolvedor no Windows).
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const root   = path.resolve(__dirname, '..')
  const exeName = `${context.packager.appInfo.productFilename}.exe` // "Catalogu.exe"
  const exe    = path.join(context.appOutDir, exeName)
  const ico    = path.join(root, 'src/assets/catalogu.ico')
  const rcedit = path.join(root, 'node_modules/rcedit/bin/rcedit.exe')

  for (const [label, p] of [['exe', exe], ['ico', ico], ['rcedit', rcedit]]) {
    if (!fs.existsSync(p)) {
      console.warn(`[afterPack] ${label} não encontrado (${p}); ícone não aplicado.`)
      return
    }
  }

  execSync(`"${rcedit}" "${exe}" --set-icon "${ico}"`)
  console.log(`[afterPack] ✅ ícone aplicado em ${exe}`)
}
