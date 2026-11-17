import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/router.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/pill_button.dart';
import '../../widgets/prize_car_hero.dart';
import '../contest/providers.dart';

class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            12,
            AppSpacing.page,
            16,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: PrizeCarHero(
                  title: l10n.welcomeHeroTitle,
                  body: l10n.welcomeHeroBody,
                ),
              ),
              const SizedBox(height: 20),
              PillButton(
                label: l10n.welcomeLogin,
                icon: Icons.arrow_forward,
                onPressed: () => context.push(AppRoutes.login),
              ),
              const SizedBox(height: 4),
              TextButton(
                onPressed: () {
                  ref.read(sessionProvider.notifier).continueAsGuest();
                  context.go(AppRoutes.rating);
                },
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.ink,
                  minimumSize: const Size.fromHeight(48),
                ),
                child: Text(l10n.welcomeGuest),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
