// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Uzbek (`uz`).
class AppLocalizationsUz extends AppLocalizations {
  AppLocalizationsUz([String locale = 'uz']) : super(locale);

  @override
  String get appTitle => 'Reels tanlovi';

  @override
  String greeting(String name) {
    return 'Salom, $name';
  }

  @override
  String get welcome => 'Tanlovga xush kelibsiz';

  @override
  String daysLeft(int days) {
    return 'Tanlov tugashiga $days kun qoldi';
  }

  @override
  String get contestFinished => 'Tanlov yakunlandi';

  @override
  String get ratingTitle => 'Reyting';

  @override
  String get filterAll => 'Barchasi';

  @override
  String get filterTop10 => 'Top 10';

  @override
  String get filterNearMe => 'Men atrofimda';

  @override
  String get firstPlace => '1-o\'rin';

  @override
  String viewsCount(String count) {
    return '$count ko\'rish';
  }

  @override
  String participantsCount(String count) {
    return '$count ishtirokchi';
  }

  @override
  String myRankCta(int rank) {
    return 'Mening o\'rnim: $rank';
  }

  @override
  String get joinCta => 'Videongizni yuboring';

  @override
  String get you => 'Siz';

  @override
  String get ratingEmpty => 'Reyting hali shakllanmagan';

  @override
  String get loadError => 'Ma\'lumotni yuklab bo\'lmadi';

  @override
  String get retry => 'Qayta urinish';

  @override
  String get myReelTitle => 'Mening videom';

  @override
  String get myReelSubtitle => 'Link va ko\'rishlar statistikasi';

  @override
  String get submitHeading => 'Reel linkini yuboring';

  @override
  String get submitBody =>
      'Mahsulot haqidagi Instagram Reel linkini qo\'ying. Ko\'rishlar har kuni avtomatik yangilanadi.';

  @override
  String get linkHint => 'https://www.instagram.com/reel/...';

  @override
  String get paste => 'Qo\'yish';

  @override
  String get submit => 'Yuborish';

  @override
  String get linkInvalid =>
      'Bu Instagram Reel linki emas. Namuna: https://www.instagram.com/reel/ABC123';

  @override
  String get linkEmpty => 'Linkni kiriting';

  @override
  String get submitFailed => 'Yuborib bo\'lmadi. Qayta urinib ko\'ring.';

  @override
  String get submitted => 'Video qabul qilindi';

  @override
  String get rulesHeading => 'Shartlar';

  @override
  String get ruleBusiness =>
      'Instagram akkaunt Business yoki Creator turida bo\'lishi kerak';

  @override
  String get ruleTag => 'Videoda zavod akkaunti belgilangan bo\'lishi kerak';

  @override
  String get ruleNoTarget => 'Pullik reklama (target) taqiqlangan';

  @override
  String get ruleOwn => 'Video o\'z akkauntingizda va ochiq bo\'lishi kerak';

  @override
  String get reelLinkLabel => 'Video linki';

  @override
  String get copy => 'Nusxalash';

  @override
  String get copied => 'Link nusxalandi';

  @override
  String get statusPending => 'Tekshirilmoqda';

  @override
  String get statusAccepted => 'Qabul qilingan';

  @override
  String get statusRejected => 'Rad etilgan';

  @override
  String get pendingNote =>
      'Video tekshirilmoqda. Qabul qilingach, statistika shu yerda paydo bo\'ladi.';

  @override
  String get rejectedNote =>
      'Video rad etildi. Batafsil ma\'lumot uchun supportga murojaat qiling.';

  @override
  String get statTotalViews => 'Jami ko\'rishlar';

  @override
  String get statToday => 'Bugungi o\'sish';

  @override
  String get statRank => 'Reytingdagi o\'rin';

  @override
  String get statRankChange => 'O\'rin o\'zgarishi';

  @override
  String get noChange => 'o\'zgarishsiz';

  @override
  String get chartTitle => 'Kunlik ko\'rishlar';

