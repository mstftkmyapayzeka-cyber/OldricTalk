# OldricTalk

Discord benzeri Windows masaüstü sohbet uygulaması: sunucular, metin ve ses kanalları,
direkt mesajlar, arkadaşlık sistemi.

- **Masaüstü:** Electron + Vite + React 19 + TypeScript + Tailwind
- **Arka uç:** Supabase (kimlik doğrulama, Postgres + RLS, depolama, gerçek zamanlı yayın)
- **Ses/görüntü:** LiveKit (yakında)

> Bu dal (`desktop`), `main` dalındaki Next.js web sürümünün yerini alır.

## Geliştirme

Gereksinim: Node.js 22+.

```bash
npm install
npm run dev          # uygulamayı geliştirme modunda açar
npm run typecheck    # tip denetimi
npm test             # birim testleri
npm run build        # out/ altına derler
```

VS Code'un tümleşik terminalinde `ELECTRON_RUN_AS_NODE` tanımlıysa Electron açılmaz;
`Remove-Item Env:ELECTRON_RUN_AS_NODE` ile kaldırın.

### Uçtan uca test

İki test hesabıyla iki uygulama penceresi açar; sunucu kurma, davet, gerçek zamanlı
mesaj, yazıyor göstergesi, arkadaşlık ve DM akışını gerçek Supabase üzerinde dener.
Hesap bilgileri git'e girmeyen `.env.test` dosyasından okunur.

```bash
npm run build && node scripts/e2e.mjs out/shots
```

## Mimari

```
src/main/        Electron ana süreç (pencere, güvenlik, görev çubuğu rozeti)
src/preload/     Renderer'a açılan dar köprü (window.oldric)
src/renderer/    React arayüzü
  lib/           supabase istemcisi, gerçek zamanlı yönetici, biçimlendirme, yükleme
  hooks/         veri sorguları (TanStack Query)
  stores/        zustand durumları (oturum, modal, yazıyor, açık hedef)
  components/    arayüz bileşenleri
  pages/         ekranlar
supabase/migrations/   veritabanı şeması, RLS, RPC'ler, yayın tetikleyicileri
```

### Güvenlik modeli

- Her tabloda RLS açık; istemci yalnızca izin verilen satırları görür/yazar.
- Rol gerektiren işlemler (sunucu kurma, katılma, rol, atma/yasaklama, DM açma,
  arkadaşlık) `security definer` RPC'lerden geçer; iç yardımcılar dışa kapalı
  `private` şemasında.
- Gerçek zamanlı iletim özel broadcast konularıyla yapılır: `server:<id>` yalnızca
  üyelere, `user:<id>` yalnızca kişinin kendisine, `dm:<id>` katılımcılara.
- Resim/dosya URL'leri yalnızca projenin kendi depolamasını gösterebilir (dış resimler
  görüntüleyenin IP'sini sızdırır).
- Mesaj hız sınırı: 5 saniyede 5 mesaj. Sunucu oluşturma 25, katılma 100 ile sınırlı.
- Electron: `contextIsolation`, `sandbox`, `nodeIntegration: false`, paketli sürümde
  CSP; bağlantılar sistem tarayıcısında açılır.
