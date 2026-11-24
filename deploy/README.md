# Serverga chiqarish (`deploy/`)

Reels tanlov `https://konkurs-olivia.uz` da ishlaydi. Bu papkada serverdagi Docker sozlamasi
repo ichida saqlanadi — serverdagi qo'lda yozilgan nusxalar o'rniga.

| Fayl | Vazifasi |
|---|---|
| [`compose.yml`](compose.yml) | `konkurs` loyihasi: `backend` (NestJS), `ai-worker` (AI video tekshiruvi) va `web` (nginx) |
| [`Dockerfile.backend`](Dockerfile.backend) | Backend image (`target: backend`) va AI worker (`target: worker`, + ffmpeg); context — `apps/backend` |
| [`../apps/backend/.dockerignore`](../apps/backend/.dockerignore) | Backend context'idan chiqariladigan fayllar (serverdagi eski builder faqat context ildizidagini o'qiydi) |
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
ai-worker ─► backend:3000/api/v1/internal/ai  (Docker tarmog'i ichida; nginx /api/v1/internal/ ni yopadi)
          ─► Instagram CDN (video), Claude API (api.anthropic.com)
```

- Admin panel: **<https://konkurs-olivia.uz/admin/>**. U statik fayllar (server kodi yo'q) va API'ga
  shu domendagi `/api/v1` orqali murojaat qiladi — CORS kerak emas, sessiya `HttpOnly` cookie'da.
- Serverda faqat 80/443 ochiq va ular Mezon nginx'iga tegishli, shuning uchun admin panel alohida
  port yoki subdomen emas, `/admin/` yo'lida.

## Domen

| Nima | Qayerda |
|---|---|
| DNS | `konkurs-olivia.uz` va `www` — A yozuvi `134.209.252.152` (eskiz.uz paneli) |
| Sertifikat | certbot webroot: `/etc/letsencrypt/live/konkurs-olivia.uz` (`www` ham), avtomatik yangilanadi |
| Mezon nginx | `/srv/mezon/shared/nginx.conf` — `konkurs-olivia.uz` bloki (→ `konkurs-web`), `www` → asosiy domenga 301 |
| Eski domen | `konkurs.mezon.site` → `https://konkurs-olivia.uz` ga 301 (eski havolalar ishlaydi) |
| Bot | `TELEGRAM_MINIAPP_URL=https://konkurs-olivia.uz` (`shared/backend.env`) — menyu va "Ilovani ochish" tugmalari |
| Telegram Login | @BotFather → `/setdomain` → `konkurs-olivia.uz` (Login faqat bitta domenda ishlaydi) |

- Mini App va admin panel API'ga nisbiy `/api/v1` orqali murojaat qiladi (`compose.yml` →
  `VITE_API_URL`), shuning uchun domen almashsa ham qayta sozlash kerak emas.
- `nginx.conf` Mezon nginx konteyneriga **bitta fayl** bo'lib bind-mount qilingan: uni faqat joyida
  tahrirlang (masalan, `cat >>` yoki faylni qayta ochib yozish). `sed -i` faylni almashtiradi — konteyner
  eski nusxani ko'raveradi. Keyin: `docker exec mezon-nginx-1 nginx -t` va `nginx -s reload`.
