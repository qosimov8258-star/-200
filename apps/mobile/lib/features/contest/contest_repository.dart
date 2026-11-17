import '../reels/reel_url.dart';
import 'models.dart';

class ReelSubmitException implements Exception {
  const ReelSubmitException(this.reason);

  final ReelSubmitFailure reason;
}

enum ReelSubmitFailure { invalidLink, alreadySubmitted, server }

class AuthException implements Exception {
  const AuthException(this.reason);

  final AuthFailure reason;
}

enum AuthFailure { invalidPhone, invalidCode, underAge, invalidProfile, server }

/// Backend bilan yagona aloqa nuqtasi. Hozircha [MockContestRepository]
/// ishlatiladi; API tayyor bo'lgach, OpenAPI klientiga asoslangan
/// implementatsiya bilan almashtiriladi — ekranlar o'zgarmaydi.
abstract interface class ContestRepository {
  /// Ilova ochilganda tiklangan sessiya holati.
  SessionStage get initialStage;

  /// Faqat test muhitida: qabul qilinadigan kod. Haqiqiy API da — null.
  String? get otpTestHint;

  /// Kod so'raydi. Kod Telegram bot orqali yetkaziladi — [OtpChallenge].
  Future<OtpChallenge> requestOtp(String phone);
  Future<SessionStage> verifyOtp(String phone, String code);
  Future<void> register({
    required String firstName,
    required String lastName,
    required int age,
  });
  Future<ContestRules> rules();
  Future<void> acceptRules(int version);
  Future<void> logout();
  Future<void> deleteAccount();

  Future<ContestInfo> contest();
  Future<Profile?> profile();
  Future<List<RatingEntry>> rating();
  Future<MyReel?> myReel();
  Future<MyReel> submitReel(String url);
  Future<List<AppNotification>> notifications();
  Future<void> markNotificationRead(String id);
  Future<void> markAllNotificationsRead();
  Future<Winner?> winner();

  Future<List<SupportTicket>> supportTickets();
  Future<List<SupportMessage>> supportMessages(String ticketId);
  Future<SupportTicket> createTicket(String text, {String? attachmentPath});
  Future<void> sendSupportMessage(
    String ticketId,
    String text, {
    String? attachmentPath,
  });
}

final _phonePattern = RegExp(r'^\+998\d{9}$');

/// Xotiradagi soxta ma'lumotlar. Ko'rishlar serverda yig'iladi — bu yerda
/// faqat UI ni ko'rsatish uchun namunaviy sonlar bor. Ilova qayta ochilganda
/// hammasi boshidan boshlanadi.
class MockContestRepository implements ContestRepository {
  MockContestRepository({
    DateTime Function()? clock,
    this.latency = _latency,
    bool signedIn = false,
    bool demo = false,
    this.winnerAnnounced = false,
  }) : _clock = clock ?? DateTime.now {
    if (signedIn || demo) {
      _signedIn = true;
      _phone = '+998901234517';
      _profile = demo
          ? _buildProfile('Jamshid', 'Ergashev', 25)
          : _buildProfile('Usmon', 'Karimov', 24);
      _consented = true;
    }
    // Demo: video allaqachon yuborilgan holat (do'kon skrinshotlari uchun).
    if (demo) _myReel = _sampleReel('Cx1AbC_d-9');
  }

  static const _latency = Duration(milliseconds: 350);
  static const _myRank = 12;
  static const _otp = '123456';

  /// `--dart-define=TELEGRAM_BOT_USERNAME=...`; bo'sh bo'lsa, bot ulanmagan.
  static const _botUsername = String.fromEnvironment('TELEGRAM_BOT_USERNAME');
  static const _minAge = 18;
  static const _rulesVersion = 1;

  final DateTime Function() _clock;
  final Duration latency;
  final bool winnerAnnounced;

  var _signedIn = false;
  String? _phone;
  Profile? _profile;
  var _consented = false;
  MyReel? _myReel;
  var _ticketSeq = 1;
  var _otpSeq = 0;
  final _readNotificationIds = <String>{'n2'};

