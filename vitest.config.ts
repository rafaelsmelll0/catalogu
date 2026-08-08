import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['electron/__tests__/**/*.test.ts'],
  },
  resolve: {
    // A camada Electron usa imports com extensão .js (estilo NodeNext) apontando
    // para arquivos .ts. O Vite não reescreve isso sozinho, então removemos a
    // extensão .js dos imports relativos para o resolver achar o .ts.
    alias: [{ find: /^(\.\.?\/.*)\.js$/, replacement: '$1' }],
  },
})
