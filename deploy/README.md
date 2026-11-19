# Serverga chiqarish (`deploy/`)

Reels tanlov `https://konkurs.mezon.site` da ishlaydi. Bu papkada serverdagi Docker sozlamasi
repo ichida saqlanadi — serverdagi qo'lda yozilgan nusxalar o'rniga.

| Fayl | Vazifasi |
|---|---|
| [`compose.yml`](compose.yml) | `konkurs` loyihasi: `backend` (NestJS) va `web` (nginx) |
| [`Dockerfile.backend`](Dockerfile.backend) | Backend image (context — `apps/backend`) |
| [`Dockerfile.backend.dockerignore`](Dockerfile.backend.dockerignore) | Backend context'idan chiqariladigan fayllar |
| [`Dockerfile.web`](Dockerfile.web) | Mini App (Vite) + admin panel (Next.js statik eksport) → nginx |
| [`web.conf`](web.conf) | nginx: `/` Mini App, `/admin/` admin panel, `/api/` backend |
| [`../.dockerignore`](../.dockerignore) | Repo ildizi context bo'lganda (`Dockerfile.web`) chiqariladigan fayllar |

## Tuzilma

```text
Internet ─► Mezon nginx (80/443, TLS) ─► konkurs-web (nginx, mezon_default tarmog'ida)
                                            ├─ /          Mini App / sayt   (/usr/share/nginx/html)
                                            ├─ /admin/    admin panel       (/usr/share/nginx/html/admin)
                                            └─ /api/      backend:3000      (port tashqariga ochilmaydi)
backend ─► /app/data  =  host: /srv/konkurs/data   (ishtirokchilar, reellar, support, audit...)
```

- Admin panel: **<https://konkurs.mezon.site/admin/>**. U statik fayllar (server kodi yo'q) va API'ga
  shu domendagi `/api/v1` orqali murojaat qiladi — CORS kerak emas, sessiya `HttpOnly` cookie'da.
- Serverda faqat 80/443 ochiq va ular Mezon nginx'iga tegishli, shuning uchun admin panel alohida
  port yoki subdomen emas, `/admin/` yo'lida.

## Serverdagi papkalar

| Yo'l | Nima |
|---|---|
| `/srv/konkurs/app` | Repo klon (`origin/main`) |
| `/srv/konkurs/shared/backend.env` | Backend maxfiy sozlamalari (tokenlar, admin hisoblari). Repoda yo'q, qo'lda boshqariladi |
| `/srv/konkurs/data` | Backend ma'lumotlari (`DATA_DIR=/app/data`). **Egasi `1000:1000` bo'lishi shart** |
| `/srv/konkurs/bin/deploy` | Deploy skripti |
| `/srv/konkurs/backups` | Ma'lumotlar zaxirasi (tavsiya) |

## Birinchi marta o'tkazish (bir martalik)

Hozirgi server `/srv/konkurs/shared/compose.yml` va `/srv/konkurs/shared/web.conf` bilan ishlaydi.
Ular endi shu papkadagi fayllar bilan almashadi.

1. Ma'lumotlar papkasi. Konteynerda backend `node` foydalanuvchisi (uid/gid 1000) nomidan ishlaydi:

   ```bash
   sudo mkdir -p /srv/konkurs/data /srv/konkurs/backups
   sudo chown 1000:1000 /srv/konkurs/data
   sudo chmod 750 /srv/konkurs/data
   ```

2. `/srv/konkurs/shared/backend.env` ni yangi backend talab qiladigan o'zgaruvchilar bilan to'ldirish
   (admin hisoblari va boshqalar — repo ildizidagi `.env.example` ga qarang). `DATA_DIR` ni u yerga
   yozish shart emas — `compose.yml` o'zi beradi.

3. `/srv/konkurs/bin/deploy` skriptida compose faylini almashtirish:

   ```text
   eski:  docker compose -f /srv/konkurs/shared/compose.yml ...
   yangi: docker compose -f /srv/konkurs/app/deploy/compose.yml ...
   ```

   Loyiha nomi o'zgarmaydi (`name: konkurs`), xizmatlar nomi ham o'sha (`backend`, `web`) —
   `up` eski konteynerlarni yangilari bilan almashtiradi, ikkinchi nusxa paydo bo'lmaydi.
   Agar eski compose'da `container_name` yozilgan bo'lsa va nom to'qnashuvi xatosi chiqsa, bir marta:

   ```bash
   docker compose -p konkurs -f /srv/konkurs/shared/compose.yml down
   ```