  late final Map<String, SupportTicket> _tickets = {
    't1': SupportTicket(
      id: 't1',
      status: TicketStatus.closed,
      lastMessage: 'Ha, Creator akkaunt ham mos keladi.',
      updatedAt: _today.subtract(const Duration(days: 2, hours: -11)),
    ),
  };

  late final Map<String, List<SupportMessage>> _messages = {
    't1': [
      SupportMessage(
        fromSupport: false,
        text: 'Creator akkaunt bilan qatnashsa bo\'ladimi?',
        createdAt: _today.subtract(const Duration(days: 2, hours: -10)),
      ),
      SupportMessage(
        fromSupport: true,
        text: 'Ha, Creator akkaunt ham mos keladi.',
        createdAt: _today.subtract(const Duration(days: 2, hours: -11)),
      ),
    ],
  };

  static const _names = [
    'Dilnoza Rahimova',
    'Jasur Toshmatov',
    'Madina Yusupova',
    'Bekzod Aliyev',
    'Nigora Saidova',
    'Sardor Qodirov',
    'Zarina Ismoilova',
    'Otabek Nazarov',
    'Shahlo Ergasheva',
    'Aziz Mirzayev',
    'Kamola Tursunova',
    'Rustam Xolmatov',
    'Feruza Abdullayeva',
    'Ulug\'bek Sobirov',
    'Gulnoza Hamidova',
    'Doston Rasulov',
    'Malika Ortiqova',
    'Javohir Umarov',
    'Sevara Normatova',
    'Islom Haydarov',
    'Nodira Karimova',
    'Farrux Salimov',
    'Lola Mahmudova',
    'Sherzod Boboyev',
  ];

  static const _deltas = [0, 1, -1, 2, 0, -2, 3, 0, 1, -1, 0, 4];

  Future<void> _wait() => Future<void>.delayed(latency);

  DateTime get _today {
    final now = _clock();
    return DateTime(now.year, now.month, now.day);
  }

  Profile _buildProfile(String firstName, String lastName, int age) {
    final digits = _phone!.substring(4);
    return Profile(
      firstName: firstName,
      lastName: lastName,
      age: age,
      phone: '+998 ${digits.substring(0, 2)} *** ** ${digits.substring(7)}',
    );
  }

  /// Kirgan foydalanuvchi profili; kirmagan bo'lsa — null.
  Profile? get _me => _signedIn ? _profile : null;

  SessionStage get _stage {
    if (!_signedIn) return SessionStage.signedOut;
    if (_profile == null) return SessionStage.needsRegistration;
    if (!_consented) return SessionStage.needsConsent;
    return SessionStage.active;
  }

  @override
  SessionStage get initialStage => _stage;

  @override
  String? get otpTestHint => _otp;

  @override
  Future<OtpChallenge> requestOtp(String phone) async {
    await _wait();
    if (!_phonePattern.hasMatch(phone)) {
      throw const AuthException(AuthFailure.invalidPhone);
    }
    // Haqiqiy backend bir martalik token yaratadi; bot shu token bo'yicha
    // qaysi raqam kutilayotganini biladi. Havolada telefon raqami bo'lmaydi.
    _otpSeq++;
    return OtpChallenge(
      phone: phone,
      telegramUrl: _botUsername.isEmpty
          ? null
          : Uri.https('t.me', '/$_botUsername', {'start': 'login_$_otpSeq'}),
    );
  }

  @override
  Future<SessionStage> verifyOtp(String phone, String code) async {
    await _wait();
    if (!_phonePattern.hasMatch(phone)) {
      throw const AuthException(AuthFailure.invalidPhone);
    }
    if (code != _otp) throw const AuthException(AuthFailure.invalidCode);
    if (_phone != phone) {
      // Mock da bitta akkaunt bor: boshqa raqam — yangi, bo'sh akkaunt.
      _profile = null;
      _consented = false;
      _myReel = null;
    }
    _phone = phone;
    _signedIn = true;
    return _stage;
  }

