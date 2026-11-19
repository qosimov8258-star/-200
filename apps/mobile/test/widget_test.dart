import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:reels_tanlov/app/app.dart';
import 'package:reels_tanlov/app/router.dart';
import 'package:reels_tanlov/features/contest/contest_repository.dart';
import 'package:reels_tanlov/features/contest/models.dart';
import 'package:reels_tanlov/features/contest/providers.dart';

Future<MockContestRepository> _pumpApp(
  WidgetTester tester, {
  bool signedIn = true,
  bool winnerAnnounced = false,
}) async {
  final repo = MockContestRepository(
    clock: () => DateTime(2026, 11, 17, 10),
    latency: Duration.zero,
    signedIn: signedIn,
    winnerAnnounced: winnerAnnounced,
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [contestRepositoryProvider.overrideWithValue(repo)],
      child: const ReelsContestApp(),
    ),
  );
  await tester.pumpAndSettle();
  return repo;
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('rating screen shows leader and prompts to join', (tester) async {
    await _pumpApp(tester);

    expect(find.text('Salom, Usmon'), findsOneWidget);
    expect(find.text('Reyting'), findsWidgets);
    expect(find.text('Dilnoza Rahimova'), findsWidgets);
    expect(find.text('Videongizni yuboring'), findsOneWidget);
    expect(find.text('Siz'), findsNothing);
  });

  testWidgets('unread notifications show a badge only when signed in', (
    tester,
  ) async {
    await _pumpApp(tester);
    final badge = find.byKey(const Key('nav-unread-badge'));
    expect(badge, findsOneWidget);
    expect(
      find.descendant(of: badge, matching: find.text('1')),
      findsOneWidget,
    );
  });

  testWidgets('tapping a notification marks it read', (tester) async {
    await _pumpApp(tester);
    final badge = find.byKey(const Key('nav-unread-badge'));
    await _tap(tester, find.byKey(const Key('nav-notifications')));
    expect(find.text('Bildirishnomalar'), findsOneWidget);
    expect(badge, findsOneWidget);

    await _tap(tester, find.text('Reyting yangilandi'));
    expect(badge, findsNothing);
  });

  testWidgets('"mark all read" clears the badge and stays read', (
    tester,
  ) async {
    final repo = await _pumpApp(tester);
    await _tap(tester, find.byKey(const Key('nav-notifications')));
    await _tap(tester, find.text('Barchasini o\'qish'));
    expect(find.byKey(const Key('nav-unread-badge')), findsNothing);

    // Server holati ham yangilangan: qayta yuklanganda o'qilgan bo'lib qoladi.
    final stored = await tester.runAsync(repo.notifications);
    expect(stored!.every((n) => n.read), isTrue);
  });

  testWidgets('dragging the lens along the bar switches sections', (
    tester,
  ) async {
    await _pumpApp(tester);
    final from = tester.getCenter(find.byKey(const Key('nav-home')));
    final to = tester.getCenter(find.byKey(const Key('nav-profile')));

    final gesture = await tester.startGesture(from);
    await gesture.moveTo(Offset((from.dx + to.dx) / 2, from.dy));
    await tester.pump();
    await gesture.moveTo(to);
    await tester.pump();
    // Barmoq qo'yib yuborilmaguncha bo'lim almashmaydi.
    expect(find.text('Salom, Usmon'), findsOneWidget);
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.text('Akkauntni o\'chirish'), findsOneWidget);
  });

  testWidgets('guest sees no unread badge', (tester) async {
    await _pumpApp(tester, signedIn: false);
    await _tap(tester, find.text('Mehmon sifatida ko\'rish'));
    expect(find.byKey(const Key('nav-unread-badge')), findsNothing);
  });

  testWidgets('submitting a link shows stats and adds me to rating', (
    tester,
  ) async {
    await _pumpApp(tester);

    await _tap(tester, find.byKey(const Key('nav-reel')));
    expect(find.text('Reel linkini yuboring'), findsOneWidget);

    // Yaroqsiz link — xato ko'rsatiladi, yuborilmaydi.
    await tester.enterText(find.byType(TextField), 'https://example.com/x');
    await _tap(tester, find.text('Yuborish'));
    expect(find.textContaining('Bu Instagram Reel linki emas'), findsOneWidget);

    await tester.enterText(
      find.byType(TextField),
      'https://www.instagram.com/reel/Cx1AbC_d-9/?igsh=zzz',
    );
    await _tap(tester, find.text('Yuborish'));

    expect(find.text('instagram.com/reel/Cx1AbC_d-9/'), findsOneWidget);
    expect(find.text('Qabul qilingan'), findsOneWidget);
    expect(find.text('26 255'), findsOneWidget);
    expect(find.text('+3 945'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);

    await _tap(tester, find.byKey(const Key('nav-home')));
    expect(find.text("Mening o'rnim: 12"), findsOneWidget);
  });

  testWidgets('onboarding: phone, code, registration, consent', (tester) async {
    await _pumpApp(tester, signedIn: false);
    expect(find.text('Mehmon sifatida ko\'rish'), findsOneWidget);

    await _tap(tester, find.text('Kirish'));
    expect(find.text('Telefon raqamingiz'), findsOneWidget);

    // To'liq bo'lmagan raqam rad etiladi.
    await tester.enterText(find.byType(TextField), '9012');
    await _tap(tester, find.text('Kod olish'));
    expect(find.textContaining('9 ta raqam'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '901112233');
    await _tap(tester, find.text('Kod olish'));
    expect(find.text('Kodni kiriting'), findsOneWidget);
    expect(find.textContaining('+998 90 111 22 33'), findsOneWidget);

    // Kod Telegram orqali keladi; bot ulanmagan test muhitida tugma kodni
    // ko'rsatadi, tashqi ilovani ochmaydi.
    expect(
      find.text('Botda «Raqamni ulashish» tugmasini bosing'),
      findsOneWidget,
    );
    await _tap(tester, find.text('Telegram\'ni ochish'));
    expect(find.textContaining('bot hali ulanmagan'), findsOneWidget);
    // Xabar o'zi yopilguncha kutamiz — u pastdagi tugmalarni yopib turadi.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(find.textContaining('bot hali ulanmagan'), findsNothing);

    // Noto'g'ri kod.
    await tester.enterText(find.byType(TextField), '000000');
    await tester.pumpAndSettle();
    expect(find.textContaining('Kod noto\'g\'ri'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '123456');
    await tester.pumpAndSettle();
    expect(find.text('Ro\'yxatdan o\'tish'), findsOneWidget);

    // Yosh chegarasi.
    await tester.enterText(find.byType(TextField).at(0), 'Aziza');
    await tester.enterText(find.byType(TextField).at(1), 'Valiyeva');
    await tester.enterText(find.byType(TextField).at(2), '16');
    await _tap(tester, find.text('Davom etish'));
    expect(find.textContaining('18 yoshdan'), findsOneWidget);

    await tester.enterText(find.byType(TextField).at(2), '22');
    await _tap(tester, find.text('Davom etish'));
    expect(find.text('Ma\'lumotlar to\'g\'rimi?'), findsOneWidget);
    await _tap(tester, find.text('Tasdiqlash'));

    // Rozilik bermasdan davom etib bo'lmaydi.
    expect(find.text('Tanlov qoidalari'), findsOneWidget);
    await _tap(tester, find.text('Davom etish'));
    expect(find.text('Tanlov qoidalari'), findsOneWidget);
    expect(find.textContaining('Salom'), findsNothing);

    await _tap(tester, find.byType(Checkbox));
    await _tap(tester, find.text('Davom etish'));
    expect(find.text('Salom, Aziza'), findsOneWidget);
  });

  testWidgets('guest sees rating but must log in for other sections', (
    tester,
  ) async {
    await _pumpApp(tester, signedIn: false);

    await _tap(tester, find.text('Mehmon sifatida ko\'rish'));
    expect(find.text('Reyting'), findsWidgets);
    expect(find.text('Dilnoza Rahimova'), findsWidgets);

    await _tap(tester, find.byKey(const Key('nav-reel')));
    expect(find.text('Ro\'yxatdan o\'ting'), findsOneWidget);
    expect(find.text('Reel linkini yuboring'), findsNothing);
  });

  testWidgets('support: existing ticket is closed, new ticket can be sent', (
    tester,
  ) async {
    await _pumpApp(tester);

    await _tap(tester, find.byKey(const Key('nav-profile')));
    await _tap(tester, find.text('Support'));
    expect(find.text('Yopilgan'), findsOneWidget);

    await _tap(tester, find.text('Yangi murojaat'));
    await tester.enterText(find.byType(TextField), 'Videom reytingda yo\'q');
    await _tap(tester, find.byTooltip('Yuborish'));
    expect(find.text('Videom reytingda yo\'q'), findsOneWidget);

    await _tap(tester, find.byTooltip('Orqaga'));
    expect(find.text('Yangi'), findsOneWidget);
    expect(find.text('Videom reytingda yo\'q'), findsOneWidget);
  });

  testWidgets('winner screen: pending and announced states', (tester) async {
    await _pumpApp(tester);
    await _tap(tester, find.byTooltip('G\'olib'));
    expect(find.text('G\'olib hali e\'lon qilinmagan'), findsOneWidget);
  });

  testWidgets('winner screen shows the winner once announced', (tester) async {
    await _pumpApp(tester, winnerAnnounced: true);
    await _tap(tester, find.byTooltip('G\'olib'));
    expect(find.text('Tabriklaymiz!'), findsOneWidget);
    expect(find.text('Avtomobil sohibi'), findsOneWidget);
    expect(find.text('1 482 930 ko\'rish'), findsOneWidget);
  });

  testWidgets('deleting the account returns to the welcome screen', (
    tester,
  ) async {
    final repo = await _pumpApp(tester);

    await _tap(tester, find.byKey(const Key('nav-profile')));
    await _tap(tester, find.text('Akkauntni o\'chirish'));
    expect(find.text('Akkaunt o\'chirilsinmi?'), findsOneWidget);

    // Bekor qilinsa, hech narsa o'zgarmaydi.
    await _tap(tester, find.text('Bekor qilish'));
    expect(repo.initialStage, SessionStage.active);

    await _tap(tester, find.text('Akkauntni o\'chirish'));
    await _tap(tester, find.text('O\'chirish'));
    expect(find.text('Mehmon sifatida ko\'rish'), findsOneWidget);
    expect(repo.initialStage, SessionStage.signedOut);
  });

  test('redirects follow the session stage', () {
    expect(redirectFor(SessionStage.signedOut, '/'), '/welcome');
    expect(redirectFor(SessionStage.signedOut, '/login'), isNull);
    expect(redirectFor(SessionStage.guest, '/'), isNull);
    expect(redirectFor(SessionStage.guest, '/support'), '/login');
    expect(redirectFor(SessionStage.guest, '/register'), '/');
    expect(redirectFor(SessionStage.needsRegistration, '/'), '/register');
    expect(redirectFor(SessionStage.needsConsent, '/reel'), '/consent');
    expect(redirectFor(SessionStage.active, '/otp'), '/');
    expect(redirectFor(SessionStage.active, '/support/t1'), isNull);
  });

  test(
    'code request returns a challenge without the phone in the link',
    () async {
      final repo = MockContestRepository(latency: Duration.zero);
      final challenge = await repo.requestOtp('+998901112233');
      expect(challenge.phone, '+998901112233');
      // Test muhitida bot nomi berilmagan — havola yo'q.
      expect(challenge.telegramUrl, isNull);
      await expectLater(
        repo.requestOtp('12345'),
        throwsA(isA<AuthException>()),
      );
    },
  );

  test('profile cannot be registered twice', () async {
    final repo = MockContestRepository(latency: Duration.zero, signedIn: true);
    await expectLater(
      repo.register(firstName: 'Boshqa', lastName: 'Odam', age: 30),
      throwsA(isA<AuthException>()),
    );
    expect((await repo.profile())?.firstName, 'Usmon');
  });

  test('daily gains are differences between snapshots', () {
    final reel = MyReel(
      url: 'u',
      shortcode: 's',
      status: ReelStatus.accepted,
      totalViews: 150,
      rank: 1,
      deltaRank: 0,
      history: [
        ViewsSnapshot(day: DateTime(2026, 11, 15), totalViews: 100),
        ViewsSnapshot(day: DateTime(2026, 11, 16), totalViews: 120),
        ViewsSnapshot(day: DateTime(2026, 11, 17), totalViews: 150),
      ],
      lastSyncedAt: null,
    );
    expect(reel.dailyGains.map((g) => g.views), [20, 30]);
    expect(reel.todayGain, 30);
  });
}