4. Eski `shared/compose.yml` va `shared/web.conf` ni o'chirmasdan `*.old` qilib qoldiring (qaytish uchun).

5. Mezon nginx'ida `konkurs.mezon.site` uchun `proxy_read_timeout` kamida `300s` bo'lsin: admin
   panelidagi "Reklama kutubxonasini hoziroq tekshirish" javobi 1–3 daqiqa kutadi (`web.conf` da
   ham 300s). `client_max_body_size` kamida `10m` bo'lsin (shikoyat skrinshotlari).

## Deploy

Deploy faqat `origin/main` dan qilinadi (`main` ga faqat PR orqali). Skript taxminan shunday:

```bash
cd /srv/konkurs/app
git fetch --prune origin
git reset --hard origin/main
docker compose -f /srv/konkurs/app/deploy/compose.yml up -d --build --remove-orphans
docker image prune -f
```

`web` image'i ikkala frontendni ham yig'adi (Mini App va admin panel), shuning uchun birinchi
build bir necha daqiqa oladi; keyingilarida `npm ci` qatlamlari keshdan olinadi.
Next.js build paytida Google Fonts'dan shrift yuklaydi — serverda internet bo'lishi kerak.

Backend `stop_grace_period: 30s` bilan to'xtatiladi — ma'lumotlarni diskka yozib ulguradi.

### Tekshirish

```bash
docker compose -f /srv/konkurs/app/deploy/compose.yml ps
docker compose -f /srv/konkurs/app/deploy/compose.yml logs --tail=100 backend
curl -sI https://konkurs.mezon.site/admin/          # 200, Cache-Control: no-store
curl -sI https://konkurs.mezon.site/admin           # 301 → /admin/
curl -s  https://konkurs.mezon.site/api/v1/admin/auth/me   # 401 (sessiyasiz) — API ishlayapti
```

### Ortga qaytish

```bash
cd /srv/konkurs/app
git reset --hard <oldingi-commit>
docker compose -f /srv/konkurs/app/deploy/compose.yml up -d --build
```

Ma'lumotlar `/srv/konkurs/data` da qoladi — image almashganda o'chmaydi.

## Zaxira nusxa

Hamma muhim ma'lumot `/srv/konkurs/data` da. Kuniga bir marta arxivlash (root crontab):

```cron
30 3 * * * tar -czf /srv/konkurs/backups/data-$(date +\%F).tar.gz -C /srv/konkurs data && find /srv/konkurs/backups -name 'data-*.tar.gz' -mtime +14 -delete
```

Muhim amallardan oldin (g'olibni e'lon qilish, katta o'zgarish) qo'lda ham oling:

```bash
sudo tar -czf /srv/konkurs/backups/data-$(date +%F-%H%M).tar.gz -C /srv/konkurs data
```

Zaxiradan tiklash:

```bash
docker compose -f /srv/konkurs/app/deploy/compose.yml stop backend
sudo mv /srv/konkurs/data /srv/konkurs/data.broken
sudo tar -xzf /srv/konkurs/backups/data-YYYY-MM-DD.tar.gz -C /srv/konkurs
sudo chown -R 1000:1000 /srv/konkurs/data
docker compose -f /srv/konkurs/app/deploy/compose.yml start backend
```

Zaxiralarni vaqti-vaqti bilan serverdan tashqariga ham ko'chiring (server diski ishdan chiqsa).

## Lokal tekshirish

Repo ildizidan:

```bash
docker build -f deploy/Dockerfile.web --build-arg VITE_API_URL=https://konkurs.mezon.site/api/v1 -t konkurs-web .
docker build -f deploy/Dockerfile.backend apps/backend
```

Admin panelning eksport build'ini Docker'siz ham ko'rish mumkin:

```bash
cd apps/admin
ADMIN_BASE_PATH=/admin NEXT_PUBLIC_API_MODE=http npm run build   # natija: out/
```