  @override
  Future<void> register({
    required String firstName,
    required String lastName,
    required int age,
  }) async {
    await _wait();
    // Profil bir marta yoziladi — qayta yozishga urinish rad etiladi.
    if (!_signedIn || _profile != null) {
      throw const AuthException(AuthFailure.invalidProfile);
    }
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      throw const AuthException(AuthFailure.invalidProfile);
    }
    if (age < _minAge) throw const AuthException(AuthFailure.underAge);
    _profile = _buildProfile(firstName.trim(), lastName.trim(), age);
  }

  @override
  Future<ContestRules> rules() async {
    await _wait();
    // Namunaviy matn. Yakuniy qoidalar buyurtmachi va yurist tomonidan
    // tasdiqlanib, serverdan keladi.
    return const ContestRules(
      version: _rulesVersion,
      sections: [
        RulesSection(
          title: '1. Ishtirok etish',
          body:
              'Tanlovda zavod mahsulotini sotib olgan, 18 yoshga to\'lgan '
              'shaxslar qatnashadi. Bitta telefon raqami — bitta akkaunt.',
        ),
        RulesSection(
          title: '2. Video talablari',
          body:
              'Mahsulot haqidagi Reel o\'z Instagram akkauntingizda (Business '
              'yoki Creator) joylanadi, ochiq bo\'ladi va unda zavod akkaunti '
              'belgilanadi. Reel linki ilova orqali yuboriladi.',
        ),
        RulesSection(
          title: '3. Taqiqlar',
          body:
              'Pullik reklama (target) va sun\'iy ko\'rishlar taqiqlanadi. '
              'Qoidabuzarlik aniqlansa, ishtirokchi ogohlantiriladi yoki '
              'tanlovdan chetlatiladi.',
        ),
        RulesSection(
          title: '4. G\'olibni aniqlash',
          body:
              'Ko\'rishlar har kuni avtomatik yig\'iladi. Tanlov yakunida eng '
              'ko\'p ko\'rish yig\'gan ishtirokchi tekshiruvdan so\'ng g\'olib '
              'deb e\'lon qilinadi.',
        ),
        RulesSection(
          title: '5. Shaxsiy ma\'lumotlar',
          body:
              'Ism va familiyangiz ommaviy reytingda ko\'rsatiladi. Telefon '
              'raqamingiz boshqa ishtirokchilarga ko\'rsatilmaydi.',
        ),
      ],
    );
  }

  @override
  Future<void> acceptRules(int version) async {
    await _wait();
    if (_profile == null || version != _rulesVersion) {
      throw const AuthException(AuthFailure.server);
    }
    _consented = true;
  }

  @override
  Future<void> logout() async {
    await _wait();
    // Akkaunt saqlanib qoladi: shu raqam bilan qayta kirilsa, profil joyida.
    _signedIn = false;
  }

  @override
  Future<void> deleteAccount() async {
    await _wait();
    _signedIn = false;
    _phone = null;
    _profile = null;
    _consented = false;
    _myReel = null;
  }

  @override
  Future<ContestInfo> contest() async {
    await _wait();
    return ContestInfo(
      endsAt: _today.add(const Duration(days: 44, hours: 12)),
      participants: 1284,
      minAge: _minAge,
    );
  }

  @override
  Future<Profile?> profile() async {
    await _wait();
    return _me;
  }

  @override
  Future<List<RatingEntry>> rating() async {
    await _wait();
    final me = _me;
    final reel = _myReel;
    final entries = <RatingEntry>[];
    var nameIndex = 0;
    for (var rank = 1; rank <= _names.length + 1; rank++) {
      if (me != null && reel != null && rank == _myRank) {
        entries.add(
          RatingEntry(
            rank: rank,
            fullName: me.fullName,
            views: reel.totalViews,
            deltaRank: reel.deltaRank,
            isMe: true,
          ),
        );
        continue;
      }
      if (nameIndex >= _names.length) break;
      entries.add(
        RatingEntry(
          rank: rank,
          fullName: _names[nameIndex],
          views: 250000 ~/ rank + 6400 - rank * 37,
          deltaRank: _deltas[nameIndex % _deltas.length],
        ),
      );
      nameIndex++;
    }
    return entries;
  }

  @override
  Future<MyReel?> myReel() async {
    await _wait();
    return _me == null ? null : _myReel;
  }

  MyReel _sampleReel(String shortcode) {
    // Haqiqiy backendda video avval PENDING bo'ladi va statistika birinchi
    // kunlik yig'ishdan keyin paydo bo'ladi. Mock darhol namunaviy tarix
    // qaytaradi, shunda statistika ekranini ko'rish mumkin.
    const totals = [3120, 5480, 9050, 12890, 15400, 19760, 22310, 26255];
    final today = _today;
    return MyReel(
      url: canonicalReelUrl(shortcode),
      shortcode: shortcode,
      status: ReelStatus.accepted,
      totalViews: totals.last,
      rank: _myRank,
      deltaRank: 3,
      history: [
        for (var i = 0; i < totals.length; i++)
          ViewsSnapshot(
            day: today.subtract(Duration(days: totals.length - 1 - i)),
            totalViews: totals[i],
          ),
      ],
      lastSyncedAt: today.add(const Duration(hours: 9)),
    );
  }

  @override
  Future<MyReel> submitReel(String url) async {
    await _wait();
    final shortcode = parseReelShortcode(url);
    if (shortcode == null) {
      throw const ReelSubmitException(ReelSubmitFailure.invalidLink);
    }
    if (_myReel != null) {
      throw const ReelSubmitException(ReelSubmitFailure.alreadySubmitted);
    }
    if (_stage != SessionStage.active) {
      throw const ReelSubmitException(ReelSubmitFailure.server);
    }

    final reel = _sampleReel(shortcode);
    _myReel = reel;
    return reel;
  }

  @override
  Future<List<AppNotification>> notifications() async {
    await _wait();
    if (_me == null) return const [];
    final today = _today;
    return [
      AppNotification(
        id: 'n1',
        title: 'Reyting yangilandi',
        body: 'Bugungi ko\'rishlar yig\'ildi. O\'rningizni tekshiring.',
        createdAt: today.add(const Duration(hours: 9)),
        read: _readNotificationIds.contains('n1'),
      ),
      AppNotification(
        id: 'n2',
        title: 'Tanlov qoidalari',
        body: 'Pullik reklama (target) taqiqlanganini eslatib o\'tamiz.',
        createdAt: today.subtract(const Duration(days: 1, hours: -14)),
        read: _readNotificationIds.contains('n2'),
      ),
    ];
  }

  @override
  Future<void> markNotificationRead(String id) async {
    await _wait();
    _readNotificationIds.add(id);
  }

  @override
  Future<void> markAllNotificationsRead() async {
    await _wait();
    _readNotificationIds.addAll(const ['n1', 'n2']);
  }

  @override
  Future<Winner?> winner() async {
    await _wait();
    if (!winnerAnnounced) return null;
    return Winner(
      fullName: _names.first,
      finalViews: 1482930,
      announcedAt: _today,
    );
  }

  @override
  Future<List<SupportTicket>> supportTickets() async {
    await _wait();
    if (_me == null) return const [];
    return _tickets.values.toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  @override
  Future<List<SupportMessage>> supportMessages(String ticketId) async {
    await _wait();
    return List.unmodifiable(_messages[ticketId] ?? const []);
  }

  @override
  Future<SupportTicket> createTicket(
    String text, {
    String? attachmentPath,
  }) async {
    await _wait();
    final id = 'n${_ticketSeq++}';
    _messages[id] = [];
    _appendMessage(id, text, attachmentPath, TicketStatus.open);
    return _tickets[id]!;
  }

  @override
  Future<void> sendSupportMessage(
    String ticketId,
    String text, {
    String? attachmentPath,
  }) async {
    await _wait();
    final ticket = _tickets[ticketId];
    if (ticket == null || ticket.status == TicketStatus.closed) {
      throw StateError('Ticket is closed or missing: $ticketId');
    }
    _appendMessage(ticketId, text, attachmentPath, ticket.status);
  }

  void _appendMessage(
    String ticketId,
    String text,
    String? attachmentPath,
    TicketStatus status,
  ) {
    final now = _clock();
    _messages[ticketId]!.add(
      SupportMessage(
        fromSupport: false,
        text: text,
        attachmentPath: attachmentPath,
        createdAt: now,
      ),
    );
    _tickets[ticketId] = SupportTicket(
      id: ticketId,
      status: status,
      lastMessage: text,
      updatedAt: now,
    );
  }
}
