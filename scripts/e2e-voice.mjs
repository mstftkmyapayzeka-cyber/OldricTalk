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
const denoiseFailed = []
for (const c of [a, b]) {
  c.win.on('console', (m) => m.text().includes('[ses]') && denoiseFailed.push(m.text()))
}

try {
  await step('Giriş', async () => {
    await login(a, env.OLDRIC_TEST1_EMAIL, env.OLDRIC_TEST1_PASSWORD)
    await login(b, env.OLDRIC_TEST2_EMAIL, env.OLDRIC_TEST2_PASSWORD)
  })

  const serverName = `Ses Testi ${stamp}`
  let code = ''
  await step('Mehmet sunucu kurar, Ayşe katılır', async () => {
    await b.win.getByRole('button', { name: 'Sunucu Ekle' }).click()
    await b.win.getByRole('button', { name: /Kendi sunucumu oluştur/ }).click()
    await b.win.getByLabel('Sunucu adı').fill(serverName)
    await b.win.getByRole('button', { name: 'Oluştur' }).click()
    await b.win.getByPlaceholder('#genel kanalına mesaj gönder').waitFor({ timeout: T })
    await b.win.locator('aside').getByRole('button', { name: serverName }).click()
    await b.win.getByRole('menuitem', { name: /İnsanları Davet Et/ }).click()
    code = (await b.win.getByLabel('Davet kodu').innerText()).trim()
    await b.win.keyboard.press('Escape')

    await a.win.getByRole('button', { name: 'Sunucu Ekle' }).click()
    await a.win.getByRole('button', { name: 'Bir Sunucuya Katıl' }).click()
    await a.win.getByLabel('Davet bağlantısı ya da kodu').fill(code)
    await a.win.getByRole('button', { name: 'Sunucuya Katıl' }).click()
    await a.win.getByPlaceholder('#genel kanalına mesaj gönder').waitFor({ timeout: T })
  })

  // Ayşe'nin bağlantısını sonradan inceleyebilmek için RTCPeerConnection'ları yakala.
  await a.win.evaluate(() => {
    const Original = window.RTCPeerConnection
    window.__pcs = []
    window.RTCPeerConnection = class extends Original {
      constructor(...args) {
        super(...args)
        window.__pcs.push(this)
      }
    }
  })

  await step('Ayşe ses kanalına bağlanır; Mehmet kenar çubuğunda görür', async () => {
    await a.win.getByRole('link', { name: 'Genel', exact: true }).click()
    await a.win.getByText('Ses Bağlandı').waitFor({ timeout: T })
    await b.win.getByRole('list', { name: 'Ses kanalındakiler' }).getByText('Ayşe (test)').waitFor({ timeout: T })
    await shot(dir, b, 'ses-01-kenar-cubugu.png')
  })

  await step('Mehmet de bağlanır; ikisi de odada', async () => {
    await b.win.getByRole('link', { name: 'Genel', exact: true }).click()
    await b.win.getByText('Ses Bağlandı').waitFor({ timeout: T })
    // Oda görünümünde iki kişinin karosu.
    await a.win.locator('main').getByText('Mehmet (test)').waitFor({ timeout: T })
    await shot(dir, a, 'ses-02-oda.png')
  })

  await step('Ses kalitesi ayarları (Opus 64 kbps, FEC) ve kalite göstergesi', async () => {
    const info = await a.win.evaluate(() => {
      const pc = window.__pcs.at(-1)
      const tx = pc.getTransceivers().find((t) => t.sender.track?.kind === 'audio')
      return { sdp: pc.remoteDescription.sdp, maxBitrate: tx?.sender.getParameters().encodings?.[0]?.maxBitrate }
    })
    if (!/maxaveragebitrate=64000/.test(info.sdp) || !/useinbandfec=1/.test(info.sdp)) {
      throw new Error('Opus ayarları SDP\'de yok')
    }
    if (info.maxBitrate !== 64000) throw new Error(`maxBitrate beklenmedik: ${info.maxBitrate}`)
    await a.win.getByLabel('Bağlantı kalitesi').getByText(/\d+ ms/).waitFor({ timeout: T })
  })

  await step('Ses Ayarları: gürültü engelleme yüklü, ölçer çalışıyor', async () => {
    if (denoiseFailed.length) throw new Error(`RNNoise yüklenemedi: ${denoiseFailed[0]}`)
    await a.win.getByRole('button', { name: 'Ses Ayarları' }).click()
    await a.win.getByRole('switch', { name: 'Gürültü engelleme (önerilen)' }).waitFor({ timeout: T })
    await a.win.getByRole('button', { name: 'Mikrofon', exact: true }).waitFor({ timeout: T })
    // Sahte mikrofonun bip sesi ölçeri hareket ettirmeli.
    await a.win.waitForFunction(
      () => parseFloat(document.querySelector('[aria-label="Mikrofon seviyesi"] > div')?.style.width ?? '0') > 5,
      null,
      { timeout: T }
    )
    if (await a.win.getByText('Mikrofon açılamadı').count()) throw new Error('önizleme mikrofonu açılamadı')
    await shot(dir, a, 'ses-06-ayarlar.png')
    await a.win.keyboard.press('Escape')
    if (denoiseFailed.length) throw new Error(`RNNoise yüklenemedi: ${denoiseFailed[0]}`)
  })

  await step('Mehmet\'in sesi Ayşe\'ye ulaşır', async () => {
    await a.win.locator('main .border-online').getByText('Mehmet (test)').waitFor({ timeout: T })
  })

  await step('Mehmet sessize alır; Ayşe simgeyi görür', async () => {
    await b.win.getByRole('button', { name: 'Sessize Al' }).first().click()
    await a.win.locator('aside svg.lucide-mic-off').first().waitFor({ timeout: T })
  })

  await step('Ayşe\'nin sesi Mehmet\'e ulaşır (konuşma halkası); kamera/ekran düğmesi yok', async () => {
    // Sahte mikrofon düzenli bip sesi üretir; SFU üzerinden gelince Ayşe'nin karosu yeşillenir.
    await b.win.locator('main .border-online').getByText('Ayşe (test)').waitFor({ timeout: T })
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
      .getByRole('list', { name: 'Ses kanalındakiler' })
      .getByText('Ayşe (test)')
      .waitFor({ state: 'detached', timeout: T })
  })

  await step('Mikrofonu olmayan Mehmet yine de Ayşe\'yi duyar', async () => {
    await b.win.getByRole('button', { name: 'Bağlantıyı Kes' }).first().click()
    await b.win.getByText('Ses Bağlandı').waitFor({ state: 'detached', timeout: T })
    // Mikrofonu engellenmiş / takılı olmayan kullanıcı.
    await b.win.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('yok', 'NotFoundError'))
    })
    await a.win.getByRole('link', { name: 'Genel', exact: true }).click()
    await a.win.getByText('Ses Bağlandı').waitFor({ timeout: T })
    await b.win.getByRole('link', { name: 'Genel', exact: true }).click()
    await b.win.getByText(/Mikrofona erişilemedi/).waitFor({ timeout: T })
    await b.win.locator('main .border-online').getByText('Ayşe (test)').waitFor({ timeout: T })
    await shot(dir, b, 'ses-05-mikrofonsuz.png')
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
