import type { RulesSection } from "../types";

/*
 * Mock rejim uchun: backend `apps/backend/src/rules/offer-text.ts` ning aynan nusxasi (ommaviy
 * oferta 25.11.2026, UZ va RU). Haqiqiy ilova matnni serverdan oladi (`GET /miniapp/rules`).
 * Oferta o'zgarsa — shu faylga ham ko'chiring. Mock'da faqat kerak bo'lganda yuklanadi
 * (`import()`), production bundle'ga qo'shilmaydi.
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

/** Публичная оферта (25.11.2026) — официальный текст на русском языке. */
export const OFFER_RU: RulesSection[] = [
  {
    title: "Публичная оферта — об условиях участия в рекламной акции «OLIVIA»",
    body:
      "город Ташкент, 25 ноября 2026 года\n" +
      "Настоящий документ является официальной публичной офертой ООО «ALVIERO» (далее — «Организатор»), адресованной физическим лицам в соответствии с Гражданским кодексом Республики Узбекистан, и определяет условия участия в рекламной акции бренда OLIVIA.\n" +
      "С момента совершения лицом действия, указанного в пункте 2.3 настоящей Оферты, лицо считается полностью и безоговорочно принявшим (акцептовавшим) Оферту и признаётся заключившим с Организатором договор на условиях настоящей Оферты.",
  },
  {
    title: "1. Термины и определения",
    body:
      "1.1. В настоящей Оферте используются следующие термины:\n" +
      "— Организатор — ООО «ALVIERO», юридическое лицо, организующее и проводящее Акцию;\n" +
      "— Акция — рекламная акция, проводимая брендом OLIVIA на условиях настоящей Оферты;\n" +
      "— Участник — физическое лицо, акцептовавшее настоящую Оферту и отвечающее требованиям раздела 3;\n" +
      "— Платформа — используемые Организатором для Акции Telegram-бот @olivia_konkursbot и веб-сайт www.konkurs-olivia.uz (совместно или по отдельности). Участник вправе выбрать любой из них, оба имеют равную юридическую силу;\n" +
      "— Видео — видеоролик, размещённый Участником в своём аккаунте Instagram в формате Reels, ссылка на который зарегистрирована на Платформе;\n" +
      "— Подтверждённые просмотры — количество просмотров, прошедших проверку Организатором в соответствии с требованиями разделов 7 и 8, в отношении которых не выявлены признаки искусственной активности;\n" +
      "— Акцепт — полное и безоговорочное принятие Участником условий настоящей Оферты в порядке, установленном пунктом 2.3.",
  },
  {
    title: "2. Общие положения",
    body:
      "2.1. Настоящая Оферта определяет условия Акции, порядок участия, определения победителей, правила вручения призов, а также права на Видео.\n" +
      "2.2. Оферта вступает в силу с момента её опубликования на Платформе. Официальным и основным текстом Оферты считается текст, размещённый на веб-сайте www.konkurs-olivia.uz. Копии или ссылки, размещённые в Telegram-боте, на странице Организатора в Instagram и в других каналах, носят информационный характер; при расхождении текстов преимущественную силу имеет текст на веб-сайте.\n" +
      "2.3. Акцептом Оферты считается регистрация Участника на Платформе (в Telegram-боте или на веб-сайте) и нажатие в Telegram-боте кнопки «С условиями публичной оферты ознакомлен(а) и согласен(на)» либо проставление соответствующей отметки на веб-сайте. Акцепт совершается только один раз. Каждая последующая отправка ссылки на Видео на Платформу является исполнением договора, заключённого после акцепта, и означает применение к данному Видео условий раздела 11.\n" +
      "2.4. Акция проводится на территории Республики Узбекистан.\n" +
      "2.5. Срок проведения Акции: с 27 ноября 2026 года по 27 февраля 2027 года (включительно). Настоящая Оферта действует до полного исполнения Сторонами своих обязательств (в том числе до завершения определения победителей и вручения призов).\n" +
      "2.6. Основная цель Акции — повышение узнаваемости бренда OLIVIA и знакомство потребителей с брендом посредством интерактивного участия.\n" +
      "2.7. Участие в Акции бесплатное. Покупка продукции не является обязательным условием участия.\n" +
      "2.8. Акция проводится в форме публичного конкурса в смысле статьи 976 Гражданского кодекса Республики Узбекистан. Поскольку для участия не требуется оплата или покупка продукции, Акция не является лотереей или азартной игрой. Победители определяются на основании критериев, установленных настоящей Офертой.\n" +
      "2.9. Участник подтверждает, что участвует в Акции добровольно, без какого-либо принуждения. Участник понимает и принимает, что победители определяются путём случайного выбора (random), достижение установленного количества просмотров не гарантирует получение приза, а участие в Акции не влечёт для него никаких материальных обязательств или потерь. Участник подтверждает, что независимо от того, выиграл он приз или нет, не имеет к Организатору никаких претензий и возражений по результатам случайного выбора, проведённого в соответствии с настоящей Офертой. Данное положение не ограничивает право Участника на подачу возражений в случаях нарушения правил Акции, предусмотренное пунктами 8.7, 9.6 и разделом 15 настоящей Оферты.",
  },
  {
    title: "3. Требования к Участникам",
    body:
      "3.1. В Акции могут участвовать достигшие 18 лет граждане Республики Узбекистан, а также физические лица, постоянно проживающие на территории Республики Узбекистан (имеющие статус налогового резидента).\n" +
      "3.2. Участник должен использовать принадлежащий ему аккаунт Instagram.\n" +
      "3.3. Аккаунт Instagram должен быть открытым (public). Видео, размещённые в закрытых (private) аккаунтах, не учитываются.\n" +
      "3.4. Участник должен использовать личный аккаунт Instagram, существовавший до начала Акции. Создание нового аккаунта исключительно для Акции запрещается.\n" +
      "3.5. Каждый Участник может участвовать только через один личный аккаунт.\n" +
      "3.6. В Акции не могут участвовать работники Организатора, их близкие родственники (круг лиц, определённый статьёй 57 Семейного кодекса Республики Узбекистан), а также работники партнёрских организаций, привлечённых к организации и проведению Акции.\n" +
      "3.7. Участник обязан соблюдать все условия настоящей Оферты.",
  },
  {
    title: "4. Порядок участия в Акции",
    body:
      "4.1. Для участия в Акции Участник должен выполнить следующие шаги:\n" +
      "— запустить Telegram-бот (@olivia_konkursbot) или зайти на веб-сайт (www.konkurs-olivia.uz);\n" +
      "— зарегистрироваться на Платформе (указать имя, номер телефона и имя аккаунта Instagram) и акцептовать настоящую Оферту;\n" +
      "— разместить в своём аккаунте Instagram Видео в формате Reels с участием продукции OLIVIA;\n" +
      "— ввести ссылку на размещённое Видео на Платформе;\n" +
      "— проверить, что ссылка на Видео успешно принята.\n" +
      "4.2. В течение Акции Участник может разместить любое количество Видео и отправить ссылки на них на Платформу.\n" +
      "4.3. Каждое Видео должно регистрироваться отдельно.\n" +
      "4.4. Повторно отправленная ссылка на одно и то же Видео не учитывается.\n" +
      "4.5. В конкурсе учитываются только Видео, отвечающие требованиям настоящей Оферты и зарегистрированные на Платформе.\n" +
      "4.6. Участник обязан не удалять и не архивировать зарегистрированное на Платформе Видео в своём аккаунте Instagram, а также сохранять открытый (public) статус аккаунта до официального объявления итогов Акции и вручения призов.",
  },
  {
    title: "5. Требования к Видео",
    body:
      "5.1. Видео должны быть оригинальным контентом, созданным самим Участником.\n" +
      "5.2. В Видео продукция OLIVIA должна быть чётко видна либо должна содержаться содержательная информация о продукции.\n" +
      "5.3. Видео могут быть в следующих форматах:\n" +
      "— обзор продукции;\n" +
      "— процесс использования продукции;\n" +
      "— творческие и развлекательные видео;\n" +
      "— демонстрация преимуществ продукции;\n" +
      "— другие оригинальные идеи, связанные с брендом OLIVIA.\n" +
      "5.4. Запрещается несанкционированное копирование видео других лиц, нарушение авторских и смежных прав (в том числе использование музыкальных произведений, использование которых в коммерческих целях запрещено), распространение ложной информации, демонстрация брендов-конкурентов, а также размещение контента, наносящего ущерб деловой репутации бренда OLIVIA и противоречащего законодательству Республики Узбекистан, нормам морали и нравственности.\n" +
      "5.5. Видео, не соответствующие требованиям Акции, не учитываются.\n" +
      "5.6. В соответствии с требованиями Закона Республики Узбекистан «О рекламе» Участник обязан указать в описании размещаемого Видео хештег #reklama или #OLIVIAaksiya, обозначающий, что Видео подготовлено в рамках рекламы/акции.\n" +
      "5.7. В Видео допускается использование только музыки, свободной от авторских прав (royalty-free), или музыки, разрешённой Instagram для использования в коммерческих целях.",
  },
  {
    title: "6.1. Ежемесячные призы",
    body:
      "6.1.1. Ежемесячно среди Участников, набравших в соответствующем месячном этапе от 1 000 до 100 000 подтверждённых просмотров, путём случайного выбора (random) разыгрываются подарочные ваучеры Korzinka номиналом 500 000 сумов:\n" +
      "— в месяц — 200 ваучеров;\n" +
      "— за время Акции — всего 600 ваучеров;\n" +
      "— номинал одного ваучера — 500 000 (пятьсот тысяч) сумов.\n" +
      "6.1.2. Месячные этапы:\n" +
      "— 1-й этап: 27 ноября 2026 года — 26 декабря 2026 года;\n" +
      "— 2-й этап: 27 декабря 2026 года — 26 января 2027 года;\n" +
      "— 3-й этап: 27 января 2027 года — 27 февраля 2027 года.\n" +
      "6.1.3. По итогам каждого месячного этапа 200 победителей определяются путём случайного выбора среди Участников, отвечающих установленным требованиям, и каждому из них вручается подарочный ваучер Korzinka номиналом 500 000 сумов.\n" +
      "6.1.4. Если количество Участников, отвечающих установленным требованиям, менее 200, оставшиеся ваучеры на следующий месяц не переносятся.\n" +
      "6.1.5. При выполнении требований каждый месяц Участник может выигрывать ваучеры в течение нескольких месяцев.\n" +
      "6.1.6. Случайный выбор по ежемесячным призам проводится в порядке, установленном пунктом 6.4 настоящей Оферты.",
  },
  {
    title: "6.2. Главные призы",
    body:
      "6.2.1. Главные призы разыгрываются по итогам Акции путём случайного выбора (random). Каждый вид приза разыгрывается среди Участников, общее количество подтверждённых просмотров которых, набранных за время Акции, попадает в следующий диапазон:\n" +
      "— 4 000 001 и более — 1 шт. — Автомобиль BYD Chazor\n" +
      "— 1 500 001 — 4 000 000 — 3 шт. — Туристическая путёвка в Таиланд на 2 человек\n" +
      "— 500 001 — 1 500 000 — 15 шт. — Смартфон iPhone 18 Pro\n" +
      "— 100 001 — 500 000 — 25 шт. — Планшет\n" +
      "6.2.2. Каждый Участник участвует в розыгрыше только одного приза по одному диапазону, соответствующему его общему количеству подтверждённых просмотров. Участники, набравшие 100 000 и менее просмотров, в розыгрыше главных призов не участвуют.\n" +
      "6.2.3. Если в каком-либо диапазоне количество Участников, отвечающих требованиям, меньше количества призов, установленного для этого диапазона, победителями признаются все Участники этого диапазона, отвечающие требованиям, а оставшиеся призы в другой диапазон не переносятся и не разыгрываются. Если в каком-либо диапазоне нет Участников, отвечающих требованиям, приз этого диапазона не разыгрывается.\n" +
      "6.2.4. Ежемесячные призы (подарочные ваучеры Korzinka) не являются главными призами. Участник, выигравший ежемесячный ваучер, сохраняет право участвовать в розыгрыше главного приза по своему диапазону. За время Акции Участник может получить несколько ежемесячных ваучеров и дополнительно только один главный приз.\n" +
      "6.2.5. Призы не подлежат замене денежным эквивалентом и передаче другому лицу.",
  },
  {
    title: "6.3–6.4. Порядок проведения случайного выбора",
    body:
      "6.3. Товарные знаки «iPhone», «BYD» и «Korzinka» принадлежат их соответствующим правообладателям; указанные бренды не являются организаторами или спонсорами настоящей Акции.\n" +
      "6.4. Порядок проведения случайного выбора\n" +
      "6.4.1. Случайный выбор по ежемесячным и главным призам проводится с помощью программы случайного выбора платформы konkurs-olivia.uz в присутствии комиссии, сформированной Организатором, в составе не менее 3 (трёх) человек.\n" +
      "6.4.2. В розыгрыше участвуют только Участники, прошедшие проверку в соответствии с разделами 7 и 8 и вошедшие в соответствующий диапазон. Перед розыгрышем по каждому диапазону формируется список участников.\n" +
      "6.4.3. Процесс розыгрыша записывается на видео и транслируется в прямом эфире на официальной странице Организатора в YouTube / Instagram.\n" +
      "6.4.4. Результаты розыгрыша оформляются протоколом, подписанным членами комиссии. В протоколе по каждому диапазону указываются количество участников, победители и резервные победители.\n" +
      "6.4.5. По каждому диапазону вместе с основными победителями путём случайного выбора определяются также резервные победители. Резервные победители признаются победителями в порядке очерёдности в случаях, предусмотренных пунктом 10.3.",
  },
  {
    title: "7. Подсчёт и проверка количества просмотров",
    body:
      "7.1. Количество просмотров каждого Участника суммируется по всем его Видео, зарегистрированным на Платформе и подтверждённым.\n" +
      "7.2. Для ежемесячных призов учитывается количество просмотров только тех Видео, которые зарегистрированы в течение соответствующего месяца.\n" +
      "7.3. Для главных призов учитывается общее количество просмотров всех подтверждённых Видео, зарегистрированных за время Акции.\n" +
      "7.4. По итогам каждого месячного этапа статистика просмотров фиксируется по состоянию на 23:59 по ташкентскому времени последнего дня соответствующего этапа и в течение 3 календарных дней проверяется и объявляется.\n" +
      "7.5. Итоговая статистика просмотров по главным призам фиксируется по состоянию на 23:59 по ташкентскому времени 27 февраля 2027 года и в течение 7 календарных дней проверяется и оформляется.\n" +
      "7.6. При необходимости Организатор вправе запросить дополнительные доказательства (скриншот, запись экрана) для проверки количества просмотров через статистику Instagram (Insights). Участник обязан предоставить запрошенные доказательства в течение 3 (трёх) календарных дней со дня направления запроса. Если доказательства не предоставлены в установленный срок или Участник отказывается их предоставить, соответствующие Видео не учитываются, а в случае повторения Участник может быть отстранён от Акции.\n" +
      "7.7. Лайки, комментарии и репосты не являются основным критерием при определении призёров, однако могут проверяться в качестве дополнительного показателя для выявления искусственной активности.",
  },
  {
    title: "8. Предотвращение искусственной активности и нарушений",
    body:
      "8.1. В Акции запрещается искусственная накрутка просмотров, использование ботов, создание фейковых аккаунтов, покупка лайков и комментариев, обмен активностью, а также набор просмотров с помощью платных рекламных инструментов Instagram (Target / Boost / Meta Ads).\n" +
      "8.2. Нарушением могут быть признаны следующие случаи:\n" +
      "— покупка искусственных просмотров и активности;\n" +
      "— использование ботов и автоматизированных сервисов;\n" +
      "— использование фейковых или массово созданных аккаунтов;\n" +
      "— искусственное увеличение просмотров и других показателей, в том числе с помощью платной рекламы (Target / Boost);\n" +
      "— неправомерное влияние на результаты других Участников.\n" +
      "8.3. Для выявления подозрительных случаев Организатор вправе проверять статистические данные, активность аккаунта и другие доступные показатели.\n" +
      "8.4. Признаки подозрительной активности оцениваются Организатором на основе комплексного изучения статистических показателей и активности аккаунта, а также ручной проверки.\n" +
      "8.5. На время проверки результаты Участника могут быть временно приостановлены.\n" +
      "8.6. В случае подтверждения нарушения Участник может быть отстранён от Акции, а его результаты — аннулированы.\n" +
      "8.7. Участник вправе подать возражение на решение о дисквалификации в течение 3 рабочих дней. Организатор рассматривает поступившее возражение в течение 5 рабочих дней.\n" +
      "8.8. Организатор не требует от Участников пароль от аккаунта Instagram.",
  },
  {
    title: "9. Определение победителей",
    body:
      "9.1. Победители определяются путём случайного выбора (random) по диапазонам просмотров, установленным разделом 6 настоящей Оферты. Победители не определяются по рейтингу или занятому месту. Один Участник может быть признан победителем только по одному главному призу (пункт 6.2.2).\n" +
      "9.2. Диапазон, в который входит Участник, определяется на основании количества подтверждённых просмотров, зафиксированного в сроки, установленные пунктами 7.4 и 7.5.\n" +
      "9.3. Результат случайного выбора является окончательным и пересмотру не подлежит, за исключением случаев, предусмотренных разделами 8 и 10.\n" +
      "9.4. До определения победителей проверяются:\n" +
      "— возраст Участника;\n" +
      "— принадлежность ему аккаунта Instagram;\n" +
      "— подлинность Видео;\n" +
      "— подтверждённость количества просмотров;\n" +
      "— соблюдение правил Акции.\n" +
      "9.5. Список победителей объявляется на официальных страницах Организатора или через другие официальные информационные каналы.\n" +
      "9.6. Если Участник считает, что ежемесячные или итоговые результаты, порядок определения победителей или его права нарушены, он вправе направить Организатору жалобу (возражение) в течение 1 (одного) календарного дня с момента объявления результатов. Жалоба направляется через Платформу или на официальный адрес электронной почты, указанный в разделе 17, в письменной форме с изложением оснований и приложением имеющихся доказательств.\n" +
      "9.7. Организатор рассматривает своевременно поступившую жалобу и направляет мотивированный ответ в срок, установленный пунктом 15.1. Жалобы, направленные по истечении установленного срока, не являются основанием для пересмотра результатов, однако это не ограничивает права Участника, предусмотренные разделом 15.",
  },
  {
    title: "10. Порядок вручения призов",
    body:
      "10.1. После объявления победителей Организатор связывается с ними.\n" +
      "10.2. Победитель должен связаться с Организатором в течение 5 календарных дней и предоставить сведения, необходимые для получения приза (документ, удостоверяющий личность, контактные данные и др.).\n" +
      "10.3. Вместо победителя, не ответившего в установленный срок, отказавшегося от получения приза или признанного по результатам проверки не соответствующим требованиям, победителем в порядке очерёдности признаётся резервный победитель, определённый по тому же диапазону.\n" +
      "10.4. Ваучеры Korzinka вручаются победителям в установленном порядке. Условия использования ваучеров разъясняются при их вручении.\n" +
      "10.5. Направление, продолжительность, количество путешественников, состав услуг и срок использования туристических путёвок заранее определяются Организатором и доводятся до сведения победителей.\n" +
      "10.6. Передача автомобиля BYD Chazor, нотариальное оформление и государственная регистрация в органах ГУБДД (ГАИ) осуществляются в соответствии с действующим законодательством. Все государственные пошлины и сборы, связанные с оформлением автомобиля, оплачиваются за счёт Победителя.\n" +
      "10.7. В соответствии со статьями 377 и 386 Налогового кодекса Республики Узбекистан налог на доходы физических лиц (НДФЛ 12%) со стоимости всех призов, полученных в натуральной форме, в том числе подарочных ваучеров Korzinka, вручённых в качестве ежемесячных призов, и главных призов, уплачивается Победителем в порядке, установленном законодательством. Организатор как налоговый агент в установленном порядке сообщает органам государственной налоговой службы о невозможности удержания налога.\n" +
      "10.8. При получении приза победитель подписывает с Организатором акт приёма-передачи приза.",
  },
  {
    title: "11. Авторское право на Видео",
    body:
      "11.1. С момента отправки ссылки на Видео на Платформу Участник передаёт Организатору все исключительные имущественные права на данное Видео в полном объёме, на безвозмездной основе (без выплаты авторского вознаграждения), на весь установленный законодательством срок действия исключительных прав и с действием на территории всего мира.\n" +
      "11.2. Организатор вправе по своему усмотрению, без получения дополнительного согласия Участника и без выплаты вознаграждения, использовать Видео любым законным способом, в том числе:\n" +
      "— размещать Видео в формате постов, Reels, Stories и в других форматах на страницах Организатора и бренда OLIVIA в Instagram, Telegram, TikTok, YouTube, Facebook и других социальных сетях;\n" +
      "— использовать Видео на веб-сайтах, в мобильных приложениях, на телевидении, радио, в наружной и внутренней рекламе, а также в иных рекламных и маркетинговых материалах;\n" +
      "— перерабатывать, монтировать, сокращать Видео, объединять их с другими материалами, добавлять в них текст, музыку, логотипы и другие элементы;\n" +
      "— воспроизводить, распространять, публично демонстрировать и доводить Видео до всеобщего сведения;\n" +
      "— предоставлять право использования Видео третьим лицам (партнёрам, рекламным агентствам и др.).\n" +
      "11.3. При использовании Видео Организатор вправе указывать или не указывать имя Участника или название его аккаунта.\n" +
      "11.4. Участник даёт согласие на использование Организатором его изображения, имени и голоса в Видео в целях, указанных в настоящем разделе.\n" +
      "11.5. Участник гарантирует, что Видео создано им самим и что он получил необходимые разрешения от других лиц, изображённых в Видео, а также от авторов музыки, изображений и других материалов, использованных в Видео.\n" +
      "11.6. В случае предъявления третьими лицами претензий к Организатору в связи с Видео Участник обязуется урегулировать такие претензии за свой счёт и возместить Организатору причинённый ущерб.\n" +
      "11.7. Права, указанные в настоящем разделе, сохраняются за Организатором независимо от того, стало ли Видео победителем, вышел ли Участник из Акции или был от неё отстранён, а также от удаления Участником Видео из своего аккаунта.\n" +
      "11.8. Личные неимущественные права автора, не подлежащие передаче другому лицу в соответствии с законодательством, остаются за Участником.",
  },
  {
    title: "12. Обработка персональных данных",
    body:
      "12.1. Акцептуя Оферту, Участник даёт согласие на обработку своих персональных данных (Ф.И.О., дата рождения, номер телефона, данные аккаунтов Instagram и Telegram и др.) в целях организации Акции, проверки Участников, определения победителей, вручения призов и опубликования списка победителей.\n" +
      "12.2. Персональные данные обрабатываются в соответствии с законодательством Республики Узбекистан о защите персональных данных.\n" +
      "12.3. Организатор принимает необходимые меры для защиты персональных данных Участников от несанкционированного использования и распространения.\n" +
      "12.4. В соответствии с Законом Республики Узбекистан «О персональных данных» согласие на обработку персональных данных даётся на срок проведения Акции, а также на 3 (три) года после её завершения. Участник вправе отозвать данное согласие, направив письменное заявление на официальную электронную почту Организатора (в этом случае участие Участника в Акции прекращается).",
  },
  {
    title: "13. Права и обязанности Сторон",
    body:
      "13.1. Организатор имеет право:\n" +
      "— проверять соблюдение Участниками требований настоящей Оферты;\n" +
      "— не учитывать Видео, не соответствующие требованиям, и отстранять Участников-нарушителей от Акции;\n" +
      "— использовать Видео в соответствии с разделом 11;\n" +
      "— вносить изменения в Оферту в сроки и порядке, установленные пунктом 16.1.\n" +
      "13.2. Организатор обязуется:\n" +
      "— проводить Акцию в соответствии с условиями настоящей Оферты;\n" +
      "— беспристрастно определять победителей и вручать призы в установленном порядке;\n" +
      "— защищать персональные данные Участников.\n" +
      "13.3. Участник имеет право:\n" +
      "— получать информацию об условиях Акции;\n" +
      "— получить приз при выполнении условий Оферты;\n" +
      "— подать возражение на решения Организатора в течение 1 дня.\n" +
      "13.4. Участник обязуется:\n" +
      "— соблюдать условия настоящей Оферты;\n" +
      "— предоставлять о себе правильные и достоверные сведения;\n" +
      "— не нарушать права третьих лиц.",
  },
  {
    title: "14. Ответственность и форс-мажор",
    body:
      "14.1. За неисполнение или ненадлежащее исполнение обязательств по настоящей Оферте Стороны несут ответственность в соответствии с законодательством Республики Узбекистан.\n" +
      "14.2. Организатор не несёт ответственности за перебои в работе платформы Instagram, интернет-провайдеров, операторов мобильной связи или иных третьих лиц, изменение Instagram статистики просмотров, а также за последствия блокировки аккаунта Участника. Количество просмотров, зафиксированное в сроки, установленные пунктами 7.4 и 7.5, является окончательным, и его последующее изменение на результаты не влияет.\n" +
      "14.3. Стороны освобождаются от ответственности за неисполнение обязательств вследствие обстоятельств непреодолимой силы (форс-мажор) — стихийных бедствий, военных действий, решений государственных органов и иных чрезвычайных обстоятельств. Форс-мажорное обстоятельство должно быть подтверждено документом, выданным Торгово-промышленной палатой Республики Узбекистан или иным уполномоченным органом.",
  },
  {
    title: "15. Разрешение споров",
    body:
      "15.1. Споры, вытекающие из настоящей Оферты, разрешаются между Сторонами в обязательном претензионном порядке. Письменное возражение Участника направляется на юридический адрес Организатора или на официальную электронную почту, указанную в разделе 17. Организатор рассматривает поступившее возражение в течение 10 (десяти) рабочих дней и направляет мотивированный ответ.\n" +
      "15.2. При невозможности досудебного урегулирования спор рассматривается в суде по гражданским делам по месту нахождения Организатора в порядке, установленном законодательством Республики Узбекистан.",
  },
  {
    title: "16. Заключительные положения",
    body:
      "16.1. В соответствии со статьёй 977 Гражданского кодекса Республики Узбекистан Организатор вправе вносить изменения и дополнения в условия настоящей Оферты только в течение первой половины срока проведения Акции (до 10 января 2027 года). Изменения вступают в силу с момента их опубликования на Платформе и на официальных страницах Организатора и не уменьшают объявленный призовой фонд в ущерб Участникам.\n" +
      "16.2. Настоящая Оферта действует до окончания срока Акции и вручения всех призов. Условия раздела 11 сохраняют силу в течение всего установленного законодательством срока действия исключительных прав.\n" +
      "16.3. Вопросы, не предусмотренные настоящей Офертой, разрешаются в соответствии с законодательством Республики Узбекистан.\n" +
      "16.4. С вопросами и возражениями по Акции можно обращаться по номеру телефона и на официальную электронную почту, указанные в разделе 17, а также через страницу в Telegram / Instagram.",
  },
  {
    title: "17. Реквизиты Организатора",
    body:
      "Полное наименование: Общество с ограниченной ответственностью «ALVIERO»\n" +
      "Юридический адрес: МСГ «Иброхим ота», ул. Иброхим ота, дом 7-а\n" +
      "Почтовый адрес: МСГ «Иброхим ота», ул. Иброхим ота, дом 7-а\n" +
      "ИНН (STIR): 203697731\n" +
      "ОКЭД: 20420\n" +
      "Наименование банка: Головной офис АО «Национальный банк ВЭД Республики Узбекистан», г. Ташкент\n" +
      "Расчётный счёт: 20208000204137337001\n" +
      "МФО: 00450\n" +
      "Телефон: +998 95 508 80 08\n" +
      "Электронная почта: info@alviero.uz\n" +
      "Официальный сайт / страница: https://alviero.uz/\n" +
      "Руководитель (Ф.И.О., должность): Артикходжаев Закирходжа Абидович",
  },
];
