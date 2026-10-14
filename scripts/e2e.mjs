// Uçtan uca senaryo: iki uygulama örneği (iki test hesabı) gerçek Supabase'e bağlanır,
// sunucu kurar, davetle katılır, gerçek zamanlı mesajlaşır, arkadaş olur ve DM atar.
// Kullanım: npm run build && node scripts/e2e.mjs [ekran-görüntüsü-klasörü]
import { _electron as electron } from 'playwright-core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..')
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.test'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)
const shots = path.resolve(process.argv[2] ?? path.join(root, 'out', 'shots'))
fs.mkdirSync(shots, { recursive: true })
const stamp = Date.now().toString(36)
const T = 20_000

// VS Code gibi Electron tabanlı bir ortamdan çalışınca miras kalan bu değişken
// Electron'u düz Node olarak başlatır.
const { ELECTRON_RUN_AS_NODE: _ignored, ...baseEnv } = process.env

async function launch(name) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `oldric-${name}-`))
  const app = await electron.launch({
    args: [root],
    cwd: root,
    env: { ...baseEnv, OLDRIC_TEST_PROFILE: profile }
  })
  const win = await app.firstWindow()
  win.on('console', (m) => {
    const t = m.text()
    if (t.includes('Electron Security Warning')) return
    if (m.type() === 'error' || m.type() === 'warning' || t.startsWith('[realtime]')) {
      console.log(`  [${name}] ${t}`)
    }
  })
  return { app, win, name }
}

async function shot(c, file) {
  await c.win.waitForTimeout(400)
  await c.win.screenshot({ path: path.join(shots, file) })
  console.log('  📸', file)
}

async function login(c, email, password) {
  await c.win.getByLabel('E-posta').fill(email)
  await c.win.getByLabel('Şifre').fill(password)
  await c.win.getByRole('button', { name: 'Giriş Yap' }).click()
  await c.win.getByRole('link', { name: 'Arkadaşlar' }).waitFor({ timeout: T })
}

async function step(title, fn) {
  process.stdout.write(`• ${title}\n`)
  await fn()
}

