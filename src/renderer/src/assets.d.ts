// electron.vite.config.ts içindeki wasmBase64 eklentisi.
declare module '*.wasm?base64' {
  const base64: string
  export default base64
}
