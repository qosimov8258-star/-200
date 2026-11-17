import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../features/contest/providers.dart';
import '../l10n/app_localizations.dart';
import '../widgets/glass_nav_bar.dart';

/// Pastki suzuvchi shisha menyu bilan ilova qobig'i.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _go(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final unread =
        ref.watch(notificationsProvider).value?.where((n) => !n.read).length ??
        0;

    return Scaffold(
      // Kontent menyu ostidan o'tadi — shisha orqali xiralashib ko'rinadi.
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: GlassNavBar(
            currentIndex: navigationShell.currentIndex,
            onSelected: _go,
            items: [
              GlassNavItem(
                key: const Key('nav-home'),
                icon: Icons.home_outlined,
                activeIcon: Icons.home_rounded,
                label: l10n.navHome,
              ),
              GlassNavItem(
                key: const Key('nav-reel'),
                icon: Icons.play_circle_outline,
                activeIcon: Icons.play_circle_rounded,
                label: l10n.navReel,
              ),
              GlassNavItem(
                key: const Key('nav-notifications'),
                icon: Icons.notifications_none_rounded,
                activeIcon: Icons.notifications_rounded,
                label: l10n.navNotificationsShort,
                semanticLabel: l10n.navNotifications,
                badge: unread,
              ),
              GlassNavItem(
                key: const Key('nav-profile'),
                icon: Icons.person_outline_rounded,
                activeIcon: Icons.person_rounded,
                label: l10n.navProfile,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
