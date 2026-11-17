import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_uz.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[Locale('uz')];

  /// No description provided for @appTitle.
  ///
  /// In uz, this message translates to:
  /// **'Reels tanlovi'**
  String get appTitle;

  /// No description provided for @greeting.
  ///
  /// In uz, this message translates to:
  /// **'Salom, {name}'**
  String greeting(String name);

  /// No description provided for @welcome.
  ///
  /// In uz, this message translates to:
  /// **'Tanlovga xush kelibsiz'**
  String get welcome;

  /// No description provided for @daysLeft.
  ///
  /// In uz, this message translates to:
  /// **'Tanlov tugashiga {days} kun qoldi'**
  String daysLeft(int days);

  /// No description provided for @contestFinished.
  ///
  /// In uz, this message translates to:
  /// **'Tanlov yakunlandi'**
  String get contestFinished;

  /// No description provided for @ratingTitle.
  ///
  /// In uz, this message translates to:
  /// **'Reyting'**
  String get ratingTitle;

  /// No description provided for @filterAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get filterAll;

  /// No description provided for @filterTop10.
  ///
  /// In uz, this message translates to:
  /// **'Top 10'**
  String get filterTop10;

  /// No description provided for @filterNearMe.
  ///
  /// In uz, this message translates to:
  /// **'Men atrofimda'**
  String get filterNearMe;

  /// No description provided for @firstPlace.
  ///
  /// In uz, this message translates to:
  /// **'1-o\'rin'**
  String get firstPlace;

  /// No description provided for @viewsCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ko\'rish'**
  String viewsCount(String count);

  /// No description provided for @participantsCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ishtirokchi'**
  String participantsCount(String count);

  /// No description provided for @myRankCta.
  ///
  /// In uz, this message translates to:
  /// **'Mening o\'rnim: {rank}'**
  String myRankCta(int rank);

  /// No description provided for @joinCta.
  ///
  /// In uz, this message translates to:
  /// **'Videongizni yuboring'**
  String get joinCta;

  /// No description provided for @you.
  ///
  /// In uz, this message translates to:
  /// **'Siz'**
  String get you;

  /// No description provided for @ratingEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Reyting hali shakllanmagan'**
  String get ratingEmpty;

  /// No description provided for @loadError.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotni yuklab bo\'lmadi'**
  String get loadError;

  /// No description provided for @retry.
  ///
  /// In uz, this message translates to:
  /// **'Qayta urinish'**
  String get retry;

  /// No description provided for @myReelTitle.
  ///
  /// In uz, this message translates to:
  /// **'Mening videom'**
  String get myReelTitle;

  /// No description provided for @myReelSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Link va ko\'rishlar statistikasi'**
  String get myReelSubtitle;

  /// No description provided for @submitHeading.
  ///
  /// In uz, this message translates to:
  /// **'Reel linkini yuboring'**
  String get submitHeading;

  /// No description provided for @submitBody.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot haqidagi Instagram Reel linkini qo\'ying. Ko\'rishlar har kuni avtomatik yangilanadi.'**
  String get submitBody;

  /// No description provided for @linkHint.
  ///
  /// In uz, this message translates to:
  /// **'https://www.instagram.com/reel/...'**
  String get linkHint;

  /// No description provided for @paste.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'yish'**
  String get paste;

  /// No description provided for @submit.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get submit;

  /// No description provided for @linkInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Bu Instagram Reel linki emas. Namuna: https://www.instagram.com/reel/ABC123'**
  String get linkInvalid;

  /// No description provided for @linkEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Linkni kiriting'**
  String get linkEmpty;

  /// No description provided for @submitFailed.
  ///
  /// In uz, this message translates to:
  /// **'Yuborib bo\'lmadi. Qayta urinib ko\'ring.'**
  String get submitFailed;

  /// No description provided for @submitted.
  ///
  /// In uz, this message translates to:
  /// **'Video qabul qilindi'**
  String get submitted;

  /// No description provided for @rulesHeading.
  ///
  /// In uz, this message translates to:
  /// **'Shartlar'**
  String get rulesHeading;

  /// No description provided for @ruleBusiness.
  ///
  /// In uz, this message translates to:
  /// **'Instagram akkaunt Business yoki Creator turida bo\'lishi kerak'**
  String get ruleBusiness;

  /// No description provided for @ruleTag.
  ///
  /// In uz, this message translates to:
  /// **'Videoda zavod akkaunti belgilangan bo\'lishi kerak'**
  String get ruleTag;

  /// No description provided for @ruleNoTarget.
  ///
  /// In uz, this message translates to:
  /// **'Pullik reklama (target) taqiqlangan'**
  String get ruleNoTarget;

  /// No description provided for @ruleOwn.
  ///
  /// In uz, this message translates to:
  /// **'Video o\'z akkauntingizda va ochiq bo\'lishi kerak'**
  String get ruleOwn;

  /// No description provided for @reelLinkLabel.
  ///
  /// In uz, this message translates to:
  /// **'Video linki'**
  String get reelLinkLabel;

  /// No description provided for @copy.
  ///
  /// In uz, this message translates to:
  /// **'Nusxalash'**
  String get copy;

  /// No description provided for @copied.
  ///
  /// In uz, this message translates to:
  /// **'Link nusxalandi'**
  String get copied;

  /// No description provided for @statusPending.
  ///
  /// In uz, this message translates to:
  /// **'Tekshirilmoqda'**
  String get statusPending;

  /// No description provided for @statusAccepted.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qilingan'**
  String get statusAccepted;

  /// No description provided for @statusRejected.
  ///
  /// In uz, this message translates to:
  /// **'Rad etilgan'**
  String get statusRejected;

  /// No description provided for @pendingNote.
  ///
  /// In uz, this message translates to:
  /// **'Video tekshirilmoqda. Qabul qilingach, statistika shu yerda paydo bo\'ladi.'**
  String get pendingNote;

  /// No description provided for @rejectedNote.
  ///
  /// In uz, this message translates to:
  /// **'Video rad etildi. Batafsil ma\'lumot uchun supportga murojaat qiling.'**
  String get rejectedNote;

  /// No description provided for @statTotalViews.
  ///
  /// In uz, this message translates to:
  /// **'Jami ko\'rishlar'**
  String get statTotalViews;

  /// No description provided for @statToday.
  ///
  /// In uz, this message translates to:
  /// **'Bugungi o\'sish'**
  String get statToday;

  /// No description provided for @statRank.
  ///
  /// In uz, this message translates to:
  /// **'Reytingdagi o\'rin'**
  String get statRank;

  /// No description provided for @statRankChange.
  ///
  /// In uz, this message translates to:
  /// **'O\'rin o\'zgarishi'**
  String get statRankChange;

  /// No description provided for @noChange.
  ///
  /// In uz, this message translates to:
  /// **'o\'zgarishsiz'**
  String get noChange;

  /// No description provided for @chartTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kunlik ko\'rishlar'**
  String get chartTitle;

  /// No description provided for @chartSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'So\'nggi 7 kun'**
  String get chartSubtitle;

  /// No description provided for @lastSynced.
  ///
  /// In uz, this message translates to:
  /// **'Oxirgi yangilanish: {time}'**
  String lastSynced(String time);

  /// No description provided for @notificationsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get notificationsTitle;

  /// No description provided for @notificationsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha bildirishnoma yo\'q'**
  String get notificationsEmpty;

  /// No description provided for @profileTitle.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get profileTitle;

  /// No description provided for @profileLockedNote.
  ///
  /// In uz, this message translates to:
  /// **'Ism, familiya va yosh ro\'yxatdan o\'tishda bir marta kiritiladi va o\'zgartirilmaydi.'**
  String get profileLockedNote;

  /// No description provided for @fieldFirstName.
  ///
  /// In uz, this message translates to:
  /// **'Ism'**
  String get fieldFirstName;

  /// No description provided for @fieldLastName.
  ///
  /// In uz, this message translates to:
  /// **'Familiya'**
  String get fieldLastName;

  /// No description provided for @fieldAge.
  ///
  /// In uz, this message translates to:
  /// **'Yosh'**
  String get fieldAge;

  /// No description provided for @fieldPhone.
  ///
  /// In uz, this message translates to:
  /// **'Telefon'**
  String get fieldPhone;

  /// No description provided for @navHome.
  ///
  /// In uz, this message translates to:
  /// **'Reyting'**
  String get navHome;

  /// No description provided for @navReel.
  ///
  /// In uz, this message translates to:
  /// **'Videom'**
  String get navReel;

  /// No description provided for @navNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get navNotifications;

  /// No description provided for @navProfile.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get navProfile;

  /// No description provided for @back.
  ///
  /// In uz, this message translates to:
  /// **'Orqaga'**
  String get back;

  /// No description provided for @welcomeHeroTitle.
  ///
  /// In uz, this message translates to:
  /// **'Reel joylang —\navtomobil yuting'**
  String get welcomeHeroTitle;

  /// No description provided for @welcomeHeroBody.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot haqida Instagram Reel joylang. Eng ko\'p ko\'rish yig\'gan ishtirokchi g\'olib bo\'ladi.'**
  String get welcomeHeroBody;

  /// No description provided for @welcomeLogin.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get welcomeLogin;

  /// No description provided for @welcomeGuest.
  ///
  /// In uz, this message translates to:
  /// **'Mehmon sifatida ko\'rish'**
  String get welcomeGuest;

  /// No description provided for @loginTitle.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqamingiz'**
  String get loginTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash kodi Telegram orqali yuboriladi. Bitta raqam — bitta akkaunt.'**
  String get loginSubtitle;

  /// No description provided for @phoneHint.
  ///
  /// In uz, this message translates to:
  /// **'90 123 45 67'**
  String get phoneHint;

  /// No description provided for @phoneInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqamini to\'liq kiriting (9 ta raqam)'**
  String get phoneInvalid;

  /// No description provided for @sendCode.
  ///
  /// In uz, this message translates to:
  /// **'Kod olish'**
  String get sendCode;

  /// No description provided for @otpTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kodni kiriting'**
  String get otpTitle;

  /// No description provided for @otpSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'{phone} raqami uchun kodni Telegram botimizdan oling'**
  String otpSubtitle(String phone);

  /// No description provided for @otpInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Kod noto\'g\'ri. Qayta urinib ko\'ring.'**
  String get otpInvalid;

  /// No description provided for @otpResendIn.
  ///
  /// In uz, this message translates to:
  /// **'Yangi kod: {seconds} s'**
  String otpResendIn(int seconds);

  /// No description provided for @otpResend.
  ///
  /// In uz, this message translates to:
  /// **'Yangi kod so\'rash'**
  String get otpResend;

  /// No description provided for @otpTestHint.
  ///
  /// In uz, this message translates to:
  /// **'Test rejimi: kod {code}'**
  String otpTestHint(String code);

  /// No description provided for @confirm.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get confirm;

  /// No description provided for @genericError.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik yuz berdi. Qayta urinib ko\'ring.'**
  String get genericError;

  /// No description provided for @registerTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get registerTitle;

  /// No description provided for @registerSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlarni hujjatdagidek kiriting.'**
  String get registerSubtitle;

  /// No description provided for @registerWarning.
  ///
  /// In uz, this message translates to:
  /// **'Diqqat: ism, familiya va yosh bir marta kiritiladi. Keyin ularni o\'zgartirib bo\'lmaydi.'**
  String get registerWarning;

  /// No description provided for @nameInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Kamida 2 ta harf kiriting'**
  String get nameInvalid;

  /// No description provided for @ageInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Yoshni raqam bilan kiriting'**
  String get ageInvalid;

  /// No description provided for @ageTooYoung.
  ///
  /// In uz, this message translates to:
  /// **'Tanlovda {min} yoshdan boshlab qatnashish mumkin'**
  String ageTooYoung(int min);

  /// No description provided for @ageRejected.
  ///
  /// In uz, this message translates to:
  /// **'Yoshingiz tanlov shartlariga to\'g\'ri kelmaydi'**
  String get ageRejected;

  /// No description provided for @continueLabel.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish'**
  String get continueLabel;

  /// No description provided for @registerConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlar to\'g\'rimi?'**
  String get registerConfirmTitle;

  /// No description provided for @registerConfirmBody.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlagandan keyin ularni o\'zgartirib bo\'lmaydi.'**
  String get registerConfirmBody;

  /// No description provided for @edit.
  ///
  /// In uz, this message translates to:
  /// **'Tahrirlash'**
  String get edit;

  /// No description provided for @rulesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tanlov qoidalari'**
  String get rulesTitle;

  /// No description provided for @rulesAgree.
  ///
  /// In uz, this message translates to:
  /// **'Qoidalar bilan tanishdim va ularga roziman'**
  String get rulesAgree;

  /// No description provided for @loginRequiredTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'ting'**
  String get loginRequiredTitle;

  /// No description provided for @loginRequiredBody.
  ///
  /// In uz, this message translates to:
  /// **'Bu bo\'limdan foydalanish uchun telefon raqamingiz bilan kiring.'**
  String get loginRequiredBody;

  /// No description provided for @menuSupport.
  ///
  /// In uz, this message translates to:
  /// **'Support'**
  String get menuSupport;

  /// No description provided for @menuRules.
  ///
  /// In uz, this message translates to:
  /// **'Tanlov qoidalari'**
  String get menuRules;

  /// No description provided for @menuWinner.
  ///
  /// In uz, this message translates to:
  /// **'G\'olib'**
  String get menuWinner;

  /// No description provided for @logout.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get logout;

  /// No description provided for @deleteAccount.
  ///
  /// In uz, this message translates to:
  /// **'Akkauntni o\'chirish'**
  String get deleteAccount;

  /// No description provided for @deleteConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Akkaunt o\'chirilsinmi?'**
  String get deleteConfirmTitle;

  /// No description provided for @deleteConfirmBody.
  ///
  /// In uz, this message translates to:
  /// **'Akkauntingiz va videongiz tanlovdan chiqariladi. Bu amalni ortga qaytarib bo\'lmaydi.'**
  String get deleteConfirmBody;

  /// No description provided for @delete.
  ///
  /// In uz, this message translates to:
  /// **'O\'chirish'**
  String get delete;

  /// No description provided for @cancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get cancel;

  /// No description provided for @supportTitle.
  ///
  /// In uz, this message translates to:
  /// **'Support'**
  String get supportTitle;

  /// No description provided for @supportEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha murojaat yo\'q. Savolingiz bo\'lsa, yozing.'**
  String get supportEmpty;

  /// No description provided for @supportNew.
  ///
  /// In uz, this message translates to:
  /// **'Yangi murojaat'**
  String get supportNew;

  /// No description provided for @ticketOpen.
  ///
  /// In uz, this message translates to:
  /// **'Yangi'**
  String get ticketOpen;

  /// No description provided for @ticketInProgress.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'rib chiqilmoqda'**
  String get ticketInProgress;

  /// No description provided for @ticketClosed.
  ///
  /// In uz, this message translates to:
  /// **'Yopilgan'**
  String get ticketClosed;

  /// No description provided for @ticketClosedNote.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat yopilgan. Yangi savol uchun yangi murojaat oching.'**
  String get ticketClosedNote;

  /// No description provided for @messageHint.
  ///
  /// In uz, this message translates to:
  /// **'Xabar yozing...'**
  String get messageHint;

  /// No description provided for @attach.
  ///
  /// In uz, this message translates to:
  /// **'Skrinshot biriktirish'**
  String get attach;

  /// No description provided for @removeAttachment.
  ///
  /// In uz, this message translates to:
  /// **'Biriktirmani olib tashlash'**
  String get removeAttachment;

  /// No description provided for @send.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get send;

  /// No description provided for @attachTooLarge.
  ///
  /// In uz, this message translates to:
  /// **'Rasm hajmi {mb} MB dan oshmasligi kerak'**
  String attachTooLarge(int mb);

  /// No description provided for @attachFailed.
  ///
  /// In uz, this message translates to:
  /// **'Rasmni tanlab bo\'lmadi'**
  String get attachFailed;

  /// No description provided for @supportAgent.
  ///
  /// In uz, this message translates to:
  /// **'Support'**
  String get supportAgent;

  /// No description provided for @chatEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Muammoni batafsil yozing. Kerak bo\'lsa, skrinshot biriktiring.'**
  String get chatEmpty;

  /// No description provided for @attachmentLabel.
  ///
  /// In uz, this message translates to:
  /// **'Biriktirilgan rasm'**
  String get attachmentLabel;

  /// No description provided for @winnerTitle.
  ///
  /// In uz, this message translates to:
  /// **'G\'olib'**
  String get winnerTitle;

  /// No description provided for @winnerPendingTitle.
  ///
  /// In uz, this message translates to:
  /// **'G\'olib hali e\'lon qilinmagan'**
  String get winnerPendingTitle;

  /// No description provided for @winnerPendingBody.
  ///
  /// In uz, this message translates to:
  /// **'G\'olib tanlov tugagach, tekshiruvdan so\'ng e\'lon qilinadi.'**
  String get winnerPendingBody;

  /// No description provided for @winnerCongrats.
  ///
  /// In uz, this message translates to:
  /// **'Tabriklaymiz!'**
  String get winnerCongrats;

  /// No description provided for @winnerPrize.
  ///
  /// In uz, this message translates to:
  /// **'Avtomobil sohibi'**
  String get winnerPrize;

  /// No description provided for @winnerAnnouncedAt.
  ///
  /// In uz, this message translates to:
  /// **'E\'lon qilingan: {date}'**
  String winnerAnnouncedAt(String date);

  /// No description provided for @markAllRead.
  ///
  /// In uz, this message translates to:
  /// **'Barchasini o\'qish'**
  String get markAllRead;

  /// No description provided for @navNotificationsShort.
  ///
  /// In uz, this message translates to:
  /// **'Xabarlar'**
  String get navNotificationsShort;

  /// No description provided for @unreadLabel.
  ///
  /// In uz, this message translates to:
  /// **'O\'qilmagan'**
  String get unreadLabel;

  /// No description provided for @prizeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Bosh sovrin'**
  String get prizeLabel;

  /// No description provided for @prizeCar.
  ///
  /// In uz, this message translates to:
  /// **'Chevrolet Cobalt'**
  String get prizeCar;

  /// No description provided for @otpStep1.
  ///
  /// In uz, this message translates to:
  /// **'Telegram botimizni oching'**
  String get otpStep1;

  /// No description provided for @otpStep2.
  ///
  /// In uz, this message translates to:
  /// **'Botda «Raqamni ulashish» tugmasini bosing'**
  String get otpStep2;

  /// No description provided for @otpStep3.
  ///
  /// In uz, this message translates to:
  /// **'Bot yuborgan 6 xonali kodni shu yerga kiriting'**
  String get otpStep3;

  /// No description provided for @openTelegram.
  ///
  /// In uz, this message translates to:
  /// **'Telegram\'ni ochish'**
  String get openTelegram;

  /// No description provided for @telegramOpenFailed.
  ///
  /// In uz, this message translates to:
  /// **'Telegram\'ni ochib bo\'lmadi. Telegram o\'rnatilganini tekshiring.'**
  String get telegramOpenFailed;

  /// No description provided for @telegramNotConnected.
  ///
  /// In uz, this message translates to:
  /// **'Test rejimi: bot hali ulanmagan. Kod: {code}'**
  String telegramNotConnected(String code);

  /// No description provided for @codeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash kodi'**
  String get codeLabel;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['uz'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'uz':
      return AppLocalizationsUz();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
