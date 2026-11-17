import 'package:material_ui/material_ui.dart';

import '../../app/router.dart';
import '../../theme/app_theme.dart';
import '../../widgets/sub_page.dart';

/// Kirish va ro'yxatdan o'tish ekranlari uchun umumiy joylashuv.
class AuthPage extends StatelessWidget {
  const AuthPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    this.showBack = true,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SubPage(
      showBack: showBack,
      fallbackLocation: AppRoutes.welcome,
      body: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          12,
          AppSpacing.page,
          24,
        ),
        children: [
          Text(title, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.muted),
          ),
          const SizedBox(height: 24),
          ...children,
        ],
      ),
    );
  }
}