  @override
  String get chartSubtitle => 'So\'nggi 7 kun';

  @override
  String lastSynced(String time) {
    return 'Oxirgi yangilanish: $time';
  }

  @override
  String get notificationsTitle => 'Bildirishnomalar';

  @override
  String get notificationsEmpty => 'Hozircha bildirishnoma yo\'q';

  @override
  String get profileTitle => 'Profil';

  @override
  String get profileLockedNote =>
      'Ism, familiya va yosh ro\'yxatdan o\'tishda bir marta kiritiladi va o\'zgartirilmaydi.';

  @override
  String get fieldFirstName => 'Ism';

  @override
  String get fieldLastName => 'Familiya';

  @override
  String get fieldAge => 'Yosh';

  @override
  String get fieldPhone => 'Telefon';

  @override
  String get navHome => 'Reyting';

  @override
  String get navReel => 'Videom';

  @override
  String get navNotifications => 'Bildirishnomalar';

  @override
  String get navProfile => 'Profil';

  @override
  String get back => 'Orqaga';

  @override
  String get welcomeHeroTitle => 'Reel joylang —\navtomobil yuting';

  @override
  String get welcomeHeroBody =>
      'Mahsulot haqida Instagram Reel joylang. Eng ko\'p ko\'rish yig\'gan ishtirokchi g\'olib bo\'ladi.';

  @override
  String get welcomeLogin => 'Kirish';

  @override
  String get welcomeGuest => 'Mehmon sifatida ko\'rish';

  @override
  String get loginTitle => 'Telefon raqamingiz';

  @override
  String get loginSubtitle =>
      'Tasdiqlash kodi Telegram orqali yuboriladi. Bitta raqam — bitta akkaunt.';

  @override
  String get phoneHint => '90 123 45 67';

  @override
  String get phoneInvalid => 'Telefon raqamini to\'liq kiriting (9 ta raqam)';

  @override
  String get sendCode => 'Kod olish';

  @override
  String get otpTitle => 'Kodni kiriting';

  @override
  String otpSubtitle(String phone) {
    return '$phone raqami uchun kodni Telegram botimizdan oling';
  }

  @override
  String get otpInvalid => 'Kod noto\'g\'ri. Qayta urinib ko\'ring.';

  @override
  String otpResendIn(int seconds) {
    return 'Yangi kod: $seconds s';
  }

  @override
  String get otpResend => 'Yangi kod so\'rash';

  @override
  String otpTestHint(String code) {
    return 'Test rejimi: kod $code';
  }

  @override
  String get confirm => 'Tasdiqlash';

  @override
  String get genericError => 'Xatolik yuz berdi. Qayta urinib ko\'ring.';

  @override
  String get registerTitle => 'Ro\'yxatdan o\'tish';

  @override
  String get registerSubtitle => 'Ma\'lumotlarni hujjatdagidek kiriting.';

  @override
  String get registerWarning =>
      'Diqqat: ism, familiya va yosh bir marta kiritiladi. Keyin ularni o\'zgartirib bo\'lmaydi.';

  @override
  String get nameInvalid => 'Kamida 2 ta harf kiriting';

  @override
  String get ageInvalid => 'Yoshni raqam bilan kiriting';

  @override
  String ageTooYoung(int min) {
    return 'Tanlovda $min yoshdan boshlab qatnashish mumkin';
  }

  @override
  String get ageRejected => 'Yoshingiz tanlov shartlariga to\'g\'ri kelmaydi';

  @override
  String get continueLabel => 'Davom etish';

  @override
  String get registerConfirmTitle => 'Ma\'lumotlar to\'g\'rimi?';

  @override
  String get registerConfirmBody =>
      'Tasdiqlagandan keyin ularni o\'zgartirib bo\'lmaydi.';

  @override
  String get edit => 'Tahrirlash';

  @override
  String get rulesTitle => 'Tanlov qoidalari';

