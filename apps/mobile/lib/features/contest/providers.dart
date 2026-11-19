import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'contest_repository.dart';
import 'models.dart';

/// `--dart-define=DEMO_SESSION=true` — kirilgan, videosi bor namunaviy holatda
/// ochiladi (do'kon skrinshotlarini olish uchun). Odatda o'chiq.
const _demoSession = bool.fromEnvironment('DEMO_SESSION');

final contestRepositoryProvider = Provider<ContestRepository>(
  (ref) => MockContestRepository(demo: _demoSession),
);

/// Sessiya bosqichi. Router shu qiymatga qarab yo'naltiradi; foydalanuvchiga
/// bog'liq providerlar uni kuzatadi va kirish/chiqishda yangilanadi.
final sessionProvider = NotifierProvider<SessionNotifier, SessionStage>(
  SessionNotifier.new,
);

class SessionNotifier extends Notifier<SessionStage> {
  ContestRepository get _repo => ref.read(contestRepositoryProvider);

  @override
  SessionStage build() => ref.watch(contestRepositoryProvider).initialStage;

  void continueAsGuest() => state = SessionStage.guest;

  Future<OtpChallenge> requestOtp(String phone) => _repo.requestOtp(phone);

  Future<void> verifyOtp(String phone, String code) async {
    state = await _repo.verifyOtp(phone, code);
  }

  Future<void> register({
    required String firstName,
    required String lastName,
    required int age,
  }) async {
    await _repo.register(firstName: firstName, lastName: lastName, age: age);
    state = SessionStage.needsConsent;
  }

  Future<void> acceptRules(int version) async {
    await _repo.acceptRules(version);
    state = SessionStage.active;
  }

  Future<void> logout() async {
    await _repo.logout();
    state = SessionStage.signedOut;
  }

  Future<void> deleteAccount() async {
    await _repo.deleteAccount();
    state = SessionStage.signedOut;
  }
}

final contestInfoProvider = FutureProvider<ContestInfo>(
  (ref) => ref.watch(contestRepositoryProvider).contest(),
);

final rulesProvider = FutureProvider<ContestRules>(
  (ref) => ref.watch(contestRepositoryProvider).rules(),
);

final winnerProvider = FutureProvider<Winner?>(
  (ref) => ref.watch(contestRepositoryProvider).winner(),
);

final profileProvider = FutureProvider<Profile?>((ref) {
  ref.watch(sessionProvider);
  return ref.watch(contestRepositoryProvider).profile();
});

final ratingProvider = FutureProvider<List<RatingEntry>>((ref) {
  ref.watch(sessionProvider);
  return ref.watch(contestRepositoryProvider).rating();
});

final notificationsProvider =
    AsyncNotifierProvider<NotificationsNotifier, List<AppNotification>>(
      NotificationsNotifier.new,
    );

class NotificationsNotifier extends AsyncNotifier<List<AppNotification>> {
  @override
  Future<List<AppNotification>> build() {
    ref.watch(sessionProvider);
    return ref.watch(contestRepositoryProvider).notifications();
  }

  /// Bitta xabarni o'qilgan deb belgilaydi. Ekran darhol yangilanadi;
  /// server xato qaytarsa, ro'yxat serverdan qayta olinadi.
  Future<void> markRead(String id) async {
    final current = state.value;
    if (current == null || !current.any((n) => n.id == id && !n.read)) return;
    state = AsyncData([
      for (final n in current) n.id == id ? n.markedRead() : n,
    ]);
    try {
      await ref.read(contestRepositoryProvider).markNotificationRead(id);
    } on Exception {
      ref.invalidateSelf();
    }
  }

  Future<void> markAllRead() async {
    final current = state.value;
    if (current == null || current.every((n) => n.read)) return;
    state = AsyncData([for (final n in current) n.markedRead()]);
    try {
      await ref.read(contestRepositoryProvider).markAllNotificationsRead();
    } on Exception {
      ref.invalidateSelf();
    }
  }
}

final supportTicketsProvider = FutureProvider<List<SupportTicket>>((ref) {
  ref.watch(sessionProvider);
  return ref.watch(contestRepositoryProvider).supportTickets();
});

final supportMessagesProvider =
    FutureProvider.family<List<SupportMessage>, String>(
      (ref, ticketId) =>
          ref.watch(contestRepositoryProvider).supportMessages(ticketId),
    );

final myReelProvider = AsyncNotifierProvider<MyReelNotifier, MyReel?>(
  MyReelNotifier.new,
);

class MyReelNotifier extends AsyncNotifier<MyReel?> {
  @override
  Future<MyReel?> build() {
    ref.watch(sessionProvider);
    return ref.watch(contestRepositoryProvider).myReel();
  }

  /// Linkni yuboradi. Xatoda [ReelSubmitException] otadi — forma ko'rsatadi.
  Future<void> submit(String url) async {
    final reel = await ref.read(contestRepositoryProvider).submitReel(url);
    state = AsyncData(reel);
    // Ishtirokchi endi reytingda ko'rinadi.
    ref.invalidate(ratingProvider);
  }
}
