import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../app/router.dart';
import '../l10n/app_localizations.dart';
import '../theme/app_theme.dart';
import 'app_card.dart';
import 'pill_button.dart';

/// Mehmon uchun: bo'limdan foydalanishga kirish taklifi.
class LoginPrompt extends StatelessWidget {
  const LoginPrompt({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.loginRequiredTitle, style: theme.textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            l10n.loginRequiredBody,
            style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.muted),
          ),
          const SizedBox(height: 16),
          PillButton(
            label: l10n.welcomeLogin,
            icon: Icons.arrow_forward,
            onPressed: () => context.push(AppRoutes.login),
          ),
        ],
      ),
    );
  }
}