- **Istoriya videolari** (Mini App → istoriya qo'shish) 50 MB gacha bo'ladi. `web.conf` da
  `location = /api/v1/miniapp/stories` uchun `client_max_body_size 55m` bor, lekin oldidagi Mezon
  nginx'ining `konkurs-olivia.uz` blokida ham chegara kamida `55m` bo'lishi kerak (hozir `10m`),
  aks holda 10 MB dan katta video `413` bilan qaytadi.
- **Qoida videosi** (admin panel → Sozlamalar → Tanlov qoidalari) 100 MB gacha: `web.conf` da
  `location = /api/v1/admin/rules/video` uchun `105m`. Mezon nginx'ida chegara shundan kam bo'lmasin —
  ikkalasi uchun ham eng oddiysi `client_max_body_size 105m`.

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

5. Mezon nginx'ida `client_max_body_size 10m` bor — istoriya va qoida videolari uchun uni `105m` ga oshiring
   (yuqoridagi "Domen" bo'limiga qarang). Standart 60 soniyalik
   `proxy_read_timeout` ham yetadi — "Reklama kutubxonasini hoziroq tekshirish" 45 soniyadan
   cho'zilsa, backend "davom etmoqda" deb javob beradi, tekshiruv esa fonda tugaydi.

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
curl -sI https://konkurs-olivia.uz/admin/          # 200, Cache-Control: no-store
curl -sI https://konkurs-olivia.uz/admin           # 301 → /admin/
curl -s  https://konkurs-olivia.uz/api/v1/admin/auth/me   # 401 (sessiyasiz) — API ishlayapti
```

### Ortga qaytish

```bash
cd /srv/konkurs/app
git reset --hard <oldingi-commit>
docker compose -f /srv/konkurs/app/deploy/compose.yml up -d --build
```

Ma'lumotlar `/srv/konkurs/data` da qoladi — image almashganda o'chmaydi.

## AI worker

Admin panel → **AI** bo'limidagi video tekshiruvini alohida `ai-worker` konteyneri bajaradi
(batafsil — [`apps/backend/README.md`](../apps/backend/README.md#ai-video-tekshiruvi)). U
backend bilan bir xil koddan yig'iladi, ichida `ffmpeg` bor, `deploy` skripti uni ham ishga tushiradi.

### Yoqish (bir martalik)

1. Claude API kaliti: <https://platform.claude.com> → **API Keys** → *Create Key*. Kalitni hech
   kimga yubormang (chat, Telegram, git) — faqat serverdagi faylga yoziladi. Hisobda balans bo'lsin
   (Billing); xarajat chegarasini (*Limits → Spend limit*) ham qo'yib qo'ying.
2. `/srv/konkurs/shared/backend.env` ga qo'shing (backend va worker shu faylni o'qiydi):

   ```bash
   sudo nano /srv/konkurs/shared/backend.env
   ```

   ```dotenv
   ANTHROPIC_API_KEY=<kalit>
   AI_WORKER_TOKEN=<openssl rand -hex 32 natijasi>
   # ixtiyoriy (standart qiymatlar):
   # AI_MODEL=claude-opus-5-5
   # AI_FRAME_INTERVAL_SEC=2
   # AI_FRAME_HEIGHT=720
   # AI_CONFIDENCE_MIN=0.8
   ```

3. Qayta ishga tushiring va tekshiring:

   ```bash
   docker compose -f /srv/konkurs/app/deploy/compose.yml up -d --build backend ai-worker
   docker compose -f /srv/konkurs/app/deploy/compose.yml logs --tail=50 ai-worker
   # "Ishga tushdi: provider=anthropic ..." — tayyor. Admin panel → AI: "Worker ishlayapti".
   ```

Kalit yoki token bo'lmasa worker yiqilmaydi — log'ga sababini yozib kutadi ("AI tekshiruvi
o'chiq: ..."). Kalit hech qachon log'ga chiqmaydi. Vaqtinchalik kadrlar `ai-work` volume'ida
(natija kelguncha, 24 soatgacha) — worker qayta ishga tushsa ham yo'qolmaydi.

Server yuklamasi kichik: worker bir vaqtda 2 ta videoni yuklab, ffmpeg bilan ajratadi (2 daqiqalik
video — bir necha soniya CPU), qolgan vaqt Claude natijasini kutadi. 1 000 video ≈ 1–2 soat
tayyorlash + batch natijasi (odatda 1 soat ichida, ko'pi bilan 24 soat).

### Alohida DigitalOcean droplet'da (ixtiyoriy)

Asosiy server band bo'lsa, worker'ni alohida droplet'ga chiqarish mumkin (Ubuntu, 1 vCPU / 2 GB,
Docker o'rnatilgan). Backend'ning ichki API'si tashqariga yopiq, shuning uchun:

1. Asosiy serverda `deploy/web.conf` dagi `location /api/v1/internal/` ni faqat droplet IP'siga oching
   (PR orqali):

   ```nginx
   location /api/v1/internal/ {
       allow <droplet-ip>;
       deny all;
       resolver 127.0.0.11 valid=30s;
       set $backend http://backend:3000;
       proxy_pass $backend;
       proxy_set_header Host $host;
       proxy_read_timeout 600s;
   }
   ```

   Mezon nginx'i mijoz IP'sini `X-Forwarded-For` da uzatsa, `set_real_ip_from` ham kerak bo'ladi.
2. Droplet'da repo'ni klonlab, image yig'ing va ishga tushiring:

   ```bash
   git clone <repo> /srv/ai-worker && cd /srv/ai-worker
   docker build -f deploy/Dockerfile.backend --target worker -t konkurs-ai-worker apps/backend
   sudo install -m 600 /dev/null /srv/ai-worker.env   # ANTHROPIC_API_KEY, AI_WORKER_TOKEN shu yerga
   docker run -d --name ai-worker --restart unless-stopped \
     --env-file /srv/ai-worker.env \
     -e AI_BACKEND_URL=https://konkurs-olivia.uz/api/v1 \
     -v ai-work:/app/work konkurs-ai-worker
   docker logs -f ai-worker
   ```

3. Asosiy serverdagi `ai-worker` ni o'chiring (ikkalasi bir vaqtda ishlasa ham xato bo'lmaydi —
   har bir video bitta worker'ga beriladi, lekin keraksiz):
   `docker compose -f /srv/konkurs/app/deploy/compose.yml stop ai-worker`.

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
docker build -f deploy/Dockerfile.web --build-arg VITE_API_URL=/api/v1 -t konkurs-web .
docker build -f deploy/Dockerfile.backend --target backend apps/backend
docker build -f deploy/Dockerfile.backend --target worker apps/backend
```

Admin panelning eksport build'ini Docker'siz ham ko'rish mumkin:

```bash
cd apps/admin
ADMIN_BASE_PATH=/admin NEXT_PUBLIC_API_MODE=http npm run build   # natija: out/
```
