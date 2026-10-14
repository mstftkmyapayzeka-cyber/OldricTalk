// Ses senaryosu: iki hesap aynı sunucunun "Genel" ses kanalına bağlanır; kenar
// çubuğunda birbirlerini görürler, sessize alma yansır, ses karşı tarafa ulaşır.
// Sahte mikrofon kullanılır (OLDRIC_TEST_PROFILE).
// Kullanım: npm run build && node scripts/e2e-voice.mjs [ekran-görüntüsü-klasörü]
import { env, launch, login, shot, shotsDir, step, T } from './e2e-lib.mjs'

const dir = shotsDir(process.argv[2])
const stamp = Date.now().toString(36)
const a = await launch('ayse')
const b = await launch('mehmet')
let failed = false

try {
  await step('Giriş', async () => {
    await login(a, env.OLDRIC_TEST1_EMAIL, env.OLDRIC_TEST1_PASSWORD)
    await login(b, env.OLDRIC_TEST2_EMAIL, env.OLDRIC_TEST2_PASSWORD)
  })

  const serverName = `Ses Testi ${stamp}`
  let code = ''
  await step('Ayşe sunucu kurar, Mehmet katılır', async () => {
    await a.win.getByRole('button', { name: 'Sunucu Ekle' }).click()
    await a.win.getByRole('button', { name: /Kendi sunucumu oluştur/ }).click()
    await a.win.getByLabel('Sunucu adı').fill(serverName)
    await a.win.getByRole('button', { name: 'Oluştur' }).click()
    await a.win.getByPlaceholder('#genel kanalına mesaj gönder').waitFor({ timeout: T })
    await a.win.locator('aside').getByRole('button', { name: serverName }).click()
    await a.win.getByRole('menuitem', { name: /İnsanları Davet Et/ }).click()
    code = (await a.win.locator('span.font-mono').first().innerText()).trim()
    await a.win.keyboard.press('Escape')

    await b.win.getByRole('button', { name: 'Sunucu Ekle' }).click()
    await b.win.getByRole('button', { name: 'Bir Sunucuya Katıl' }).click()
    await b.win.getByLabel('Davet bağlantısı ya da kodu').fill(code)
    await b.win.getByRole('button', { name: 'Sunucuya Katıl' }).click()
    await b.win.getByPlaceholder('#genel kanalına mesaj gönder').waitFor({ timeout: T })
  })

  await step('Ayşe ses kanalına bağlanır; Mehmet kenar çubuğunda görür', async () => {
    await a.win.getByRole('link', { name: 'Genel', exact: true }).click()
    await a.win.getByText('Ses Bağlandı').waitFor({ timeout: T })
    await b.win.locator('aside').getByText('Ayşe (test)').waitFor({ timeout: T })
    await shot(dir, b, 'ses-01-kenar-cubugu.png')
  })

  await step('Mehmet de bağlanır; ikisi de odada', async () => {
    await b.win.getByRole('link', { name: 'Genel', exact: true }).click()
    await b.win.getByText('Ses Bağlandı').waitFor({ timeout: T })
    // Oda görünümünde iki kişinin karosu.
    await a.win.locator('main').getByText('Mehmet (test)').waitFor({ timeout: T })
    await shot(dir, a, 'ses-02-oda.png')
  })

  await step('Mehmet sessize alır; Ayşe simgeyi görür', async () => {
    await b.win.getByRole('button', { name: 'Sessize Al' }).first().click()
    await a.win.locator('aside svg.lucide-mic-off').first().waitFor({ timeout: T })
  })

  await step('Ayşe\'nin sesi Mehmet\'e ulaşır (konuşma halkası); kamera/ekran düğmesi yok', async () => {
    // Sahte mikrofon düzenli bip sesi üretir; SFU üzerinden gelince Ayşe'nin karosu yeşillenir.
    await b.win.locator('main .ring-online').getByText('Ayşe (test)').waitFor({ timeout: T })
    await shot(dir, b, 'ses-03-konusuyor.png')
    for (const name of ['Kamerayı Aç', 'Ekran Paylaş']) {
      if (await a.win.getByRole('button', { name }).count()) throw new Error(`"${name}" düğmesi hâlâ var`)
    }
  })

  await step('Ayşe metin kanalına geçer, seste kalır', async () => {
    await a.win.getByRole('link', { name: 'genel', exact: true }).click()
    await a.win.getByText('Ses Bağlandı').waitFor({ timeout: T })
    await shot(dir, a, 'ses-04-metinde-seste.png')
  })

  await step('Bağlantıyı keser; Mehmet listeden düştüğünü görür', async () => {
    await a.win.getByRole('button', { name: 'Bağlantıyı Kes' }).first().click()
    await b.win
      .locator('aside')
      .getByText('Ayşe (test)')
      .waitFor({ state: 'detached', timeout: T })
  })
} catch (err) {
  failed = true
  console.error('✗ HATA:', err.message)
  await shot(dir, a, 'ses-hata-ayse.png').catch(() => {})
  await shot(dir, b, 'ses-hata-mehmet.png').catch(() => {})
} finally {
  await a.app.close()
  await b.app.close()
}
console.log(failed ? '\nSes senaryosu BAŞARISIZ' : '\nSes senaryosu tamamlandı ✓')
process.exit(failed ? 1 : 0)
