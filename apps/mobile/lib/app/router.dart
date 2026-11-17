import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_screen.dart';
import '../features/auth/otp_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/welcome_screen.dart';
import '../features/contest/models.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/rating/rating_screen.dart';
import '../features/reels/my_reel_screen.dart';
import '../features/rules/rules_screen.dart';
import '../features/support/support_chat_screen.dart';
import '../features/support/support_list_screen.dart';
import '../features/winner/winner_screen.dart';
import 'shell.dart';

abstract final class AppRoutes {
  static const welcome = '/welcome';
  static const login = '/login';
  static const otp = '/otp';
  static const register = '/register';
  static const consent = '/consent';

  static const rating = '/';
  static const myReel = '/reel';
  static const notifications = '/notifications';
  static const profile = '/profile';

  static const rules = '/rules';
  static const winner = '/winner';
  static const support = '/support';
  static const supportNew = '/support/new';
  static String supportTicket(String id) => '/support/$id';
}

const _authFlow = {AppRoutes.welcome, AppRoutes.login, AppRoutes.otp};
const _onboarding = {AppRoutes.register, AppRoutes.consent};

/// Sessiya bosqichiga qarab yo'naltirish. null — joyida qoladi.
String? redirectFor(SessionStage stage, String location) {
  switch (stage) {
    case SessionStage.signedOut:
      return _authFlow.contains(location) ? null : AppRoutes.welcome;
    case SessionStage.guest:
      if (_onboarding.contains(location)) return AppRoutes.rating;
      if (location.startsWith(AppRoutes.support)) return AppRoutes.login;
      return null;
    case SessionStage.needsRegistration:
      return location == AppRoutes.register ? null : AppRoutes.register;
    case SessionStage.needsConsent:
      return location == AppRoutes.consent ? null : AppRoutes.consent;
    case SessionStage.active:
      return _authFlow.contains(location) || _onboarding.contains(location)
          ? AppRoutes.rating
          : null;
  }
}

GoRouter buildRouter(ValueListenable<SessionStage> session) {
  return GoRouter(
    initialLocation: AppRoutes.rating,
    refreshListenable: session,
    redirect: (context, state) =>
        redirectFor(session.value, state.matchedLocation),
    routes: [
      GoRoute(
        path: AppRoutes.welcome,
        builder: (context, state) => const WelcomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.otp,
        builder: (context, state) {
          final challenge = state.extra;
          return challenge is OtpChallenge
              ? OtpScreen(challenge: challenge)
              : const LoginScreen();
        },
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: AppRoutes.consent,
        builder: (context, state) => const RulesScreen(requireConsent: true),
      ),
      GoRoute(
        path: AppRoutes.rules,
        builder: (context, state) => const RulesScreen(),
      ),
      GoRoute(
        path: AppRoutes.winner,
        builder: (context, state) => const WinnerScreen(),
      ),
      GoRoute(
        path: AppRoutes.support,
        builder: (context, state) => const SupportListScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const SupportChatScreen(),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                SupportChatScreen(ticketId: state.pathParameters['id']),
          ),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.rating,
                builder: (context, state) => const RatingScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.myReel,
                builder: (context, state) => const MyReelScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.notifications,
                builder: (context, state) => const NotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
