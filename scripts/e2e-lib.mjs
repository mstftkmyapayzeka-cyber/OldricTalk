// Uçtan uca testlerin ortak yardımcıları: iki ayrı veri klasörüyle uygulama açma,
// giriş, ekran görüntüsü, adım raporu.
import { _electron as electron } from 'playwright-core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')),
  '..'
)
export const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.test'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)
export const T = 20_000

export function shotsDir(arg) {
  const dir = path.resolve(arg ?? path.join(root, 'out', 'shots'))
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// VS Code gibi Electron tabanlı bir ortamdan çalışınca miras kalan bu değişken
// Electron'u düz Node olarak başlatır.
const { ELECTRON_RUN_AS_NODE: _ignored, ...baseEnv } = process.env

export async function launch(name) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `oldric-${name}-`))
  const app = await electron.launch({
    args: [root],
    cwd: root,
    env: { ...baseEnv, OLDRIC_TEST_PROFILE: profile }
  })
  const win = await app.firstWindow()
  win.on('console', (m) => {
    const t = m.text()
    if (t.includes('Electron Security Warning') || t.startsWith('[realtime]')) return
    if (m.type() === 'error' || m.type() === 'warning') console.log(`  [${name}] ${t}`)
  })
  return { app, win, name }
}

export async function shot(dir, c, file) {
  await c.win.waitForTimeout(400)
  await c.win.screenshot({ path: path.join(dir, file) })
  console.log('  📸', file)
}

export async function login(c, email, password) {
  await c.win.getByLabel('E-posta').fill(email)
  await c.win.getByLabel('Şifre').fill(password)
  await c.win.getByRole('button', { name: 'Giriş Yap' }).click()
  await c.win.getByRole('link', { name: 'Arkadaşlar' }).waitFor({ timeout: T })
}

export async function step(title, fn) {
  process.stdout.write(`• ${title}\n`)
  await fn()
}
