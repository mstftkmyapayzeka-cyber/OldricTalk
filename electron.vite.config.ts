import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// `dosya.wasm?base64` → base64 metin. Paketlenmiş uygulama file:// üzerinden açıldığı için
// .wasm'ı fetch ile okumak yerine pakete gömüyoruz (RNNoise gürültü engelleme).
function wasmBase64(): Plugin {
  const suffix = '?base64'
  return {
    name: 'wasm-base64',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith('.wasm' + suffix)) return null
      const data = await readFile(id.slice(0, -suffix.length))
      return `export default ${JSON.stringify(data.toString('base64'))}`
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: { '@': resolve('src/renderer/src') }
    },
    plugins: [wasmBase64(), react()]
  }
})