const a = await launch('ayse')
const b = await launch('mehmet')
let failed = false
try {
  await step('Giriş ekranı', async () => {
    await a.win.getByText('Tekrar hoş geldin!').waitFor({ timeout: T })
    await a.win.waitForTimeout(400)
    await shot(a, '01-giris.png')
  })
  await step('İki hesap giriş yapar', async () => {
    await login(a, env.OLDRIC_TEST1_EMAIL, env.OLDRIC_TEST1_PASSWORD)
    await login(b, env.OLDRIC_TEST2_EMAIL, env.OLDRIC_TEST2_PASSWORD)
    await shot(a, '02-ana-sayfa.png')
  })

  const serverName = `Test Sunucusu ${stamp}`
  await step('Ayşe sunucu oluşturur', async () => {
    await a.win.getByRole('button', { name: 'Sunucu Ekle' }).click()
    await a.win.getByRole('button', { name: /Kendi sunucumu oluştur/ }).click()
    await a.win.getByLabel('Sunucu adı').fill(serverName)
    await a.win.getByRole('button', { name: 'Oluştur' }).click()
    await a.win.getByPlaceholder('#genel kanalına mesaj gönder').waitFor({ timeout: T })
  })

  const first = `Merhaba **dünya**! @test.mehmet bu bir deneme \`kod\` ${stamp}`
  await step('Ayşe mesaj gönderir', async () => {
    const box = a.win.getByPlaceholder('#genel kanalına mesaj gönder')
    await box.fill(first)
    await box.press('Enter')
    await a.win.getByText(`bu bir deneme`).first().waitFor({ timeout: T })
    await shot(a, '03-sunucu-mesaj.png')
  })

  let code = ''
  await step('Davet kodu alınır', async () => {
    await a.win.locator('aside').getByRole('button', { name: serverName }).click()
    await a.win.getByRole('menuitem', { name: /İnsanları Davet Et/ }).click()
    code = (await a.win.locator('span.font-mono').first().innerText()).trim()
    await shot(a, '04-davet.png')
    await a.win.keyboard.press('Escape')
    if (!/^[a-f0-9]{12}$/.test(code)) throw new Error(`davet kodu okunamadı: ${code}`)
  })

  await step('Mehmet davetle katılır ve mesajı görür', async () => {
    await b.win.getByRole('button', { name: 'Sunucu Ekle' }).click()
    await b.win.getByRole('button', { name: 'Bir Sunucuya Katıl' }).click()
    await b.win.getByLabel('Davet bağlantısı ya da kodu').fill(`oldrictalk://invite/${code}`)
    await b.win.getByRole('button', { name: 'Sunucuya Katıl' }).click()
    await b.win.getByText('bu bir deneme').first().waitFor({ timeout: T })
    await shot(b, '05-mehmet-katildi.png')
  })

  await step('Yazıyor göstergesi gerçek zamanlı görünür', async () => {
    const box = b.win.getByPlaceholder('#genel kanalına mesaj gönder')
    await box.pressSequentially('Selam', { delay: 30 })
    await a.win.getByText('Mehmet (test) yazıyor…').waitFor({ timeout: T })
    await shot(a, '06-yaziyor.png')
  })

  const reply = `Selam Ayşe, mesajın geldi ${stamp}`
  await step('Mehmet yanıtlar, Ayşe gerçek zamanlı alır', async () => {
    const box = b.win.getByPlaceholder('#genel kanalına mesaj gönder')
    await box.fill(reply)
    await box.press('Enter')
    await a.win.getByText(reply).waitFor({ timeout: T })
    await shot(a, '07-gercek-zamanli.png')
  })

  await step('Mehmet arkadaşlık isteği gönderir, Ayşe kabul eder', async () => {
    await b.win.getByRole('button', { name: 'Direkt Mesajlar' }).click()
    await b.win.getByRole('button', { name: 'Arkadaş Ekle' }).click()
    await b.win.getByPlaceholder('Kullanıcı adı yazarak arkadaş ekleyebilirsin.').fill('test.ayse')
    await b.win.getByRole('button', { name: 'Arkadaşlık İsteği Gönder' }).click()
    const result = b.win.getByText(/arkadaşlık isteği gönderildi|zaten|artık arkadaşsınız/)
    await result.waitFor({ timeout: T })
    const alreadyFriends = /zaten arkadaşın/.test(await result.innerText())
    await shot(b, '08-istek-gonderildi.png')

    await a.win.getByRole('button', { name: 'Direkt Mesajlar' }).click()
    if (!alreadyFriends) {
      await a.win.getByRole('button', { name: /Bekleyen/ }).click()
      const accept = a.win.getByRole('button', { name: 'Kabul et' }).first()
      await accept.waitFor({ timeout: T })
      await shot(a, '09-bekleyen.png')
      await accept.click()
    }
    // Mehmet açık olduğu için Çevrimiçi sekmesinde görünmeli (heartbeat).
    await a.win.getByRole('button', { name: 'Çevrimiçi', exact: true }).click()
    await a.win.getByText('Mehmet (test)').first().waitFor({ timeout: T })
    await shot(a, '10-arkadaslar.png')
  })

  const dm = `Özelden yazıyorum ${stamp}`
  await step('Ayşe DM gönderir, Mehmet alır', async () => {
    await a.win.getByRole('button', { name: 'Mesaj', exact: true }).first().click()
    const box = a.win.getByPlaceholder(/kişisine mesaj gönder/)
    await box.waitFor({ timeout: T })
    await box.fill(dm)
    await box.press('Enter')
    await b.win.getByRole('link', { name: /Ayşe \(test\)/ }).first().waitFor({ timeout: T })
    await shot(b, '11-dm-okunmamis.png')
    await b.win.getByRole('link', { name: /Ayşe \(test\)/ }).first().click()
    await b.win.getByText(dm).waitFor({ timeout: T })
    await shot(b, '12-dm.png')
  })

  await step('Mesaj düzenleme gerçek zamanlı yansır', async () => {
    const msg = a.win.getByText(dm)
    await msg.hover()
    await a.win.getByRole('button', { name: 'Düzenle' }).click().catch(async () => {
      await a.win.locator('button:has(svg.lucide-pencil)').first().click()
    })
    const edit = a.win.locator('textarea').first()
    await edit.fill(`${dm} (düzeltildi)`)
    await edit.press('Enter')
    await b.win.getByText('(düzenlendi)').first().waitFor({ timeout: T })
    await shot(b, '13-duzenlendi.png')
  })

  await step('Emoji seçici açılır ve emoji eklenir', async () => {
    await b.win.getByRole('button', { name: 'Emoji' }).click()
    const picker = b.win.locator('em-emoji-picker')
    await picker.waitFor({ timeout: T })
    await b.win.waitForTimeout(800)
    await shot(b, '14-emoji.png')
    await picker.locator('button[aria-label="😀"]').first().click()
    await b.win.keyboard.press('Escape')
    const value = await b.win.getByPlaceholder(/kişisine mesaj gönder/).inputValue()
    if (!value.includes('😀')) throw new Error(`emoji eklenmedi: "${value}"`)
  })
} catch (err) {
  failed = true
  console.error('✗ HATA:', err.message)
  await shot(a, 'hata-ayse.png').catch(() => {})
  await shot(b, 'hata-mehmet.png').catch(() => {})
} finally {
  await a.app.close()
  await b.app.close()
}
console.log(failed ? '\nSenaryo BAŞARISIZ' : '\nSenaryo tamamlandı ✓')
process.exit(failed ? 1 : 0)