  @override
  String get rulesAgree => 'Qoidalar bilan tanishdim va ularga roziman';

  @override
  String get loginRequiredTitle => 'Ro\'yxatdan o\'ting';

  @override
  String get loginRequiredBody =>
      'Bu bo\'limdan foydalanish uchun telefon raqamingiz bilan kiring.';

  @override
  String get menuSupport => 'Support';

  @override
  String get menuRules => 'Tanlov qoidalari';

  @override
  String get menuWinner => 'G\'olib';

  @override
  String get logout => 'Chiqish';

  @override
  String get deleteAccount => 'Akkauntni o\'chirish';

  @override
  String get deleteConfirmTitle => 'Akkaunt o\'chirilsinmi?';

  @override
  String get deleteConfirmBody =>
      'Akkauntingiz va videongiz tanlovdan chiqariladi. Bu amalni ortga qaytarib bo\'lmaydi.';

  @override
  String get delete => 'O\'chirish';

  @override
  String get cancel => 'Bekor qilish';

  @override
  String get supportTitle => 'Support';

  @override
  String get supportEmpty =>
      'Hozircha murojaat yo\'q. Savolingiz bo\'lsa, yozing.';

  @override
  String get supportNew => 'Yangi murojaat';

  @override
  String get ticketOpen => 'Yangi';

  @override
  String get ticketInProgress => 'Ko\'rib chiqilmoqda';

  @override
  String get ticketClosed => 'Yopilgan';

  @override
  String get ticketClosedNote =>
      'Murojaat yopilgan. Yangi savol uchun yangi murojaat oching.';

  @override
  String get messageHint => 'Xabar yozing...';

  @override
  String get attach => 'Skrinshot biriktirish';

  @override
  String get removeAttachment => 'Biriktirmani olib tashlash';

  @override
  String get send => 'Yuborish';

  @override
  String attachTooLarge(int mb) {
    return 'Rasm hajmi $mb MB dan oshmasligi kerak';
  }

  @override
  String get attachFailed => 'Rasmni tanlab bo\'lmadi';

  @override
  String get supportAgent => 'Support';

  @override
  String get chatEmpty =>
      'Muammoni batafsil yozing. Kerak bo\'lsa, skrinshot biriktiring.';

  @override
  String get attachmentLabel => 'Biriktirilgan rasm';

  @override
  String get winnerTitle => 'G\'olib';

  @override
  String get winnerPendingTitle => 'G\'olib hali e\'lon qilinmagan';

  @override
  String get winnerPendingBody =>
      'G\'olib tanlov tugagach, tekshiruvdan so\'ng e\'lon qilinadi.';

  @override
  String get winnerCongrats => 'Tabriklaymiz!';

  @override
  String get winnerPrize => 'Avtomobil sohibi';

  @override
  String winnerAnnouncedAt(String date) {
    return 'E\'lon qilingan: $date';
  }

  @override
  String get markAllRead => 'Barchasini o\'qish';

  @override
  String get navNotificationsShort => 'Xabarlar';

  @override
  String get unreadLabel => 'O\'qilmagan';

  @override
  String get prizeLabel => 'Bosh sovrin';

  @override
  String get prizeCar => 'Chevrolet Cobalt';

  @override
  String get otpStep1 => 'Telegram botimizni oching';

  @override
  String get otpStep2 => 'Botda «Raqamni ulashish» tugmasini bosing';

  @override
  String get otpStep3 => 'Bot yuborgan 6 xonali kodni shu yerga kiriting';

  @override
  String get openTelegram => 'Telegram\'ni ochish';

  @override
  String get telegramOpenFailed =>
      'Telegram\'ni ochib bo\'lmadi. Telegram o\'rnatilganini tekshiring.';

  @override
  String telegramNotConnected(String code) {
    return 'Test rejimi: bot hali ulanmagan. Kod: $code';
  }

  @override
  String get codeLabel => 'Tasdiqlash kodi';
}
