import type { RulesSection } from "../types";

/*
 * Mock rejim uchun: ommaviy oferta (25.11.2026) o'zbekcha matni — backend
 * `apps/backend/src/rules/offer-text.ts` dagi `OFFER_UZ` ning aynan nusxasi. Haqiqiy admin panel
 * qoidalarni serverdan oladi (`GET /admin/rules`). Oferta o'zgarsa — shu faylga ham ko'chiring.
 */

/** Ommaviy oferta (25.11.2026) — rasmiy matn, o'zbek tilida (lotin). */
export const OFFER_UZ: RulesSection[] = [
  {
    title: "Ommaviy oferta — «OLIVIA» reklama aksiyasida ishtirok etish shartlari",
    body:
      "Toshkent shahri, 2026-yil 25-noyabr\n" +
      "Ushbu hujjat «ALVIERO» MChJ (keyingi o'rinlarda — «Tashkilotchi») tomonidan O'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq jismoniy shaxslarga yo'llangan rasmiy ommaviy oferta hisoblanadi va OLIVIA brendining reklama aksiyasida ishtirok etish shartlarini belgilaydi.\n" +
      "Shaxs ushbu Ofertaning 2.3-bandida ko'rsatilgan harakatni amalga oshirgan paytdan boshlab Ofertani to'liq va so'zsiz qabul qilgan (aksept qilgan) hisoblanadi hamda Tashkilotchi bilan ushbu Oferta shartlari asosida shartnoma tuzgan deb e'tirof etiladi.",
  },
  {
    title: "1. Atamalar va ta'riflar",
    body:
      "1.1. Ushbu Ofertada quyidagi atamalar qo'llaniladi:\n" +
      "— Tashkilotchi — «ALVIERO» MChJ, Aksiyani tashkil etuvchi va o'tkazuvchi yuridik shaxs;\n" +
      "— Aksiya — OLIVIA brendi tomonidan ushbu Oferta shartlari asosida o'tkaziladigan reklama aksiyasi;\n" +
      "— Ishtirokchi — ushbu Ofertani aksept qilgan va 3-bo'limdagi talablarga javob beradigan jismoniy shaxs;\n" +
      "— Platforma — Aksiya uchun Tashkilotchi tomonidan foydalaniladigan @olivia_konkursbot Telegram-boti va www.konkurs-olivia.uz veb-sayti (birgalikda yoki alohida). Ishtirokchi ulardan istalganini tanlashi mumkin, ikkalasi ham teng huquqiy kuchga ega;\n" +
      "— Video — Ishtirokchi o'z Instagram akkauntida Reels formatida joylagan va havolasi Platformada ro'yxatdan o'tkazilgan videorolik;\n" +
      "— Tasdiqlangan ko'rishlar — Tashkilotchi tomonidan 7 va 8-bo'limlar talablariga muvofiq tekshiruvdan o'tkazilgan va sun'iy faollik belgilari aniqlanmagan ko'rishlar soni;\n" +
      "— Aksept — Ishtirokchining ushbu Oferta shartlarini 2.3-bandda belgilangan tartibda to'liq va so'zsiz qabul qilishi.",
  },
  {
    title: "2. Umumiy qoidalar",
    body:
      "2.1. Ushbu Oferta Aksiyaning shartlari, qatnashish tartibi, g'oliblarni aniqlash, sovrinlarni topshirish qoidalari hamda Videolarga bo'lgan huquqlarni belgilaydi.\n" +
      "2.2. Oferta Platformada e'lon qilingan paytdan boshlab kuchga kiradi. Ofertaning rasmiy va asosiy matni www.konkurs-olivia.uz veb-saytida joylashtirilgan matn hisoblanadi. Telegram-botda va Tashkilotchining Instagram sahifasi hamda boshqa kanallarda joylashtirilgan nusxalar yoki havolalar ma'lumot uchun mo'ljallangan; matnlar o'rtasida farq bo'lsa, veb-saytdagi matn ustun turadi.\n" +
      "2.3. Ofertaning aksepti deb Ishtirokchining Platformada (Telegram-botda yoki veb-saytda) ro'yxatdan o'tishi va Telegram-botda «Ommaviy oferta shartlari bilan tanishdim va roziman» tugmasini bosishi yoki veb-saytda tegishli belgini qo'yishi hisoblanadi. Aksept faqat bir marta amalga oshiriladi. Keyinchalik Platformaga har bir Video havolasini yuborish akseptdan keyin tuzilgan shartnomani ijro etish hisoblanadi va ushbu Videoga nisbatan 11-bo'lim shartlari qo'llanilishini anglatadi.\n" +
      "2.4. Aksiya O'zbekiston Respublikasi hududida o'tkaziladi.\n" +
      "2.5. Aksiya muddati: 2026-yil 27-noyabrdan 2027-yil 27-fevralgacha (shu kunlar ham kiradi). Ushbu Oferta Tomonlar o'z majburiyatlarini to'liq bajargunlariga qadar (shu jumladan, g'oliblarni aniqlash va sovrinlarni topshirish yakunlangunga qadar) amal qiladi.\n" +
      "2.6. Aksiyaning asosiy maqsadi — OLIVIA brendining tanilganlik darajasini oshirish va iste'molchilarni brend bilan interaktiv ishtirok orqali tanishtirish.\n" +
      "2.7. Aksiyada ishtirok etish bepul. Mahsulot xarid qilish ishtirok etish uchun majburiy shart hisoblanmaydi.\n" +
      "2.8. Aksiya O'zbekiston Respublikasi Fuqarolik kodeksining 976-moddasi ma'nosida ommaviy tanlov shaklida o'tkaziladi. Ishtirok etish uchun to'lov yoki mahsulot xaridi talab qilinmagani sababli Aksiya lotereya yoki qimor o'yini hisoblanmaydi. G'oliblar ushbu Ofertada belgilangan mezonlar asosida aniqlanadi.\n" +
      "2.9. Ishtirokchi Aksiyada o'z ixtiyori bilan, hech qanday majburlashsiz ishtirok etayotganini tasdiqlaydi. Ishtirokchi g'oliblar tasodifiy tanlov (random) orqali aniqlanishini, belgilangan ko'rishlar soniga erishish sovrin olishni kafolatlamasligini hamda Aksiyada ishtirok etish uning uchun hech qanday moddiy majburiyat yoki yo'qotish keltirib chiqarmasligini tushunadi va qabul qiladi. Ishtirokchi sovrin yutgan yoki yutmaganidan qat'i nazar, ushbu Ofertaga muvofiq o'tkazilgan tasodifiy tanlov natijasi yuzasidan Tashkilotchiga nisbatan hech qanday da'vo va e'tirozga ega emasligini tasdiqlaydi. Bu qoida Ishtirokchining Aksiya qoidalari buzilgan holatlar yuzasidan ushbu Ofertaning 8.7, 9.6-bandlari va 15-bo'limida nazarda tutilgan e'tiroz bildirish huquqini cheklamaydi.",
  },
  {
    title: "3. Ishtirokchilarga qo'yiladigan talablar",
    body:
      "3.1. Aksiyada 18 yoshga to'lgan, O'zbekiston Respublikasi fuqarolari hamda O'zbekiston Respublikasi hududida doimiy yashovchi (soliq rezidenti maqomiga ega) jismoniy shaxslar ishtirok etishi mumkin.\n" +
      "3.2. Ishtirokchi o'ziga tegishli Instagram akkauntidan foydalanishi kerak.\n" +
      "3.3. Instagram akkaunti ochiq (public) bo'lishi shart. Yopiq (private) akkauntlar orqali joylangan Videolar hisobga olinmaydi.\n" +
      "3.4. Ishtirokchi Aksiya boshlanishidan oldin mavjud bo'lgan shaxsiy Instagram akkauntidan foydalanishi kerak. Faqat Aksiya uchun yangi akkaunt ochish taqiqlanadi.\n" +
      "3.5. Har bir Ishtirokchi faqat bitta shaxsiy akkaunt orqali qatnashishi mumkin.\n" +
      "3.6. Tashkilotchi xodimlari, ularning yaqin qarindoshlari (O'zbekiston Respublikasi Oila kodeksining 57-moddasida belgilangan shaxslar doirasi), shuningdek Aksiyani tashkil etish va o'tkazishga jalb qilingan hamkor tashkilotlar xodimlari Aksiyada ishtirok eta olmaydi.\n" +
      "3.7. Ishtirokchi ushbu Ofertaning barcha shartlariga rioya qilishi shart.",
  },
  {
    title: "4. Aksiyada ishtirok etish tartibi",
    body:
      "4.1. Aksiyada qatnashish uchun Ishtirokchi quyidagi bosqichlarni bajarishi kerak:\n" +
      "— Telegram-botni (@olivia_konkursbot) ishga tushirish yoki veb-saytga (www.konkurs-olivia.uz) kirish;\n" +
      "— Platformada ro'yxatdan o'tish (ism, telefon raqami va Instagram akkaunti nomini ko'rsatish) va ushbu Ofertani aksept qilish;\n" +
      "— o'z Instagram akkauntida OLIVIA mahsuloti ishtirokida Reels formatida Video joylash;\n" +
      "— joylangan Videoning havolasini Platformaga kiritish;\n" +
      "— Video havolasi muvaffaqiyatli qabul qilinganini tekshirish.\n" +
      "4.2. Ishtirokchi Aksiya davomida istalgan miqdorda Video joylashi va ularning havolalarini Platformaga yuborishi mumkin.\n" +
      "4.3. Har bir Video alohida ro'yxatdan o'tkazilishi kerak.\n" +
      "4.4. Bir xil Video havolasi takroran yuborilsa, u hisobga olinmaydi.\n" +
      "4.5. Faqat ushbu Oferta talablariga javob beradigan va Platformada ro'yxatdan o'tkazilgan Videolar tanlovda hisobga olinadi.\n" +
      "4.6. Ishtirokchi Platformada ro'yxatdan o'tkazilgan Videoni Aksiya yakunlari rasman e'lon qilingunga va sovrinlar topshirilgunga qadar o'z Instagram akkauntidan o'chirmasligi, arxivlamasligi hamda akkauntning ochiq (public) holatini saqlab turishi shart.",
  },
  {
    title: "5. Videolarga qo'yiladigan talablar",
    body:
      "5.1. Videolar Ishtirokchining o'zi tomonidan tayyorlangan original kontent bo'lishi kerak.\n" +
      "5.2. Videoda OLIVIA mahsuloti aniq ko'rinishi yoki mahsulot haqida mazmunli ma'lumot berilishi shart.\n" +
      "5.3. Videolar quyidagi formatlarda bo'lishi mumkin:\n" +
      "— mahsulot haqida sharh;\n" +
      "— mahsulotdan foydalanish jarayoni;\n" +
      "— ijodiy va ko'ngilochar videolar;\n" +
      "— mahsulotning afzalliklarini namoyish etish;\n" +
      "— OLIVIA brendi bilan bog'liq boshqa original g'oyalar.\n" +
      "5.4. Boshqa shaxslarning videolarini ruxsatsiz ko'chirish, mualliflik va turdosh huquqlarni buzish (shu jumladan, tijorat maqsadlarida foydalanish taqiqlangan musiqiy asarlardan foydalanish), yolg'on ma'lumot tarqatish, raqobatchi brendlarni namoyish etish, shuningdek OLIVIA brendining ishchanlik obro'siga putur yetkazuvchi hamda O'zbekiston Respublikasi qonunchiligiga, axloq va odob me'yorlariga zid kontent joylash taqiqlanadi.\n" +
      "5.5. Aksiya talablariga javob bermaydigan Videolar hisobga olinmaydi.\n" +
      "5.6. O'zbekiston Respublikasining «Reklama to'g'risida»gi Qonuni talablariga muvofiq, Ishtirokchi joylashtirilayotgan Video tavsifida uning reklama/aksiya doirasida tayyorlanganligini bildiruvchi #reklama yoki #OLIVIAaksiya xeshtegini ko'rsatishi shart.\n" +
      "5.7. Videoda faqat mualliflik huquqidan xoli (royalty-free) musiqadan yoki Instagram tomonidan tijorat maqsadlarida foydalanishga ruxsat etilgan musiqalardan foydalanish mumkin.",
  },
  {
    title: "6.1. Oylik sovrinlar",
    body:
      "6.1.1. Har oy tegishli oylik bosqichda 1 000 tadan 100 000 tagacha tasdiqlangan ko'rishlar soniga ega bo'lgan Ishtirokchilar orasida 500 000 so'mlik Korzinka xarid vaucherlari tasodifiy tanlov (random) orqali o'ynaladi:\n" +
      "— bir oyda — 200 ta vaucher;\n" +
      "— Aksiya davomida — jami 600 ta vaucher;\n" +
      "— bitta vaucher qiymati — 500 000 (besh yuz ming) so'm.\n" +
      "6.1.2. Oylik bosqichlar:\n" +
      "— 1-bosqich: 2026-yil 27-noyabr — 2026-yil 26-dekabr;\n" +
      "— 2-bosqich: 2026-yil 27-dekabr — 2027-yil 26-yanvar;\n" +
      "— 3-bosqich: 2027-yil 27-yanvar — 2027-yil 27-fevral.\n" +
      "6.1.3. Har bir oylik bosqich yakunida 200 nafar g'olib belgilangan talablarga javob beradigan Ishtirokchilar orasidan tasodifiy tanlov orqali aniqlanadi va ularning har biriga 500 000 so'mlik Korzinka xarid vaucheri beriladi.\n" +
      "6.1.4. Agar belgilangan talablarga javob beradigan Ishtirokchilar soni 200 nafardan kam bo'lsa, qolgan vaucherlar keyingi oyga o'tkazilmaydi.\n" +
      "6.1.5. Ishtirokchi har oy talablarni bajargan taqdirda, bir necha oy davomida vaucher yutib olishi mumkin.\n" +
      "6.1.6. Oylik sovrinlar bo'yicha tasodifiy tanlov ushbu Ofertaning 6.4-bandida belgilangan tartibda o'tkaziladi.",
  },
  {
    title: "6.2. Asosiy sovrinlar",
    body:
      "6.2.1. Asosiy sovrinlar Aksiya yakunida tasodifiy tanlov (random) orqali o'ynaladi. Har bir sovrin turi Aksiya davomida to'plangan umumiy tasdiqlangan ko'rishlar soni quyidagi oraliqqa to'g'ri keladigan Ishtirokchilar o'rtasida o'ynaladi:\n" +
      "— 4 000 001 va undan ortiq — 1 ta — BYD Chazor avtomobili\n" +
      "— 1 500 001 — 4 000 000 — 3 ta — Tailandga 2 kishilik sayohat yo'llanmasi\n" +
      "— 500 001 — 1 500 000 — 15 ta — iPhone 18 Pro smartfoni\n" +
      "— 100 001 — 500 000 — 25 ta — Planshet\n" +
      "6.2.2. Har bir Ishtirokchi faqat o'zining umumiy tasdiqlangan ko'rishlar soni to'g'ri keladigan bitta oraliq bo'yicha tanlovda bitta sovrin uchun ishtirok etadi. Ko'rishlar soni 100 000 va undan kam bo'lgan Ishtirokchilar asosiy sovrinlar tanlovida ishtirok etmaydi.\n" +
      "6.2.3. Agar biror oraliqda talablarga javob beradigan Ishtirokchilar soni shu oraliq uchun belgilangan sovrinlar sonidan kam bo'lsa, ushbu oraliqdagi barcha talablarga javob beradigan Ishtirokchilar g'olib deb topiladi, qolgan sovrinlar esa boshqa oraliqqa o'tkazilmaydi va o'ynalmaydi. Biror oraliqda talablarga javob beradigan Ishtirokchi bo'lmasa, shu oraliq sovrini o'ynalmaydi.\n" +
      "6.2.4. Oylik sovrinlar (Korzinka xarid vaucherlari) asosiy sovrin hisoblanmaydi. Oylik vaucher yutgan Ishtirokchi asosiy sovrin tanlovida o'z oralig'i bo'yicha ishtirok etish huquqini saqlab qoladi. Ishtirokchi Aksiya davomida bir nechta oylik vaucher va qo'shimcha ravishda faqat bitta asosiy sovrinni qo'lga kiritishi mumkin.\n" +
      "6.2.5. Sovrinlar pul ekvivalentiga almashtirilmaydi va boshqa shaxsga berilmaydi.",
  },
  {
    title: "6.3–6.4. Tasodifiy tanlovni o'tkazish tartibi",
    body:
      "6.3. «iPhone», «BYD» va «Korzinka» savdo belgilari ularning tegishli huquq egalariga tegishli bo'lib, mazkur brendlar ushbu Aksiyaning tashkilotchisi yoki homiysi hisoblanmaydi.\n" +
      "6.4. Tasodifiy tanlovni o'tkazish tartibi\n" +
      "6.4.1. Oylik va asosiy sovrinlar bo'yicha tasodifiy tanlov konkurs-olivia.uz platformasidagi tasodifiy tanlov dasturi yordamida, Tashkilotchi tomonidan tuzilgan kamida 3 (uch) kishidan iborat komissiya ishtirokida o'tkaziladi.\n" +
      "6.4.2. Tanlovda faqat 7 va 8-bo'limlarga muvofiq tekshiruvdan o'tgan, tegishli oraliqqa kirgan Ishtirokchilar ishtirok etadi. Tanlovdan oldin har bir oraliq bo'yicha ishtirokchilar ro'yxati shakllantiriladi.\n" +
      "6.4.3. Tanlov jarayoni videoga yozib olinadi va Tashkilotchining rasmiy YouTube / Instagram sahifasida jonli efirda namoyish etiladi.\n" +
      "6.4.4. Tanlov natijalari komissiya a'zolari imzolagan bayonnoma bilan rasmiylashtiriladi. Bayonnomada har bir oraliq bo'yicha ishtirokchilar soni, g'oliblar va zaxira g'oliblar ko'rsatiladi.\n" +
      "6.4.5. Har bir oraliq bo'yicha asosiy g'oliblar bilan birga zaxira g'oliblar ham tasodifiy tanlov orqali aniqlanadi. Zaxira g'oliblar 10.3-bandda nazarda tutilgan hollarda navbat tartibida g'olib deb topiladi.",
  },
  {
    title: "7. Ko'rishlar sonini hisoblash va tekshirish",
    body:
      "7.1. Har bir Ishtirokchining ko'rishlar soni uning Platformada ro'yxatdan o'tkazilgan va tasdiqlangan barcha Videolari bo'yicha jamlanadi.\n" +
      "7.2. Oylik sovrinlar uchun faqat tegishli oy davomida ro'yxatdan o'tkazilgan Videolarning ko'rishlar soni hisobga olinadi.\n" +
      "7.3. Asosiy sovrinlar uchun Aksiya davomida ro'yxatdan o'tkazilgan barcha tasdiqlangan Videolarning umumiy ko'rishlar soni hisoblanadi.\n" +
      "7.4. Har bir oylik bosqich yakunida ko'rishlar statistikasi tegishli bosqichning oxirgi kuni Toshkent vaqti bilan soat 23:59 holatiga ko'ra qayd etiladi va 3 kalendar kuni ichida tekshirilib e'lon qilinadi.\n" +
      "7.5. Asosiy sovrinlar bo'yicha yakuniy ko'rishlar statistikasi 2027-yil 27-fevral Toshkent vaqti bilan soat 23:59 holatiga ko'ra qayd etiladi va 7 kalendar kuni ichida tekshirilib rasmiylashtiriladi.\n" +
      "7.6. Tashkilotchi zarur hollarda Instagram statistikasi (Insights) orqali ko'rishlar sonini tekshirish uchun qo'shimcha dalillar (skrinshot, ekran yozuvi) so'rashi mumkin. Ishtirokchi so'ralgan dalillarni so'rov yuborilgan kundan boshlab 3 (uch) kalendar kuni ichida taqdim etishi shart. Dalillar belgilangan muddatda taqdim etilmasa yoki taqdim etishdan bosh tortilsa, tegishli Videolar hisobga olinmaydi, takroriy holatda esa Ishtirokchi Aksiyadan chetlashtirilishi mumkin.\n" +
      "7.7. Layklar, izohlar va ulashishlar sovrinlarni aniqlashda asosiy mezon hisoblanmaydi, biroq ular sun'iy faollikni aniqlashda qo'shimcha ko'rsatkich sifatida tekshirilishi mumkin.",
  },
  {
    title: "8. Sun'iy faollik va qoidabuzarliklarning oldini olish",
    body:
      "8.1. Aksiyada sun'iy ravishda ko'rishlar sonini oshirish, botlardan foydalanish, soxta akkauntlar yaratish, layk va izohlarni sotib olish, o'zaro faollik almashish, shuningdek Instagram'ning pullik reklama vositalari (Target / Boost / Meta Ads) orqali ko'rishlar yig'ish taqiqlanadi.\n" +
      "8.2. Quyidagi holatlar qoidabuzarlik sifatida ko'rib chiqilishi mumkin:\n" +
      "— sun'iy ko'rishlar va faollik sotib olish;\n" +
      "— botlar va avtomatlashtirilgan xizmatlardan foydalanish;\n" +
      "— soxta yoki ommaviy tarzda yaratilgan akkauntlardan foydalanish;\n" +
      "— ko'rishlar va boshqa ko'rsatkichlarni sun'iy oshirish, shu jumladan pullik reklama (Target / Boost) orqali;\n" +
      "— boshqa Ishtirokchilarning natijalariga noqonuniy ta'sir ko'rsatish.\n" +
      "8.3. Tashkilotchi shubhali holatlarni aniqlash uchun statistik ma'lumotlar, akkaunt faolligi va boshqa mavjud ko'rsatkichlarni tekshirishi mumkin.\n" +
      "8.4. Shubhali faollik belgilari Tashkilotchi tomonidan statistik ko'rsatkichlar va akkaunt faolligini kompleks o'rganish hamda qo'lda tekshirish asosida baholanadi.\n" +
      "8.5. Tekshiruv davomida Ishtirokchining natijalari vaqtincha to'xtatib turilishi mumkin.\n" +
      "8.6. Qoidabuzarlik tasdiqlangan taqdirda, Ishtirokchi Aksiyadan chetlashtirilishi va uning natijalari bekor qilinishi mumkin.\n" +
      "8.7. Ishtirokchi diskvalifikatsiya qarori yuzasidan 3 ish kuni ichida e'tiroz bildirish huquqiga ega. Tashkilotchi kelib tushgan e'tirozni 5 ish kuni ichida ko'rib chiqadi.\n" +
      "8.8. Tashkilotchi Ishtirokchilardan Instagram akkaunti parolini talab qilmaydi.",
  },
  {
    title: "9. G'oliblarni aniqlash",
    body:
      "9.1. G'oliblar ushbu Ofertaning 6-bo'limida belgilangan ko'rishlar oraliqlari bo'yicha tasodifiy tanlov (random) orqali aniqlanadi. G'oliblar reyting yoki egallagan o'rin bo'yicha aniqlanmaydi. Bitta Ishtirokchi faqat bitta asosiy sovrin bo'yicha g'olib deb topilishi mumkin (6.2.2-band).\n" +
      "9.2. Ishtirokchining qaysi oraliqqa kirishi 7.4 va 7.5-bandlarda belgilangan vaqtda qayd etilgan tasdiqlangan ko'rishlar soni asosida aniqlanadi.\n" +
      "9.3. Tasodifiy tanlov natijasi yakuniy hisoblanadi va qayta o'tkazilmaydi, 8 va 10-bo'limlarda nazarda tutilgan hollar bundan mustasno.\n" +
      "9.4. G'oliblar aniqlanishidan oldin quyidagilar tekshiriladi:\n" +
      "— Ishtirokchining yoshi;\n" +
      "— Instagram akkauntining unga tegishliligi;\n" +
      "— Videolarning haqiqiyligi;\n" +
      "— ko'rishlar sonining tasdiqlanganligi;\n" +
      "— Aksiya qoidalariga rioya qilinganligi.\n" +
      "9.5. G'oliblar ro'yxati Tashkilotchining rasmiy sahifalari yoki boshqa rasmiy axborot kanallari orqali e'lon qilinadi.\n" +
      "9.6. Ishtirokchi oylik yoki yakuniy natijalar, g'oliblarni aniqlash tartibi yoki o'z huquqlari buzilgan deb hisoblasa, natijalar e'lon qilingan paytdan boshlab 1 (bir) kalendar kuni ichida Tashkilotchiga shikoyat (e'tiroz) yuborishi mumkin. Shikoyat Platforma orqali yoki 17-bo'limda ko'rsatilgan rasmiy elektron pochta manziliga yozma shaklda, asoslari va mavjud dalillar ilova qilingan holda yuboriladi.\n" +
      "9.7. Tashkilotchi o'z vaqtida kelib tushgan shikoyatni ko'rib chiqadi va 15.1-bandda belgilangan muddatda asoslantirilgan javob yuboradi. Belgilangan muddat o'tganidan keyin yuborilgan shikoyatlar natijalarni qayta ko'rib chiqish uchun asos bo'lmaydi, biroq bu Ishtirokchining 15-bo'limda nazarda tutilgan huquqlarini cheklamaydi.",
  },
  {
    title: "10. Sovrinlarni topshirish tartibi",
    body:
      "10.1. G'oliblar e'lon qilinganidan so'ng Tashkilotchi ular bilan bog'lanadi.\n" +
      "10.2. G'olib Tashkilotchi bilan 5 kalendar kuni ichida bog'lanishi va sovrinni olish uchun zarur ma'lumotlarni (shaxsini tasdiqlovchi hujjat, aloqa ma'lumotlari va boshqalar) taqdim etishi kerak.\n" +
      "10.3. Belgilangan muddatda javob bermagan, sovrinni olishdan bosh tortgan yoki tekshiruv natijasida talablarga javob bermasligi aniqlangan g'olibning o'rniga shu oraliq bo'yicha aniqlangan zaxira g'olib navbat tartibida g'olib deb topiladi.\n" +
      "10.4. Korzinka vaucherlari g'oliblarga belgilangan tartibda topshiriladi. Vaucherlardan foydalanish shartlari ularni topshirish vaqtida tushuntiriladi.\n" +
      "10.5. Sayohat yo'llanmalari bo'yicha yo'nalish, davomiylik, yo'lovchilar soni, xizmatlar tarkibi va foydalanish muddati Tashkilotchi tomonidan oldindan belgilanadi va g'oliblarga ma'lum qilinadi.\n" +
      "10.6. BYD Chazor avtomobilini topshirish, notarial rasmiylashtirish va DYHXX (GAI) organlarida davlat ro'yxatidan o'tkazish tegishli qonunchilikka muvofiq amalga oshiriladi. Avtomobilni rasmiylashtirish bilan bog'liq barcha davlat bojlari va yig'imlar G'olib hisobidan qoplanadi.\n" +
      "10.7. O'zbekiston Respublikasi Soliq kodeksining 377 va 386-moddalariga muvofiq, natura shaklida olingan barcha sovrinlar, shu jumladan oylik sovrin sifatida berilgan Korzinka xarid vaucherlari va asosiy sovrinlar qiymatidan jismoniy shaxslardan olinadigan daromad solig'i (12% JShDS) qonunchilikda belgilangan tartibda G'olib tomonidan to'lanadi. Tashkilotchi soliq agenti sifatida soliqni ushlab qolish imkoni yo'qligi to'g'risida davlat soliq xizmati organlariga belgilangan tartibda xabar beradi.\n" +
      "10.8. Sovrinni olishda g'olib Tashkilotchi bilan sovrinni qabul qilish-topshirish dalolatnomasini imzolaydi.",
  },
  {
    title: "11. Videolarga bo'lgan mualliflik huquqi",
    body:
      "11.1. Ishtirokchi Video havolasini Platformaga yuborgan paytdan boshlab ushbu Videoga bo'lgan barcha mutlaq mulkiy huquqlarni Tashkilotchiga to'liq hajmda, bepul (tekin) asosda (mualliflik haqi to'lanmasdan), mutlaq huquqlarning qonunchilikda belgilangan butun amal qilish muddati davomida va butun dunyo hududida amal qiladigan tarzda o'tkazadi.\n" +
      "11.2. Tashkilotchi Videolardan o'z xohishiga ko'ra, Ishtirokchidan qo'shimcha rozilik olmasdan va haq to'lamasdan, har qanday qonuniy usulda foydalanish huquqiga ega, shu jumladan:\n" +
      "— Videolarni Tashkilotchi va OLIVIA brendining Instagram, Telegram, TikTok, YouTube, Facebook va boshqa ijtimoiy tarmoqlardagi sahifalarida post, Reels, Stories va boshqa formatlarda joylash;\n" +
      "— Videolarni veb-saytlarda, mobil ilovalarda, televideniye, radio, tashqi va ichki reklamada hamda boshqa reklama va marketing materiallarida foydalanish;\n" +
      "— Videolarni qayta ishlash, montaj qilish, qisqartirish, boshqa materiallar bilan birlashtirish, ularga matn, musiqa, logotip va boshqa elementlar qo'shish;\n" +
      "— Videolarni ko'paytirish, tarqatish, ommaga namoyish etish va ommaga yetkazish;\n" +
      "— Videolardan foydalanish huquqini uchinchi shaxslarga (hamkorlar, reklama agentliklari va boshqalarga) berish.\n" +
      "11.3. Tashkilotchi Videolardan foydalanganda Ishtirokchining ismini yoki akkaunt nomini ko'rsatishi yoki ko'rsatmasligi mumkin.\n" +
      "11.4. Ishtirokchi Videodagi o'z tasviri, ismi va ovozidan Tashkilotchi tomonidan ushbu bo'limda ko'rsatilgan maqsadlarda foydalanilishiga rozilik beradi.\n" +
      "11.5. Ishtirokchi Video o'zi tomonidan yaratilganini va Videoda tasvirlangan boshqa shaxslardan, shuningdek Videoda foydalanilgan musiqa, tasvir va boshqa materiallar mualliflaridan zarur ruxsatlarni olganini kafolatlaydi.\n" +
      "11.6. Agar uchinchi shaxslar Video bo'yicha Tashkilotchiga da'vo qo'ysa, Ishtirokchi bunday da'voni o'z hisobidan hal qilish va Tashkilotchiga yetkazilgan zararni qoplash majburiyatini oladi.\n" +
      "11.7. Ushbu bo'limda ko'rsatilgan huquqlar Video g'olib bo'lgan yoki bo'lmaganidan, Ishtirokchi Aksiyadan chiqqan yoki chetlashtirilganidan, shuningdek Ishtirokchi Videoni o'z akkauntidan o'chirganidan qat'i nazar Tashkilotchida saqlanib qoladi.\n" +
      "11.8. Muallifning qonunchilikka muvofiq boshqa shaxsga o'tkazilmaydigan shaxsiy nomulkiy huquqlari Ishtirokchida qoladi.",
  },
  {
    title: "12. Shaxsiy ma'lumotlarni qayta ishlash",
    body:
      "12.1. Ofertani aksept qilish orqali Ishtirokchi o'zining shaxsiy ma'lumotlarini (F.I.Sh., tug'ilgan sana, telefon raqami, Instagram va Telegram akkaunti ma'lumotlari va boshqalar) Aksiyani tashkil etish, Ishtirokchilarni tekshirish, g'oliblarni aniqlash, sovrinlarni topshirish va g'oliblar ro'yxatini e'lon qilish maqsadida qayta ishlashga rozilik beradi.\n" +
      "12.2. Shaxsiy ma'lumotlar O'zbekiston Respublikasining shaxsiy ma'lumotlarni himoya qilish to'g'risidagi qonunchiligiga muvofiq qayta ishlanadi.\n" +
      "12.3. Tashkilotchi Ishtirokchilarning shaxsiy ma'lumotlarini ruxsatsiz foydalanish va tarqatishdan himoya qilish uchun zarur choralarni ko'radi.\n" +
      "12.4. O'zbekiston Respublikasining «Shaxsga doir ma'lumotlar to'g'risida»gi Qonuniga muvofiq, shaxsiy ma'lumotlarga ishlov berishga rozilik Aksiya muddati davomida hamda Aksiya yakunlanganidan keyin 3 (uch) yil muddatga beriladi. Ishtirokchi ushbu rozilikni Tashkilotchining rasmiy elektron pochtasiga yozma ariza yuborish orqali chaqirib olish huquqiga ega (bunday holda Ishtirokchining Aksiyadagi ishtiroki to'xtatiladi).",
  },
  {
    title: "13. Tomonlarning huquq va majburiyatlari",
    body:
      "13.1. Tashkilotchi quyidagi huquqlarga ega:\n" +
      "— Ishtirokchilarning ushbu Oferta talablariga rioya qilishini tekshirish;\n" +
      "— talablarga javob bermaydigan Videolarni hisobga olmaslik va qoidabuzar Ishtirokchilarni Aksiyadan chetlashtirish;\n" +
      "— Videolardan 11-bo'limga muvofiq foydalanish;\n" +
      "— Ofertaga 16.1-bandda belgilangan muddat va tartibda o'zgartirishlar kiritish.\n" +
      "13.2. Tashkilotchi quyidagi majburiyatlarni oladi:\n" +
      "— Aksiyani ushbu Oferta shartlariga muvofiq o'tkazish;\n" +
      "— g'oliblarni xolis aniqlash va sovrinlarni belgilangan tartibda topshirish;\n" +
      "— Ishtirokchilarning shaxsiy ma'lumotlarini himoya qilish.\n" +
      "13.3. Ishtirokchi quyidagi huquqlarga ega:\n" +
      "— Aksiya shartlari haqida ma'lumot olish;\n" +
      "— Oferta shartlari bajarilgan taqdirda sovrin olish;\n" +
      "— Tashkilotchi qarorlari yuzasidan 1 kun ichida e'tiroz bildirish.\n" +
      "13.4. Ishtirokchi quyidagi majburiyatlarni oladi:\n" +
      "— ushbu Oferta shartlariga rioya qilish;\n" +
      "— o'zi haqida to'g'ri va haqqoniy ma'lumot taqdim etish;\n" +
      "— uchinchi shaxslarning huquqlarini buzmaslik.",
  },
  {
    title: "14. Javobgarlik va fors-major",
    body:
      "14.1. Tomonlar ushbu Oferta bo'yicha majburiyatlarni bajarmaganlik yoki lozim darajada bajarmaganlik uchun O'zbekiston Respublikasi qonunchiligiga muvofiq javobgar bo'ladi.\n" +
      "14.2. Tashkilotchi Instagram platformasi, internet provayderlari, mobil aloqa operatorlari yoki boshqa uchinchi shaxslar faoliyatidagi uzilishlar, Instagram tomonidan ko'rishlar statistikasining o'zgartirilishi, shuningdek Ishtirokchi akkauntining bloklanishi oqibatlari uchun javobgar emas. 7.4 va 7.5-bandlarda belgilangan vaqtda qayd etilgan ko'rishlar soni yakuniy hisoblanadi va keyinchalik o'zgarishi natijalarga ta'sir qilmaydi.\n" +
      "14.3. Tomonlar yengib bo'lmaydigan kuch (fors-major) holatlari — tabiiy ofatlar, harbiy harakatlar, davlat organlarining qarorlari va boshqa favqulodda holatlar tufayli majburiyatlarni bajarmaganlik uchun javobgarlikdan ozod qilinadi. Fors-major holati O'zbekiston Respublikasi Savdo-sanoat palatasi yoki boshqa vakolatli organ tomonidan berilgan hujjat bilan tasdiqlanishi lozim.",
  },
  {
    title: "15. Nizolarni hal qilish",
    body:
      "15.1. Ushbu Oferta yuzasidan kelib chiqadigan nizolar Tomonlar o'rtasida majburiy talabnoma (pretenziya) tartibida hal qilinadi. Ishtirokchining yozma e'tirozi Tashkilotchining yuridik manziliga yoki 17-bo'limda ko'rsatilgan rasmiy elektron pochtasiga yuboriladi. Tashkilotchi kelib tushgan e'tirozni 10 (o'n) ish kuni ichida ko'rib chiqadi va asoslantirilgan javob yuboradi.\n" +
      "15.2. Nizoni sudgacha hal qilish imkoni bo'lmagan taqdirda, nizo O'zbekiston Respublikasi qonunchiligida belgilangan tartibda Tashkilotchi joylashgan yerdagi fuqarolik ishlari bo'yicha sudda ko'rib chiqiladi.",
  },
  {
    title: "16. Yakuniy qoidalar",
    body:
      "16.1. O'zbekiston Respublikasi Fuqarolik kodeksining 977-moddasiga muvofiq, Tashkilotchi ushbu Oferta shartlariga o'zgartirish va qo'shimchalar kiritishga faqat Aksiya muddatining birinchi yarmi mobaynida (2027-yil 10-yanvargacha) haqli. O'zgartirishlar Platformada va Tashkilotchining rasmiy sahifalarida e'lon qilingan paytdan boshlab kuchga kiradi hamda e'lon qilingan sovrinlar jamg'armasini Ishtirokchilar zarariga kamaytirmaydi.\n" +
      "16.2. Ushbu Oferta Aksiya muddati tugaguniga va barcha sovrinlar topshirilguniga qadar amal qiladi. 11-bo'lim shartlari mutlaq huquqlarning qonunchilikda belgilangan butun amal qilish muddati davomida o'z kuchida qoladi.\n" +
      "16.3. Ushbu Ofertada nazarda tutilmagan masalalar O'zbekiston Respublikasi qonunchiligiga muvofiq hal qilinadi.\n" +
      "16.4. Aksiya bo'yicha savollar va e'tirozlar uchun 17-bo'limda ko'rsatilgan telefon raqami va rasmiy elektron pochta, shuningdek Telegram / Instagram sahifasi orqali murojaat qilish mumkin.",
  },
  {
    title: "17. Tashkilotchi rekvizitlari",
    body:
      "To'liq nomi: \"ALVIERO\" MAS'ULIYATI CHEKLANGAN JAMIYAT\n" +
      "Yuridik manzili: Ibroxim ota MFY, Ibroxim ota ko'chasi, 7-a-uy\n" +
      "Pochta manzili: Ibroxim ota MFY, Ibroxim ota ko'chasi, 7-a-uy\n" +
      "STIR (INN): 203697731\n" +
      "OKED: 20420\n" +
      "Bank nomi: ТОШКЕНТ Ш., \"ТИФ МИЛЛИЙ БАНКИ\" АЖ БОШ ОФИСИ\n" +
      "Hisob raqami: 20208000204137337001\n" +
      "MFO: 00450\n" +
      "Telefon: +998 95 508 80 08\n" +
      "Elektron pochta: info@alviero.uz\n" +
      "Rasmiy sayt / sahifa: https://alviero.uz/\n" +
      "Rahbar (F.I.Sh., lavozimi): Artikxodjayev Zakirxodja Abidovich",
  },
];
