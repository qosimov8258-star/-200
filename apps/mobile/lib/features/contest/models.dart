enum ReelStatus { pending, accepted, rejected }

/// Foydalanuvchi ilovaning qaysi bosqichida ekanini bildiradi.
enum SessionStage {
  /// Kirmagan — xush kelibsiz ekrani.
  signedOut,

  /// Mehmon: faqat reyting va qoidalarni ko'radi.
  guest,

  /// Telefon tasdiqlangan, ism/familiya/yosh hali kiritilmagan.
  needsRegistration,

  /// Ro'yxatdan o'tgan, qoidalarga rozilik hali berilmagan.
  needsConsent,

  active,
}

enum TicketStatus { open, inProgress, closed }

/// Tasdiqlash kodi so'rovi natijasi. Kod Telegram bot orqali yetkaziladi:
/// foydalanuvchi [telegramUrl] ni ochadi, botda raqamini ulashadi va bot
/// unga kod yuboradi. Telegram bu yerda faqat kod yetkazuvchi — akkaunt
/// ilovaning o'zida, telefon raqami bo'yicha.
class OtpChallenge {
  const OtpChallenge({required this.phone, required this.telegramUrl});

  final String phone;

  /// Botni ochuvchi havola (bir martalik token bilan, telefon raqamisiz).
  /// null — bot ulanmagan (test muhiti).
  final Uri? telegramUrl;
}

class ContestInfo {
  const ContestInfo({
    required this.endsAt,
    required this.participants,
    required this.minAge,
  });

  final DateTime endsAt;
  final int participants;
  final int minAge;

  /// Tanlov tugashiga qolgan to'liq kunlar (manfiy bo'lmaydi).
  int daysLeft(DateTime now) {
    final diff = endsAt.difference(now);
    return diff.isNegative ? 0 : diff.inDays;
  }
}

class RatingEntry {
  const RatingEntry({
    required this.rank,
    required this.fullName,
    required this.views,
    required this.deltaRank,
    this.isMe = false,
  });

  final int rank;
  final String fullName;
  final int views;

  /// Kechagi kunga nisbatan o'rin o'zgarishi: musbat — ko'tarilgan.
  final int deltaRank;
  final bool isMe;
}

/// Bir kun oxiridagi jami ko'rishlar (snapshot).
class ViewsSnapshot {
  const ViewsSnapshot({required this.day, required this.totalViews});

  final DateTime day;
  final int totalViews;
}

class DailyGain {
  const DailyGain({required this.day, required this.views});

  final DateTime day;
  final int views;
}

class MyReel {
  const MyReel({
    required this.url,
    required this.shortcode,
    required this.status,
    required this.totalViews,
    required this.rank,
    required this.deltaRank,
    required this.history,
    required this.lastSyncedAt,
  });

  final String url;
  final String shortcode;
  final ReelStatus status;
  final int totalViews;
  final int? rank;
  final int deltaRank;

  /// Kunlik snapshotlar, eskidan yangiga tartiblangan.
  final List<ViewsSnapshot> history;
  final DateTime? lastSyncedAt;

  /// Snapshotlar orasidagi farq — har kungi o'sish.
  List<DailyGain> get dailyGains => [
    for (var i = 1; i < history.length; i++)
      DailyGain(
        day: history[i].day,
        views: history[i].totalViews - history[i - 1].totalViews,
      ),
  ];

  int get todayGain {
    final gains = dailyGains;
    return gains.isEmpty ? 0 : gains.last.views;
  }
}

class Profile {
  const Profile({
    required this.firstName,
    required this.lastName,
    required this.age,
    required this.phone,
  });

  final String firstName;
  final String lastName;
  final int age;
  final String phone;

  String get fullName => '$firstName $lastName';
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.read,
  });

  final String id;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool read;

  AppNotification markedRead() => AppNotification(
    id: id,
    title: title,
    body: body,
    createdAt: createdAt,
    read: true,
  );
}

class RulesSection {
  const RulesSection({required this.title, required this.body});

  final String title;
  final String body;
}

class ContestRules {
  const ContestRules({required this.version, required this.sections});

  /// Rozilik qaysi versiyaga berilgani serverda saqlanadi.
  final int version;
  final List<RulesSection> sections;
}

class Winner {
  const Winner({
    required this.fullName,
    required this.finalViews,
    required this.announcedAt,
  });

  final String fullName;
  final int finalViews;
  final DateTime announcedAt;
}

class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.status,
    required this.lastMessage,
    required this.updatedAt,
  });

  final String id;
  final TicketStatus status;
  final String lastMessage;
  final DateTime updatedAt;
}

class SupportMessage {
  const SupportMessage({
    required this.fromSupport,
    required this.text,
    required this.createdAt,
    this.attachmentPath,
  });

  final bool fromSupport;
  final String text;
  final DateTime createdAt;

  /// Qurilmadagi rasm yo'li (mock). API ulanganda — yuklangan fayl URL i.
  final String? attachmentPath;
}
